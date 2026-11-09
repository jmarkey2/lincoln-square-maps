# Source image downloads

These are byte-for-byte copies of the supplied source images, before GIS georeferencing and study-area clipping. They are separate from the prepared viewer tiles. Original files outside this repository were not modified.

| Image | Download | Size (MiB) | Notes |
| --- | --- | ---: | --- |
| USGS aerial photograph, May 5, 1960 | [Download](usgs/usgs-1960-05-05.tif?raw=1) | 98.24 | Original supplied TIFF; not georeferenced or cropped. |
| USGS aerial photograph, February 23, 1966 | [Download](usgs/usgs-1966-02-23.tif?raw=1) | 95.56 | Original supplied TIFF; not georeferenced or cropped. |
| Lincoln Square Development Plan, 1956 | [Download](site-plans/lincoln-square-development-plan-1956.png?raw=1) | 7.71 | Original supplied PNG; not georeferenced or cropped. |
| Lincoln Square Site Plan, May 28, 1956 (restored) | [Download](site-plans/lincoln-square-site-plan-restored-1956.jpg?raw=1) | 14.38 | Supplied restored JPEG, including the documented binding removal and page alignment; not the untouched NYPL scan. Not georeferenced or cropped. |

The **restored site plan is an edited derivative**, not the untouched NYPL scan. The [original NYPL scan (image 5038312)](https://images.nypl.org/index.php?id=5038312&t=u) remains available from the library. The project page describes the restoration.

USGS photographs were obtained through [EarthExplorer](https://earthexplorer.usgs.gov/). The development plan is credited to Lincoln Center for the Performing Arts via [Google Arts & Culture](https://artsandculture.google.com/story/fgUBTK2US70oKA?hl=en). The site plan is credited to the New York City Committee on Slum Clearance, via [NYPL Digital Collections](https://digitalcollections.nypl.org/items/99407f80-9ef0-0130-f139-58d385a7bbd0). See the website’s Sources section for full citations.

File sizes, original filenames, provenance notes, and SHA-256 checksums are recorded in [manifest.json](manifest.json). Files remain below GitHub’s 100 MiB regular-Git limit, so no Git LFS setup is needed. Use Git on your computer to push them: the two TIFFs exceed GitHub’s 25 MiB browser-upload limit.

These files are committed to the repository, but the Pages workflow publishes only `site/`. Website download links point back to these files on GitHub. The repository must be public for unauthenticated visitors to access them.
