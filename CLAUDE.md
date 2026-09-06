# Production Atlas — project instructions

Interactive Leaflet webmap of Philippine agricultural production (regions/provinces, 2021–2025). Vanilla HTML/CSS/JS, no build step. Full architecture and feature reference: [DOCUMENTATION.md](DOCUMENTATION.md).

## Documentation maintenance (required)

Whenever you add, change, or remove a feature or user-visible behavior:

1. **Update [DOCUMENTATION.md](DOCUMENTATION.md)** — amend the affected section(s) and the "Last updated" date at the top.
2. **Add a dated entry to [CHANGELOG.md](CHANGELOG.md)** — newest first, under Added/Changed/Fixed/Mobile headings as appropriate.

Do this in the same set of edits as the code change, without being asked.

## QA/QC before and after any data change (required)

Whenever a data file is added, regenerated, repointed or replaced, compare the
**old and the new** across **all five metrics** the app carries — never just the
one you were working on:

| metric | `provConfig` key | unit |
|---|---|---|
| Volume | `file` | MT |
| Area Harvested | `areaFile` | HA |
| Yield | `yieldFile` | MT/HA |
| Bearing Trees | `treesFile` | trees |
| Yield per Bearing Tree | `yieldTreeFile` | MT/tree |

Run `python tools/qaqc_metrics.py` — it reports every crop/metric where the
configured file changed, disagrees with its source, or is missing.

**A missing metric is often correct, not missing.** PSA publishes no area for
23 commodities, so yield cannot be derived for them — and none of them has a
yield file either, so the source is self-consistent. Tree crops (Durian,
Calamansi, Rambutan, …) carry **Bearing Trees** and **Yield per Tree** instead
of hectares; for livestock and fisheries hectares are meaningless. `js/app.js`
already handles this — `metricAvailableForCrop()` disables the tab and
`autoSwitchMetricCounterpart()` moves Area→Trees and Yield→Yield/Tree — so
never "fill in" a missing area file. `qaqc_metrics.py` section 5 lists them.

**When the numbers disagree, do not assume the old file was wrong.** Establish
what each file actually represents before changing anything. Cassava is the
worked example: its file looked 82% short against the source, and the real
answer was that it deliberately tracked `Cassava for industrial use, fresh
tubers` — matching that subtype **0.0% off, every year**. The provinces that
looked missing (Basilan, Sulu, Tawi-Tawi) genuinely grow no industrial cassava.
"Incomplete" was the wrong conclusion; "a different commodity" was the right
one. Match a suspect file against **every** candidate series and let the numbers
name it, then ask before redefining what a commodity means.

## Never re-round or re-derive a published figure (required)

**Show PSA's number at the precision PSA published it.** Do not round it, do not
recompute it at finer precision, do not substitute a value you derived yourself
for one the source states — not to make a choropleth show more variation, not to
make a figure look tidier.

The worked example is **Banana Cardava's Yield per Bearing Tree**. PSA publishes
it to 2 decimals, and the real ratios run 0.005–0.02, so **54 of 60 provinces read
0.01** and the map is nearly one flat colour. `Volume ÷ Trees` would recover the
detail (Sulu 0.0050 against Davao del Sur 0.0147 — a 2.9× spread the published
file cannot show). **Do it anyway? No.** jayve: *"we must show the actual PSA
data … no alteration of the data/numbers given."* A coarse source stays coarse;
say so in the docs instead of computing around it.

This is about the **value**, not about row keying. Reorganising rows is fine and
often necessary — filling a blank `ADM2_PCODE`, folding an undivided-province row
into its successor, dropping a parent row that duplicates its children,
repointing config at a better source file. Those move a published number to the
right place; they do not change what it says.

## Project rules

- **`data/` is foldered by role** — `volume/ area/ yield/ trees/ yieldtree/` for the
  214 commodity files, plus `boundaries/ sources/ raw/ subannual/`. Filenames are
  `<commodity-slug>.csv`; the folder carries the metric, so the name does not repeat
  it. `raw/` and `sources/` are never fetched by the app. See `data/README.md`.
- **Bump `DATA_VERSION`** in `js/app.js` whenever any file in `data/` changes — it is the cache buster for all data requests.
- All dynamically inserted strings must pass through `esc()` (XSS guard).
- Every new fetch path must report failures via `showDataError()` and, if it participates in crop loading, call `finishMetricLoad()` on error too.
- New choropleth palettes must be lightness-monotonic (readable in grayscale).
- Keep mobile (≤640 px) in mind: the control panel is a bottom sheet; test popups and fly-to padding against it. Use `dvh` + safe-area insets, not bare `vh`.
- No frameworks/bundlers — keep everything in the existing three files unless the user asks otherwise.
- Node **is** installed (v24.19.0, `/c/Program Files/nodejs/node`). Syntax-check every JS edit with `node --check js/app.js`. For behaviour, `npm install jsdom` in the scratchpad and drive `js/app.js` under jsdom with `L`/`Papa`/`XLSX`/`fetch` stubbed — the whole file evaluates and its top-level `function`s and `var`s are reachable for testing (`let`/`const` are not).
