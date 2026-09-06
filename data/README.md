# data/

Foldered by **role**, because a flat directory of 310 files could not show
which of them the app actually fetches. Every file has exactly one role — the
214 commodity files partition cleanly across the five metric folders, with no
file serving two.

| folder | files | what it is |
|---|---|---|
| `volume/` | 85 | Production volume, MT. `provConfig[crop].file` |
| `area/` | 57 | Area harvested, HA. `.areaFile` |
| `yield/` | 53 | Yield, MT/HA. `.yieldFile` |
| `yieldtree/` | 10 | Yield per bearing tree, MT/tree. `.yieldTreeFile` |
| `trees/` | 9 | Bearing trees, count. `.treesFile` |
| `subannual/` | — | Quarter and semester series (Palay and Corn only) |
| `boundaries/` | 6 | Admin boundary GeoJSON, the PSGC parent table, the hillshade |
| `sources/` | 3 | `*_long.csv` — inputs to `tools/`, **never fetched by the app** |
| `raw/` | 87 | Original PSA downloads and superseded files. Provenance only |

## Naming

`<commodity-slug>.csv` — the folder carries the metric, so the filename does
not repeat it. Three files that previously read

    IrrigatedPalay2024onwards.csv
    IrrigatedPalay_Yield_Provincial.csv
    conv_irrigatedpalay_area_provincial.csv

are now `volume/`, `yield/` and `area/` + `irrigated-palay.csv`.

The slug is the crop key minus the `Overall ` prefix and ` Production`
suffix, lowercased and hyphenated. The three regional Agristat files take a
`-regional` suffix (`volume/mango-regional.csv`), since regional and
provincial series for one crop would otherwise collide.

## Rules

- **`raw/` is not wired to anything.** It holds the original workbooks the CSVs
  were converted from, plus files superseded by a `veg_`-prefixed rebuild. Keep
  it for provenance — the Cacao/Pili and Celery investigations need it — but
  nothing there is fetched at runtime.
- **`sources/` is tool input, not app input.** `tools/sync_*.py` read these;
  `js/app.js` never does. `vegetables_long.csv` is 52 MB.
- **Adding a commodity file** means dropping it in the folder for its metric,
  named for the crop, and pointing `cropConfig`/`provConfig` at it. If a path
  is wrong, `tools/qaqc_metrics.py` section 1 reports it as missing.
