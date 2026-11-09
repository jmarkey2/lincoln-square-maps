# Prepared geographic data

Prepared from `Day08-Utopia.qgz` and its sources on November 7, 2026.

## Coverage

- Longitude: -73.991817635 to -73.979809952
- Latitude: 40.767100434 to 40.781807530
- Geographic footprint: the actual `Map Boundary` polygon, not the urban renewal polygon.
- Tile projection: EPSG:3857; vector exports: EPSG:4326, longitude first.
- XYZ convention: north-origin rows, 256 × 256 pixels.

## Included layers

| Layer | Source pixel size (EPSG:3857 m) | Packaged maximum zoom | Tile pixel size (EPSG:3857 m) | Tiles | MiB |
|---|---:|---:|---:|---:|---:|
| 1924 · NYC aerial imagery | Service tiles | 19 | 0.2986 | 766 | 13.8 |
| 1951 · NYC aerial imagery | Service tiles | 19 | 0.2986 | 766 | 15.1 |
| 1956 · Development plan | 0.6294 | 18 | 0.5972 | 215 | 6.4 |
| 1956 · Site plan (restored color) | 0.2644 | 20 | 0.1493 | 2,818 | 91.6 |
| 1960 · USGS aerial (May 5) | 1.9660 | 17 | 1.1943 | 65 | 1.6 |
| 1966 · USGS aerial (February 23) | 0.7943 | 18 | 0.5972 | 215 | 5.2 |
| 1996 · NYC orthophotography | Service tiles | 19 | 0.2986 | 766 | 53.3 |
| 2024 · NYC orthophotography | Service tiles | 20 | 0.1493 | 2,818 | 137.7 |

**Total: 8,429 tiles; 324.8 MiB of imagery.** The browser loads only the visible tiles for the two selected layers, rather than downloading the archive.

Web Mercator projected meters are larger than ground meters at this latitude. Multiply pixel sizes by approximately 0.757 to estimate ground resolution. Service tile sampling is not a claim about the original photograph’s optical resolution.

## Inspection and processing notes

- QGIS contained 13 layers: eight historical comparison rasters, two vector boundaries, and three contextual OpenStreetMap basemap entries. The basemaps are excluded to keep the comparison geographically bounded and self-contained.
- Both 1956 scans have valid Web Mercator geotransforms. The restored color scan is 4,659 × 7,096 pixels; the development plan is 2,199 × 3,244 pixels. Both are included independently.
- USGS georeferenced rasters are 10,752 × 10,282 (1960) and 10,170 × 9,858 (1966). Only their small project-area windows are published. The raw, unreferenced source TIFFs are excluded.
- The remote URLs are those stored in QGIS. Service metadata and tile availability were inspected. The older layers are packaged at level 19, and 2024 at level 20, preserving more detail than the QGIS XYZ connections’ level-18 cap.
- The 2024 service describes its final NYC orthophotography at scales through 1:564 (level 20). Historical services describe manual georeferencing (1924/1951) and one-foot photography (1996).
- No contrast enhancement or recoloring was added. The provided restored plan remains a restored source. Interior black details are preserved; only exterior zero-valued scan padding and pixels outside the map boundary become transparent.
- The map boundary extends farther north than the 1956 plans. Transparent uncovered areas allow the bottom imagery to show through.
- All tiles, source inventory, manifests, and GeoJSON exports are new files beneath this website directory. Original data are not published by the workflow.

## Source references

