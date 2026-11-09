#!/usr/bin/env python3
"""Prepare a bounded, self-contained XYZ tile archive. Originals are read only."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import io
import json
import math
from pathlib import Path
import time
import urllib.request
import zipfile
import xml.etree.ElementTree as ET

import numpy as np
from osgeo import gdal, ogr, osr
from PIL import Image, ImageDraw, ImageOps

gdal.UseExceptions()
ogr.UseExceptions()
ROOT = Path(__file__).resolve().parents[1]
HALF = 20037508.342789244
MIN_ZOOM = 14


def fetch(url):
    for attempt in range(5):
        try:
            with urllib.request.urlopen(url, timeout=60) as response:
                return response.read()
        except Exception:
            if attempt == 4:
                raise
            time.sleep(2 ** attempt)


def tile_range(extent, z):
    left, right, bottom, top = extent
    span = HALF * 2 / (2 ** z)
    return (math.floor((left + HALF) / span), math.ceil((right + HALF) / span) - 1,
            math.floor((HALF - top) / span), math.ceil((HALF - bottom) / span) - 1)


def path_for(folder, z, x, y):
    return folder / str(z) / str(x) / f'{y}.webp'


def save_tile(image, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, 'WEBP', lossless=True, method=4)


def export_vector(layer):
    source_srs = layer.GetSpatialRef()
    target = osr.SpatialReference()
    target.ImportFromEPSG(4326)
    source_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    target.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    transform = osr.CoordinateTransformation(source_srs, target)
    features = []
    layer.ResetReading()
    for feature in layer:
        geom = feature.GetGeometryRef().Clone()
        geom.Transform(transform)
        features.append({'type': 'Feature', 'properties': {}, 'geometry': json.loads(geom.ExportToJson())})
    return {'type': 'FeatureCollection', 'features': features}


def pyramid(folder, extent, max_zoom):
    for z in range(max_zoom - 1, MIN_ZOOM - 1, -1):
        x0, x1, y0, y1 = tile_range(extent, z)
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                parent = Image.new('RGBA', (512, 512))
                for dx in (0, 1):
                    for dy in (0, 1):
                        child = path_for(folder, z + 1, 2*x + dx, 2*y + dy)
                        if child.exists():
                            with Image.open(child) as im:
                                parent.paste(im, (dx*256, dy*256))
                save_tile(parent.resize((256, 256), Image.Resampling.LANCZOS), path_for(folder, z, x, y))


def prepare_local(source, folder, extent, max_zoom, gpkg):
    x0, x1, y0, y1 = tile_range(extent, max_zoom)
    span = HALF * 2 / 2 ** max_zoom
    original = gdal.Open(str(source), gdal.GA_ReadOnly)
    pixels = original.ReadAsArray()
    if pixels.ndim == 2:
        pixels = pixels[np.newaxis, ...]
    # Only remove zero-valued padding connected to the outside of the scan.
    # Treating every black pixel as nodata would erase black text and dark roofs.
    zeros = np.all(pixels == 0, axis=0)
    mask = ImageOps.expand(Image.fromarray(np.where(zeros, 0, 255).astype('uint8')), border=1, fill=0)
    ImageDraw.floodfill(mask, (0, 0), 128)
    alpha = np.where(np.asarray(mask)[1:-1, 1:-1] == 128, 0, 255).astype('uint8')
    prepared = gdal.GetDriverByName('MEM').Create('', original.RasterXSize, original.RasterYSize, pixels.shape[0]+1, gdal.GDT_Byte)
    prepared.SetGeoTransform(original.GetGeoTransform())
    prepared.SetProjection(original.GetProjection())
    for i, band in enumerate(pixels, 1):
        prepared.GetRasterBand(i).WriteArray(band)
        prepared.GetRasterBand(i).SetColorInterpretation(original.GetRasterBand(i).GetColorInterpretation())
    prepared.GetRasterBand(pixels.shape[0]+1).WriteArray(alpha)
    prepared.GetRasterBand(pixels.shape[0]+1).SetColorInterpretation(gdal.GCI_AlphaBand)
    # A virtual warp reads the in-memory copy; source files remain read only.
    warped = gdal.Warp('', prepared, format='VRT', dstSRS='EPSG:3857',
        outputBounds=(x0*span-HALF, HALF-(y1+1)*span, (x1+1)*span-HALF, HALF-y0*span),
        width=(x1-x0+1)*256, height=(y1-y0+1)*256,
        cutlineDSName=str(gpkg), cutlineLayer='Map Boundary', dstAlpha=True,
        resampleAlg='bilinear')
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            data = warped.ReadAsArray((x-x0)*256, (y-y0)*256, 256, 256)
            if data.shape[0] == 2:
                data = np.stack([data[0], data[0], data[0], data[1]])
            save_tile(Image.fromarray(np.moveaxis(data, 0, 2).astype('uint8')), path_for(folder, max_zoom, x, y))
    warped = None


def prepare_service(url, folder, extent, max_zoom, polygon, cache, workers):
    x0, x1, y0, y1 = tile_range(extent, max_zoom)
    span = HALF * 2 / 2 ** max_zoom
    cache.mkdir(parents=True, exist_ok=True)
    def download(coord):
        x, y = coord
        cached = cache / f'{max_zoom}-{x}-{y}.bin'
        if not cached.exists():
            raw = fetch(f'{url}/tile/{max_zoom}/{y}/{x}')
            # ArcGIS can return a JSON error with HTTP 200; verify before caching.
            with Image.open(io.BytesIO(raw)) as im:
                if im.size != (256, 256):
                    raise ValueError(f'Unexpected tile size: {url}, {x}, {y}')
                im.load()
            cached.write_bytes(raw)
        with Image.open(cached) as im:
            tile = im.convert('RGBA')
        mask = Image.new('L', (256, 256))
        points = [((px + HALF - x*span)*256/span, (HALF - py - y*span)*256/span) for px, py in polygon]
        ImageDraw.Draw(mask).polygon(points, fill=255)
        tile.putalpha(Image.fromarray(np.minimum(np.asarray(tile.getchannel('A')), np.asarray(mask))))
        save_tile(tile, path_for(folder, max_zoom, x, y))
    coords = [(x, y) for x in range(x0, x1+1) for y in range(y0, y1+1)]
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(download, coord) for coord in coords]
        for i, future in enumerate(as_completed(futures), 1):
            future.result()
            if i % 200 == 0:
                print(f'  {i}/{len(coords)} source tiles', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, default=ROOT.parent)
    parser.add_argument('--only', nargs='*', help='Build only these layer IDs')
    parser.add_argument('--workers', type=int, default=6)
    args = parser.parse_args()
    src = args.source_dir.resolve()
    config = json.loads((ROOT/'tools/sources.json').read_text())
    site = ROOT/'site'
    data_dir = site/'data'
    data_dir.mkdir(parents=True, exist_ok=True)
    gpkg = src/'Boundaries.gpkg'
    ds = ogr.Open(str(gpkg), 0)
    boundary = ds.GetLayerByName('Map Boundary')
    extent = boundary.GetExtent(force=1)
    boundary.ResetReading()
    boundary_feature = boundary.GetNextFeature()
    polygon = json.loads(boundary_feature.GetGeometryRef().ExportToJson())['coordinates'][0]
    # Record the actual QGIS layer list without extracting or rewriting the project.
    with zipfile.ZipFile(src/'Day08-Utopia.qgz') as project:
        xml = ET.fromstring(project.read(next(n for n in project.namelist() if n.endswith('.qgs'))))
    inventory = [{'name': l.findtext('layername'), 'provider': l.findtext('provider'),
                  'source': l.findtext('datasource'), 'crs': l.findtext('srs/spatialrefsys/authid')}
                 for l in xml.findall('.//projectlayers/maplayer')]
    (data_dir/'project-inventory.json').write_text(json.dumps(inventory, indent=2)+'\n')
    for name, filename in [('Map Boundary','map-boundary.geojson'), ('UrbanRenewalArea','urban-renewal.geojson')]:
        (data_dir/filename).write_text(json.dumps(export_vector(ds.GetLayerByName(name)))+'\n')
    ll = json.loads((data_dir/'map-boundary.geojson').read_text())['features'][0]['geometry']['coordinates'][0]
    bounds = [[min(p[1] for p in ll), min(p[0] for p in ll)], [max(p[1] for p in ll), max(p[0] for p in ll)]]
    manifest = {'bounds': bounds, 'minZoom': MIN_ZOOM, 'maxZoom': 21,
                'defaultTop': 'site-plan-1956', 'defaultBottom': 'nyc-2024', 'layers': []}
    for layer in config:
        folder = site/'tiles'/layer['id']
        if args.only is None or layer['id'] in args.only:
            print(f"Preparing {layer['label']} (native zoom {layer['maxNativeZoom']})", flush=True)
            if 'file' in layer:
                prepare_local(src/layer['file'], folder, extent, layer['maxNativeZoom'], gpkg)
            else:
                metadata = json.loads(fetch(layer['sourceUrl']+'?f=pjson'))
                cache = ROOT/'.cache'/layer['id']
                cache.mkdir(parents=True, exist_ok=True)
                (cache/'service-metadata.json').write_text(json.dumps(metadata, indent=2)+'\n')
                prepare_service(layer['sourceUrl'], folder, extent, layer['maxNativeZoom'], polygon, cache, args.workers)
            pyramid(folder, extent, layer['maxNativeZoom'])
        public = {k:v for k,v in layer.items() if k != 'file'}
        public['url'] = f"tiles/{layer['id']}/{{z}}/{{x}}/{{y}}.webp"
        public['tileCount'] = sum(1 for _ in folder.rglob('*.webp'))
        public['bytes'] = sum(p.stat().st_size for p in folder.rglob('*.webp'))
        manifest['layers'].append(public)
    (data_dir/'layers.json').write_text(json.dumps(manifest, indent=2)+'\n')
    print('Ready:', site, flush=True)


if __name__ == '__main__':
    main()
