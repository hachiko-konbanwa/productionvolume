# Admin Boundary 2026 — reference set

**The canonical Philippine administrative boundaries for this and any future map.**
Start here rather than re-exporting from QGIS: these are already simplified,
validated, and carry a fix that a fresh export does not.

Last updated: 2026-09-03

## Files

| File | Features | Size | Use for |
|---|---:|---:|---|
| `Admin_Boundary_Regional_2026.geojson` | 18 | 3.54 MB | Region-level choropleths |
| `Admin_Boundary_Provincial_2026.geojson` | 105 | 3.87 MB | Province-level; cities inside their provinces |
| `Admin_Boundary_Provincial_NCR_HUC_2026.geojson` | 122 | 3.93 MB | Province-level with the 17 HUCs carved out as their own polygons |
| `Admin_Boundary_Municipality_2026.geojson` | 1,642 | 7.13 MB | Municipal detail |
| `Admin_Boundary_HUC_2026.geojson` | 17 | 0.18 MB | Highly-urbanised cities only |

Each has a matching `.qmd` sidecar, so the folder loads into QGIS with its
styling intact. Total 18.65 MB, down from 2,300 MB of source.

## Two things to know before using these

**1. The Regional file here is NOT the QGIS export.** The direct regional export
had Sulu present in *both* Region IX and BARMM — added to its new region without
being erased from its old one — leaving the two overlapping by 1,519 km², the
province's entire area, counted twice. Sulu would have been shaded under two
different regional values and a click there would land on whichever layer drew
last.

The file here was instead **dissolved from `Admin_Boundary_Provincial_2026` on
`Region_PSGC_Code`**, which makes that class of error impossible: a province
belongs to exactly one region by construction. Verified Sulu is 100% inside
Region IX and 0% inside BARMM.

> If you ever regenerate the regional layer, **dissolve it from the provincial
> layer**. Do not re-export it on its own.

**2. Field names differ between the regional and provincial files.**

- Regional: `ADM1_EN`, `ADM1_PCODE`
- Provincial / municipal / HUC: `Province_Name`, `Province_PSGC_Code`,
  `Region_Name`, `Region_PSGC_Code`, `City_Name`, `City_PSGC_Code`

Code that reads `ADM2_PCODE` (as the Production Atlas does) needs a rename step
for the provincial files.

## What "2026" means

Sulu moved from BARMM to Region IX effective 2026, and its PSGC code changed
from `1906600000` to `0906600000`. **These boundaries show the 2026 state.**
For earlier years Sulu belongs to BARMM — PSA books its 2025 output there — so a
map covering 2021–2025 needs an earlier vintage, not this one.

## How they were made

Source: `Desktop/GIS work 2 (1)/GIS work 2/GIS work/Admin Boundary/Admin Boundary 2026/`

```
tolerance 0.0004 deg (~44 m), 6 decimals, all attribute fields kept
```

Douglas-Peucker with `preserve_topology=True`, simplify *before* rounding
(rounding first puts vertices on a grid and leaves collinear runs, giving a
result both larger and blockier). Same settings as
`bantaypresyo/tools/simplify_boundaries.py`.

99.2% smaller with every feature kept, zero invalid geometries, and the small
islands intact — Palawan keeps 759, Sulu 427, Tawi-Tawi 399.

**Known limitation:** each feature was simplified independently, so shared
borders no longer use identical vertices and neighbouring polygons overlap by
slivers totalling ~1.4 km² nationwide (worst pair 0.29 km²). Invisible at
display scale and harmless for choropleths. If you need exactly zero, re-simplify
with [mapshaper](https://mapshaper.org), whose `-simplify` is topology-aware and
thins each shared border once.