- [1924 · NYC aerial imagery](https://tiles.arcgis.com/tiles/yG5s3afENB5iO9fj/arcgis/rest/services/Ortho_1924_Mosaic/MapServer) — NYC OTI / NYC Department of City Planning.
- [1951 · NYC aerial imagery](https://tiles.arcgis.com/tiles/yG5s3afENB5iO9fj/arcgis/rest/services/NYC_Orthos_1951/MapServer) — NYS DOS / NYC Department of Records Municipal Archives.
- [1960 · USGS aerial (May 5)](https://earthexplorer.usgs.gov/) — USGS · May 5, 1960 · project georeferencing.
- [1966 · USGS aerial (February 23)](https://earthexplorer.usgs.gov/) — USGS · February 23, 1966 · project georeferencing.
- [1996 · NYC orthophotography](https://tiles.arcgis.com/tiles/yG5s3afENB5iO9fj/arcgis/rest/services/Ortho_1996_Mosaic/MapServer) — NYC · 1996 orthophotography.
- [2024 · NYC orthophotography](https://tiles.arcgis.com/tiles/yG5s3afENB5iO9fj/arcgis/rest/services/NYC_Orthos_2024/MapServer) — NYC Office of Technology and Innovation · 2024 orthophotography.

## Verification

- All 8,429 expected tiles passed image, grid completeness, clipping-corner transparency, and manifest-size checks.
- Browser checks passed for all eight layers, default selections, left/right blend endpoints, the red outline, fixed 90° clockwise rotation, compass direction, rendered tile/vector geographic alignment, mouse panning, wheel/pinch zoom, geographic pan limits, fitting the complete extent, desktop-to-mobile resizing, full dropdown labels, compact wrapping controls, exact supplied page content, continuous native slider dragging, fine wheel adjustments, and overview prominence. Swap and fit buttons are removed. Map and controls are centered at 75% desktop width; controls wrap as needed on phones to preserve readable names. The container follows the rotated study-area aspect ratio; initial fitting uses continuous zoom and 8 px padding. There were no browser errors, HTTP failures, or external network requests.
- Screenshots of the desktop and 390 × 844 mobile layouts are in the local, ignored `test-results/` directory.
- SHA-256 checksums and modification times for all 23 original files remained unchanged across the corrected preparation run and final verification.

## Final interface validation

The page now presents the supplied title, author, project description, five source entries (six links), and methodology as ordinary HTML. The controls wrap on narrow screens; the boundary checkbox shares the dropdown row when space permits. The old introduction, disclosure, and percentage readout are removed.

The overview uses the rotated projected study-area aspect ratio, continuous fit zoom, and 8 px padding. Browser checks verify the full extent remains inside the viewport and occupies over 90% of both dimensions on desktop and 390 px mobile. The 90° clockwise rotation, compass, tile/vector alignment, and repository-relative asset loading remain verified.

Blending applies opacity to the completed imagery pane rather than invoking Leaflet’s per-tile fade update. Native range dragging and 0.1% wheel events were checked, including large wheel deltas and clamped endpoints. Screenshot pixel comparisons between the two endpoint images and their midpoint had a mean midpoint error of 0.194 on 0–255 RGB channels, versus an 82.912 mean difference between endpoints. Small 0.1% adjustments did not produce endpoint jumps. Ordinary 8-bit display rounding can make very small changes visually indistinguishable; the slider retains their numeric precision. No imagery preparation or original-data changes were needed.

## Slider pointer handling and default controls

The intermittent thumb-click reset was not reproduced by repeated native Chrome clicks at device pixel ratios 1, 1.25, and 2. The range now explicitly handles pointer presses and captured drags: grabbing the thumb leaves the value unchanged, dragging applies relative movement, and pointer release/cancellation clears the gesture. The native range appearance, keyboard controls, and accessible value remain. Wheel input now moves 5% per typical notch, with a per-event cap and smaller trackpad adjustments. The slider and checkbox use the standard CSS accent color light sky blue (#87cefa). The red geographic boundary starts enabled; its checkbox can still hide it. The challenge name is now a normal-weight hyperlink to https://30daymapchallenge.com/. Runtime JavaScript/CSS URLs carry a revision query to avoid reusing a previous implementation from browser caches.

## Repository preparation and downloads

The local `main` repository targets https://github.com/jmarkey2/lincoln-square-maps. The GitHub Pages workflow publishes only `site/`. Four byte-for-byte source-image copies are now in `raw-images/`, with provenance, sizes, and SHA-256 checksums. The 1960 and 1966 original USGS TIFFs are 98.24 and 95.56 MiB, respectively: both fit GitHub's 100 MiB regular-Git limit. The plan downloads are the supplied development PNG and the supplied restored JPEG; the untouched NYPL scan is linked separately. The methodology includes GitHub browse/download links. Controls now use #0000ee, standard unvisited HTML hyperlink blue.

The repository was private at inspection. Public download access requires public repository visibility and the initial push. No commit, push, visibility change, or deployment was performed as part of local preparation. Original geographic source files remain untouched.
