#!/usr/bin/env python3
"""Check every expected XYZ tile, clipping, manifest sizes, and static assets."""
import json
from pathlib import Path
import sys

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from prepare_data import HALF, tile_range

root = Path(__file__).resolve().parents[1]
site = root/'site'
config = json.loads((site/'data/layers.json').read_text())
from osgeo import ogr
ds = ogr.Open(str(root.parent/'Boundaries.gpkg'), 0)
extent = ds.GetLayerByName('Map Boundary').GetExtent()
assert config['defaultTop'] == 'site-plan-1956'
assert config['defaultBottom'] == 'nyc-2024'
assert len({l['id'] for l in config['layers']}) == len(config['layers'])
assert [l['year'] for l in config['layers']] == sorted(l['year'] for l in config['layers'])
total_tiles = total_bytes = 0
for layer in config['layers']:
    count = size = 0
    for z in range(config['minZoom'], layer['maxNativeZoom'] + 1):
        x0, x1, y0, y1 = tile_range(extent, z)
        for x in range(x0, x1+1):
            for y in range(y0, y1+1):
                tile = site/layer['url'].format(z=z, x=x, y=y)
                assert tile.is_file(), f'Missing {tile}'
                with Image.open(tile) as image:
                    assert image.size == (256, 256), tile
                    # WebP drops the redundant alpha channel on fully opaque tiles.
                    assert image.mode in ('RGB', 'RGBA'), tile
                    image.verify()
                size += tile.stat().st_size
                count += 1
        # Corners of the tile grid must have transparent pixels beyond the boundary.
        corner = site/layer['url'].format(z=z, x=x0, y=y0)
        with Image.open(corner) as image:
            assert image.getpixel((0, 0))[3] == 0, f'Unclipped outer corner: {corner}'
    assert count == layer['tileCount'], (layer['id'], count, layer['tileCount'])
    assert size == layer['bytes']
    total_tiles += count
    total_bytes += size
    print(f"{layer['id']}: {count} verified tiles, {size/1024**2:.1f} MiB")
for file in ['index.html','style.css','app.js','vendor/leaflet/leaflet.js','vendor/leaflet/leaflet.css','vendor/leaflet/LICENSE','.nojekyll']:
    assert (site/file).is_file(), file
for file in ['urban-renewal.geojson', 'map-boundary.geojson']:
    vector = json.loads((site/'data'/file).read_text())
    assert vector['type'] == 'FeatureCollection'
    assert len(vector['features']) == 1
    coords = vector['features'][0]['geometry']['coordinates'][0]
    assert all(-75 < x < -73 and 40 < y < 42 for x, y in coords), 'Expected longitude, latitude'
assert max(p.stat().st_size for p in site.rglob('*') if p.is_file()) < 100*1024**2
print(f'PASS: {len(config["layers"])} layers, {total_tiles} tiles, {total_bytes/1024**2:.1f} MiB')
