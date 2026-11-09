# The Remaking of Lincoln Square

A static Leaflet map comparing eight historical plans and aerial images, 1924–2024. The default is the restored color **1956 site plan over 2024 orthophotography**, at 55% top-layer opacity. Both dropdowns offer every layer in chronological order. The red urban renewal outline starts on by default; uncheck its box to hide it. The map is rotated **90° clockwise**, with a simple compass pointing north (right on screen). Imagery and the vector boundary share the same rotation. The centered map and content use 75% of the page width on desktop and the available width on phones. Intrinsically sized native dropdowns and the boundary checkbox form a compact left-aligned row that wraps as needed on phones. Map 1 is drawn over Map 2: move the slider **left for Map 1, right for Map 2**. The labels and direction stay fixed when selections change. The initial slider position is 45, equivalent to 55% Map 1 opacity. The page uses browser-default typography and native controls with standard unvisited-link blue (#0000ee) on the slider and boundary checkbox. The title and author precede the map; the supplied project description, Sources, and Methodology follow the controls and a horizontal rule. Edit these ordinary HTML sections in `site/index.html`. The map container matches the rotated study-area aspect ratio, with continuous overview fitting and 8 px padding to minimize gray margins without cropping. On very narrow phones, a minimum map height keeps navigation usable.

The ready-to-publish website is **`site/`**. It needs no build, backend, API key, remote imagery service, or CDN. Leaflet 1.9.4 and leaflet-rotate 0.5.3 are included locally with their licenses. The rotation plugin’s corresponding unmodified source is included in `site/vendor/leaflet-rotate/src/`; its license is GPL-3.0. It is compatible with the included Leaflet 1.9 version. No npm installation is needed to serve or deploy the site. All paths are relative, including tiles, so GitHub Pages repository subpaths work.

## Test locally

From this `lincoln-square-viewer` directory:

```bash
python3 -m http.server 8000 --directory site
```

Open **http://localhost:8000**. Stop the server with Ctrl+C. Python is only an optional local file server: it does not process requests for the application, run GIS work, or generate imagery. Any ordinary static HTTP server can replace it. GitHub Pages serves these same files directly, without Python. Use an HTTP server rather than opening `index.html` directly, because the map loads JSON files with `fetch`.

Select two images, blend them, and toggle the red outline. Drag to pan or pinch/scroll to zoom. Zoom out to the minimum to return to the full-area overview. There are no swap or fit buttons. Rotation is fixed: touch rotation, shift-wheel rotation, pitch, and the plugin’s rotation control are disabled, preserving normal pinch and scroll zoom. Source credits update with the selected images. The Sources section contains the supplied citations. The range uses 0.1% increments for dragging and keyboard input. Hover and turn the mouse wheel for faster adjustment: a typical notch moves 5% (50 times the previous wheel increment), down toward Map 2 and up toward Map 1. Small trackpad deltas remain finer, and each event is capped at 5%. Pointer gestures explicitly preserve the current value when grabbing the thumb and apply relative movement while dragging, with pointer capture so releases outside the slider cannot leave dragging active. Track clicks and keyboard Home/End can still intentionally select the endpoints. Wheel events over the slider do not scroll the page or zoom the map. Opacity is applied to the complete Map 1 pane, separately from Leaflet’s per-tile loading fades, and never rebuilds layers during blending.

## Publish to GitHub Pages

The existing local repository is connected to **https://github.com/jmarkey2/lincoln-square-maps** on branch `main`. No initial commit or push has been made. The repository root is this `lincoln-square-viewer` folder; do not commit its parent folder of GIS working data.

```text
.github/workflows/pages.yml   GitHub Pages deployment
.gitignore                   Working files and caches to exclude
.gitattributes               Text/binary handling
site/                        Complete static website and clipped tiles
raw-images/                  Downloadable source images and checksum manifest
tools/                       Offline preparation and validation
README.md                    Testing and publishing instructions
DATA_REPORT.md               Data preparation and validation notes
```

1. The GitHub repository was private when checked. **Make it public** in the repository settings if visitors should be able to download its source images without a GitHub login. GitHub Free supports Pages from public repositories; Pages from a private repository requires a supported paid plan. See [GitHub Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages). Changing repository visibility is left to the owner.
2. In **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**.
3. From this repository folder, create the initial commit and push:

   ```bash
   git add .
   git commit -m "Add Lincoln Square historical map viewer and source images"
   git push -u origin main
   ```

4. Open **Actions → Publish map to GitHub Pages**. If needed, run it manually after enabling Pages. Later pushes to `main` publish automatically.
5. After a successful deployment, the expected website address is **https://jmarkey2.github.io/lincoln-square-maps/**.

The workflow uploads only `site/`; it does not publish `raw-images/`, processing tools, or working data. The methodology links to the downloads in the GitHub repository. Keep this folder structure: the workflow expects `site/` at the repository root. The original QGIS project, GeoPackage, georeferenced rasters, and caches stay outside the repository or are ignored. The four deliberate image downloads in `raw-images/` are included; `.gitignore` explicitly permits its TIFFs. Every file is below GitHub's 100 MiB individual-file limit. No Git LFS is required. The USGS TIFFs exceed GitHub’s 25 MiB browser-upload limit, so use Git to push them. See [GitHub file limits](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github).

## Source image downloads

See [raw-images/README.md](raw-images/README.md) for the two original USGS TIFFs, the supplied development-plan PNG, and the restored site-plan JPEG. These are byte-for-byte copies of the supplied files before georeferencing and cropping. The restored JPEG is explicitly identified as an edited derivative, with a link to the untouched NYPL scan. [raw-images/manifest.json](raw-images/manifest.json) records filenames, sizes, provenance, and SHA-256 checksums. The copies total about **216 MiB**; the complete repository content is about **541 MiB**, while the published site remains about **325 MiB**. Download links will work for public visitors once the initial files are pushed and the repository is public.

For another static host, upload the contents of `site/` unchanged. No GitHub-specific code is used by the map.

## Static hosting compatibility and limitations

The runtime consists only of HTML, CSS, JavaScript, local JSON/GeoJSON, vendored Leaflet and its rotation plugin, and prepared WebP tiles. There are no server routes, API calls, databases, environment variables, or server-side dependencies. Python/GDAL are offline data preparation and validation tools only. The Pages workflow uploads `site/` directly, with no Python or GIS build step.

The complete published site is about **325 MiB**, including **8,429 tiles**. It is below GitHub Pages’ **1 GB published-site limit**; Pages also has a **100 GB/month soft bandwidth limit** and deployments time out after **10 minutes**. See [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits). Tiles load on demand for the selected maps and viewport, rather than downloading the entire collection. Extensive browsing or high traffic can still consume significant bandwidth. More imagery increases repository size; avoid committing repeated full tile rebuilds unnecessarily because Git retains old versions.

All runtime asset URLs are relative to the page, including Leaflet’s internal image references. Browser QA checks a repository-style `/lincoln-square/` path and rejects requests outside that path, failed requests, and external requests. The original ArcGIS services are needed only if you rebuild those prepared layers; source and credit links are ordinary links. There is no runtime external imagery dependency.

JavaScript, HTTP(S), and a browser with WebP support are required. Double-clicking `index.html` is insufficient because browser security restricts local JSON fetches. Prepared detail ends at each layer’s native tile zoom; further zooming enlarges those pixels. Actual publication still requires pushing this folder as the repository root and enabling the included GitHub Actions workflow as described above. Local checks verify static hosting behavior; no live GitHub deployment has been performed.

## What was prepared

See [DATA_REPORT.md](DATA_REPORT.md) for layer resolutions, tile counts, size, and geographic bounds. [site/data/project-inventory.json](site/data/project-inventory.json) records all layers read directly from `Day08-Utopia.qgz`, including contextual basemaps excluded from this historical comparison.

- **Map Boundary**, in `Boundaries.gpkg`, supplies the geographic footprint. Its actual polygon clips all layers; its longitude/latitude bounding box limits panning. The small nonrectangular edges are transparent. On wide screens the overview has neutral margins outside this footprint.
- **UrbanRenewalArea**, from the same GeoPackage, is exported as longitude/latitude GeoJSON. It draws above both imagery panes as a 2 px red outline, without fill.
- The four georeferenced TIFFs are used as supplied, in EPSG:3857. The unreferenced scans and earlier raw USGS TIFFs are excluded from the interactive layer list to avoid duplicates or misalignment; the supplied images are available separately in `raw-images/`.
- The four NYC ArcGIS services are sampled only over the map boundary. Historic service layers are packaged through zoom 19; the 2024 service through zoom 20. No citywide download is included. The map never requests the services at runtime.
- XYZ tiles are 256 px **lossless WebP**, with overviews down to zoom 14. Local rasters receive one bilinear warp to the chosen Web Mercator tile grid; overviews use Lanczos resampling. Service tiles retain their existing pixels and compression artifacts without another lossy encoding. Sampling beyond the original resolution does not add detail.
- Black padding connected to the outside of local scans is made transparent. Interior black text and image detail are retained. All other scan color and gray values are preserved through the warp; the QGIS renderers use RGB without contrast enhancement or a 0–255 grayscale stretch.
- The restored plan and 2024 imagery retain the highest prepared detail. Layers enlarge beyond their packaged maximum zoom, up to map zoom 21. This avoids storing redundant magnified tiles for the coarser aerials.

The original project and source files are opened read only. Processing outputs go into this new directory. No project edits, source overwrites, or source overviews/statistics are generated. Historic photographs can retain georeferencing error, camera perspective, or changes from restoration; this viewer preserves the supplied alignment rather than estimating a new one.

## Add or rebuild imagery

The complete prepared website is already included. Rebuilding is only needed after changing data.

The preparation script uses Python 3, GDAL/OGR, NumPy, and Pillow with WebP support. On Ubuntu, these are available through `python3-gdal`, `python3-numpy`, and `python3-pil`. Use the system Python that can import `osgeo`.

```bash
python3 tools/prepare_data.py --source-dir ".."
```

The default source directory is the parent of this repository, where the supplied project and GeoPackage live. Internet access is needed to fetch the NYC service tiles during preparation. Downloads use six workers, retries, and a reusable `.cache/` directory. Rebuilding never runs in the publishing workflow.

To rebuild one or more layers:

```bash
python3 tools/prepare_data.py --only site-plan-1956 nyc-2024
```

To add an 8-bit georeferenced raster:

1. Put the new source outside `site/` and add an entry to [tools/sources.json](tools/sources.json). Give it a unique `id`, `year`, `label`, `file` relative to the source directory, `credit`, `note`, and `maxNativeZoom`. An optional `sourceUrl` becomes a source link.
2. Choose a maximum tile zoom near the raster's pixel resolution. In Web Mercator, pixel size is `156543.033928 / 2^zoom` projected meters. Prefer the next finer zoom when preserving detail matters. For another ArcGIS XYZ service, use `sourceUrl` instead of `file` and verify its available levels.
3. Keep the config ordered chronologically and run `python3 tools/prepare_data.py --only YOUR-ID`. This exports its tiles and refreshes the manifest for all entries. To change the opening selection, edit `defaultTop` / `defaultBottom` in the preparation script and regenerate the manifest.
4. Test locally, then commit the updated `site/`, configuration, and any source documentation. Changing only `site/data/layers.json` is also sufficient to register tiles you have prepared separately with the same clipping and XYZ scheme.

The browser reads [site/data/layers.json](site/data/layers.json); there is no hardcoded layer list in the interface. `tools/sources.json` is the preparation source of truth, and `layers.json` is its generated public counterpart.

## Validation

Check every expected tile, image dimensions, boundary transparency, sizes, and GeoJSON coordinate order:

```bash
python3 tools/check_site.py
python3 tools/check_downloads.py
node --check site/app.js
```

`check_downloads.py` uses only Python’s standard library and verifies the download checksums, sizes, and methodology URLs. `check_site.py` requires the GIS packages and the original boundary GeoPackage in the parent directory. Browser checks use Playwright with system Chrome. With the local server running, an optional temporary installation avoids adding website dependencies:

```bash
npm install --prefix /tmp/lincoln-viewer-qa playwright
PLAYWRIGHT_MODULE=/tmp/lincoln-viewer-qa/node_modules/playwright node tools/browser_check.cjs
```

Set `CHROME_BIN` if Chrome is elsewhere. The checks exercise both dropdowns and all eight imagery layers, left/right blend endpoints and consistency after selection, the outline, compass direction, rendered tile and vector geographic alignment, mouse panning, wheel and touch-pinch zoom, geographic pan limits, overview fitting, prominent uncropped imagery, page structure, citations, native slider dragging, thumb presses at several positions and offsets, mouse and touch dragging, keyboard Home/End and arrow keys, faster wheel adjustments, the boundary-on default, standard hyperlink-blue accents, the unbolded challenge hyperlink, and mobile layouts. They also verify that both removed buttons remain absent and that full layer names fit the native selects. They reject browser errors, failed HTTP responses, external network requests, and requests outside the supplied URL’s base path. Layout checks cover desktop, 390 px mobile, and 320 px narrow screens. Screenshots go to ignored `test-results/`. To repeat the repository-subpath check, serve this folder’s parent and pass the nested site URL (the server root is deliberately above the page):

```bash
python3 -m http.server 8001 --directory ..
# In another terminal, from this folder:
PLAYWRIGHT_MODULE=/tmp/lincoln-viewer-qa/node_modules/playwright node tools/browser_check.cjs http://127.0.0.1:8001/lincoln-square-viewer/site/
```

## Attribution

NYC service credits and source links are in the layer manifest and the interface. The 1924 and 1951 service descriptions identify manual georeferencing and their supplying archives. USGS dates come from the supplied project/file names. The page’s Sources section now includes the user-supplied Lincoln Center and NYPL plan citations and the tentative historical report citation for the manually digitized boundary. The prepared manifest retains its original supplied-scan provenance notes; the website text records the more specific archive citations without rebuilding imagery. The boundaries come from the supplied GeoPackage. Leaflet's BSD license is included in `site/vendor/leaflet/LICENSE`. The unmodified [leaflet-rotate](https://github.com/Raruto/leaflet-rotate) distribution, source, notices, and GPL-3.0 license are included under `site/vendor/leaflet-rotate/`.
