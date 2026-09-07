# Changelog

All notable changes to the Production Atlas webmap. Newest first.
Each entry: date · what changed · why (if not obvious).

## 2026-09-08

### Fixed — a semester built from one quarter is no longer offered

- **`2026S1` was exactly `2026Q1` for 54 of 60 commodities.** Not approximately —
  exactly, in all 3,265 province rows. The fruit and vegetable semester files are
  summed from quarters rather than read from a semester row, and nothing checked
  that both quarters existed. PSA has published only Q1 for those crops, so the
  sum was Q1.

- **It carried no warning**, because the code's rule was that only the annual
  column can be partial — "a quarter of data is a whole quarter". True for a
  quarter; false for a half-year assembled from one.

- **What it did to the map.** Read against 2025S1, the 54 showed a median
  **−46.3%** change, with 39 of 53 looking like a drop of more than 30% —
  Asparagus −94.3%, Mango −85.4%, Dragon Fruit −85.3%, Cassava −59.0%.
  Every one an artefact of comparing one quarter with two.

- **Fix:** the `2026S1` column is removed from those 54 files, so the period is
  not offered at all — in Semester view those crops now end at 2025S2. Verified
  the removal touched nothing else: 58,643 surviving cells compared against the
  committed files, zero discrepancies. Quarter view is unaffected and still
  shows 2026Q1, which is real.

- **Palay and Corn keep their 2026S1.** They come from Agristat, which publishes
  a real Q2, and their S1 equals Q1+Q2 exactly in all 522 province rows.

- **Stopped at source too:** `sync_fruits.py` and `sync_vegetables.py` now emit a
  semester only when both of its quarters are present, and log any they drop.
  Audited every other year: 2026S1 was the only affected period.

- `DATA_VERSION` → `2026-09-08a`.

## 2026-09-07

### Changed — Rounding note hidden from the footer

- **Removed from view, not from the page.** The footer's `Rounding` term and its
  paragraph are commented out in `index.html`, so restoring them is uncommenting
  rather than rewriting. The footer's definition list now runs Data → Boundaries
  → Metrics.

- **The explanation still reaches the people who need it.** `#table-modal-note`,
  above the data table, already says "Figures are PSA's, rounded to two decimals
  per reporting period. Details may not sum exactly to totals." That is the one
  place a quarters-vs-annual mismatch is actually visible, so the caveat now sits
  where the discrepancy does instead of on every page view.

- Nothing about the data changed. Figures are still PSA's own at PSA's precision,
  still never re-rounded or adjusted.

## 2026-09-06

### Changed — Overall Banana hidden for now

- **Withheld pending a usable bearing-tree file.** Its VOLUME is sound — all six
  varieties summed from `fruits_long` — but the only all-banana tree file puts
  2025 at 276,209,633 while **Banana Cardava alone is 303,648,834**, a subset above
  its parent in 67 of 87 provinces. `treesFile` was already unwired; the commodity
  is now hidden outright.

- Hidden the established way, both halves: `item-hidden` in the crop tree, and the
  `CROP_META` entry removed — that object is the catalogue's universe
  (`names = Object.keys(CROP_META)`), so a crop the map will not open should not
  rank in the Top 10 either. Same arrangement as Banana Cavendish, Cassava and
  Celery. Its `cropConfig`/`provConfig` entries and data files stay put, so
  unhiding is removing the class and restoring one line — both recorded in
  comments at each site.

- **The share denominator is unchanged**, which was the thing worth checking:
  aggregates were already excluded from it, so removing Overall Banana moved
  nothing. Verified live — `totalVal` still **58,229,734.02** to the cent, shares
  excluding aggregates still sum to **exactly 100.0000%**, and only the ranked
  count fell, 75 → 74 ("Showing the top 10 of 74 ranked").

- **Banana Cardava is unaffected** and keeps its own tonnage in the base, plus its
  Bearing Trees and Yield per Tree — those reconcile against its volume to 2.5%.

- **Old links degrade gracefully.** A bookmark to
  `#crop=Overall Banana Production` no longer dead-ends: the boot guard rewrites
  it to Palay, the map renders, and the hash is corrected. Search cannot surface a
  hidden crop either (`filterCropTree()` skips `item-hidden`).

### Fixed — three bugs in the Top 10 Commodities catalogue

**The audit first: the annual maths is sound.** Recomputed independently — the
ranking sorts correctly at every scope, the share denominator excludes exactly the
two aggregates (Overall Palay + Overall Banana, **28,222,280 MT**; including them
would overstate the base by **48%** and understate every share), shares sum to
**exactly 100.000%** at national, all three islands and region scope, and the
previous-year map matches an independent recomputation with **0 mismatches** over
74 entries. Nothing wrong there. The three below are what was.

- **Sub-annual mode blamed the wrong thing.** Switch the timeline to Quarter or
  Semester and all 75 commodities drop out at once — `catalogueData` is built from
  the ANNUAL files, so every lookup for `2025Q4` misses. The grid emptied and said
  *“75 commodities have no reported figure for this area”*, which at national scope
  accuses the entire country of growing nothing. New `catalogueAnnualOnlyNote()`
  names the real reason instead, in both the coverage line and the empty grid:

  > The commodity catalogue is published annually — switch the timeline to Annual
  > to see it. Quarter and Semester figures exist only for Palay and Corn, on the
  > map above.

- **`computeCatalogueRankings()` did arithmetic on the period string.**
  `String(parseInt(year, 10) - 1)` turns `'2025Q4'` into `'2024'`, which is never a
  period in a sub-annual `YEARS`, so `prevMap` came back empty and both the YoY
  column and the rank-movement delta vanished without a word. Replaced with a new
  `previousPeriod(period)` that indexes `YEARS` — the rule the rest of the app
  already used — and `getPrevYear()` now delegates to it rather than repeating it.
  Annual behaviour is byte-identical; the fix matters for whoever gives the
  catalogue sub-annual data, and a note there flags that the “YoY” heading would
  then need renaming, since it would compare against the previous QUARTER.

- **An unknown island key threw.** `ISLAND_GROUPS[scopeValue].regions` was
  unguarded, so anything but the exact lowercase `luzon`/`visayas`/`mindanao` took
  the catalogue down with a TypeError. Now returns no value, matching how the
  province branch already handles a missing lookup. Not reachable through the UI —
  found by passing `'Luzon'` capitalised.

- Verified live: a Quarter URL loads straight into the new message with 0 cards,
  and returning to Annual restores 10 cards and *“Showing the top 10 of 75
  ranked”*. The catalogue was also confirmed to refresh itself on a period change —
  an earlier reading suggesting otherwise was a flaky test click, not a defect.

- Regression cover: new `cataloguetest.js` (21 assertions) pins `previousPeriod()`
  across annual and sub-annual keys and at the axis start, that the notice appears
  only off the annual axis and never blames “this area”, and that an unknown island
  key returns rather than throws while a valid one still works. Suite now
  **342 tests across 19 files**.

### QA/QC — do the VALUES agree with their sources? (separate from the formula audit)

The earlier audit checked the arithmetic *on* each row. This checks the rows
themselves. Run of `tools/qaqc_metrics.py` plus two comparisons it does not make:

| check | result |
|---|---|
| Configured file missing from disk | **none** |
| Production lost to codeless rows | **none** (57 files carry a duplicate parent row the app correctly drops) |
| Yield = Volume ÷ Area, per province, 2025 | **52 of 53 crops within 5%** — second-worst is 0.26%, and 25 match to under 0.005% |
| Regional file vs provincial file, where both exist | Mango **0.00%** every year; Egg within 0.30% (worst 2024, −2,538 MT of 837,592) |
| **Overall Celery Production** | **inverted — 510% median error** |

- **Celery's yield file holds area ÷ volume.** In **15 of 15** reporting provinces
  `conv_celery_yield_provincial.csv` equals area÷volume rather than volume÷area:
  Benguet 0.0820 where the true yield is **12.1991 MT/HA**, Bukidnon 0.1380
  against **7.2467**. It is the reciprocal, not a rounding or vintage difference.

- **No change was needed — Celery is already hidden**, and was verified so rather
  than assumed: `item-hidden` in the crop tree (computed `display:none`, not
  reachable by search), absent from `CROP_META` so it cannot enter the Top 10 or
  the 80-row full ranking, and absent from `catalogueData` (75 crops loaded).
  Exactly one "Celery" text node exists in the DOM and it is invisible.

- A comment now sits beside that `item-hidden` class in `index.html` recording
  why, so the class is not removed without replacing the file first.

- **36 crops carry a vintage split** — Volume rebuilt from a `*_long` source while
  Area and Yield still come from the older files. Worth knowing, but not currently
  visible: every one of those 36 passes the per-province consistency test, so the
  two vintages agree in practice.

- **Scope note.** The formula audit (24,258 rows, 0 issues) could never have caught
  Celery: its numbers are internally consistent, they are simply the wrong
  quantity. Arithmetic correctness and source correctness are different checks and
  both are needed.

### QA/QC — every popup formula re-derived across all 268 data files

Each figure in the region/province popup was recomputed independently and compared
against what the app's own functions produce, for **every row of every commodity
file** — all regions, all provinces, all commodities, all five metrics.

| check | rows exercised | discrepancies |
|---|---|---|
| Lowest / Highest / Average (`buildStatsRowsHTML`) | 8,716 | **0** |
| Trend % and its base year (`buildSparklineHTML`) | 8,716 | **0** |
| Change and Growth vs previous period (`buildGrowthHTML`) | 8,114 | **0** |

**268 files, 24,258 rows, 0 discrepancies.** Beyond matching the numbers, the
audit also asserts the invariants: the mean always falls between the min and the
max, `previous + change` always returns the current value, a series with fewer
than two points renders nothing rather than a degenerate chart, and no trend ever
cites 2026 (the partial column stays out, as `trendPeriods()` intends).

15,542 rows were correctly skipped as having fewer than two data points — crops
that simply are not grown in most provinces.

**The audit was verified to fail when it should.** Corrupting the reported mean by
1% produced 40 flagged rows immediately, so the clean result is evidence rather
than a test that never fires.

### Changed — the popup sparkline is now legible

- **130×26 → 248×56 viewBox units**, drawn at `width:100%` so it fills the popup
  instead of occupying half of it. It renders at **290×65.5 px** on desktop,
  against 130×26 before — 2.2× wider and 2.5× taller. Dots, line weight, the
  current-period guide and the shaded area all scale with it.
- The SVG keeps its viewBox, so it scales down intact rather than overflowing: at
  a 390px phone viewport it renders 151.7×34.3 px — still larger than the old
  desktop size — with no popup overflow and no horizontal page scroll.
- `.spark-chart` was pinned at `width: 130px` inside a 290px panel; it is now
  `100%`.

### Changed — drilling into a region now shows that region's own total, and its share

- **The legend's headline number was the country's while the rows below it were
  the region's.** Nothing on screen added up to it: focused on Bicol the header
  read *“2025 Q1 national total: 4,692,422.31 MT”* while the six province rows
  underneath summed to 281,871.98 — the figure in the region popup. jayve asked
  why the two did not agree; they were never meant to, but the panel gave no way
  to tell.

- **Now it states both**, region first:

  > 2025 Mimaropa Region: 1,314,220.12 MT · 6.7% of the national 19,611,730.97 MT

  The leading figure is `classification.total`, deduped by the same path that
  drew the map, so it matches the province rows below **and** the popup's own
  Production line exactly — verified live at 1,314,220.12 MT in both places, with
  the share agreeing at 6.70%.

- **Both numbers have to be there.** The region total is what matches the screen;
  the national total is what the Above/Below colouring is measured against, so
  dropping it would strand the threshold line beneath it with nothing explaining
  where 233,472.99 came from. Showing only one was offered and rejected.

- **Ratio metrics are untouched.** Yield is volume ÷ area, so a region “total”
  does not exist — adding provincial yields together produces a meaningless
  number. `legendHeaderText()` falls back to the national average for those.

- Unfocused is unchanged: *“2025 national total: 19,611,730.97 MT”*.

- Regression cover: new `legendheadertest.js` (13 assertions) pins that the
  region total leads, that the national figure survives, that the share is
  region ÷ nation, that a ratio metric falls back, and that a null or zero
  national figure prints no NaN. Suite now **321 tests across 18 files**.

### Fixed — the legend's average named a denominator it had not used

- **Focused on a region, the threshold line stated a national figure but counted
  the areas on screen.** Palay Q1 2025 with Bicol focused read *“national average
  58,655.28 MT · across 6 provinces”* — but that average is the national total
  4,692,422.31 ÷ **80** reporting provinces. ÷ 6 gives 782,070. The value and its
  stated denominator described different populations, so the line invited a
  division that could not work.

- **Root cause.** `renderLegend()` took the threshold from `overrideAvg`
  (`nationalProvAvg`, computed over every reporting province in the country) but
  derived the count from `classification.counts` — the provinces of the focused
  region. Unfocused those two agree, which is why it went unnoticed; focus a
  region and they stop being the same population.

- **Fix.** `renderProvincialChoropleth()` now passes `nationalProvCount` — the
  denominator it actually divided by — alongside `nationalProvAvg`, and the
  sentence is built by a new `legendThresholdText(thr, areas, singular, plural)`
  so the value and count are paired in one place. Verified live on Mimaropa:
  **233,472.99 × 84 = 19,611,731.16** against a national total of
  **19,611,730.97**, matching to 0.19 MT of display rounding. Unfocused is
  unchanged and still reconciles: 1,153,631.23 × 17 = 19,611,731.

- Pluralisation moved into that function too, rather than each call site
  resolving “region/regions” or “province/provinces” for itself.

- **Not a bug, for the record:** the popup's regional Production (Bicol
  281,871.98 MT) is *supposed* to differ from the legend's national total — one
  is a region, the other the country, and the popup's own “Share to Philippines
  6.01%” is exactly 281,871.98 ÷ 4,692,422.31. What made the panel look wrong was
  the mismatched denominator beside it.

- Regression cover: new `thresholdcounttest.js` (10 assertions) pins that the
  count is the one the average divides by, that value × count reproduces the
  national total, plural agreement, and the three silence rules. Suite now
  **308 tests across 17 files**.

### Fixed — clicking “No data” made the whole map look like no data

- **jayve:** *“when i click no data, its like all region has no data.”* Exactly right,
  and the selection logic was never at fault — it highlighted precisely the right
  regions. The failure was that you could not see it.

- **Root cause: the highlight rode entirely on fill opacity, and the No-data fill
  is invisible.** `palette[0]` is a near-white wash in all 83 palettes (`#fefae8`
  in 41 crops, `#f2f9d9` in 23, `#f2f9e8` in 16). So picking “No data” raised the
  matching regions to 0.92 in a colour indistinguishable from the basemap, while
  fading every other region to 0.08 — nothing stood out and the entire map read as
  the class being highlighted. “Above average” never showed the bug because
  `#ae5209` is dark. Measured on Durian 2025: 2 regions at `#fefae8 @0.92`, the
  other 16 at `@0.08`.

- **Fix: a matched no-data area is repainted** for the duration of the highlight —
  a desaturated slate `#8d93a1` instead of the near-white `palette[0]`. The
  choropleth stays strokeless, so nothing is drawn on top of the map. Coloured
  classes keep their own palette colour and still work on opacity alone, since
  their fills are dark enough to carry it.

  The slate is cool on purpose: it has to stay clear of every palette in use, and
  a warm grey would collide with the brown ramps (Coconut runs `#d7c6b6` through
  `#9e7956`). A test asserts it differs from all thirteen palette colours in play.

  `clearClassHighlight()` restores the fill **colour** as well as the opacity, so
  releasing cannot strand slate on a region that later gets raised again.

- **An outline was tried first and rejected on sight** — a 2.5px near-black ring,
  which worked but looked heavy over a pale basemap. jayve: *"damn the borderline
  stroke is just ugly."* Fill carries the emphasis with nothing drawn on top.

- The style decision lives in `highlightStyleFor(info, cls, opacity, restOpacity, baseFill)`
  so it is testable without a live Leaflet map.

- Verified in the browser on Durian 2025 across the full cycle — pick **No data**
  (2 regions to `#8d93a1 @0.92`, the other 16 to `@0.08`, **stroke-width 0
  everywhere**), release (cream restored at `@0`, nothing stranded), pick **Above
  average**, release again. New `highlighttest.js` (29 assertions) pins both
  branches, that no stroke key is emitted at all, that `fillColor` is always
  returned so a release can restore it, and that the slate collides with none of
  the palettes. Suite now **298 tests across 16 files**.

## 2026-09-05

### Fixed — a period with no data drew three empty legend bands

- **On a year where nothing is reported the legend showed four rows, three of
  them blank** — “Above average / above the national average” and not a number
  in sight, no range and no region count, above a map with nothing on it.

- **Root cause: an inconsistent return shape.** `classifyEntries()` early-returns
  `counts: {}` and `rangeStrings: {}` when no area has a value, while every
  other path returns all six classes. `renderLegend()` skips a band with
  `counts[cls] === 0`, and `undefined === 0` is **false**, so the empty object
  let three bands straight through. Fixed at the source: the empty return now
  carries the same six keys, zeroed, so the skip works and every consumer of
  `counts`/`rangeStrings` gets a number and a string rather than `undefined`.

- Mango Bearing Trees at 2026 is the case that surfaced it (its trees run
  2021–2025), but it fired for **any** crop/metric/period with nothing
  reported. The legend there now shows the single “No data · 18 regions” row.

- **`reportEmptyPeriod()` was already working** and needed no change — the hint
  “Bearing Trees for Mango is published only for 2021, 2022, 2023, 2024, 2025 —
  nothing to show for 2026.” was on screen the whole time, and clears correctly
  when scrubbing back to a populated year. An earlier note in this changelog
  said it was not reaching this case; that was wrong, and the real defect was
  the legend beside it.

- Regression cover: new `emptylegendtest.js` (29 assertions) pins the complete
  shape of both the empty and populated returns, for the regional and provincial
  paths. Suite now **269 tests across 15 files**.

### Fixed — Overall Banana's bearing-tree count was smaller than its own Cardava subset

- **A subset cannot exceed its parent, and it did in 67 of 87 provinces.** The only
  all-banana tree file (`banana_yieldtree_provincial.csv`, self-labelled `'Banana'`)
  puts 2025 at **276,209,633** bearing trees, while **Banana Cardava alone** — from
  the newer 2026-release file — is **303,648,834**. Cardava is **29.7% of banana
  volume but 109.9% of the supposed all-varieties tree count**, and the implied
  per-tree yields differ 3.7× (0.0312 against Cardava's 0.0084 MT/tree).

- **Cardava's numbers are the sound ones**, so the aggregate file is the wrong one:
  trees × published yield/tree = 2,626,117 MT against an actual Cardava volume of
  2,560,921 MT, 2.5% apart on a 62-of-87 province overlap. Saba needs 303M hills
  for 2.56M MT, so a real all-varieties count sits far above 303M — plausibly
  500–600M — not below it. The file is either one variety mislabelled `'Banana'`
  or an older vintage that must not sit beside the 2026-release files.

- **`treesFile` unwired for Overall Banana only.** It now shows **Volume alone**;
  its volume is unaffected (all six varieties summed from `fruits_long`). Banana
  Cardava keeps both Bearing Trees and Yield per Tree.

### QA/QC — every wired tree crop checked against trees × yield-per-tree

Implied volume (Σ trees × published MT/tree) against actual volume, 2025 and 2026:

| crop | 2025 trees | implied vs actual | verdict |
|---|---|---|---|
| Avocado | 1,998,646 | **0.0%** | sound |
| Durian | 5,622,753 | **0.0%** | sound |
| Dragon Fruit | 1,772,779 | **0.0%** | sound |
| Calamansi | 32,701,453 | **0.0%** | sound |
| Pomelo | 2,015,189 | **0.0%** | sound |
| Rambutan | 1,844,579 | **0.0%** | sound |
| Dalandan | 232 | **0.0%** | sound but near-empty |
| Banana Cardava | 303,648,834 | +2.5% | sound (62/87 overlap) |
| **Overall Banana** | 276,209,633 | — | **contradicted — unwired** |

- **Mango cannot be cross-checked** — it is the one crop with a tree count but no
  published yield-per-tree. Tested for plausibility instead: **73.8–80.0 kg per
  bearing tree across six consecutive years** (2020–2025), stable and squarely in
  the 50–100 kg a mature mango tree yields. Kept.

- **Dalandan is thin, not broken.** 2.22 MT on 232 trees in 2025; its 2026 count
  rises because new provinces enter the series (Cotabato 1,200 trees, Aklan 10),
  not because a stock grew inside one quarter. A sparse source stays sparse.

#### Still open

- ~~**Mango has no 2026 bearing trees**, painting an empty map with nothing
  said.~~ **Resolved above.** `reportEmptyPeriod()` was in fact firing; the
  silent part was the legend, which drew three blank bands beside it.
- **Cacao and Pili are mis-wired, not merely missing a denominator.** Their
  `yieldTreeFile` points at `cacao_provincial_yield.csv` / `pili_provincial_yield.csv`,
  which hold **MT/HA, not MT/tree**: volume ÷ area reproduces those files exactly
  in **76 of 76** Cacao provinces and **26 of 26** Pili provinces. Neighbouring
  crops using the identical filename convention (Abaca, Asparagus) send theirs to
  `yieldFile`. So the app draws a “Yield per Bearing Tree” map out of hectares and
  labels it `MT/tree`, while the real Yield tab stays dark. Neither crop has
  bearing-tree data at all.

  A **second problem sits underneath**: national volume ÷ area is **0.0004 MT/HA
  for Cacao** (0.4 kg per hectare) against a real ~0.3–0.5, and 0.0086 for Pili —
  about three orders of magnitude out. Renaming the key alone will not make the
  Yield tab trustworthy; the volume and area files need checking against source.

  **Deferred by jayve on 2026-09-05** — he is reviewing the source CSVs himself
  first. Do not rewire unprompted.
- The two tree-file vintages cover opposite years: Mango 2021–2025 with no 2026,
  the eight newer crops 2025–2026 with no 2021–2024.

### Fixed — Mango, Banana and Coconut showed a 4×-inflated Area and a derived Yield

- **Quarterly area was summed, but area does not accumulate.** The provincial
  source reports a *standing* planted area and repeats it every quarter — mango
  in Zambales reads **8,658.99 ha in all four quarters**, identical to the cent —
  so adding them multiplied the annual figure by about four. Volume legitimately
  sums; area does not.

  | crop | shown for 2025 | actual national area |
  |---|---|---|
  | Coconut | 14,651,870 HA | ~3.6M |
  | Banana | 1,762,161 HA | ~440k |
  | Mango | 707,518 HA | ~180k |

  The 2026 column was right by accident: it holds a single quarter, so nothing
  was summed — 3,670,435 / 438,816 / 174,680, which land on the real figures.

- **Yield was derived from that bad area**, as `volume ÷ area` carried to full
  float precision (Abra mango 2025: `1034.05 / 526.59 = 1.9636719269260714`,
  stored to all 17 digits). Mango read **1.0 MT/HA** against a true ~4.0.
  `tools/sync_fruits.py` already refuses to write these two files for this exact
  reason — *“VOLUME ONLY … yield is volume/area so it cannot be derived either”* —
  and the untracked `conv_*_area/yield` files bypassed it.

- **Also: 2021–2024 carried no area at all.** Four of six years were empty
  regardless, so the Area and Yield tabs rendered every province as “No data”.

- **Fix: `areaFile` and `yieldFile` unwired for all three.**
  `metricAvailableForCrop()` disables the tabs on its own, so Mango and Banana
  now show **Volume + Bearing Trees** and Coconut shows **Volume** — the same
  shape Durian, Calamansi and Rambutan already have. No derived figure and no
  4× figure remains on screen. The data files are left in `data/` but nothing
  points at them.

- **Annual vegetables were checked and deliberately left alone.** Their quarterly
  areas genuinely differ — only 4% of provinces repeat a value for Eggplant and
  7% for Cassava, against 79% for Durian and 55% for Mango — because the same
  land really is cropped more than once a year, so summing is the right figure
  there. Palay and corn are also untouched: they come from `palay_corn_long`,
  which carries real per-period area on 89.9% of rows.

- Regression cover: new `metricwiretest.js` (26 assertions) pins which metrics
  each crop offers, that palay/corn keep Area and Yield, and that no config
  string still points at the six withdrawn files. Suite now **228 tests across
  14 files**.

#### Still open

`conv_*_area_provincial.csv` is empty for 2021–2024 in **19 of 25** files — every
one except palay and corn. The vegetables' 2025 sums are defensible, but four of
six years are blank for all of them, which the Area and Yield tabs do not
currently explain. Not changed here; flagged for a decision.

### Fixed — in average mode the darkest palette colour went unused, lightening the top of every map

- **The top band was drawn in `palette[3]`, the shade that means “second tier”
  everywhere else, while `palette[4]` — the darkest — was painted nowhere.**
  Average mode assigns no `peak` class, and `getColor()` only ever reached
  `palette[4]` through `peak`, so dropping the band silently dropped the colour.
  Side by side the two vocabularies disagreed: Yield's “Peak Production” swatch
  was `#003d10` while Area's “Above average” — the same top-of-map meaning — was
  `#1a7a3a`. jayve spotted it: *“why the peak and above ave is not the same
  color?”*

- `getColor()` now returns `palette[4]` for `high`/`medHigh` while in average
  mode. All ten call sites — map polygons, popup badges, legend swatches — route
  through it, so the legend cannot disagree with the map.

- **This was already affecting Volume**, which entered average mode earlier: its
  maps have been missing their darkest tone since. The fix restores it for
  Volume, Area and Trees together. Yield and Yield/Tree keep a real `peak` band
  and are untouched.

- Side benefit: the popup badge sits on a darker chip, so white badge text goes
  from **5.40:1 to 12.54:1**. The ramp stays lightness-monotonic
  (`#fefae8` → `#b7e4a8` → `#52c45e` → `#003d10`), so it still reads in grayscale
  per the project palette rule.

- Regression cover: new `swatchtest.js` (24 assertions) pins the per-class colour
  for every metric, that Area's “Above average” equals Yield's “Peak Production”
  swatch, that the ratio metrics are excluded, and that the ramp stays monotonic.
  Suite now **202 tests across 13 files**.

### Changed — Area Harvested and Bearing Trees now use Volume's average-based legend

- **“Peak Production / High Production / Average Production / Low Production” was
  wrong over hectares and tree counts.** Hectares are not production and a tree
  count is not production, but both metrics carried Volume-era wording. They now
  use the same unit-neutral labels Volume uses — **Above average / Near average /
  Below average / No data** — plus the `#legend-threshold` line naming the national
  average in the metric's own unit.

- `AVERAGE_MODE_METRICS` goes from `['volume']` to `['volume', 'area', 'trees']`.
  Everything else follows automatically: all five branch points already test
  `metricUsesAverageMode()` — the legend rows, the ±10% near-average band, the
  threshold line, and the three `clsLabels` maps (region popup, province popup,
  data table).

- **The rule is now additive counts vs ratios.** Volume (MT), Area (HA) and Trees
  (trees) are in average mode; **Yield (MT/HA) and Yield per Tree (MT/tree) are
  deliberately not** and keep the Peak/High/Average/Low Production wording and the
  original banding. Verified live: Yield/Tree still reads “Peak Production
  0.018–0.033 MT/tree”. This list was applied to all five metrics by mistake once
  before and had to be scoped back; the comment above it now says so.

- **Consequence, requested and confirmed:** Area and Trees lose the rank-based
  Peak band, so a former peak area falls to `high`/`medHigh` and takes
  `palette[3]` instead of the darkest `palette[4]` — jayve: *“yes no peak … just
  the peak color = above ave”*. Measured on **Palay Area 2025 across 82
  provinces: 75 keep their colour, 7 move** — 3 are that peak→above-average
  shift, and 4 are pulled into the near-average band (2 from above, 2 from
  below). There is now no “most hectares / most trees” tier anywhere in the app;
  the Top 10 catalogue ranks by Volume only.

- Live check on Durian Bearing Trees: “Above average 532,012–3,605,480 trees · 3
  regions / Below average 8–294,316 trees · 13 regions”, threshold “national
  average 351,422.06 trees · across 16 regions”. No “Production” anywhere.

- Regression cover: `peakbandtest.js` extended 14 → 22 assertions — it now pins
  which metrics are in average mode, that `peak` is never assigned to any of
  them, and that the near-average band fires for Area/Trees but not Yield/Tree.
  Suite now **178 tests across 12 files**.

### Fixed — the partial 2026 column was being trended, inventing a collapse in every crop

- **67 of 75 commodities were affected; the median trend was wrong by 75.7
  percentage points; and for 33 of them the arrow pointed the wrong way.**
  PSA publishes an annual figure only after Q4 closes, so the `2026` column holds
  whatever had been reported when the sheet was pulled — for most commodities about
  one quarter. Every trend surface was measuring a full 2021 against that quarter.
  That is not a comparison, it is a category error, and it was on screen as a
  confident red number. Measured nationally against the live files:

  | commodity | trend shown | actual 2021–2025 |
  |---|---|---|
  | Irrigated Palay | ▼ −77.3% | ▲ +0.1% |
  | Banana Cardava | ▼ −78.7% | ▲ +0.7% |
  | Pineapple | ▼ −75.4% | ▲ +0.2% |
  | Yellow Corn | ▼ −70.6% | ▲ +4.1% |
  | Cacao | ▼ −66.7% | ▲ +18.7% |
  | Rambutan | ▼ −93.6% | ▲ +42.7% |
  | Dragon Fruit | ▼ −96.0% | ▲ +62.5% |

  The eight unaffected commodities are the ones whose regional files carry no
  `2026` column at all, so there was no partial point to drag them down.

- **Every one of those crops grew and was shown collapsing.** This was not a
  cosmetic defect: the headline number in the popup, the one users read first,
  asserted a catastrophe that the data does not contain.

- **It bent the chart as well as the caption.** The partial point is a low outlier,
  so it stretched the sparkline's y-axis: on a Palay-shaped row the five real years
  landed at y = 4.2, 4.0, 4.5, 4.1, 4.6 in a 26px chart — **0.6px of travel** — with
  the 2026 point at y = 22. The flat-line-then-cliff users saw was an artifact of
  the axis, not the crop. Over `trendPeriods()` the same row now spans 4.0–22.0 and
  shows its actual shape.

- **The header over-counted too**, reading “6-Year Trend” above five years of data.

- `trendPeriods()` and `partialYearNote()` already existed and `buildStatsRowsHTML()`
  already used them; the fix points the remaining trend surfaces at them —
  `buildSparklineHTML()` (popup), the catalogue card sparkline, and the ranking
  table's “5-yr trend” column, the last two via a new `getCommodityTrendSeries()`.

- **The CSV exports deliberately keep 2026.** They call `getCommodityYearSeries()`,
  which still walks the full `YEARS` — the ranking export's header is built as
  `.concat(YEARS)`, so a 5-wide series would have written values under the wrong
  year headings, and withholding a published figure from a download of the figures
  would break the project's “never alter published numbers” rule. The rule here is
  *don't trend it*, not *don't show it*: the map, legend, popup values, data table
  and rankings all still show 2026.

- **Selecting 2026 no longer blanks the caption.** With the year off the chart the
  “you are here” dot has nothing to point at, and the caption would have vanished
  silently — leaving a 2026 figure sitting above a 2021–2025 chart with nothing
  saying they were different spans. It now switches to an amber `.spark-partial`
  line: “Showing **2026** · partial year, not plotted”, in the same `#8a5a12` the
  timeline note and coverage badge already use for this state (5.9:1 on white).

- Sub-annual views are untouched — `partialYearNote()` fires in annual mode only,
  and a quarter of data is a whole quarter.

- Regression cover: new `sparktest.js` (29 assertions) pins the honest −1.7%, the
  5-period axis and header, the y-axis scaling, the 2026 caption, and the
  6-wide-export / 5-wide-trend split. Suite now **170 tests across 12 files**.

### Fixed — the No-data swatch was invisible on the legend panel

- **Every crop is affected, not just Palay.** `palette[0]` is the No-data fill and
  it is a near-white wash in all 83 palettes — `#fefae8` (41 crops), `#f2f9d9`
  (23), `#f2f9e8` (16), and three one-offs — scoring **1.05–1.12:1** against the
  white legend panel. The swatch outline was `rgba(0,0,0,0.10)`, itself only
  **1.25:1**, so nothing delineated the square and it read as empty space.
- **Fix is the outline, not the fill.** The No-data swatch takes a solid
  `#7d8794` border: **3.64:1** against the panel and **3.48:1** against the fill
  it encloses, clearing WCAG 1.4.11's 3:1 for a graphical object. Every other
  swatch's border goes `rgba(0,0,0,0.10)` → `rgba(0,0,0,0.22)`, which delineates
  the paler bands without competing with the saturated ones.
- **The fill is deliberately untouched** so the swatch still matches the polygon
  drawn on the map — the outline reads as swatch chrome, not as part of the
  colour being keyed. `#7d8794` is already this file's scrollbar-thumb token.
- Verified in Chromium: the four swatches render `rgb(26,122,58)`,
  `rgb(82,196,94)`, `rgb(183,228,168)` and `rgb(254,250,232)` with the No-data
  border at `rgb(125,135,148)`.
- **11 suites, 142 tests, all passing.** Asset cache-busters → `2026-09-05q`.

### Fixed — the legend's last band could not be reached; now nothing scrolls at all

Measured in Chromium at 1280×{440, 480, 600, 720, 900, 1080} rather than reasoned about.

- **The reserve was wrong by more than 2×.** `#legend-body` capped itself at
  `calc(100dvh - 440px)`, but the panel's non-body chrome (header, table button,
  padding) measures **164px**, plus 44px clearing the scale bar — a true reserve of
  ~210px. At a 720px window that left **220px for 223px of content**, so the
  "No data" band sat just past the edge behind a scroll track a few pixels long.
  Now `calc(100dvh - 300px)` with a **230px floor**, ceiling 420px (the tallest
  possible legend is 5 bands, ~280px).
- **The attribution line was inside the scroll area.** "Data: PSA · 2021–2026" is
  constant chrome, not content to scroll through, and it was occupying the bottom
  of the very area the last band needed. Moved out of `#legend-body`.
- **The hairline was on the wrong element.** It was added to `#legend-items`, the
  *first child* of the scroll container, so it scrolled away with the first band
  instead of separating the header from the list. Moved onto `#legend-body`
  itself, with `.collapsed` flattening its margin/padding/border so collapsing
  still closes to nothing.
- **Result across every height tested — no scrolling at all, "No data" fully
  visible, panel entirely on screen:**

  | viewport | body max-height | content | scrolls? |
  |---|---|---|---|
  | 440px | 230px | 223px | no |
  | 480px | 230px | 223px | no |
  | 600px | 300px | 223px | no |
  | 720px | 420px | 223px | no |
  | 1080px | 420px | 223px | no |

- **A fifth contrast failure found on the way**: `#legend-source` was `#9aa3af`
  at **2.55:1**. Now `#6b7480` (4.74:1). All eight legend text roles pass AA.
- Verified by driving the real browser (`playwright-core` against the already
  installed Chromium) after the Playwright MCP server failed to connect — the
  four-band state is forced directly, since waiting on the 42 MB boundary times
  out headlessly. **11 suites, 142 tests, all passing.** Cache-busters → `2026-09-05p`.

### Fixed (legend UI) — three WCAG failures, a horizontal scrollbar, and a clipped row

Run against the `ui-ux-pro-max` rule set; measured, not eyeballed.

- **Three text roles failed AA contrast on white**, and one was the worst in the
  file. `.legend-count` carries each band's meaning ("above the national average
  · 5 regions") yet sat at **1.92:1** — the same failure already documented for
  `.cta-rank`.

  | role | was | ratio | now | ratio |
  |---|---|---|---|---|
  | `.legend-count` | `#bbb` | **1.92:1** | `#6b7480` | 4.74:1 |
  | `#legend-avg` | `#888` | 3.54:1 | `#5f6873` | 5.65:1 |
  | `.legend-range` | `#888` | 3.54:1 | `#5f6873` | 5.65:1 |
  | `#legend-unit-explanation` | `#888` | 3.54:1 | `#6b7480` | 4.74:1 |

  All seven legend text roles now pass; the three greys stay visually ranked
  (label darkest, count lightest) so the hierarchy is unchanged.
- **The horizontal scrollbar had a specific cause, not a general one.** A flex
  child defaults to `min-width: auto` and refuses to shrink below its content, so
  one long monospace range set the row's minimum width and pushed the whole panel
  sideways. The text column is now `.legend-row-text { min-width: 0 }` and ranges
  carry `overflow-wrap: anywhere`. `overflow-x: hidden` on `#legend-body` is a
  backstop, not the fix.
- **The last band was clipped mid-row.** The header had grown to four numeric
  lines while `#legend-body` still reserved the old height; `calc(100dvh - 540px)`
  → `calc(100dvh - 500px)`, floor 160→180px.
- **The division sign was falling back to a different glyph** in the panel's
  `DM Mono` stack — it read as `+` on screen. The line is now
  `national average 1,153,631.23 MT · across 17 regions`, which is also shorter
  and stops wrapping to three rows.
- Header and bands are separated by a hairline (`#legend-items` top border);
  four stacked figures previously ran straight into the swatches. Panel width
  260→278px so the long PSA figures wrap less.
- `thresholdtest.js` extended to 10 tests, including that the row's text column
  carries the shrink class and that the line avoids the division glyph.
  **11 suites, 142 tests, all passing.** Asset cache-busters → `2026-09-05k`.

### Fixed — the legend says "national average" and shows the number

- **"the average region" was confusing wording for a national figure.** The
  threshold is the national total divided by the areas reporting — Palay 2025:
  **19,611,730.97 ÷ 17 regions = 1,153,631.23 MT**. That is a national average,
  so the bands now say so: *above / within 10% of / below **the national
  average***. The old phrasing read as though it named some particular region.
- **The threshold is now stated as a number**, on a new muted line beneath the
  national figure:
  `national average: 1,153,631.23 MT (2025 total ÷ 17 regions)`
  Without it the average was never shown anywhere — the line above states a
  national **total**, so "above average" gave the reader nothing to measure
  against. Volume only, blank for every other metric; `.legend-threshold:empty`
  collapses it so no gap is left behind.
- The focused-province view uses its own threshold (`overrideAvg`, the average
  across all provinces nationwide) and labels the divisor "provinces".
- New suite `thresholdtest.js`, 8 tests, asserting against the rendered DOM
  rather than the source: the element exists, `classification.avg` equals
  total ÷ areas, the line names and states the average, the notes no longer say
  "average region", and the line is blank outside average mode.
  **11 suites, 140 tests, all passing.** Asset cache-busters → `2026-09-05j`.

### Fixed — the average-relative legend is Volume-only, as it was asked to be

- The previous entry applied the new banding and wording to **every metric**.
  It was scoped to Volume ("*then the Volume, hide the Peak, High, Low Production
  label*"), and browsing Yield and Area showed the change had leaked there too.
- **"Average mode" is now one predicate, `metricUsesAverageMode()`**, driven by
  `AVERAGE_MODE_METRICS = ['volume']`. Everything moves together under it:
  | | Volume | Yield / Area / Trees / Yield-per-Tree |
  |---|---|---|
  | rank-based Peak band | removed | **kept** (top 3 regional, top 1 provincial) |
  | middle band | near average, ±10% | **exact equality (`1e-6`), as before** |
  | provincial middle band | present | **absent, as before** |
  | labels | Above / Near / Below average, No data | **Peak / High / Average / Low Production** |
- **Popups and the data table follow the same split.** All three `clsLabels` maps
  are now conditional, so a Yield popup badge still reads "Peak Production" while
  a Volume one reads "Above average". They were unified to the new wording in the
  previous change, which is how the leak reached the popups too.
- Verified per metric rather than assumed — `peakbandtest.js`, 14 tests: Volume
  yields 0 peaks regionally and provincially; Yield, Area, Trees and Yield/Tree
  each yield 3 and 1. The near-average band populates 5 of 9 areas under Volume
  and 0 under Yield, on a fixture whose mean is exactly 100 with no value equal
  to it.
- `classifytest.js` now states its metric per assertion instead of relying on the
  default. Its "top 3 are peak" case had started failing legitimately, because
  the default metric is Volume and Volume no longer has a peak band.
- **10 suites, 132 tests, all passing.** Asset cache-busters → `2026-09-05i`.

### Changed — legend bands are labelled against the average, and "Near average" is now reachable

- **Labels dropped the "… Production" wording.** It described magnitude without
  saying magnitude *compared to what*, while every band boundary is
  average-relative. Now: **Top-Producing / Above average / Near average / Below
  average / No data**, with the comparison basis on the line beneath.
- **"Near average" replaces an exact-equality class that never fired.** The old
  rule matched a value to the average within `1e-6`; across **727 crop/metric/year
  combinations it fired once** — Banana Cardava yield/tree 2025, and only because
  PSA rounds that series to 2 decimals. `palette[2]`, the middle colour, was
  effectively dead. The band is now `NEAR_AVERAGE_TOLERANCE = 0.10`, i.e. within
  **10% of the average**.
  - Tolerance chosen from the data, not guessed. Production is heavily
    right-skewed, so a band round the mean stays thin: ±2% is empty 83% of the
    time, ±5% 70%, ±10% 55%, ±15% 45%. At ±10% the band fires for **35 of 75
    crops** at 2025 Volume. When it is empty the row simply does not render, which
    the legend already handled.
  - Applied to both classifications — the regional 5-tier and the focused
    provincial 3-tier, which previously had no middle band at all.
- **The comparison basis is now stated, because it differs by scope.** Regional
  view compares against **the average region**; a focused region compares its
  provinces against **the national province average**. Neither is the
  "national average" on the line above — for Volume that line is a national
  *total*. The old note read "Above national average" in the provincial view,
  which claimed a comparison the code was not making.
- **One vocabulary everywhere.** Region popups, province popups and the data
  table each had their own `clsLabels` map still saying "Peak Production" /
  "High" / "Low". All three now share the legend's wording, so a popup badge
  cannot contradict the legend row it came from.
- Counts are singular when they should be — "1 region", not "1 regions".
- New suite `classifytest.js`, 8 tests: peak selection, the near-average band,
  all-identical values, zero-valued areas as No Data, and empty input.
  **9 suites, 117 tests, all passing.** Asset cache-busters → `2026-09-05g`.

### Added — the legend says how many areas a thin national average rests on

- A ratio metric's **national average** now appends the area count when it rests
  on **3 or fewer** areas (`THIN_AVERAGE_AREAS`). Below that threshold the line is
  unchanged, so nothing gets noisier for the 76-province median.
  - `2025 national average: 0.0096 MT/tree (2 provinces)` — Dalandan
  - `2025 national average: 0.44 MT/HA (3 provinces)` — Salago
  - `2025 national average: 4.89 MT/HA` — Banana, 84 provinces, no note
- **The count is of the DENOMINATOR's areas**, because that is what the
  arithmetic divides by. Dalandan 2025 settled which count to use: Occidental
  Mindoro produces 2.22 MT on 136 bearing trees, and **Biliran carries 96 bearing
  trees with no production at all**, so the national figure is 2.22 ÷ 232 =
  **0.0096**, not Occidental Mindoro's own 0.0163. Counting only areas positive on
  *both* sides would have printed "1 province" beside a number computed over two.
- `legendAvgText()` now builds this line in **one place**. `renderLegend()` writes
  it twice — once immediately, once when a ratio's files land — and those two
  copies drifting is precisely how `ensureRatioTotals()` diverged from
  `loadCropData()` and produced the 97 wrong averages.
- Only ratio metrics get the note. A *national total* over one province is still a
  correct total, so Volume/Area/Trees are untouched.
- Sanity check while verifying: Palay 2025 national total reads **19,611,730.97 MT**,
  against PSA's published ~19.6M.
- Tests extended to 15 in `legendmergetest.js`. **8 suites, 109 tests, all passing.**
  Asset cache-busters → `2026-09-05e`.

### Fixed — the legend's "national average" was wrong for 97 crop/metric/year combinations

- **`ensureRatioTotals()` collapsed duplicate rows with first-row-wins**, and its
  comment claimed that matched `loadCropData()`. It did not — `loadCropData()`
  merges **period by period, first positive value wins**. Era-disjoint files
  deliberately split one province across two rows, each zero where the other has
  data (the NIR handover, Sulu's two codes, undivided Maguindanao), so taking
  only the first row drops a whole era.
- **Why it skewed the number rather than just shrinking it:** the numerator
  (volume) and the denominator (area / trees) lose *different* rows, so the
  quotient moves in either direction. Worst cases at the year shown:

  | crop | metric | showed | correct | off by |
  |---|---|---|---|---|
  | Cassava Industrial | Yield 2025 | 5.1322 | 4.6513 | **+10.3%** |
  | Mango | Yield/Tree 2023 | 0.0732 | 0.0789 | **−7.3%** |
  | Sugar | Yield 2025 | 54.0124 | 58.1384 | **−7.1%** |
  | Malabar Spinach | Yield 2026 | 4.1644 | 3.8987 | +6.8% |
  | White Corn | Yield 2023 | 2.0820 | 1.9652 | +5.9% |
  | Banana | Yield 2025 | 5.1401 | 4.8864 | +5.2% |

- **Fix:** new `mergeRowsByArea()`, used by `ensureRatioTotals()`. It reads its
  period columns **off the row itself** (`/^\d{4}([QS]\d)?$/`) rather than from
  `YEARS`, so it cannot drift when a sub-annual file swaps the time axis.
- **Scanned all five metrics, every crop.** Volume (83), Area (60) and Trees (10)
  were always correct — those sum `currentProvStats`, which is already merged.
  Only the two ratio metrics were affected: Yield (56 crops) and Yield/Tree (10).
  After the fix: **0 mismatches on any metric**.
- Verified live: Overall Banana, Yield, 2025 now reads **4.89 MT/HA** (was 5.14).
- New suite `legendmergetest.js`, 9 tests, covering the era-disjoint shapes that
  caused this — NIR handover, undivided Maguindanao, ADM1 fallback, codeless
  rows, non-period columns and quarter keys. **8 suites, 103 tests, all passing.**
- Asset cache-busters → `2026-09-05c`.

### Changed — rule added: never re-round or re-derive a published figure

- **New project rule in `CLAUDE.md`.** Show PSA's number at the precision PSA
  published it. Do not round it, recompute it at finer precision, or substitute a
  derived value for one the source states.
- **Worked example — Banana Cardava's Yield per Bearing Tree.** PSA publishes it
  to 2 decimals; the real ratios run 0.005–0.02, so **54 of 60 provinces read
  0.01** and that choropleth is nearly one flat colour. `Volume ÷ Trees` would
  recover the spread (Sulu 0.0050 vs Davao del Sur 0.0147 — 2.9×). **Rejected.**
  A coarse source stays coarse; the limitation is documented instead.
- **Scope: the value, not row keying.** Reorganising rows remains fine and often
  necessary — filling a blank `ADM2_PCODE`, folding an undivided-province row into
  its successor, dropping a duplicate parent row, repointing config at a better
  file. Those move a published number to the right place without changing it.
- The Maguindanao residual fold from earlier today therefore **stands as
  originally applied**: Hog del Sur 2025 reads 3,501.90 (2,097.10 published +
  1,404.80 residual), BARMM 2025 reconciles to within 70.05 MT of the regional
  reference. An intermediate revert to a row-split, made from an over-broad
  reading of this rule, has been undone.
- `DATA_VERSION` → `2026-09-05f`. All 7 suites (94 tests) passing.

### Changed — full sweep of every connected file, plus a QA/QC tool that was lying

- **`tools/qaqc_metrics.py` section 2 reported duplicates as data loss.** A blank
  `ADM2_PCODE` is not automatically lost production — the common case is an
  undivided-Maguindanao row that is a rolled-up **parent** of del Norte + del Sur
  for the same year, where dropping it is correct and "restoring" it would
  double-count. The tool now classifies:
  - additive metrics — duplicate when the blank row equals `del Norte + del Sur`
    to within 0.02
  - ratio metrics (Yield, Yield/Tree) — a ratio can never equal a sum, so
    redundancy means the successors already publish their own value that year
  - Output went from **"57 files; 9,893 HA, 693 MT/HA"** silently dropped to
    **"0 files genuinely losing data; 57 carrying a duplicate parent row"** —
    which is the truth. This is the exact misreading that caused 3.1M MT to sit
    unnoticed for a day.

- **Sweep results — everything below was checked, not assumed:**

  | check | result |
  |---|---|
  | configured files missing from disk | **0** |
  | live files losing data to codeless rows | **0** |
  | data pcodes with no boundary polygon | **0** (218 files, 92 polygons) |
  | tree items with no `cropConfig` entry | **0** |
  | `cropConfig` entries unreachable from the tree | **0** |
  | crops with no data source at all | **0** |
  | duplicate `data-crop` / config keys | **none** |
  | palettes violating lightness-monotonic | **0 of 83** |
  | `loadDataFile()` calls without an error handler | **0** |
  | crops lacking `CROP_META` | 8, all `item-hidden` |

- **XSS review.** Four `innerHTML` sites interpolate without `esc()`. All four are
  safe and deliberately so: one takes `color` from a palette constant, the other
  three take a year from `YEARS`, which is regex-constrained to
  `/^\d{4}([QS]\d)?$/` where it is assigned. **That regex is load-bearing** — if
  `YEARS` is ever populated from an unfiltered source, those three become
  injection points.

- **Formula audit — Yield = Volume ÷ Area and Yield/Tree = Volume ÷ Trees, every
  crop, every year, per province.** Two crops disagree by more than 1%:
  - **Overall Celery** — median 510.4%. Its yield file holds **HA/MT, inverted**;
    matches to 0.0% under inversion. `item-hidden`, so not user-visible.
  - **Banana Cardava** — median 22.4%, and this one **is live**. Not an error: the
    source publishes yield-per-tree rounded to **2 decimals**, and the real values
    run 0.0058–0.0168, so every province lands on 0.01 or 0.02. **62 provinces
    collapse to 2 distinct values**, leaving the Yield/Tree choropleth almost
    without variation. Every other ratio crop keeps full precision (Avocado 83
    distinct of 83, Pomelo 83, Rambutan 82). Deriving it from Volume ÷ Trees would
    restore the detail; not done without a decision.

- **`banana(saba)_provincial_bearing_area.csv` is a Trees file, not an area file** —
  values are tree counts (median 1.9M, max 17.1M), and it is correctly wired to
  `treesFile`. The filename misleads, like `banana_yieldtree_provincial.csv` before
  it; noted here so the next reader does not "fix" the wiring.

### Fixed (data) — the last of the codeless Maguindanao rows: volume loss now zero

- **Seven files were skipped wholesale by a guard that was too coarse.** Cattle,
  Chayote, Chicken, Egg, Hog and Ube (area + yield) each have an undivided
  Maguindanao row carrying **real 2021–2024 data** *and* a 2025 value that
  overlaps its successors. `maguindanao_is_safe()` rejects a file if **any** year
  overlaps, so the clean 2021–2024 years were thrown out with the ambiguous one.
  **30,437 MT, 142 HA restored.**
- **The 2025 overlap is a residual, not a duplicate** — established against the
  regional reference files, not assumed. Excluding it left BARMM 2025 short by
  1,474.85 MT on hog; including it closes the gap to 70.05. Egg: −193.93 → −69.19.
  So PSA still books some output under undivided Maguindanao alongside both
  successors.
- **Resolution (user's call): fold the residual into del Sur**, the same
  convention already used for the pre-split years. Regional and national totals
  become correct; del Sur's *province-level* 2025 is overstated by the residual,
  which is the accepted trade-off. Verified after the change:

  | crop | BARMM 2025 from provinces | regional reference | diff |
  |---|---|---|---|
  | Egg | 3,785.80 | 3,854.99 | −69.19 |
  | Hog | 9,890.67 | 9,960.72 | −70.05 |
  | Cattle | 12,313.33 | 12,700.07 | −386.74 |
  | Chicken | 8,263.26 | 8,370.48 | −107.22 |

- **Ube's yield file was handled differently and deliberately.** A yield is a
  ratio — folding a residual into it by addition is meaningless — so there the
  overlap year is dropped and each successor's own published yield stands. Only
  additive metrics (volume, area) fold.
- **Close-out: no live file loses volume to a codeless row any more.** What
  remains is 29 area files where the undivided row equals `del Norte + del Sur`
  **exactly** — genuine duplicate totals that must stay dropped — plus their 27
  yield counterparts. Checked file by file: **0 mismatches**. The ~12,637 HA that
  a naive scan reports as "missing" is double-counting, not data.
- `DATA_VERSION` → `2026-09-05d`. All 7 suites (94 tests) passing.
- **Known remaining gap:** BARMM 2025 is still ~70–390 short across these four
  crops. No province row accounts for it; the likely candidate is the **Special
  Geographic Area** (`1909900000`), which does not appear in these provincial
  files at all. Unresolved, and small enough to leave rather than guess at.

### Changed — Coconut is `Coconut (w/ husk)`, sourced from its provincial file

- **Coconut now derives its regions from `conv_coconut_volume_provincial.csv`**
  instead of a separate regional CSV (`file:` dropped from `cropConfig`), on the
  same reasoning as the six crops earlier today — but a different finding.
  - Once the codeless Maguindanao row was restored, the regional and provincial
    files agree **exactly** for 2021, 2022 and 2023, and 0.29% apart in 2025. But
    the regional file's **2024 column is short by 858,653 MT**, missing coconut in
    **Region IX, Caraga and Mimaropa** specifically. Thirteen of eighteen regions
    match to zero in that year, so it is not a vintage difference.
  - The Region IX/BARMM and VI/VII/NIR offsets that appear in *every* year are
    **not** errors — they are the Sulu and Negros handovers, which
    `aggregateProvToRegional()` already books year-aware. Verified live: 2024 now
    reads Region IX 1,819,936 and BARMM 1,674,311, with Sulu under BARMM.
  - **Commodity definition confirmed, not assumed.** All three coconut files
    (volume, area, yield) carry `Coconut (w/ husk)` as their sole Commodity Type
    across all 92 rows, and the tree label already reads "Coconut with Husk". The
    pre-conversion `coconut_productionvolume_provincial.csv` is identical to the
    converted file value-for-value, province by province.
  - QA/QC across all five metrics: Coconut carries Volume, Area and Yield (no
    Trees / Yield-per-Tree). Area and Yield exist from **2025 only** — a coverage
    gap the empty-period notice already reports, not a fault. 2025 yield
    reconciles against volume ÷ area at **0.00% median error over 84 provinces**.
- **Only 2 crops now carry an independent regional file**: Mango (whose regional
  file matches `fruits_long` to the tonne, so it is the correct side) and Egg
  (within 0.4%).
- `DATA_VERSION` → `2026-09-05c`. All 7 suites (94 tests) passing.

### Fixed (data) — 3,105,804 MT restored after a regression in yesterday's conversion

- **Undivided Maguindanao went invisible in 25 live files.** Its `ADM2_PCODE`
  was blank, and `loadCropData()` drops every row without one
  (`if (!row.ADM2_PCODE) return;`). Coconut lost its entire 2021–2024 series
  (**3,054,390 MT**), Mango **51,412 MT**, Sugar 2 MT.
- **This was a regression introduced on 2026-09-04, not a PSA data problem.**
  Comparing old and new mango files settles it: the pre-conversion
  `mango_productionvolume_provincial.csv` had `1908800000` on that row and
  **0 codeless rows**; the converted `conv_mango_volume_provincial.csv` has a
  blank and **1 codeless row**. All 92 rows are otherwise identical province by
  province — the only change in the file is the lost code.
  - **Cause is ordering.** `xlsx_to_csv.py` fills a blank code only when the
    Province name is in the boundary-derived `names` map, and undivided
    "Maguindanao" is not in it — the 2026 boundary carries only del Norte and
    del Sur. `fix_codeless_provinces.py` *does* know the case
    (`MAGUINDANAO` → del Sur, era-guarded) but it had already run **before** the
    conversion created those files. Convert first, repair second.
  - Yesterday's report that codeless rows were "down to 2 files" was wrong. The
    repair script's own summary line said `1253 codeless rows left alone`; that
    was read as "nothing left to fix" when it meant the guard was skipping them.
- **Three distinct patterns, only one of them fillable:**
  - **A — clean era-split (25 files, filled).** Parent holds 2021–24, successors
    hold 2025–26, no year overlaps. Real data. Filled with del Sur
    (`1908800000`), the convention PSA itself uses for the pre-split palay/corn
    series.
  - **B — parent is a duplicate total (~62 files, deliberately left blank).**
    Parent holds *only* 2025–26 and equals `del Norte + del Sur` exactly
    (cucumber 953.36 = 42.40 + 910.96; squash 297.92 = 212.72 + 85.20). Blank is
    the correct state — the app drops them, which is what should happen.
  - **C — mixed (hog).** Parent has 2021–24 *and* a 2025 value that does not
    reconcile with its successors (1,404.80 vs 4,195.66). **Still open.**
- **Verified against an independent source.** Mango now equals `data/fruits_long.csv`
  exactly for 2021, 2022, 2023 and 2025 (2024 differs by 36 MT, in the regional
  file). Coconut is not in `fruits_long`, but its regional and provincial files —
  independently sourced — now agree at **0.00% for 2021, 2022 and 2023**, having
  been 5.6% apart before.
- **Guard hardened.** `maguindanao_is_safe()` checked only del Sur; a file can
  carry del Norte data in a year del Sur is still zero, which would have passed a
  pattern-B row as safe. It now checks **both successors**.
  `xlsx_to_csv.py` documents the run-order requirement.
- **Still open:** Coconut 2024 — after the fill the provincial file is 5.59%
  *above* the regional one (15,359,069 vs 14,500,416); it was already 179,254 MT
  over before Maguindanao was added, so 2024 has a second, separate problem. No
  third source exists to break the tie.
- `DATA_VERSION` → `2026-09-05b`. All 7 suites (94 tests) passing.

### Fixed (data)

- **Six regional files were showing rice.** Cattle, Chicken, Hog, Milkfish,
  Tilapia and Sugar each carried their own regional CSV, and the **2021–2024
  columns in all six are Overall Palay production** — a column pasted into the
  wrong files. On the map, Region III cattle for 2021 read **3,741,211 MT**
  against a provincial sum of a few thousand; national cattle output is about
  230,000 MT for the entire country, so the region view was showing beef that
  does not exist. Zooming in to the provinces made the number collapse.
  - **Identified, not guessed.** The suspect columns were matched region by
    region against the palay provincial rollup: Region I 1,902,343 · Region II
    2,909,950 · Region III 3,741,211 · Region VIII 864,373 — identical, not
    merely close, with a **median error of 0.00% in all four years**. Only
    VI/VII/NIR differ, because the regional file predates the Negros Island
    Region split and still books Negros inside Western and Central Visayas.
    Previously logged as "phantom values"; that was too weak a conclusion.
  - **Fix:** dropped `file:` from those six `cropConfig` entries, so
    `loadCropData()` takes the `!file && provFile` path and derives regions with
    `aggregateProvToRegional()` — the same treatment palay and corn already got
    on 2026-09-03, and now the rule for all but three crops. **No data file was
    edited**; the provincial numbers were never wrong.
  - The 2025 column in all six *is* the correct commodity, so only 2021–2024
    were affected.
  - Verified live: 2021 cattle now ranks **Region X (Northern Mindanao) 36,443
    MT** first — the country's actual cattle heartland, at a plausible scale —
    where the legend previously topped out in the millions.
  - **Coconut, Mango and Egg keep their regional file.** They disagree with
    their provinces by 8.6%, 5.8% and 0.6% — the ordinary kind, not a paste,
    and nothing yet says which side is right. Left alone deliberately.
  - **Sugar's provincial file has a separate, still-unexplained problem:** it
    swings 23.9M MT (2021) → 8.6M (2024) → 13.7M (2025). Deriving its region
    from its provinces makes the two views agree with each other; it does not
    make that swing go away. Still open.
  - `DATA_VERSION` → `2026-09-05a`. All 7 suites (94 tests) passing.

### Fixed (accessibility)

- **Page zoom was locked off.** The viewport meta carried
  `maximum-scale=1,user-scalable=no`, so pinch-zoom did nothing anywhere on the
  page — a **WCAG 1.4.4 (Resize Text) failure**. A low-vision reader could not
  enlarge the legend, the crop tree or the catalogue cards. Removed both
  directives; the meta is now
  `width=device-width,initial-scale=1,viewport-fit=cover`. Leaflet installs its
  own gesture handlers on `#map`, so map pinch-zoom is unchanged and only the
  surrounding chrome became zoomable. Verified live: page zoom works, map
  gestures still behave.
- **The document had no `<h1>`** — the first heading on the page was an `<h3>`,
  so a screen reader's "list headings" gave no top-level title and the outline
  started two levels down. Added
  `<h1 class="sr-only">Philippine Agricultural Production Atlas</h1>` at the top
  of `#map-view`, with a new `.sr-only` class in `app.css` using the 1px-clip
  pattern (`position:absolute; width:1px; height:1px; clip-path:inset(50%)`) —
  hidden visually but still in the accessibility tree, which `display:none`
  and `visibility:hidden` are not. No visual change.
- **Four controls announced with no name.** `#compare-area-a`, `#compare-area-b`,
  `#basemap-select` and `#opacity-slider` have no visible label text, so a
  screen reader read them as bare "combo box" / "slider". Added `aria-label`
  ("First area to compare", "Second area to compare", "Basemap style",
  "Layer opacity"). The three catalogue selects were checked and left alone —
  they are already named by a wrapping `<label><span>…</span><select>`.
- Verified in the browser, not just in the source: `h1` present and in the
  accessibility tree, all four controls expose their names, and the viewport
  no longer blocks zoom. `node --check js/app.js` clean; all 7 test suites
  (94 tests) passing. Cache-busters → `2026-09-05b`.

## 2026-09-04

### Fixed

- **The five highly-urbanised cities were invisible on the map.** Their rows in
  `data/` carried an **empty `ADM2_PCODE`**, and `loadDataFile()` drops any row
  without one (`if (!row.ADM2_PCODE) return;`), so their production reached
  nothing — not the choropleth, not the regional rollup, not the Top 10, not the
  CSV export. No error, no warning; the totals just came out short.
  - **48 volume files affected, 358,062 MT missing from 2025** — about 2% of
    national production across those crops. Worst hit: **Durian 55.9% invisible**
    (39,830 of 71,250 MT), Cacao 23.1%, Alugbati 12.1%, Spinach 11.3%,
    Pomelo 9.3%, Spring Onion 7.2%, Sponge Gourd 6.2%, Avocado and Radish 5.6%.
    By city: City of Davao 287,250 MT, City of Zamboanga 70,807 MT.
  - Found by cross-checking `data/fruits_long.csv` against the app. For all
    eight fruits present in both, *(what the map showed) + (what it dropped)
    == fruits_long*, **to the tonne** — which identified the cause exactly.
  - New **`tools/fix_codeless_provinces.py`** fills the codes: 708 rows across
    146 files. Codes are **pinned**, not harvested by name, for the reason
    `sync_agristat.py` already documents — several files give these cities a
    code belonging to a real province (`1804600000` is Negros *Oriental*,
    `1108600000` is Davao *Occidental*), so harvesting would post city output
    onto another province and the national total would still balance. The script
    refuses any assignment that would merge two provinces, only ever fills
    blanks, and defaults to a dry run.
  - Verified live: Durian national 2025 is now **71,250 MT** and **City of Davao
    ranks 1st** among durian provinces, which is what the source says. All eight
    fruits reconcile with `fruits_long` exactly. Collisions before the change: 5;
    after: 5; **introduced: 0**.
  - `DATA_VERSION` → `2026-09-04a`.

### Added

- **Quarter and Semester timelines for all 13 fruits.** New
  **`tools/sync_fruits.py`** builds `data/subannual/<Stem>_volume_{quarter,semester}.csv`
  from `data/fruits_long.csv` — 26 files, **21 quarterly periods (2021Q1 – 2026Q1)**
  and 11 semestral. Until now Palay and Corn were the only crops with a
  sub-annual axis.
  - It **imports** `province_codes()`, `boundary_names()`, `HUC_OWN_PCODE`,
    `PROVINCE_ALIASES` and `assert_no_collisions()` from `sync_agristat.py`
    rather than copying them. Two province→PSGC maps that can drift apart is
    the exact failure mode this project keeps hitting.
  - **Volume only.** `fruits_long.csv` fills `area_ha` on just 3.8% of rows
    (18,547 of 481,712) against 89.9% for `palay_corn_long.csv`, so there is
    nothing to publish for Area and nothing to divide for Yield. New
    `SUBANNUAL_VOLUME_ONLY` in `js/app.js` makes `subAnnualFile()` return null
    for those metrics, so the Quarter/Semester tabs simply stay unavailable
    instead of 404-ing into a data error.
  - **Semester is summed, not read.** `fruits_long` publishes quarters only —
    no annual row and no semester row exist in it. Annual files are therefore
    left alone, exactly as `sync_agristat.py` leaves them: `DOCUMENTATION.md`
    notes PSA rounds each period independently, and checking `palay_corn_long`
    (which has both) shows 99.3% of published annuals identical to the summed
    quarters, 46 rows differing by at most 0.01 MT.
  - Verified: for Durian, Mango, Pineapple, Calamansi, Avocado and Pomelo at
    2023 and 2025, **Σ quarters == Σ semesters == the annual file, exactly**.
    Live in the browser, Durian on Quarter shows 21 periods and its four 2025
    quarters total **71,250 MT** — the annual figure.
  - This also gives **Banana Cavendish** a real series for the first time; it is
    still `item-hidden` in the tree, so unhiding it is now a one-line change.

### Fixed (deployment)

- **`index.html`'s asset cache-busters had drifted badly** — `app.js?v=2026-09-03b`
  and `app.css?v=2026-09-02s`, while both files had changed many times since.
  They are hand-maintained and separate from `DATA_VERSION`, so returning
  visitors were being served stale code from cache; this was reproduced in the
  browser during testing. Both now read `2026-09-04b`, matching `DATA_VERSION`.
- **`Maguindanao` was coded as `1903600000` — Lanao del Sur's code** — in
  `Ube_ProductionVolume_Provincial.csv` and `Ube_YieldVolume_Provincial.csv`,
  posting its ube onto a neighbouring province. Caught by
  `assert_no_collisions()` when the fruit pipeline first ran. The code is now
  blanked rather than reassigned: undivided Maguindanao has no polygon, so
  invisible is honest where wrongly-attributed is not.

### Fixed (the legend's national figure was not a national figure)

- **The legend showed the mean of the reporting regions for all five metrics**,
  labelled "national average". As a colouring threshold that is right; as a
  statement about the country it was not, and for the ratio metrics it was badly
  wrong.
- **Yield was a mean of means.** Provincial yields are averaged unweighted into
  regions (`aggregateProvToRegional(..., average: true)`), then the legend
  averaged those regions unweighted again — so Benguet counted the same as a
  region with one hectare. Across the 56 crops carrying volume, area and yield
  the **median error was 26%**, the worst **1109%**:

  | crop | showed | true | off by |
  |---|---|---|---|
  | Squash | 98.12 | 8.11 | 1109% |
  | Cotton | 5.46 | 0.63 | 766% |
  | Stringbeans | 24.29 | 5.06 | 380% |
  | Carrots | 4.42 | 13.33 | 65% |

- **Now:** additive metrics report the **national total**, ratio metrics the
  properly weighted quotient. Carrots 2025 reads `national total: 60,509.97 MT`
  and `national average: 13.4 MT/HA`; Durian reads `5,622,753 trees` and
  `0.013 MT/tree` (71,250 ÷ 5,622,753 — verified independently).
- **The choropleth is untouched.** `classifyEntries()` still colours against the
  per-region mean — "is this region above the typical region" is a fair thing to
  colour by — and it still reads 4,654.61 for Carrots. Only the stated figure
  changed.
- Ratio metrics need the volume and area/trees files to weight properly, so
  `ensureRatioTotals()` fetches them once per crop and caches: the legend
  re-renders on every year scrub and focus change, and it is the same two files
  each time. A failure caches nulls rather than retrying, and the line goes
  blank rather than printing `NaN` or a confident wrong number.
- The figure is national regardless of zoom, computed from every province rather
  than from `classification`, which only holds what is currently on screen.

### Added (a blank map now explains itself)

- **Picking Bearing Trees for Durian in 2022 painted an empty map with no
  explanation**, which reads as a broken app rather than absent data.
  `metricAvailableForCrop()` only knows whether a *file* is configured, not
  whether the selected *period* has anything in it — so the tab stayed enabled
  and the map just went blank.
- New `periodsWithData()` / `describeEmptyPeriod()` / `reportEmptyPeriod()` put a
  sentence on screen instead:
  *"Bearing Trees for Durian is published from 2025 onwards — nothing to show
  for 2022."* A scattered series is enumerated rather than described as a range
  (*"is published only for 2021, 2023"*), because calling that a range would be
  a lie.
- It reuses **`#year-hint`**, the element the sub-annual gap already speaks
  through, so there is one place a "nothing here, and here is why" message
  appears rather than two competing ones. The notice tags itself
  (`dataset.emptyPeriod`) so scrubbing to a populated year clears **only its own
  message** — blanking the sub-annual notice or the "select a crop" prompt would
  have been a regression.
- Wired into both `loadCropData()` branches **and** `setYear()`: scrubbing the
  timeline re-renders from cached stats without reloading, so the check has to
  run there too, both to appear and to clear.
- `reportEmptyPeriod(cropName, stats, period)` takes its inputs rather than
  reading module state. `currentProvStats`, `currentCropStats` and `currentYear`
  are all `let`, so nothing driving the page from outside can set them — making
  the arguments injectable is what made the DOM behaviour testable at all.
- **This is not a data fix.** Eight tree crops on `*_provincial_bearing_area.csv`
  (Avocado, Calamansi, Dalandan, Dragon Fruit, Durian, Pomelo, Rambutan, Banana
  Cardava) carry **2025 and 2026 only**; Banana and Mango reach back to 2020
  because their `treesFile` points at a `*_yieldtree_provincial.csv` instead.
  That is a difference in the sources, not a config mistake, and the files were
  verified untouched by this session's repairs (untracked, no `.bak`).

### Changed (the panel scrollbars are actually visible now)

- **The crop list and legend scrollbars were 4px of `#e0e0e0`** — a contrast
  ratio of **1.32:1** against the panel, which is to say invisible. They are the
  only cue that there is more of the list below the fold.
- Now **10px with a visible track**: thumb `#7d8794` on a `#eef1f5` track,
  measuring **3.64:1 against white and 3.22:1 against the track**, so it clears
  the 3:1 WCAG 1.4.11 bar for a non-text UI control. Darkens to `#5a6472` on
  hover, and the thumb is inset 2px so it reads as sitting *in* the track
  without shrinking the 10px pointer target.
- Declaring `::-webkit-scrollbar` at all also opts Chromium out of **overlay
  scrollbars**, so the bar stays on screen instead of fading out after a scroll.
  `scrollbar-width`/`scrollbar-color` cover Firefox, which ignores the
  `-webkit-` rules and previously got no styling at all.
- The legend had a byte-identical copy of the old rule; both now share one.

### Changed (Fibers grouped; Overall Corn hidden)

- **New "Fibers" sub-group in Non-Food & Industrial**, holding all 12 fibre
  entries — 6 live (Abaca, Piña, Cotton, Bariw, Salago, Coir) and 6 that PSA
  publishes nothing for (Silk, Raffia, Buri, Agave, Agave Sisal, Agave Maguey).
  They had been interleaved with the food and tobacco crops — Silk between
  Cotton and Bariw, the three Agaves between Coir and Tobacco — so neither the
  fibres nor the tobaccos read as a set.
  - Source order is preserved inside the group rather than re-sorted, and the
    group leads the section per the sub-groups-first rule.
  - `Tobacco (Burley)` stays with the tobaccos: it is `item-disabled` for the
    same reason but it is not a fibre.
- **New "Tobacco" sub-group** in the same section, holding Tobacco, Tobacco
  (Virginia), Tobacco (Burley) and Tobacco (Native) — the overall leading its
  variants, the same shape as the Banana group. Burley stays here rather than
  with the other record-less entries: it is `item-disabled` for the same reason
  but it is a tobacco, and grouping by "has no PSA record" instead of by what
  the crop *is* would have been the wrong cut.
- Non-Food & Industrial now reads as two groups then four loose crops: **Fibers**
  (12), **Tobacco** (4), then Cacao, Coconut with Husk, Pili and Sugarcane
  (hidden). Audited: no section anywhere has a loose item preceding a sub-group.
- **`Overall Corn Production` hidden** — `item-hidden` in the tree and removed
  from `CROP_META`, the same arrangement as Overall Cassava, Cassava Industrial
  and Banana Cavendish. Yellow Corn and White Corn stay. Its config and
  sub-annual files are untouched, so unhiding is removing the class and
  restoring one entry.
  - Note this leaves the two staples asymmetric: Palay still shows a combined
    row plus Irrigated and Rainfed, while Corn now shows only its two variants.
  - No percentages move — Overall Corn was badged `Combined total` and already
    excluded from the share denominator — but it ranked 5th, so the visible Top
    10 gains a slot.
- Tree ↔ `CROP_META` reconciliation holds at **75 == 75**, no crop on either
  side without the other.

### Added (clicking a Top 10 card loads that crop on the map)

- **Clicking a commodity card now also switches the map above to that crop.**
  The card itself is unchanged — same markup, same `aria-expanded` contract, and
  it still expands on the same click to show the blurb, scientific name, YoY,
  yield and top regions/provinces. The click just does one more thing.
- New `showCropOnMap()` resolves the card to its crop-tree item via a
  `data-crop` attribute carrying the **catalogue name**, not the displayed
  label: the card reads "Coconut" while the map's crop is
  `Overall Coconut Production` and the tree item is labelled "Coconut with
  Husk". Verified live — clicking Coconut paints 18 regions and the legend
  reads "Coconut Production".
- Two things it has to handle:
  - **`selectCrop()` deselects** when handed the element already active, so
    clicking the card for the crop already on the map would have blanked it.
    Guarded on `currentCropName`.
  - **The tree section may be collapsed**, which would load the crop while the
    panel showed no highlight. Ancestors are opened, the same reveal
    `filterCropTree()` performs.
- Keyboard parity: Enter and Space on a card do exactly what a click does.
- No scroll is forced — the card expands where you are, and "▲ Back to map"
  takes you up to the crop you were reading about.

### Added (Data coverage — which commodities have Area and Yield)

- **A greyed-out metric tab now has an explanation.** PSA publishes no Area for
  22 of the 78 commodities, and none of them has a Yield either — yield is
  volume ÷ area, so without area there is nothing to divide. That was invisible
  in the UI and stated wrongly in the help text.
- **`metricCoverage()`** derives the whole thing live from
  `cropConfig`/`provConfig` through the existing `metricAvailableForCrop()`.
  Nothing is hardcoded, so adding a crop or wiring up a file updates both views
  on its own. Two groups, both derived rather than asserted:
  - **Trees instead of hectares (8)** — has `treesFile`, no `areaFile`: Avocado,
    Banana Cardava, Calamansi, Dalandan, Dragon Fruit, Durian, Pomelo, Rambutan.
    They carry **Trees** and **Yield/Tree**, and `autoSwitchMetricCounterpart()`
    already moves the reader across rather than showing an empty view.
  - **Volume only (14)** — livestock and fisheries, where hectares mean nothing,
    plus Cassava, Cassava (Food), Coir, Corn, Moringa, Mushroom, Sweet Potato
    Leaves and Cavendish.
- **Two views, one source.**
  - **Help modal** — the generated explainer replaces a hand-written sentence
    ("Fisheries and livestock only have Volume") that had drifted out of date as
    crops were added. Rendered on open, so it cannot drift again.
  - **Top 10 Commodities** — a **📊 Data coverage** button in the scope bar opens
    a 78 × 5 matrix, ✓ / — per cell, reusing the ranking modal's chrome and
    Escape-close chain. It **defaults to the 22 crops with a gap** and toggles to
    all 78. **"Gap" means Volume only** — no productivity measure at all. Two
    looser definitions were tried and both told the reader nothing: *missing any
    metric* selects all 78 (Trees and Yield/Tree only ever apply to tree crops),
    and *no Area* still pulled in the 8 tree crops, which are not missing
    anything — Trees and Yield/Tree are the right measure for an orchard, and
    listing them implies an absence when the substitute is in the same row.
    That leaves 14: Corn, Coir, Mushroom, Moringa, Sweet Potato Leaves, Cassava,
    Cassava (Food), and the 7 livestock and fisheries commodities.
- The cells carry meaning by glyph as well as colour, so they read the same to a
  colour-blind reader and in greyscale. Contrast measured: 5.03:1 at worst.
- **A test caught a real design flaw before it shipped.** The first "gaps only"
  filter was *missing any metric*, which selected all 78 — every crop lacks
  something, because Trees and Yield/Tree only ever apply to tree crops. A gap
  is specifically **no Area**, which is also why there is no Yield. Redefined,
  and the test now asserts the filter equals `metricCoverage().noArea`.
- No data files changed, so `DATA_VERSION` is untouched; `index.html`'s asset
  cache-busters go to `2026-09-04k`.

### Changed (every .xlsx source converted to .csv)

- **New `tools/xlsx_to_csv.py`** converts all 55 crop/metric combos the Atlas
  read from `.xlsx` into plain `.csv`, filling the codeless `ADM2_PCODE` cells
  on the way — **374 cells across 55 files**. The `.xlsx` originals are left
  untouched; only `js/app.js` is repointed.
- **Codeless-row loss is now essentially gone:** from **94 files, 613,809 MT and
  455,208 HA** down to **63 files, 2,333 MT and 9,916 HA** — 99.6% of the
  tonnage recovered. Coconut alone gets back **553,216 MT** (Davao City 179,770,
  Puerto Princesa 230,389, Zamboanga City 143,057), and its provincial sum now
  sits 0.3% under PSA's own regional total instead of 4% under.
- **`js/app.js` no longer reads a single `.xlsx`.** Verified in the browser:
  `typeof XLSX === 'undefined'` after a full session, so `ensureXLSX()` never
  fires and SheetJS is never fetched. Data changes are now diffable in git too,
  which is how the shifted code columns in cabbage and Ube went unnoticed.
- **Codes are canonicalised on the way out.** Several sheets used the legacy
  `PH#####` form (`PH14001` for Abra) that `loadDataFile()` converts at runtime;
  the converted csv carries the PSGC directly, so every file in `data/` is now
  keyed the same way.
- **The conversion exposed a bug that had been invisible.**
  `Highland_Area_Provincial.xlsx#Celery` had **no readable rows at all** — every
  `ADM2_PCODE` was blank — so celery's area could never be compared with
  anything. Now readable, it shows `Highland_Yield_Provincial.xlsx#Celery` is
  **inverted**: it holds HA/MT, not MT/HA. Under the inverse hypothesis the
  error is **0.0% across all 15 provinces** (Benguet vol/area 12.20 against a
  yield of 0.08; 1/12.20 = 0.082). Every other crop passes. **Left as-is**:
  Celery is `item-hidden` so nothing on the live map is affected, and inverting
  published figures is a call for whoever maintains the source.
- Two more false positives had to be excluded from the code checks first, both
  runtime conversions `js/app.js` already performs: the legacy `PH#####` form,
  and regional files keyed by `ADM1_PCODE` with no `ADM2_PCODE` column at all
  (which made Overall Dairy's 43,298 MT read as entirely lost when it is read
  perfectly well). `canonical_code()` and a `provincial` guard handle them.

### Changed (codeless cities resolve from the boundary file, not a hand table)

- **The name → PSGC map now comes from
  `admin_boundary_2026/Admin_Boundary_Provincial_NCR_HUC_2026.geojson`**, via a
  new `names` block in `data/psgc_parents_2026.json`. It was a hand-written
  table inside `fix_codeless_provinces.py`, which is exactly why this problem
  kept recurring: every spelling variant (`City of Davao`, `Davao City`,
  `..City of Davao`) and every city PSA newly reports on its own needed a human
  to notice and add a line.
  - The boundary file already carries **all 122 entities — 88 provinces and 34
    cities**, including the twelve HUCs the Atlas has never needed and every NCR
    city. A new one now resolves on its own.
  - `normalise()` folds the spellings: footnote markers (`Sulu c/`), the leading
    dots the sheet emits (`..City of Davao`), parenthetical suffixes
    (`Bacolod City (Capital)`, `Cotabato (North Cotabato)`) and `City of X` vs
    `X City`. Verified against every codeless spelling in `data/`: all five HUCs
    resolve in all twelve spellings, and 12 of the 14 remaining distinct names
    resolve (the two that do not are undivided Maguindanao, which has no
    polygon, and a blank name).
  - The collision guard now compares **normalised** names, so
    `Negros Occidental` and `Negros Occidental a/` are recognised as one
    province rather than refused as a merge.
- **New `--fix-wrong-codes` (opt-in) repaired a shifted code column.**
  `Ube_ProductionVolume_Provincial.csv`, `Ube_YieldVolume_Provincial.csv` and
  `cabbage_productionvolume_provincial.csv` each carried a code column shifted
  down one row — every province holding the code of the row above it, so Ube and
  cabbage output was landing on neighbouring provinces. **28 rows fixed.**
  - Which side was misaligned was **established, not assumed**: checked against
    `vegetables_long`, the values follow the province NAME in 8 of 9 Ube rows and
    12 of 12 cabbage rows (the exceptions being 0.0 either way). So names and
    values are correctly paired and the codes were wrong.
  - The flag is off by default. Rewriting a filled code is a far bigger claim
    than filling a blank, and is only safe once you know which side is shifted.
- **A first version of that check claimed 746 rows needed rewriting; 745 were
  its own fault.** Two things that are not disagreements had to be excluded:
  9-digit codes missing their leading zero (`102800000` for Ilocos Norte —
  `loadDataFile()` pads it at runtime) and Sulu's two live codes,
  `1906600000` under BARMM and `0906600000` under Region IX, which `js/app.js`
  already aliases. `same_code()` now handles both.

### Added (QA/QC across all five metrics)

- **`tools/qaqc_metrics.py`** — checks every crop against **all five** metrics
  (Volume, Area, Yield, Bearing Trees, Yield per Bearing Tree) rather than only
  the one being worked on, reporting missing files, codeless rows, vintage
  splits and Yield-vs-Volume/Area inconsistency. The rule is now in `CLAUDE.md`.
- **It immediately caught a real fault this session had introduced.** Splitting
  cassava made `Overall Cassava Production` the *combined* series, but its
  `areaFile` and `yieldFile` still pointed at `cassava_provincial_area.csv` and
  `cassava_yield_provincial.csv` — which describe **industrial cassava only**.
  Matched per province: those files agree with the industrial series to
  **0.1%**, with combined to **78.3%** and with food to **94.7%**. They are now
  configured on `Cassava Industrial Production`, and Overall Cassava carries no
  Area or Yield, because no source exists for the combined series and adding two
  published averages together would be wrong.
- **The check's first version was itself wrong, and is worth recording.** It
  compared Yield against Volume/Area *nationally* and flagged 27 crops. A
  national yield is the **unweighted mean of provincial yields** (`average: true`
  in `METRICS`), which legitimately differs from national volume ÷ national
  area. Tested per province, Carrots, Chinese Cabbage, Pineapple, Squash and
  Cotton all show **0.0% median error** — 26 of the 27 were arithmetic, not
  data. The check now compares per province only.
- **Remaining, unresolved and NOT guessed at:** the codeless-row sweep across all
  five metrics finds **94 files** still losing data — **613,809 MT, 455,208 HA
  and 2,440 MT/HA** — mostly in `.xlsx` sources that
  `fix_codeless_provinces.py` does not write. Largest single item is Overall
  Coconut, 553,216 MT and 392,665 HA. Separately, 37 crops have Volume rebuilt
  from a `*_long` source while Area/Yield still come from the older vintage;
  they are consistent per province today, but the two halves are different data.

### Added (cassava split — food is now on the map)

- **The Atlas had been showing industrial cassava the whole time.** PSA
  publishes cassava as two separate commodities and the Atlas carried only
  `Cassava for industrial use, fresh tubers`, labelled simply "Cassava". The
  food series — **1,046,442 MT in 2025** — had never been on the map.
- They are not the same crop geographically, which is why the omission mattered.
  Industrial cassava is a Luzon/Visayas crop; **food cassava is a BARMM staple**,
  and its top provinces are Basilan (254,924 MT), Sulu (181,255),
  Lanao del Sur (128,150) and Tawi-Tawi (100,877) — provinces that read **zero**
  under the industrial series.
- Cassava is now a group of three, following the Banana pattern:

  | crop | 2025 MT |
  |---|---|
  | **Cassava** (combined, badged `Combined total`) | 2,325,347 |
  | **Cassava (Food)** | 1,046,442 |
  | **Cassava (Industrial)** — what the map used to show | 1,278,905 |

  Food + Industrial == Combined exactly. The combined row is excluded from the
  share denominator, same as Overall Palay/Corn/Banana.
- All three carry quarterly and semestral series. Food cassava's 2025 quarters
  (155,364 / 218,158 / 251,497 / 421,423) sum exactly to its annual figure and
  show a clear Q4 harvest peak.
- A test caught the change honestly: `test.js` had used Overall Cassava as its
  *non*-aggregate control, and that fixture is now stale — updated to Tomato.

### Added (vegetables_long integrated)

- **`data/vegetables_long.csv` now drives 39 vegetable, root and spice crops** —
  new **`tools/sync_vegetables.py`**, third of the family after
  `sync_agristat.py` and `sync_fruits.py`, importing province resolution and the
  collision guard from the first and the Maguindanao rule from the second.
  **117 files written**: 39 annual (`veg_*_productionvolume_provincial.csv`),
  39 quarterly and 39 semestral. All 39 crops × 6 years now match the source
  **exactly — 0 differing cells**, and `SUBANNUAL_STEMS` grows from 19 to **58**.
- **`Overall X` means all subtypes of X — except where the Atlas already
  deliberately tracked one.** Verified by matching every original file against
  every candidate series rather than assuming:
  - **Cassava is `Cassava for industrial use, fresh tubers`** — the original file
    matches that subtype **exactly, 0.0% off, every year**. It is not a partial
    file. Reading it as "all subtypes" would have inflated it 82% and silently
    redefined the commodity. Basilan, Sulu and Tawi-Tawi are **correctly zero**:
    they grow food cassava and essentially no industrial cassava.
  - **Pechay is `Pechay`**, excluding `Pechay, native` — original matches to
    0.1%. Also deliberate.
  - Both are pinned to their subtype in `SERIES`, and the regenerated files
    reproduce the originals (Cassava exactly; Pechay within ~116 MT, which is
    the codeless-city gap this closes).
- **The remaining crops were genuinely short**, each having a single subtype:
  Stringbeans, Malabar Spinach, Sweet Potato Leaves, Ampalaya, Ube and Spinach
  ran 5–9% under from missing provinces and codeless cities. Those gaps close.
- **Two source hazards handled, both invisible in the file itself:**
  - **The Maguindanao parent rows.** In 2025–26 `vegetables_long` carries the
    undivided province *and* both successors for all 128 crop groups, with the
    parent exactly equal to their sum. `drop_maguindanao_parents()` removes
    1,088 such rows; without it every vegetable double-counts that province
    (visible as the 4,833 MT Cassava difference between the raw file and the
    published figure).
  - **Zero-filled future quarters.** `vegetables_long` writes **0.0** for
    quarters not yet reported where `fruits_long` leaves them blank, so 2026
    arrived with all four quarters and Q2–Q4 summing to zero nationally.
    Publishing those would have drawn "no production" across the country for
    quarters that have not happened. Periods empty everywhere are now dropped,
    leaving 2021Q1–2026Q1 — the same span as fruits.

### Fixed (Overall Banana)

- **Overall Banana's total was wrong in both directions and is now exact.** It
  was the one fruit reading a *regional* Agristat file, which
  (a) **has no 2026 column at all**, so Banana read as **zero for 2026**, and
  (b) disagreed with the published source by ~2,000 MT in 2024 and 2025.
  Its provincial fallback was worse: `FruitCrops_ProductionVolume_Provincial.xlsx#Banana`
  carries the five highly-urbanised cities with a **blank `ADM2_PCODE`** and so
  lost **238,545 MT in 2025 alone** — City of Davao 172,495, City of Zamboanga
  66,050.
  - New **`data/banana_overall_productionvolume_provincial.csv`**, built from
    `data/fruits_long.csv` with all six varieties summed (Cavendish, Saba,
    Lakatan, Latundan, Bungulan, Others). It matches the source **exactly for
    all six years**: 9,091,308 / 9,013,289 / 9,019,441 / 8,688,419 / 8,610,549
    / 1,893,655.
  - The regional file is dropped from `cropConfig`, so regional totals are now
    derived from provinces — the path 64 other crops already take. Three
    consequences: **2026 works** (Banana ranks 4th nationally), **province-level
    drill-down works** where it previously could not, and Davao City's 172,495 MT
    is counted.

### Known gap

- **`tools/fix_codeless_provinces.py` only scans `data/*.csv`.** The same
  blank-`ADM2_PCODE` fault exists in the `.xlsx` sources — the Banana sheet
  above is one instance — and those files were never repaired. Overall Banana
  sidesteps it by no longer reading one; the other xlsx-backed crops
  (Highland/Lowland vegetables, Onion, Palay/Corn yield and area) have not been
  checked or fixed.

### Fixed (Maguindanao)

- **Undivided `Maguindanao` now folds into Maguindanao del Sur** (`1908800000`),
  in the 81 files where that provably cannot double-count. This closes the last
  fruit discrepancy: **47 → 27 → 0**, every fruit now matching `fruits_long`
  across all six years.
  - **del Sur is PSA's own convention, not a guess.** `palay_corn_long.csv` —
    the series with published annual rows back to 1990 — carries *no* undivided
    row at all: every pre-split year is already booked under Maguindanao del
    Sur, with del Norte at zero until 2024.
  - **Guarded per file, because the sources disagree on the handover.**
    `fruits_long` is clean (2024 undivided only, 2025 successors only, zero
    overlapping crops). `vegetables_long` is **not**: in 2025 and 2026 all 128
    crop groups appear under all three names, and the undivided row is exactly
    del Norte + del Sur (54,772.4 == 33,918.2 + 20,854.2) — a rolled-up
    **parent** sitting beside its children. Folding that in would double-count
    the province outright. The `is_aggregate` column that should flag it reads
    **0 on every row of all three sources**, so the overlap has to be detected
    from the values; `maguindanao_is_safe()` does that per file, which is why
    **81 files were changed and 61 were refused**.
  - `sync_fruits.py` gained `assert_eras_disjoint()`, the same check at the
    pipeline level, and the fruit sub-annual files were regenerated so their
    quarters include Maguindanao. Verified: Σ quarters == Σ semesters == the
    annual file, exactly, for eight fruits at 2023 and 2025.
  - Two rows stayed refused and are worth fixing at source:
    `Ube_ProductionVolume_Provincial.csv` and `Ube_YieldVolume_Provincial.csv`
    give **Sulu** the code `1908800000`, which is Maguindanao del Sur's.

### Known, deliberately not auto-fixed
- **~20 rows are coded onto the wrong province** (as opposed to having no code):
  `Negros Oriental b/` → Siquijor's code (1,840 MT), `Lanao del Sur` → Basilan
  (435 MT), `City of Zamboanga` → Zamboanga Sibugay (317 MT), `City of Davao` →
  Davao Occidental (195 MT), and a tail of sub-100 MT cases. Small, but they
  inflate one province and deflate another rather than merely hiding a value.

### Changed

- **Sub-groups now sit at the top of their section in the crop tree.** Only
  Fruit Crops was out of order — `Avocado` preceded the `Banana` sub-group, so
  the group appeared wedged between two loose crops. Banana now leads the
  section and the loose crops follow in their existing alphabetical run.
  Vegetable & Rootcrops was already correct (it is nothing but sub-groups).
  Done by reordering the markup rather than with CSS `order`, so DOM order
  still matches visual order for tab sequence and screen readers; the sub-group
  button and its `.sub-children` container move together as a pair, which the
  `nextElementSibling` lookups in `js/app.js` depend on.

- **Emoji removed from the crop tree's sub-group labels** — Banana, Highland
  Crops, Lowland Crops, Root Crops, Spices, and Nuts & Legumes now read as
  plain uppercase text. The top-level category headers (Palay, Corn, Vegetable
  & Rootcrops, …) keep theirs; they are a separate visual tier and carry the
  category gradient. No CSS or JS change was needed — `.sub-group-header` is a
  flex row with the label and chevron as its two children, and the handlers in
  `js/app.js` work off `nextElementSibling`, never the label text.

## 2026-09-03 (latest)

### Added

- **`data/psgc_parents_2026.json`** — a geometry-free province/city → region
  parent table (122 entries, 18 region names, **4.6 KB**), generated by the new
  **`tools/build_psgc_parents.py`** from the `Region_PSGC_Code` /
  `Region_Name` / `Province_PSGC_Code` / `City_PSGC_Code` fields already
  published in `data/admin_boundary_2026/`. That folder had been sitting in the
  repo entirely unreferenced by `js/app.js`.
  - `provinceRegionPcode()` now consults it **first**, so a province's parent
    region is a lookup of what PSA publishes rather than either a 42 MB polygon
    read or arithmetic on a PSGC string. The result is still passed through
    `provinceParentRegion()`, so every year-aware rule layers on top unchanged —
    the Basilan override, the Sulu re-home, NIR reverting to R6/R7 before 2024.
  - The published data independently confirms the app's hardcoded
    `PROVINCE_REGION_OVERRIDES` entry: PSGC puts **Basilan** under BARMM, while
    `Admin_Provincial_Boundary.json` has it under Region IX.
  - `regionDisplayName()` falls back to the published `Region_Name` instead of
    a hand-copied table, so a region reads as a name rather than a PSGC code
    while the ~103 MB of regional boundary GeoJSON is still in flight.
  - **The catalogue now gates on this 4.6 KB table instead of the 42 MB
    provincial boundary.** Aggregation was the only thing that needed the
    polygon index, so the correctness fix from earlier today no longer costs a
    42 MB wait before the first card can render.
  - Two vintage adjustments are deliberate and documented in the generator:
    seven entities whose 2026 PSGC code differs from the one this project and
    every data CSV join on (Sulu, Zamboanga City, the four Metro Manila
    districts, the Special Geographic Area) are re-keyed to the project's
    vintage; and Sulu is stored under BARMM as its *base* region, because PSA
    books its 2025 output there and `PROVINCE_REHOMES` supplies Region IX from
    2026.
- `DATA_VERSION` → `2026-09-03d` for the new data file.

### Fixed

- **Province-sourced commodities silently read as zero at region and island
  scope, and the cards' "Top Regions" list printed raw numbers** (`1102`,
  `1204`, …) instead of region names. `aggregateProvToRegional()` keys its
  output by `provinceRegionPcode()`, whose last-resort fallback returned
  `adm2Pcode.substring(0, 4)` — a bare 4-character PSGC prefix. That value is
  what keys `catalogueData.byRegion`, and region/island ranking looks those
  keys up with full 10-digit pcodes from the boundary shapes and
  `ISLAND_GROUPS`, so a prefix matched nothing. National scope hid it entirely
  by summing `byRegion`'s *values* without caring about its keys, which is why
  it never showed up in national checks.
  - The fallback is reached whenever `provinceFeatureIndex` is still null.
    The map's first crop is gated behind `bootLoadDone()`, but **the catalogue
    is not** — it opens from a scroll, an `IntersectionObserver` or the
    always-visible jump button, any of which can fire long before the 42 MB
    `Admin_Provincial_Boundary.json` lands. And `catalogueData` caches the
    result for the whole session, so once it happened it stayed broken.
  - Fixed at both ends: `provincialShapesReady` now exposes the boundary fetch
    as a promise and `ensureCatalogueData()` waits on it before any aggregation
    (its `.catch()` still resolves, so a boundary failure degrades instead of
    hanging the catalogue on "Loading…"); and the fallback itself now returns a
    real region pcode (`'1100000000'`), handling the legacy `PH#####` form too.
- **Region names no longer wait on a 100 MB download.** The three regional
  boundary files total ~103 MB and are assigned together by one
  `Promise.allSettled`, so nothing could resolve a region name until the last
  of them arrived — leaving `regionDisplayName()` to print a PSGC code. Added
  `REGION_NAMES`, 18 names taken verbatim from the boundaries' own `ADM1_EN` so
  both sources read identically; the shapes still win when they are loaded.

### Changed

- **The ranking now includes every commodity — nothing is held back.** Overall
  Palay and Overall Banana rejoin `CROP_META` (they had been dropped so their
  volume would not dominate), Overall Corn joins them, and Overall Corn also
  gains the crop-tree item it never had, so every ranked commodity stays
  selectable on the map. The tree and `CROP_META` now reconcile exactly:
  **76 enabled tree crops, 76 `CROP_META` entries, no difference in either
  direction.** All 76 rank at national scope for 2025.
- **Combined commodities are marked, and kept out of the share denominator.**
  The three carry a new `CROP_META.aggregate` string naming what they contain.
  Overall Palay's 2025 national figure (19,611,731 MT) is exactly Irrigated
  (15,104,168) + Rainfed (4,507,563), so those rows now count the same tonnage
  twice on purpose. Left unhandled that would have made the national total read
  94,828,455 MT instead of 58,353,307 MT — **63% inflated** — and pulled every
  "% of area total" down with it, so `computeCatalogueRankings()` excludes
  aggregates from the denominator and from nothing else: they rank, sort, trend
  and move in the rankings as ordinary commodities. Cards show a `Combined
  total` pill (`.catalogue-tag-agg`, 5.25:1 on its own tint) whose tooltip names
  the sub-types, the ranking table prefixes its Category cell in both sort
  modes, and the CSV export gains a **`Combined Total`** column — totalling the
  exported Volume column without it overstates output by that same 63%.
- At national scope in 2025 the top of the list is now Palay, Irrigated Palay,
  Coconut, Banana, Corn, Yellow Corn, Rainfed Palay — the staples crowd the top
  ten, which is the accepted cost of excluding nothing.
- Five crops stay out because they are `item-hidden` in the tree and therefore
  unpublished across the whole app, not filtered by the ranking: Banana
  Cavendish, Sugarcane, Broccoli, Chayote, Celery.

## 2026-09-03 (later)

### Fixed

- **Catalogue province picker went stale when the year changed.** The province
  `<select>`'s option *values* are year-dependent — they come from
  `effectiveProvincePcode()`, which folds a highly-urbanised city into its
  parent province for every year before that city's `PROVINCE_SPLITS.since`
  (2025 for Davao City and Zamboanga City, 2026 for Bacolod, Butuan and Puerto
  Princesa). The picker was rebuilt only on a level or region change, so
  `refreshCatalogueForYearChange()` left it holding a pcode that resolves to
  nothing for the newly selected year: an empty Top 10 next to a map that
  rendered the same area correctly. It now repopulates on year change,
  preserving the current selection and following a city back into its parent
  when the new year predates its split. Guarded on `provincialShapes` so a boot
  with `&year=` in the hash cannot blank a deep-linked province.
- **"📋 View full ranking" did nothing at all when clicked early.**
  `openCatalogueRankingTable()` began with `if (!catalogueData) return;` and the
  button lives in the scope bar, which is live long before the ~73-file
  catalogue load settles — so an early click produced no modal, no message and
  no error. It now opens on a "Loading commodity data…" line and fills itself in
  when the data lands (or says so if the load fails).
- **Yield mode showed "—" for every commodity after a Category change.**
  `catalogueTableSortBy` persists across modal opens, but
  `openCatalogueRankingTable()` called `renderCatalogueRankingTable()` directly
  and never `loadYieldsForCrops()`. Since yield is deliberately lazy, reopening
  in Yield mode after switching Category left every newly-included commodity
  unfetched and dumped into the no-yield bucket — worst under HVEC, where only
  6 of the 16 crops have a yield source at all. New shared
  `refreshCatalogueRankingTable()` now fronts every path that rebuilds the
  table and loads yield first when in Yield mode; `switchCatalogueTableSort()`
  delegates to it.

### Added

- **Coverage line under the card grid** (`#catalogue-coverage`,
  `renderCatalogueCoverageNote()`). The grid shows 10 cards at most and
  `getAllCommodityValues()` silently drops every commodity with no reported
  figure, so "not in the grid" covered two very different situations — ranked
  11th or lower, versus no data here at all — and looked identical either way.
  Dragon Fruit, for instance, ranks **62nd of 73** nationally in 2025 (3,393 MT)
  and simply cannot reach a card. The line now states both: *"Showing the top 10
  of 63 ranked · 10 commodities have no reported figure for this area in 2026"*,
  plus a note at province scope that several commodities are published only
  regionally.
- **The partial-year warning is finally rendered.** `PARTIAL_ANNUAL_YEARS` and
  `partialYearNote()` described 2026's incomplete annual column, but nothing
  ever called the function — it was dead code. At 2026 the fourteen regional
  Agristat files stop at 2025, so Mango, Coconut, Lettuce and all seven
  Fisheries/Livestock commodities drop out of the ranking (63 of 73 rank at
  2026, against 73 of 73 at 2025) with no explanation on screen. The note now
  appears on both the coverage line and the full ranking table's subtitle.
- **Footnote now explains the Palay/Banana omission.** Overall Palay and Overall
  Banana had been dropped from `CROP_META` on purpose so their volume would not
  dominate every ranking, but nothing said so — they read as missing. The
  footnote now states it. *(Superseded the same day: both were put back and the
  footnote rewritten — see "The ranking now includes every commodity" above.)*

## 2026-09-03

### Added
- **Four highly-urbanised cities now appear as their own areas on the map.**
  Davao City, Bacolod, Butuan and Puerto Princesa had no polygon in
  `Admin_Provincial_Boundary.json`, so PSA's separate figures for them had
  nowhere to render — they were folded into the parent province and vanished
  from the map as distinct places.

  Their carved polygons come from `Admin_Boundary_Provincial_NCR_HUC_2026`, and
  the four parent provinces were swapped for the carved versions in the same
  edit, so city and province do not overlap. Verified geometrically: carved
  parent + city reproduces the original province area to 0.00–0.03%.

  `PROVINCE_SPLITS` gains one entry each, mirroring Zamboanga City. **`since`
  is per city, from the published series** — Davao City breaks out from 2025,
  the other three only from 2026. Before `since` the polygon takes its parent's
  colour and the popup says "reported under parent"; after, it carries its own
  value. Getting `since` wrong in either direction moves real tonnage between a
  city and its province.

  The importer stops folding them (`HUC_OWN_PCODE` replaces `HUC_PARENT_PCODE`,
  now empty). Folding *and* splitting would double-fold: the tonnage would land
  on the parent while the city polygon rendered as no-data. National totals are
  unchanged and still reconcile with PSA to the centavo.

### Fixed
- **Palay and corn regional totals were overstated; now derived from provincial
  data.** Every crop carrying *both* a regional CSV and a provincial one
  disagreed with itself, and always in the same direction — the regional file
  read higher than the sum of its own provinces. For palay and corn the entire
  gap sat in BARMM, and the provincial files reconcile with the published PSA
  sheet to the centavo, so the regional file was the wrong one.

  | BARMM 2025 | Was | Now | PSA |
  |---|---|---|---|
  | Overall Palay | 944,951.43 | **882,292.43** | 882,292.43 |
  | Yellow Corn | 771,546.77 | **708,664.77** | 708,664.77 |

  National Overall Palay 2025 goes from 19,674,389.99 to **19,611,730.97**,
  matching PSA exactly. Six `cropConfig` entries lost their `file:` so
  `loadCropData()` takes the `!file && provFile` path and derives regional
  totals with the year-aware `aggregateProvToRegional()` — one source of truth,
  so the two views cannot drift apart again. The six regional CSVs are now
  unreferenced but left on disk.

  **Livestock and fisheries were deliberately not touched.** They disagree too
  (Chicken +33,795; Hog +29,688; Egg +20,300), but their gap is spread across
  regions rather than concentrated in BARMM, and no published sheet covers them
  — so which side is right is still unknown. Unverified is not the same as wrong.

- **Palay annual files rebuilt from the sheet.** They carried five rows with a
  blank `ADM2_PCODE`, which `loadCropData()` silently drops — including Davao
  City's 13,162.82 MT, growing to ~18,500 MT in 2026 once Bacolod, Butuan and
  Puerto Princesa start reporting too. Rebuilt via `--annual`, those cities are
  folded into their parent provinces and every file now has zero codeless rows.
  Rainfed also picked up 3,291.91 MT it had been missing.

- **`Corn_ProductionVolume_Provincial.csv` (new).** Overall Corn had a regional
  source but no provincial one, so the map could not drill into it and its
  regional total had nothing to be checked against. Derived from Yellow + White.
- **Yellow Corn and White Corn showed irrigated palay.** Both
  `YellowCorn_ProductionVolume_Provincial.csv` and
  `WhiteCorn_ProductionVolume_Provincial.csv` were byte-identical to each
  other, and their 2025 national total of **15,104,167.77 MT** is exactly the
  figure in `IrrigatedPalay2024onwards.csv`. Picking either corn variant on the
  map drew palay, and the two variants drew the same thing — so the error was
  invisible from inside the map, since a wrong number still renders as a
  plausible choropleth.

  Both files are now rebuilt from the Agristat sheet and reconcile with PSA to
  the centavo across all six year columns:

  | | 2025 was | 2025 now | PSA |
  |---|---|---|---|
  | Yellow Corn | 15,104,167.77 | **6,295,527.28** | 6,295,527.28 |
  | White Corn | 15,104,167.77 | **1,955,148.50** | 1,955,148.50 |

  The rebuilt files also carry **no codeless rows** (the palay annual file has
  five), because the importer folds Bacolod, Butuan, Puerto Princesa and Davao
  City into their parent provinces rather than emitting them with a blank
  `ADM2_PCODE` the map silently drops.

### Added
- **`sync_agristat.py --annual`.** The importer can now rewrite the annual
  provincial files listed in `ANNUAL_FILE`, not just `data/subannual/`, reusing
  the same province aliases, HUC folding and collision assertion — so the
  annual and sub-annual files cannot drift apart in how they resolve a province.

  The `2026` column is filled from **Q1**, set by `PARTIAL_2026_FROM`. PSA has
  published no 2026 annual figure (every annual row for that year is empty),
  and Q1 is the convention two-thirds of the existing provincial volume files
  already follow. S1 would be more data but the Top 10 catalogue ranks crops
  against each other within a year, so a half-year corn would outrank a
  quarter-year palay on period coverage rather than production.

- `region_labels()` keeps the longest label per pcode rather than the first:
  `data/` holds both `Region III` and `REGION III (CENTRAL LUZON)`, so
  `setdefault` let `os.listdir` order decide the spelling, and the first run
  did produce the short form.

## 2026-09-02

### Added
- **Share-of-area bar on the Top 10 cards, with its label.** A thin
  proportional bar plus `"12.4% of area"` in the *collapsed* part of each card.
  The label is not optional: shipped bare first, the bar read as a progress
  meter or a score — green, partly filled, no caption — because the only text
  explaining it sat in the collapsed details. The number is what makes the
  length mean anything, so the two are one component. The "% of area total" figure existed already
  but lived inside `.catalogue-card-details`, which is collapsed by default —
  so the one number that lets you compare rank 1 against rank 4 was hidden
  exactly while you were scanning the grid. Ranking is what this grid is for,
  and length communicates it without reading ten figures. The bar is
  `aria-hidden`; the share is spoken once via the card's `aria-label` instead.

- **2026 in the annual view, flagged as partial.** `ANNUAL_YEARS` now runs
  2021–2026. PSA publishes an annual figure only after Q4 closes, so the `2026`
  column holds whatever part of the year had been reported — and how much that
  is *varies by commodity*: against each file's own 2025, 66 provincial volume
  files sit near a single quarter, 12 near a semester, and 36 outside both.
  There is therefore no honest fixed label like "Q1–Q2"; selecting 2026 raises
  an amber note under the timeline (`#partial-year-note`) saying the year is
  partial and not comparable, with the full explanation in the help panel.

  `currentYear` still defaults to **2025** so the map does not open on partial
  data. The warning is annual-only — 2026Q1/Q2/S1 are complete periods, and the
  sub-annual period lists already stop where PSA's data stops.

- **2026 regional boundary vintage.** `data/Admin_Boundary_Regional_2026.json`
  joins the two existing regional files, and `getActiveShapes()` becomes a
  three-way switch: pre-2024 → 2024–2025 → 2026+. The 2026 layer moves Sulu
  from BARMM to Region IX, matching `PROVINCE_REHOMES` (`since: 2026`) so the
  polygons and the regional rollup agree in every year. `parseInt(currentYear)`
  drives the switch, so `'2026Q1'` in the Quarter/Semester views resolves to
  2026 and picks the right vintage.

  The file is **dissolved from the 2026 provincial layer**, not exported
  separately: a direct regional export had Sulu present in *both* Region IX and
  BARMM, overlapping by 1,519 km² — the province's whole area, claimed twice.
  Dissolving from provinces makes that impossible by construction.

- **Quarterly and semester views.** A three-way switch (Annual / Semester /
  Quarter) above the timeline. `YEARS` is now the active period list rather than
  a fixed set of years, and the slider indexes into it — periods are not evenly
  spaced integers once quarters are involved. The dots and tick labels are drawn
  by `renderTimeline()` instead of being hard-coded in `index.html`.

  The control is **two levels**: the slider picks a year, and a branch row under
  it picks the period within that year (1st SEM / 2nd SEM, or Q1-Q4), with a
  connector descending from the selected year. A first attempt put all 22
  quarters on a single track - 3px dots and smeared labels - and it also hid the
  structure that matters, which is that a quarter belongs to a year. Only
  periods that exist are offered (2026 stops at Q2), and changing year keeps the
  period you were on where that period exists.

- **`tools/sync_agristat.py`.** Builds `data/subannual/` from the published
  Agristat sheet — pivots its long format to the wide shape the Atlas reads,
  joins province names to PSGC codes (the sheet carries none), and derives
  Overall Palay/Corn by summing their subtypes. Validated: 2024 quarters sum to
  the existing annual figures for all 79 comparable provinces, and Overall
  matches Irrigated + Rainfed across all 1,826 cells.

- Three highly-urbanised cities PSA began reporting separately in 2026 (Bacolod,
  Butuan, Puerto Princesa) are folded into their parent provinces, which is what
  the boundary layer draws. Several existing files in `data/` give those cities
  PSGC codes belonging to *real provinces* — `1804600000` is Negros Oriental,
  `1600200000` is Agusan del Norte — so the importer pins the parent codes from
  the boundary file rather than harvesting them.

### Fixed
- **Contrast failures in the commodity catalogue (WCAG AA).** Seven colours
  measured and corrected:

  | Element | Before | After |
  |---|---|---|
  | `.cta-rank` (rank digits) | 1.92:1 | 4.54:1 |
  | `.cta-heading` | 2.32:1 | 4.54:1 |
  | `.catalogue-tag` | 3.66:1 | 4.55:1 |
  | `.catalogue-stat-yoy.up`, `.catalogue-rank-delta.up`, `td.yoy-up` | 4.16:1 | 4.60:1 |
  | `.catalogue-expand-chevron` (icon, 3:1) | 1.92:1 | 3.07:1 |

  `.cta-rank` at 1.92:1 was the worst in the file, and sat on the element
  carrying the list's meaning. `.catalogue-tag` is measured against its own
  `#e5f4ec` pill rather than the page white — against white it would have
  scored a false pass.

- **`prefers-reduced-motion` is now honoured.** It appeared nowhere in
  `app.css` before. Decorative animation and transitions collapse to 0.01ms
  (not 0s — some engines skip `transitionend` at exactly zero, stranding any
  handler waiting on it). The loading spinner keeps turning, slowly, because
  freezing it would report "stalled" when the truth is "loading". Leaflet's
  pan/zoom is included deliberately: a reader who asked for less motion did not
  ask for the map to slide across the viewport.

  The two `scrollIntoView({behavior:'smooth'})` jumps between map and catalogue
  are handled in JS (`prefersReducedMotion()`, `scrollToEl()`) — a script
  argument beats the CSS property, so the media block cannot reach them.

- **Boundary fetches now carry a cache buster — on their own `BOUNDARY_VERSION`.**
  They previously had no `?v=` at all, so a corrected boundary would have been
  masked by the browser cache indefinitely: the one class of data file where a
  stale copy is least visible and most wrong.

  Hanging them off `DATA_VERSION` (the first attempt) was worse than the
  problem. That constant bumps whenever *any* file in `data/` changes — one
  crop CSV is enough — and the three regional files plus the provincial one
  total **~103 MB**, so every routine data edit forced every visitor to
  re-download all of it, with a blank map until it finished. `BOUNDARY_VERSION`
  bumps only when a boundary file itself changes.

- **One failed boundary file no longer blanks the whole map.** The regional
  loader used `Promise.all`, which is all-or-nothing: going from two files to
  three meant any single failure left all three `null`, and both the main map
  and the catalogue's illustration map rendered empty even when two of the
  three had arrived fine. Now `Promise.allSettled`, with `getActiveShapes()`
  falling back to the nearest vintage that did load, and an error naming the
  vintage that failed rather than saying "boundaries" and sending you to look
  at the map. `bootLoadDone()` also runs on failure now — previously a boundary
  error meant the boot counter never reached zero and no crop was ever
  auto-selected.

### Changed
- **Periods are spelled out wherever they appear in a sentence**: `2025 Quarter 4`
  and `2025 2nd Semester`, not the raw `2025Q4` key, which is a database
  identifier rather than something to read. Covers the legend average, the
  province alias note, the data-table export caption, the sparkline tooltips and
  the catalogue caption. The branch buttons keep the short form (`Q1`,
  `1st SEM`) - four `Quarter 1` buttons do not fit a 294px panel, and they sit
  directly under the year anyway. Table column headers use `Q1 2021`, since 22
  columns of the long form would be unreadable.
- The trend summary no longer says "22-Year Trend" when showing quarters, and
  reads "since 2021 Quarter 1" rather than "since 2021Q1".
- The legend's source line derives its year span from the loaded data instead of
  hard-coding 2021-2025, which stopped being true as soon as a quarter view
  reached into 2026.

### Fixed
- **The trend chart never said which period was selected.** With 2nd Semester
  chosen, the only period words on the chart were its two end labels
  (`2021S1`, `2026S1`) and "since 1st SEM 2021" - so a 2nd-semester chart read
  as a chart *about* 1st semester. The selected point was marked only by a 3px
  colour change, which is colour carrying meaning on its own. It now has a
  dashed guide line, a white-ringed marker, and a caption naming it in words
  ("Showing 2025 2nd Semester").
- **"Variance in previous year" / "Annual Growth Rate" were wrong in
  sub-annual views** - those rows compare against the previous *period*. They
  now name it outright: "Change vs 1st SEM 2025", "Growth vs 1st SEM 2025".

### Changed
- **Three label registers, by how much room the context has.** Long
  (`2025 2nd Semester`) for standalone headers - the legend average, the period
  pill, the chart caption. Short (`2nd SEM 2025`) for dense repeated rows,
  chart axis ends and tooltips, where the long form wrapped every popup row
  onto two lines and pushed the card from 338px to 521px. Bare (`Q1`,
  `1st SEM`) for the branch buttons. The chart's end labels are just the years,
  since the caption below names the exact period.

### Fixed (found by a UI/UX audit pass)
- **Deep links were completely broken — a regression from the timeline work.**
  `bootFromHash()` painted the timeline *before* parsing the hash, and
  `setYear()` calls `updateUrlHash()`, which does a `history.replaceState`. So
  boot overwrote the very link it was about to read, and every shared URL landed
  on the default crop at the default year. The hash is now parsed first.
- **A shared link from a semester/quarter view came back as annual.** The hash
  recorded `year=2025Q2` but not which axis that belonged to. It now carries
  `gran=` (omitted for annual, so existing links are unchanged), restored after
  the crop's own load settles - switching immediately started a second load and
  whichever response landed last won, which could leave annual figures being
  read against a quarterly axis and paint nothing.
- **A deep link to a crop with no item in the crop tree left the map blank.**
  `autoSelectInitialCrop()` returned without loading anything. It now falls back
  to the default crop. `Overall Corn Production` is the one such orphan: it has
  config and data files but no tree item, so it cannot be selected in the UI.

### Added
- **A rounding note, in the footer and on the data table.** PSA rounds every
  figure to two decimals *per reporting period*, independently — so a year's
  quarters need not add to exactly its annual total. In 2025 irrigated palay, 7
  of 84 provinces differ by exactly one centavo (4 down, 3 up), leaving a net
  0.01 MT nationally out of 15,104,167.77 MT. The same appears in 2019, 2022 and
  2023. This is round-then-sum vs sum-then-round in the source, not an error
  here, and the figures are deliberately left exactly as PSA published them.

### Fixed
- **Davao City's output was landing on Davao Occidental's polygon.** The
  importer harvests province name -> PSGC pairs from `data/`, and a file there
  gives "City of Davao" the code `1108600000`, which is DAVAO OCCIDENTAL. The
  two merged: that polygon showed 11,862 MT for 2025 irrigated palay instead of
  1,991 - roughly 6x. Davao City now folds into Davao del Sur (`1102400000`),
  matching both the boundary layer, which has no Davao City polygon, and the
  existing annual files. Davao del Sur now reads 154,262.13 for 2025, exactly
  matching `IrrigatedPalay2024onwards.csv`.
- **A collision guard makes that class of bug fatal.** Two source province names
  resolving to the same PSGC code silently merges two provinces while the
  national total still looks correct, so nothing downstream notices. The
  importer now refuses to write files when it happens.
- **Province labels come from the boundary layer, not the harvested map.**
  Reversing the name->code map labelled Davao Occidental's polygon "City of
  Davao"; `Admin_Provincial_Boundary.json` is the only source where a code and
  its name are guaranteed to agree.

### Known gaps
- Semester and Quarter cover Palay and Corn only; every other crop greys those
  options out and says so. NCR has no sub-annual rows in the source, so it stays
  unpainted there. 2026 is reported through Q1-Q2 only. The catalogue view stays
  annual.

## 2026-09-01

### Fixed
- **Sulu now counts under Region IX from 2026, not 2025.** `PROVINCE_REHOMES`
  had `since: 2025`, so the regional rollup moved Sulu's 2025 production out of
  BARMM a year early. PSA's own figures book Sulu under BARMM for 2025 (its
  Region IX row for that year is empty), so BARMM's 2025 total was understated
  and Region IX's overstated for every crop. 2021-2024 were unaffected.

- **Footer copyright now credits Agricultural Statistics, not AMAS.** The line
  read "Department of Agriculture — Agribusiness and Marketing Assistance
  Service (AMAS)", which names the wrong office for this data. Corrected in the
  Production Atlas footer, and in the Bantay Presyo and Geospatial Corner
  footers alongside it. Bantay Presyo's separate *Prices* source line still
  credits AMAS, because the Bantay Presyo price-monitoring programme genuinely
  is theirs — only the copyright holder was wrong.

## 2026-08-31

### Added
- **Carto API key is in.** Voyager renders clean again; the watermark is gone.
  `CARTO_API_KEY` is set in `js/app.js` and picked up by `cartoUrl()` for both the
  basemap and the hybrid labels layer.

### Fixed
- **Attribution now credits OpenStreetMap as well as Carto.** It read `© Carto`
  alone, which does not meet Carto's free-tier condition - their words: "keep the
  CARTO and OpenStreetMap attribution visible on your maps. That is what the free
  tier is in exchange for." Both tile layers now carry
  `© OpenStreetMap, © CARTO` with links.
- Basemap dropdown no longer labels Carto "(needs API key)". Stadia still does,
  because it still does.

### Known
- Carto's free tier is **5,000,000 tile requests a calendar month**. Nothing in the
  app counts requests, so this will be noticed only if Carto get in touch.
- **Carto are retiring raster tiles.** This project is raster-only (`L.tileLayer`
  cannot render vector), so a future move means MapLibre GL or a Leaflet vector
  plugin, not a URL change. Not urgent, not free either.

## 2026-08-29

### Fixed
- **Carto key parameter is `key`, not `api_key`.** The earlier value was a guess,
  flagged as unverified at the time; CARTO's documented tile URL is
  `.../voyager/{z}/{x}/{y}.png?key=YOUR_KEY`. Left wrong, adding a valid key would
  have changed nothing — CARTO ignores unknown parameters and serves the same
  watermarked tile, so it would have looked like a rejected key rather than a
  malformed URL. Corrected in both this project and bantaypresyo.

## 2026-08-28 (2)

### Fixed
- **Carto enforcement had already started, and it is invisible to code.** Carto now
  returns unauthenticated tiles as a valid 200 PNG with "API KEY REQUIRED" printed
  diagonally across the map. Nothing errors, so the `tileerror` fallback added earlier
  today never fires — status codes and byte counts all look healthy while the basemap
  renders defaced.
- **Default basemap is now Esri World Light Gray Canvas** (`gray`), which needs no key
  and is built for data overlay; the choropleth reads better on it than it did on
  Voyager. Carto and Stadia stay selectable and are labelled "needs API key" in the
  Layers flyout, so choosing one is informed rather than a surprise.
- **Esri Hybrid used Carto's labels-only tiles**, so it was showing "API KEY REQUIRED"
  over the satellite imagery. Now uses Esri's transparent Boundaries and Places
  reference layer.

## 2026-08-28

### Fixed
- **`file://` now explains itself.** Opening `index.html` by double-clicking it gives a
  basemap with no country on it: boundaries load by `fetch()`, and a `file://` origin is
  opaque, so the browser refuses every one. The message said "try reloading the page",
  which cannot ever help — a reload fails identically. It now detects the protocol and
  says the page must be served over http, with the command to do it
  (`loadFailureHint()`).

### Added
- **Carto API key slot and basemap fallback.** Carto now issues API keys for its
  basemaps (<https://carto.com/basemaps/apikey/>); the tiles still serve
  unauthenticated today, so this is preparation rather than a fix. Both Carto layer
  URLs are now built by `cartoUrl()`, which appends `CARTO_API_KEY` when one is set —
  paste the key there and restrict it to this project's domains in the Carto
  dashboard, because a static site cannot hide it.
- Carto is the **default** basemap, so a refusal would have loaded a blank grey grid
  with the choropleth floating on nothing. `cartoVoyager` and `cartoLabels` now watch
  Leaflet's `tileerror` and, after four failures, switch to OpenStreetMap and report
  it through `showDataError()`. Four, not one: a single missing tile at a deep zoom is
  ordinary, and swapping basemap mid-pan over one timeout is worse than the problem.
  OpenStreetMap is the fallback because it is the only option here that needs no key —
  Stadia needs one too.

## 2026-07-30 (4)

### Added
- **"HVEC" added as a second curated Category filter option**, alongside "HVC Priority" — 16 crops: Coconut, Banana (Saba/Cardava), Pineapple, Mango, Durian, Cacao, Lady Finger (Okra), Ube, Dragon Fruit, Calamansi, Pomelo, Dalandan, Avocado, Asparagus, Pili, Rambutan. Same mechanism as HVC Priority: a new `hvec: true` flag on each `CROP_META` entry, matched via a second sentinel `HVEC_CATEGORY_VALUE` in `getAllCommodityValues()`'s category-filter check, and mapped back to the display label "HVEC" by `categoryDisplayLabel()` wherever the active category shows up in user-facing text.

## 2026-07-30 (3)

### Added
- **"HVC Priority" option added to the catalogue's Category filter** — a curated cross-category list (High Value Crops Development Program), spanning 15 crops that don't share a single Primary Category: Red Onion, Red Shallot, White Onion, Carrots, Tomato, Eggplant, Bitter Gourd (Ampalaya), Squash, String Beans, White Potato, Cabbage, Chinese Cabbage, Habitsuelas, Garlic, and Chili Pepper. New `hvc: true` flag on each of those `CROP_META` entries, matched via a sentinel `HVC_CATEGORY_VALUE` in `getAllCommodityValues()`'s category filter (separate from the normal `meta.primary === categoryFilter` check, since this list cuts across Vegetables/Root Crops & Tubers/Herbs & Spices). New `categoryDisplayLabel()` helper keeps the sentinel out of user-facing text (empty-state message, ranking-table subtitle) while still working transparently everywhere else `currentCatalogueCategory()`'s value flows through (cards, full ranking table, compare view, CSV export, URL hash).

## 2026-07-30 (2)

### Added
- **Yield (MT/HA) added for 8 more crops** that previously only had Volume + Area: Cassava, Sweet Potato (Camote), White Potato, Garlic, Ginger, Lemongrass, Spring Onion, and Peanut — all confirmed at standard MT/HA scale (≈0.78–28) before wiring, none tree crops.

## 2026-07-30 (1)

### Added
- **Yield (MT/HA) added for 12 vegetable crops** that previously only had Volume + Area: Malabar Spinach (Alugbati), Jute Mallow (Saluyot), Radish, Spinach, Pechay, Cucumber, Tomato (Kamatis), Sponge Gourd (Patola), Bottle Gourd (Upo), Bell Pepper, Lettuce, and Asparagus — all confirmed at standard MT/HA scale (≈0.05–17) before wiring, none of them tree crops. Files were initially requested before they existed in `data/`; re-checked once the user confirmed they'd been added.

## 2026-07-29 (7)

### Added
- **Yield ↔ Yield/Tree auto-switch**, extending the existing Trees ↔ Area behavior to a second pair: selecting a crop while on **Yield/Tree** that isn't one of the ~10 tree crops it covers (but does have standard Yield) now auto-switches to **Yield** instead of landing on an empty "not available" view — and the reverse, picking a Yield/Tree-only crop like Cacao while on **Yield** auto-switches to **Yield/Tree**. `autoSwitchTreesArea()` is renamed `autoSwitchMetricCounterpart()` and its `counterpart` map now holds both pairs (`trees↔area`, `yield↔yieldtree`); same mechanism, same trigger point (`selectCrop`).

## 2026-07-29 (6)

### Fixed
- **Legend/popups/table showed "0" for small-value metrics despite the map correctly shading by magnitude** — e.g. Cacao's Yield/Tree legend read "0 – 0 MT/tree" for every class, and its national average showed "0 MT/tree," even though the underlying values (≈0.0001–0.001) genuinely differ enough to produce distinct choropleth classes. Root cause: every metric-value formatter across the app used a flat `maximumFractionDigits: 2`, which rounds anything under 0.005 straight to "0.00" — harmless for Volume/Area (always much larger than 1) but silently broke once Yield/Tree and some of the smaller new Yield crops (Abaca, Cacao, Pili, etc.) introduced values well under 1.
- New shared `fmtMetricValue(v)` scales decimal precision with the value's own magnitude (4 decimals under 0.01, 3 under 1, 2 otherwise — unchanged from before for anything ≥1) and now backs every spot that displays the *currently active metric's* raw value: region/province popups, the growth/stats-row/sparkline-tooltip popup helpers, the legend's class ranges and national average, the Top 5 ranking list, the data table (including its variance column), the catalogue's lazy per-card Yield stat, and the ranking-table's Yield-sort column. Catalogue Volume figures (always MT-scale, never this small) are untouched.

## 2026-07-29 (5)

### Added
- **More Yield/Tree and Yield coverage, split by checking actual file contents rather than filename alone:**
  - **Yield/Tree** (MT/tree, `yieldTreeFile`): Rambutan, Pomelo, Durian, Dragon Fruit, Pili, and Cacao. Pili and Cacao's files share the same "_provincial_yield" filename pattern as several standard-Yield files below, but their values (≈0.0001–0.004) are tree-ratio scale, not MT/HA scale — both are genuine tree crops, so classified as Yield/Tree instead.
  - **Yield** (MT/HA, `yieldFile`): Pineapple, Melon, Abaca, Pinya Fiber, Cotton, Bariw, Salago, and all 3 Tobacco variants (Overall, Virginia, Native) — none of these are tree crops, and their values (≈0.06–8.5) are consistent with a per-hectare ratio.
  - All twelve crops previously had Volume + Area only; this fills in their missing Yield tab (or, for the 6 tree crops, adds the new Yield/Tree tab from 2026-07-29 (4)).

## 2026-07-29 (4)

### Added
- **New "Yield/Tree" metric** (MT per bearing tree) for Avocado, Banana Cardava (Saba), Calamansi, and Dalandan — a new `METRICS` entry (`id: 'yieldtree'`, `fileKey`/`provFileKey: 'yieldTreeFile'`, `average: true`, ratio metric like Yield) wired to `dalandan_yieldtree_provincial.csv`, `calamansi_yieldtree_provincial.csv`, `Banana(saba)_yieldtree_provincial.csv`, and `avocado_yieldtree_provincial.csv`. New "Y/Tree" tab in the metric-tabs row (shortened from "Yield/Tree" — with 5 tabs instead of 4 in the same fixed-width crop panel, every tab lost ~20% of its width, so tab font-size/letter-spacing were nudged down slightly and the label shortened to keep all five comfortable; the fuller "Yield/Tree" label is still used in the tab's "not available" tooltip).
- **Data-quality note:** these 4 new files are *not* the same kind of data as the existing `banana_yieldtree_provincial.csv`/`mango_yieldtree_provincial.csv` (wired as the **Trees** metric — literal bearing-tree counts, values like 212,015). The new files hold tiny decimal values (e.g. Avocado ≈0.02, Calamansi ≈0.004) consistent with a yield ratio, not a count — confirmed with the user before wiring them in as a distinct metric rather than guessing.

## 2026-07-29 (3)

### Changed
- **Catalogue control strip de-cluttered** — "View full ranking" and "Compare areas" (previously their own row above the scope bar) now live inside `#catalogue-scope-bar` itself, pushed to the trailing edge (`margin-left: auto`) with a divider, so it reads as one control strip (filters, then a divider, then view actions) instead of two stacked rows of controls before the map/cards even start. On narrow screens, where the bar wraps, the divider switches from a left border to a top border so it still reads correctly as a section break rather than a stray vertical mark.
- **Unified the floating map chrome's color language** — the nav rail, `#breadcrumb`, and `#status-pill` had each picked their own "dark pill" color independently over the course of this project (rail: `#221d3d`; breadcrumb/status-pill: an unrelated navy, `rgba(20,26,38,..)`). All three now share the rail's hue, so the floating controls around the map read as one design system instead of three separately-tuned pieces. Added a single documented reference comment (top of `css/app.css`, above `#control-panel`) listing the actual z-index stacking order for every floating map-chrome element, replacing what was previously just scattered magic numbers with no explanation in one place.

## 2026-07-29 (2)

### Added
- **Hover tooltip on Top Regions/Top Provinces names** — `.cta-name` now carries a `title` attribute with the full name, so a long region/province name truncated by the list's ellipsis (`text-overflow: ellipsis`) is still readable on hover.

## 2026-07-29 (1)

### Changed
- **Top Regions/Top Provinces lists on commodity cards drop the volume figure** — rank + name only now, no MT total. Showing the raw per-region/province number there read as noise/out of place, being a different figure from the area-scoped Volume the rest of the card is about.

## 2026-07-28 (6)

### Added
- **Each commodity card now shows its own nationwide Top 5 Regions and Top 5 Provinces** — a "where is this actually grown" breakdown, independent of whatever area is currently selected in the scope bar (e.g. viewing Benguet's Top 10 and expanding Cabbage still shows Cabbage's top regions/provinces countrywide, not just within Benguet). New `getTopAreasForCommodity(cropName, year, level, limit)` reads straight from the crop's already-loaded `catalogueData` entry — no extra fetches. The Provinces column is simply omitted for crops with no provincial source (Palay/Corn variants, Fisheries, Livestock). Expanded-card `max-height` raised 360px → 520px to fit both lists.

## 2026-07-28 (5)

### Fixed
- **Compare Areas modal only offered Philippines + island groups, no regions or provinces** — its option list (`compareAreaOptionsHtml()`) was built exactly once at page load, before `getActiveShapes()`/`provincialShapes` (both fetched asynchronously) had necessarily resolved; if either was still null at that moment, the region/province options were silently omitted for good, with no retry. The selects are now rebuilt fresh (`populateCompareSelects()`) every time the compare modal is opened — by then boundary data has long since loaded — while preserving whatever the user had selected on a previous open.
- **Compare Areas lists bumped from top 5 to top 10** per side, matching the rest of the catalogue.

## 2026-07-28 (4)

### Added
Six catalogue features in one batch, all layered on the existing ranking engine (`computeCatalogueRankings()`/`getAllCommodityValues()`) so every view agrees on the same numbers:
- **Category filter** — a new always-visible "Category" dropdown in the scope bar (`#catalogue-category-select`, populated from every unique `CROP_META.primary` value) restricts the cards, full ranking table, CSV export, and compare view to one Primary Category at a time (e.g. rank only within Fruits). `getAllCommodityValues()`/`getTopCommodities()`/`computeCatalogueRankings()` all gained an optional `categoryFilter` parameter. Fisheries/Livestock/Palay/Corn have no category in the source dictionary and are excluded from every category filter, same as they already omit the tag badges on their cards.
- **Search box in the full ranking table modal** (`#catalogue-table-search`) — live-filters rows by commodity name, scientific name, local name, or category as you type; true rank numbers stay stable under the filter (looked up via `rankings.all.indexOf(r)`, not the filtered array's index).
- **Yield sort tab in the ranking table modal** — a Volume/Yield toggle (`switchCatalogueTableSort()`); switching to Yield lazily fetches yield only for the commodities currently in view (`loadYieldsForCrops()`), same lazy principle as the per-card yield stat, and swaps in a Yield-specific column set (Δ/Share/YoY/trend are volume-rank concepts that don't carry over to a yield ordering, so they're dropped in that mode rather than shown misleadingly).
- **CSV export on the ranking table modal** (`exportCatalogueRankingCSV()`) — downloads the full (unfiltered-by-search) ranking with per-year Volume columns (2021–2025), category, share of total, and YoY %, UTF-8 BOM-prefixed for Excel.
- **Compare areas modal** (`#catalogue-compare-modal`, opened via "⇄ Compare areas") — two independent area pickers (Philippines / island group / any region / any province, built once by `compareAreaOptionsHtml()` and reused for both sides) each showing their own top-5 commodities side by side for the current year, respecting the active Category filter.
- **Catalogue scope deep-linked into the URL hash** — `catScope`/`catIsland`/`catRegion`/`catProvince`/`catCategory` are now written by `updateUrlHash()` alongside the existing crop/year/region params, and restored on load via `hashBootCatalogue` (best-effort: region/province options depend on boundary data that loads asynchronously, so an unlucky race can leave the level/category restored but the specific region/province dropdown empty).

## 2026-07-28 (3)

### Fixed
- **National-scope illustration map looked small/zoomed out** — its 24% viewBox crop margin was added specifically to leave room for the top-10 icon ring outside the coastline, but that icon feature is currently disabled (`SHOW_CATALOGUE_TOP10_ICONS = false`). `renderCatalogueMap()` now only applies the wider margin while that flag is actually on; otherwise it uses the same 6% margin as every other scope, so the country fills the panel instead of floating in empty space.

## 2026-07-28 (2)

### Changed
- **Illustration map's area label (Philippines / region / province name) moved to float top-center over the map**, instead of sitting below it as a caption — a small white pill (`#catalogue-map-label`, now `position:absolute`) anchored to `#catalogue-map-panel`. The mobile layout's panel override switched `position: static` → `relative` so it still has a containing block to anchor against at narrow widths.

## 2026-07-28 (1)

### Added
- **"📋 View full ranking" button in the Top 10 Commodities catalogue** opens a modal listing every commodity ranked for the current scope/year (not just the top 10 cards) — Rank, rank movement (Δ), Commodity, Category, Volume, Share of area total, YoY %, and a 5-year trend sparkline per row. Reuses the same `computeCatalogueRankings()` math the cards use, so the numbers always agree between the two views. Yield is intentionally left out of this table — it's only fetched per-card on expand to avoid loading it for all ~75 crops upfront, and showing it here for every ranked commodity would defeat that.
- New modal chrome (`#catalogue-table-modal`) mirrors the existing data-table modal's look, wired into the same Escape-key close chain as the other modals.

## 2026-07-27 (28)

### Added
- **Catalogue cards gained five new analytics, kept to one compact row so they don't overwhelm the existing layout:**
  - **Rank movement** (▲/▼/–/NEW) next to the volume figure in the collapsed view — a quick glance without expanding, comparing this year's rank to last year's for the same crop/area.
  - **Year-over-year % change**, **share of this area's total production**, and a lazily-fetched **Yield (MT/HA)** stat, all on one line inside the expanded panel.
  - A tiny 5-year (2021–2025) sparkline showing the crop's own trend shape, next to that stats line.
  - All four of these (rank delta, YoY, share, sparkline) come straight from the Volume data already loaded for the catalogue — no extra network requests. Yield is the exception: it's fetched only the first time a card is expanded (`loadYieldForCrop()`/`loadCardYield()`), not upfront for all ~75 crops, since roughly half don't have a yield source and it would double an already-heavy initial load for a stat that's invisible until expanded.
  - `getTopCommodities()` is now built on two new shared helpers, `valueForScopeEntry()` and `getAllCommodityValues()` (the full ranking, not just top 10) — needed to compute a crop's rank/value in a different year for the YoY and rank-movement stats.
  - Expanded-card `max-height` raised 320px → 360px to fit the new row.

## 2026-07-27 (27)

### Changed
- **Top-10 map icons hidden for now** — the emoji markers scattered across the illustration map (province/region/island containment + national coastline ring) are implemented but gated off behind `SHOW_CATALOGUE_TOP10_ICONS = false` in `js/app.js` while the feature is revisited. Flip that flag back to `true` to re-enable; no other code changed.

## 2026-07-27 (26)

### Changed
- **Top-10 icons now stay inside the actual province/region/island shape, not just its bounding box** — the previous grid layout could place an icon out in the sea or over a neighboring area for any non-convex/irregular boundary (e.g. a slim province, or an island group whose regions aren't a solid block). A new ray-casting point-in-polygon test (`pointInGeometry`/`pointInRing`) samples a 12×12 grid of candidate points over the highlighted area's bounding box and keeps only ones that land inside its actual geometry, then spreads up to 10 of them evenly (`sampleInteriorPoints()`).
- **National scope now rings its icons in the sea just outside the coastline** instead of scattering them across the landmass — there's no single "selected shape" to sit inside at country scale, so the 10 markers are placed evenly around an ellipse just past the country's silhouette. The illustration map's crop margin is widened to 24% at national scope (was a flat 6%) so that ring doesn't get clipped by the SVG's default `overflow:hidden`.

## 2026-07-27 (25)

### Added
- **Top-10 commodity icons now appear on the illustration map itself** — `renderCatalogueMap()` scatters each ranked crop's emoji (in a white legibility disc, with a hover tooltip showing name + rank) across the currently highlighted area: the selected province, the selected region, the selected island's regions, or the whole country at national scope. Icons are laid out in a simple grid sized to the highlighted area's own bounding box, so they scale sensibly whether that's one small province or a whole island group. Since the map can render before crop data has finished loading, it's now re-run a second time once `ensureCatalogueData()` resolves so the icons appear without needing another scope change.

## 2026-07-27 (24)

### Changed
- **Catalogue cards now expand accordion-style** — opening a card's details collapses any other currently-open card first. Previously several cards in the grid could be expanded at once, which (even with `align-items:start`) left visibly stranded gaps under a still-collapsed neighbor sitting in the same tall row. Only one card open at a time keeps every row's height sane.

## 2026-07-27 (23)

### Added
- **Catalogue cards now show Scientific Name, Local/Common Name (PH), and category tags** — sourced from the same `Priority Commodities_working file - Commodity Dictionary.csv` used for the blurbs. Primary Category and Sub-Category render as small pill/oval badges (`.catalogue-tag`); Scientific Name (italic) and Local/Common Name (PH) render as a text line above the description. The 4 crops with blank dictionary fields (Irrigated/Rainfed Palay, Yellow/White Corn) and the 8 Fisheries/Livestock crops (not in the dictionary) simply omit these rows rather than showing empty tags. Expanded-card `max-height` raised 260px → 320px to fit the added rows.

## 2026-07-27 (22)

### Changed
- **Catalogue card descriptions replaced with sourced botanical definitions** — swapped ~65 hand-written blurbs in `CROP_META` for the "Definition & Botanical Description" text from `data/Priority Commodities_working file - Commodity Dictionary.csv`, matched by crop name. Fisheries and Livestock (8 crops) aren't covered by that dictionary and keep their original short summaries. Expanded-card `max-height` raised 160px → 260px (with `overflow-y:auto` as a safety net) since several of the sourced descriptions run two sentences or more.

## 2026-07-27 (21)

### Changed
- **Illustration map aspect-ratio floor raised 0.6 → 0.85** — the Philippines' national bounds are naturally tall/narrow, which stretched the map panel taller than the 10-card grid beside it and left empty white space under the shorter column. Trades a bit of geographic accuracy (the map is illustrative, not for measurement) for a height that better matches the cards.

## 2026-07-27 (20)

### Fixed
- **National-level view still showed the whole map in blue instead of green** — `renderCatalogueMap()` marked *every* region as "highlighted" at the "Philippines (National)" level (a leftover from before the color was pastel green), which meant the blue `.cmap-highlight` fill applied everywhere, masking the new green base color entirely. National now highlights nothing, showing the plain green map; blue is reserved for an actual island/region/province selection.

## 2026-07-27 (19)

### Changed
- **Illustration map land color → pastel green** (`#efe8d8` cream → `#bfe0b8`), still against the soft sea-blue panel background; the blue highlight color is unchanged for contrast against it.

## 2026-07-27 (18)

### Changed
- **Map/cards column split evened to 50/50** (was `flex:0 0 34%` for the map, reading lopsided next to the cards) — both `#catalogue-map-panel` and `#catalogue-content` now use `flex: 1 1 50%`, gap widened slightly (20px → 24px).
- **Province border strokes thinned** — adjacent provinces each draw their own white stroke along a shared edge, so the visible gap is roughly double the declared width; 1.1 (~2.2px combined) read as thick white gaps carving up the archipelago's many small islands. Down to 0.4 (highlight border 1.6 → 0.8), still visible without dominating.
- **More internal padding around the map** (10px → 18px) now that the panel itself is wider.

## 2026-07-27 (17)

### Fixed
- **Illustration map visual overhaul** — several real issues in the first pass: (1) land shapes (`#cfd6e0`) and the panel background (`#eef2f7`) were nearly the same gray, so unhighlighted areas barely read against the panel — land is now a warm cream (`#efe8d8`) against a soft sea-blue gradient panel, actual map-like contrast. (2) Stroke width was fixed in map-coordinate units, which vary in scale by orders of magnitude between the national view and one small province — borders would've looked razor-thin zoomed out and absurdly thick zoomed into a province; added `vector-effect: non-scaling-stroke` so border thickness stays constant in screen pixels regardless of zoom. (3) The panel forced a 1:1 square, letterboxing badly for any area whose true shape isn't roughly square (the whole country is much wider than tall); `renderCatalogueMap()` now sets the SVG's `aspect-ratio` inline to match the actual bounds shown (clamped to 0.6–1.8 so an extreme case like Palawan can't stretch the panel absurdly). Also added a subtle drop-shadow glow on the highlighted shape for more visual pop.

## 2026-07-27 (16)

### Changed
- **Top 10 catalogue cards fixed to 2 columns** (was a responsive `auto-fill` grid that could show more on wide screens) — `#catalogue-grid` now uses `repeat(2, 1fr)` on both desktop and mobile, tighter gap on phones.

## 2026-07-27 (15)

### Added
- **Illustration highlight map in the Top 10 catalogue** — a plain SVG rendering (no basemap tiles, no pan/zoom interaction) of the same boundary shapes the main map uses, sitting beside the Top 10 cards. It highlights whichever island/region/province is currently selected in blue (rest stays muted gray) and refits its viewBox to that area's bounds, giving a "zoom in there" effect as you change the Area dropdowns. Built from scratch as SVG (`ringToPathD`/`geometryToPathD`/`renderCatalogueMap` in app.js) rather than a second Leaflet instance, reusing the boundary GeoJSON already loaded for the main map — no new data fetching. Redraws on every scope change and when the year crosses the 2024 NIR boundary cutover (region shapes differ pre/post).

### Fixed
- **Catalogue card banner was painting over the circular photo** — `.catalogue-card-banner` has `position:relative` (so the rank number can anchor to it), which — per CSS stacking rules — makes it paint above plain, non-positioned siblings *regardless of DOM order*. The photo's top half (which intentionally overlaps into the banner) was rendering behind it instead of in front. Fixed with explicit `z-index`: banner `z-index:1`, photo `position:relative; z-index:2`.

## 2026-07-27 (14)

### Changed
- **Catalogue cards redesigned: collapsed by default, expand on click** — replaced the always-visible card layout with a collapsed header (colored rank banner + circular "photo" overlapping it, avatar-over-cover-photo style + crop name/value) that expands on click (or Enter/Space, keyboard-accessible via `role="button"`/`aria-expanded`) to reveal the description below. Rank 1/2/3 get gold/silver/bronze banners; others get a green banner. `#catalogue-grid` now uses `align-items:start` so expanding one card doesn't stretch its row's shorter neighbors.

## 2026-07-27 (13)

### Changed
- **"Top 10 Commodities" button re-aligned to the nav rail's left edge** (`left: 18px`, was `68px` matching the crop panel) — sits directly below the rail on desktop instead of below the crop panel.

## 2026-07-27 (12)

### Fixed
- **"Top 10 Commodities" button slid sideways on hover** — its `:hover` rule still had `transform: translateX(-50%)` left over from when the button was horizontally centered; after moving it to a fixed `left: 68px` on desktop, that leftover transform snapped the button ~half its width sideways the instant the cursor touched it, making it dodge the click. Hover now only applies `translateY(-1px)` on desktop; mobile (still centered) keeps its own hover rule with `translateX(-50%)` preserved.

## 2026-07-27 (11)

### Changed
- **"Top 10 Commodities" button moved to bottom-left on desktop** (was bottom-center) — aligned with the crop panel's own left edge (`left: 68px`), clear of the nav rail. Stays centered on phones, since the mobile crop panel is a full-width sheet with no left edge to align to.

## 2026-07-27 (10)

### Changed
- **Explicit rail margin on narrow/mobile viewports** — added a `margin: 14px 0 0 14px` rule for the nav rail inside the `max-width:640px` media query, so it can't end up flush against the screen edge there regardless of anything upstream.

## 2026-07-27 (9)

### Changed
- **More breathing room from screen edges (desktop)** — the nav rail's margin grew from 12px to 18px (top-left corner), and the "Top 10 Commodities" jump button's bottom offset grew from 14px to 20px. Both previously read as flush against the edge.

## 2026-07-27 (8)

### Changed
- **"Overall Palay Production" and "Overall Banana Production" removed from the Top 10 catalogue** — dropped from `CROP_META`, so they're no longer fetched or ranked in Top 10 Commodities at any area level (their sheer volume tended to dominate rankings, crowding out other crops). Fully unaffected everywhere else: both remain normal, selectable crops on the main map. Irrigated Palay, Rainfed Palay, and Banana Cardava (Saba) are untouched and still appear in the catalogue.

## 2026-07-27 (7)

### Changed
- **BARMM's "Special Geographic Area" hidden from the Top 10 catalogue's province picker** — a real PSGC feature (`1909900000`, North Cotabato municipalities that joined BARMM despite not being geographically contiguous with it), but not a real "province" to rank against others. Excluded via a new `CATALOGUE_EXCLUDED_PROVINCES` list in `populateCatalogueProvinceSelect()`. Its production still correctly rolls up into BARMM's region/island/national totals — only the individual province-level entry is hidden.

## 2026-07-27 (6)

### Changed
- **Sugarcane re-delisted** — reverted the previous entry; `item-hidden` restored on its tree entry and its `CROP_META` catalogue entry removed. Back to hidden everywhere, data/config untouched.

## 2026-07-27 (5)

### Changed
- **Sugarcane relisted** — removed from the hidden/delisted set (`item-hidden` dropped from its tree entry) and added to the Top 10 catalogue's `CROP_META`. It already had full Volume/Yield/Area data wired up from before, so no data changes were needed — it's now selectable on the main map and eligible to rank in Top 10 Commodities again.

## 2026-07-27 (4)

### Fixed
- **Island Group/Region/Province fields showed even at "Philippines (National)" level** — `.catalogue-field { display: flex }` shares the same CSS specificity as the browser's built-in `[hidden] { display: none }` and loads later, so it was winning the tie and defeating the `hidden` attribute on the three conditionally-shown fields. Added a `.catalogue-field[hidden] { display: none }` rule — only the field(s) relevant to the selected Area level now appear.

## 2026-07-27 (3)

### Fixed
- **Root cause of every "Top 10 Commodities doesn't work" report: a script-aborting crash on every reload.** `setYear()` calls `refreshCatalogueForYearChange()`, which reads a variable (`catalogueInitialized`) declared with `let` further down the file. `bootFromHash()` — which runs synchronously near the *top* of the script, and calls `setYear()` whenever the saved URL has `&year=...` in it (true on essentially every reload, since `history.replaceState` keeps that hash current) — was hitting this reference *before* its declaration line had executed. A `let`/`const` accessed before its own declaration throws a `ReferenceError` (temporal dead zone), and left uncaught at the top level, that **silently aborted all remaining script execution** — including the code that attaches the jump button's click handler and defines the whole catalogue engine. This is almost certainly what made the button seem broken from the very first report, regardless of the mobile z-index/overflow issues also fixed along the way (those were real, independent bugs, just not sufficient on their own). Changed `catalogueData`/`catalogueLoadPromise`/`catalogueInitialized` from `let` to `var`, which is hoisted with an initial `undefined` — an early call now safely no-ops instead of crashing.

## 2026-07-27 (2)

### Fixed
- **Catalogue stuck forever on "Loading commodity data…"** — `ensureCatalogueData()` fetches ~75 crop files in parallel via `Promise.all`, which only settles once *every* one does; if a single fetch (or a lazy-loaded script) never fires either a success or failure event, the whole batch waits forever with no error shown. Each crop load now races against a 20-second timeout (`loadCropForCatalogueSafe`) so one stuck request can't block the rest — the catalogue renders with whatever crops did load, and if literally none did, an actual error message now shows instead of an infinite spinner. Also hardened against a synchronous throw inside the loader escaping `Promise.all` entirely (converted to a rejection via `Promise.resolve().then(...)`).

## 2026-07-27

### Fixed
- **Clicking "Top 10 Commodities" did nothing — the page couldn't scroll at all** — root cause: `css/qgis2web.css` (leftover boilerplate from this project's original QGIS web export) sets `html, body, #map { overflow: hidden }`. That was harmless while the page was exactly one viewport tall (nothing to scroll to), but it silently blocked all page scrolling — including the jump button's `scrollIntoView()` — the moment `#catalogue-section` extended the page past the first screen. `app.css` (which loads after qgis2web.css) now resets `overflow` back to normal on `html`/`body`; `#map` itself correctly keeps `overflow:hidden`.

## 2026-07-24 (2)

### Fixed
- **"Top 10 Commodities" jump button was unclickable on mobile** — the collapsed bottom sheet (`#control-panel`) covers the full bottom 132px of the screen at `z-index: 1100`, which is exactly where the jump button (`bottom: 14px`) sat — the sheet was rendering on top of it. The button now sits just above the sheet on phones (`bottom: calc(146px + safe-area)`), and its z-index was raised to 1900 generally as extra headroom above any of Leaflet's own control layers.

## 2026-07-24

### Added
- **Top 10 Commodities catalogue** — a new section below the map, reached via a "Top 10 Commodities ▼" pill button (bottom-center of the map) or by scrolling down. Ranks every published crop by Production Volume (MT) for whichever year is selected on the map's timeline, at four area levels: Philippines (national), Island Group (Luzon/Visayas/Mindanao), Region (17), and Province (populated from the chosen region). Each card shows a rank badge (gold/silver/bronze for the top 3), an emoji icon, the crop name, its volume, and a one-line description.
  - The page is now two full-height sections (`#map-view`, `#catalogue-section`) instead of one fixed map — `#map-view` pins the map and all its floating controls to exactly one viewport so they stay put while scrolling to the catalogue.
  - Data model: the first time the section opens, every live crop's production file is fetched once and cached (`ensureCatalogueData()`); switching area/year afterward just re-ranks the cached data. Crops with only regional-level data (Palay, Corn, Fisheries, Livestock) count at region/island/national level but can't appear in a province-specific Top 10 — noted in the catalogue's footnote.
  - Card emoji/descriptions are hand-curated (`CROP_META` in `js/app.js`) as a placeholder for real photos later — descriptions are short general summaries, not sourced from the Agristat dataset, and worth a review pass.

## 2026-07-22 (5)

### Added
- **Area metric added for Cacao and Pili** — `cacao_provincial_area.csv` and `pili_provincial_area.csv` wired as `areaFile`. Non-Food & Industrial's Area coverage is now Cacao, Pili, Abaca, Piña, Cotton, Bariw, Salago, and all three tobacco entries — only Coconut and Sugarcane still lack an area file there.

## 2026-07-22 (4)

### Added
- **Trees ↔ Area auto-switch** — selecting a crop while on the Trees tab, when that crop has no Trees data but does have Area data, now switches to Area automatically (and the reverse: Area → Trees). Applies only between these two metrics, since they're the ones with genuinely uneven per-crop coverage; Volume/Yield still just show "not yet available" as before. `metricAvailableForCrop()` factors out the availability check shared with the tab-graying logic.

## 2026-07-22 (3)

### Added
- **Area metric added for 8 Non-Food & Industrial crops** — Abaca, Piña (`pineapplefiber_...`), Cotton, Bariw, Salago, and all three tobacco entries (Overall, Virginia, Native) get an `areaFile`. Most rows are zero except a handful of provinces (e.g. Abra tobacco ~6,000 ha for 2025) — consistent with these being concentrated, region-specific crops rather than a data gap.

## 2026-07-22 (2)

### Added
- **Area metric added for 21 Vegetable & Rootcrops** — Asparagus, Lettuce, Chili Pepper, Bell Pepper, Bottle Gourd, Sponge Gourd (`patola_...`), Tomato (`kamatis_...`), Cucumber, Pechay, Spinach, Malabar Spinach (`alugbati_...`), Radish, Jute Mallow (`saluyot_...`), Winged Beans (`sigarilyas_...`), Cassava, Sweet Potato (`Camote_...`), White Potato (`potato_...`), Garlic, Ginger, Lemongrass, Spring Onion, and Peanut all get an `areaFile`. Same data pattern as the Trees files added earlier today — only 2025 has nonzero values, so 2021–2024 will show "No Data" on the Area tab for these crops.

## 2026-07-22

### Added
- **Trees metric expanded to 8 more fruit crops** — Avocado, Banana (Cardava/Saba), Calamansi, Dalandan, Dragon Fruit, Durian, Pomelo, and Rambutan all get a `treesFile` (bearing tree/hill counts) from their `*_provincial_bearing_area.csv` files, joining Mango and Banana as crops with real Trees data. Note: these files only have nonzero values for 2025 (and an unused 2026 column) — 2021–2024 will show as "No Data" on the Trees tab for these crops, which reflects the source data, not a loading issue.
- **Area metric added for Melon and Pineapple** — `melon_provincial_area.csv` and `pineapple_provincial_area.csv` wired as `areaFile` (their filenames lack "bearing," so they went to Area rather than Trees, per the underlying hectare-scale values).

## 2026-07-20 (13)

### Removed
- **"Tobacco (Dark Air-Cured)" placeholder deleted** from Non-Food & Industrial — the "Tobacco (Overall)" item already covers the aggregate series, and no distinct Dark Air-Cured data was ever provided.

## 2026-07-20 (12)

### Added
- **9 Non-Food & Industrial crops activated** — Abaca, Piña (from `pineapplefiber_...csv`, Piña cloth is woven from pineapple leaf fiber), Cotton, Bariw, Salago, Coir, and three tobacco entries: **Tobacco (Overall)** — a new tree item for the aggregate series in `Tobacco_productionvolume_provincial.csv`, which doesn't correspond to any single sub-type — plus Tobacco (Virginia) and Tobacco (Native). Silk, Raffia, Buri, the three Agave varieties, and Tobacco (Dark Air-Cured)/(Burley) remain placeholders — no files provided for those yet. — `peanut_productionvolume_provincial.csv` wired into `provConfig`/`cropConfig`. Vegetable & Rootcrops → Nuts & Legumes is now fully live (it was the only item in that sub-group).

## 2026-07-20 (10)

### Added
- **Spices activated** — Garlic, Ginger (Luya), Lemongrass (Tanglad), Spring Onion wired into `provConfig`/`cropConfig` from `garlic_`, `ginger_`, `Lemongrass_`, `spring_onion_productionvolume_provincial.csv`. No longer placeholders under Vegetable & Rootcrops → Spices — only the three onion varieties had data there before.

## 2026-07-20 (9)

### Added
- **Root Crops activated** — Cassava, Sweet Potato, White Potato wired into `provConfig`/`cropConfig` (same palette as Highland) from `cassava_`, `sweetpotato_`, `whitepotato_productionvolume_provincial.csv`. No longer placeholders under Vegetable & Rootcrops → Root Crops — only Ube had data there before.

## 2026-07-20 (8)

### Added
- **Chili Pepper activated** — `silinglabuyo_productionvolume_provincial.csv` wired into `provConfig`/`cropConfig` (Highland palette, matching Bell Pepper). Tree label set to "Chili Pepper (Siling Labuyo)". No longer a placeholder under Vegetable & Rootcrops → Highland Crops.

## 2026-07-20 (7)

### Added
- **12 more Lowland Crops activated** — Sponge Gourd (Patola), Tomato, Cucumber, Mushroom, Pechay, Spinach, Malabar Spinach, Moringa (Malunggay), Radish, Sweet Potato Leaves, Jute Mallow (Saluyot), Winged Beans. Each wired into `provConfig`/`cropConfig` (Lowland palette) from its own CSV (`spongegourd_`, `tomato_`, `cucumber_`, `mushroom_`, `pechay_`, `spinach_`, `alugbati_`, `malunggay_`, `radish_`, `camote_tops_`, `saluyot_`, `sigarilyas_productionvolume_provincial.csv`). Upland Kangkong and Mustard Greens remain placeholders — no file provided for those yet.

### Changed
- **"Pachoy (Pok Choy)" relabeled "Pechay"** — same tree position, now with data (`pechay_productionvolume_provincial.csv`).

## 2026-07-20 (6)

### Added
- **Bottle Gourd (Upo) activated** — `upo_productionvolume_provincial.csv` wired into `provConfig`/`cropConfig` (Lowland palette, matching Ampalaya/Squash). No longer a placeholder under Vegetable & Rootcrops → Lowland Crops — it's clickable, with real data.

## 2026-07-20 (5)

### Fixed
- **Regions with zero data rows vanished from the legend's "No Data" count** — `classifyRegions()` used `Object.keys(cropStats)` as its universe of regions, but `aggregateProvToRegional` only creates a bucket for a region if at least one of its provinces has a nonzero value *somewhere in the whole file*. A region entirely absent from a crop's data (e.g. NCR for Bell Pepper — zero rows in the CSV) never got a bucket at all, so it was silently excluded from the classification instead of counting as "No Data": the map correctly rendered it with no fill, but the legend showed no "No Data" swatch and its count/percentages quietly ignored the region. `classifyRegions` now sources its region list from the active boundary shapes (every real region) instead of the data, so absent regions are counted correctly.

## 2026-07-20 (4)

### Added
- **Bell Pepper activated** — `bellpepper_productionvolume_provincial.csv` wired into `provConfig`/`cropConfig` (Highland palette). No longer a placeholder under Vegetable & Rootcrops → Highland Crops — it's clickable, with real data.

## 2026-07-20 (3)

### Added
- **Lettuce activated** — `lettuce_productionvolume_provincial.csv` wired into `provConfig`/`cropConfig` (Highland palette, same green-to-purple as Cabbage/Carrots). No longer a placeholder under Vegetable & Rootcrops → Highland Crops — it's clickable, with real data.

## 2026-07-20 (2)

### Added
- **Melon activated** — `melon_productionvolume_provincial.csv` wired into `provConfig`/`cropConfig` (regional volume derived from the provincial series, same pattern as Avocado). The Melon tree item is no longer a placeholder — it's clickable, with real data.

## 2026-07-20

### Added
- **Region name labels in the national view** — every region shows a short label (I, II, III … XIII, CAR, BARMM, NCR, NIR, MIMAROPA, …; numbered regions show just the numeral, no "Region" prefix) centered on its polygon, so regions are identifiable without hovering. Labels hide while zoomed into a region and reappear on zoom-out; they regenerate automatically at the 2024 NIR boundary cutover.

### Fixed
- **Region labels floating in open water** — archipelagic regions (Mimaropa, Region IX, Region VII, …) were labeled at their feature's overall bounding-box center, which regularly falls in the sea between separate islands. Labels now sit on the centroid of the region's single largest landmass (found via per-ring shoelace area), so they land on solid ground. BARMM is excluded — its islands and mainland pieces are close enough in size that picking "the largest" moved its label somewhere worse, so it keeps the plain bounding-box center.
- **Region/province popups could open with their title cut off above the map** — clicking a region (or a province) starts a ~1s animated `flyToBounds`, but the popup was bound and opened immediately, so its `autoPan` (or, for provinces, the fixed padding standing in for autoPan) was calculated against the camera's *pre-flight* position. By the time the flight actually finished a second later, the popup could settle with part of it off-screen. Popups now wait for the flight's `moveend` before opening, so autoPan sees the real final view; a rapid second click cancels the first popup instead of both racing to open on the same `moveend`. Province popups also regained `autoPan` (previously disabled as a workaround) now that timing is correct.
- **Classification badge ("Peak Production", etc.) rendered as a full-width bar in popups** — `.info-badge` sits inside `.info-popup-rows`, a flex column, which stretches children to full width by default; the badge now sets `align-self: flex-start` so it stays a small pill instead of ballooning across the popup.
- **`app.css`/`app.js` now cache-busted** (`?v=2026-07-20` in `index.html`) — unlike `data/` files (versioned via `DATA_VERSION`), the stylesheet and script had no version query, so browsers/dev-server caches could keep serving a stale copy after an edit. Bump this date whenever either file changes.
- **Layers flyout no longer closes when using other rail tools** — clicking the crop-panel toggle (or any rail button) was treated as an "outside" click and shut the flyout; the outside-click closer now ignores the whole nav rail, so the flyout stays open and re-anchors instead.
- **Layers flyout follows the crop panel** — its position used to be computed only when opened, so hiding/showing the crop panel left it floating in the wrong spot. It now re-anchors (with a short glide) whenever the panel toggles or the window resizes: beside the rail when the panel is hidden, beside the panel when it's open.

### Removed
- **Crops not in the published list hidden from the tree** — Cavendish (Banana group), Sugarcane (Non-Food & Industrial), and Broccoli, Chayote, Celery (Highland) now carry an `item-hidden` class: invisible in the tree and search, excluded from remembered-crop/deep-link auto-select (falls back to Overall Palay). Their data files and config remain — remove the class to relist one.
- **Sweet Corn placeholder** dropped from the Corn category (added 2026-07-18).

### Fixed
- **Sponge Gourd (Patola)** placeholder added to Lowland crops — it was on the crop list but missed in the 2026-07-18 batch.

### Added
- **Non-Food & Industrial placeholder labels** — 16 fiber and tobacco crops (Abaca, Piña, Cotton, Silk, Bariw, Salago, Raffia, Buri, Coir, Agave, Agave Sisal/Maguey, and Tobacco Dark Air-Cured/Virginia/Burley/Native), greyed `item-disabled` entries awaiting data.
- **White Potato and Garlic placeholders** in Vegetable & Rootcrops (Root Crops and Spices respectively).

### Changed
- **Fruit Crops, Non-Food & Industrial, and Vegetable & Rootcrops republished** — the three categories are selectable again: headers expand, data-backed crops load normally, and only the placeholder crops (no data yet) remain greyed out. The `category-disabled` mechanism stays available for future unpublishing.
- **Onion group folded into 🌶 Spices** — the three onion crops (with their data intact) moved from their own 🧅 sub-group into Spices, relabeled Onion (Red Onion) / Onion (Yellow Granex/White Onion) / Onion (Red Shallots).
- **Asparagus moved into 🏔 Highland Crops** (was a loose item at the section bottom).
- **"Habitsuelas" respelled "Habichuelas"** (Baguio Beans) in the tree label; the internal crop id is unchanged.

## 2026-07-18

### Added
- **Placeholder crop labels for upcoming data** — Sweet Corn (under Corn), Melon (Fruit Crops), and ~25 new Vegetable & Rootcrops entries organized into sub-groups: new 🍠 Root Crops (Cassava, Sweet Potato — Ube moved in), 🌶 Spices (Ginger, Lemongrass, Spring Onion), 🥜 Nuts & Legumes (Peanut), plus new Highland (Lettuce, Chili/Sweet/Bell Pepper) and Lowland items (Bottle Gourd, Tomato, Cucumber, Mushroom, Pachoy, Upland Kangkong, Mustard Greens, Spinach, Malabar Spinach, Moringa, Radish, Sweet Potato Leaves, Jute Mallow, Winged Beans). Placeholders use an `item-disabled` class — greyed, unclickable, "Data not yet published" tooltip — and have no `data-crop` binding until data arrives. Already-existing crops from the list (Banana, Saba, Calamansi, Cauliflower, Chinese Cabbage, Eggplant, Squash, and Ampalaya/Okra/Stringbeans as Bitter Gourd/Lady Finger/String Beans) were not duplicated.
- **Shareable URLs** — the address bar now tracks crop, metric, year, focused region, and basemap (`#crop=..&metric=..&year=..&region=..&basemap=..`). Opening a copied link restores that exact view; a deep-linked crop takes priority over the remembered last crop.
- **Breadcrumb** — when zoomed into a region, a "Philippines › Region …" chip appears above the year bar; clicking it (or pressing **Esc**) returns to the national view.
- **Layers flyout** — basemap select, hillshade, administrative boundaries, and data opacity moved out of the bottom-left corner and crop panel into one flyout opened from a new layers button on the nav rail. Outside-click and Esc close it.
- **Data source line** — the legend footer and help modal now credit the Agristat Database (2021–2025).

### Changed
- **Expandable data table** — a maximize button in the table modal header toggles the card between its normal size and near-fullscreen, for reading wide provincial tables; the icon flips to a shrink glyph while expanded.
- **Data table grid lines** — all cells now have light grey borders, making rows and columns easier to trace across the wide table.
- **"View data table" always reachable** — the button moved out of the legend's collapsible body, so it stays visible even when the legend is collapsed with ▼.
- **Fruit Crops, Vegetable & Rootcrops, and Non-Food & Industrial unpublished** — the three category headers stay in the tree, dimmed with a "Data not yet published" tooltip, but don't expand: their crop lists and sub-groups are hidden entirely. Search skips them, and a remembered or deep-linked crop from one of them falls back to Overall Palay. Data files and config stay in place; removing the `category-disabled` class from a section in `index.html` publishes it.
- **Legend always starts fully expanded** — the mobile auto-collapse on first appearance is removed; the ▼ toggle remains for tucking it away manually.
- **Legend is draggable on desktop** — grab its header to move it anywhere on the map (clamped to the viewport); the collapse ▼ button still works normally. Mobile keeps the fixed top-right spot.
- **"Data opacity" relabeled "Opacity"** in the Layers flyout.
- **Crop panel starts hidden on desktop** — the map loads clean (last/default crop still auto-loads); the rail's panel button opens it and stays highlighted while open. The mobile bottom sheet still starts visible, as it's the primary crop picker there.
- **Measure prompt panel now flies out beside the rail** — it used to render inside the rail's column, inflating it, with the tooltip chip duplicating its heading. The panel is now a white card to the rail's right (with a hover bridge so it doesn't collapse while moving the pointer to it), and the measure button relies on the panel's own heading instead of a tooltip chip.
- **Legend moved to the bottom-right** (desktop) — balances the rail + panel on the left and stops it colliding with the panel on short screens. Mobile stays top-right.
- **Breadcrumb sits at the bottom-center of the map** (the year timeline stays inside the crop panel, as before — a briefly-trialed floating year bar was reverted same-day).
- **Nav rail icons are now a shared inline SVG set** (Feather-style, `currentColor`) instead of mixed emoji/text/plugin images — consistent rendering across platforms, proper tinting on hover/active, and the locate/measure plugin icons no longer need CSS filters.

### Mobile
- **The nav rail collapses behind a single ☰ toggle on phones** (≤640 px), reclaiming the map area the always-open rail occupied.

### Fixed
- **Measure icon invisible on the rail** — the plugin's toggle isn't a standard `.leaflet-bar` link and its own stylesheet (white sprite background, text-indent hiding, indigo link color) kept defeating an injected inline SVG. The ruler is now drawn as a white-stroke SVG **CSS background image** on the toggle, which the plugin's content styling can't touch; hover tint preserved.
- **New crop-panel and layers icons** — crop panel is now a leaf (fits the crop list), map layers a folded-map icon, replacing the generic sidebar/stack glyphs.
- **Layers flyout closed itself in the same click that opened it** — Leaflet's `disableClickPropagation` doesn't stop the native `click` from bubbling, so the document-level "click outside to close" listener fired immediately and the flyout never appeared. The open click now stops its own propagation, and the closer also ignores clicks on the layers button.
- **Layers flyout / breadcrumb showed on page load** — their CSS `display:flex` overrode the HTML `hidden` attribute, so the flyout sat permanently over the crop panel and the breadcrumb's ✕ appeared with no region focused. A `[hidden] { display:none }` rule restores correct hiding; the flyout also now opens to the right of the crop panel when the panel is open, so they never overlap.
- **Measure button was a blank white square** — the leaflet-measure plugin's own stylesheet painted a white background under the rail's near-white SVG icon. The toggle's background is now transparent inside the rail.
- **XLSX parser now lazy-loads** — the ~900 KB SheetJS library is only fetched the first time a crop actually needs a workbook; CSV-only sessions never download it.
- **Province lookups indexed** — provincial GeoJSON features are indexed by pcode at load, replacing repeated linear scans during aggregation and name lookups.
- **Screen-reader labels** — rail buttons converted to tooltip chips now backfill `aria-label` from their former titles.

## 2026-07-13

### Fixed
- **"Map data not available" tiles when zooming in close on satellite** — Esri's high-res imagery over much of the Philippines ends around zoom 17–18, and past that its server returns gray placeholder tiles (valid images, so Leaflet displayed them instead of upscaling). `maxNativeZoom` on the Esri Satellite layer dropped from 19 to 17; deeper zooms now stretch the last real imagery.

### Added
- **OpenStreetMap basemap** — fourth option in the basemap switcher (standard OSM tiles, © OpenStreetMap contributors). Useful when street-level and place-name detail matters more than a muted cartographic background.
- **Crop-panel toggle in the tools menu** — a 🌾 button hides/shows the right-hand production panel, giving an unobstructed view of the basemap (handy over satellite imagery). The button highlights while the panel is hidden.

### Changed
- **Vertical navigation rail replaces the burger menu** — all top-left tools (zoom, locate, measure, search, fullscreen, help, crop-panel toggle) now live in a dark rounded vertical rail, always visible, with hover tooltip chips to the right and purple active states. The search box and its results fly out beside the rail. The ☰ burger toggle is gone.
- **Control panel docked to the nav rail** — the production panel moved from the top-right corner to sit directly beside the rail (top-left), like an expanded navigation panel. The rail's 🌾 button collapses/reopens it and stays highlighted while the panel is open. On mobile it remains a bottom sheet.
- **Esri Hybrid basemap** — Google Hybrid-style option: Esri Satellite imagery plus a transparent Carto labels-only layer. The labels render in a new `labelsPane` *above* the choropleth fills and hillshade (below region outlines), so place names remain readable over the data. Both layers are added/removed together by the basemap switcher.

## 2026-07-09

### Fixed
- **Phantom "0906" region row / lost Sulu data** — newer data files code Sulu under Region IX (PSGC `0906600000`, post-2024 Supreme Court ruling) while the boundary GeoJSON still has its old BARMM code (`1906600000`). The mismatch produced a nameless "0906" row in the data table and silently dropped Sulu's values from the map (e.g. Mango ~1,700 MT/yr was in national totals but drawn nowhere). A new `PROVINCE_REHOMES` map reconciles the two codes, and the rollup is year-aware: Sulu counts under BARMM for 2021–2024 and under Region IX from 2025, matching the PSGC change. Its polygon colors correctly in both eras and the phantom row is gone.
- **BARMM island provinces couldn't be clicked / Basilan misassigned** — two stacked bugs. (1) The boundary file tags Basilan's polygon under Region IX while the data reports it under BARMM, so the BARMM drill-down skipped it and its values counted toward Region IX; a `PROVINCE_REGION_OVERRIDES` entry pins Basilan to BARMM. (2) The drill-down layer rendered every province in the country and hid non-members with zero opacity — but invisible SVG fills still capture clicks, leaving dead zones over the archipelago. Non-member provinces are now filtered out of the layer entirely, so clicks land on the visible polygons.
- **Year-correct regional aggregation** — provincial values now roll up to the region each province belonged to *in that year*, instead of the region it belongs to in the year active at load time. Besides Sulu, this fixes a latent NIR issue where Negros Occidental/Oriental and Siquijor's 2021–2023 values could land in NIR (undrawn pre-2024) rather than in Regions VI/VII, depending on which year was selected when the crop loaded.
- **Pinned legend class now survives the year timeline** — clicking a legend row (e.g. Peak Production) pins the highlight, but scrubbing or pressing ▶ used to drop it on the first year change. The pin now stays locked through 2021–2025 playback and re-lights each year's members of that class, both in the national view and while zoomed into a region's provinces. It still clears when the crop, metric, or region focus changes, where the old classes wouldn't apply.

### Added
- **"Trees" metric tab** — number of bearing trees/hills, currently with data for Overall Mango and Overall Banana (`mango_yieldtree_provincial.csv`, `banana_yieldtree_provincial.csv`); all other crops show the tab as unavailable. Counts are additive: provinces sum into regions and the data table shows a Total row, same as Volume/Area. On the Trees tab the crop list shows only the Fruit Crops category. (Refactor alongside: ratio metrics like Yield are now marked with an `average: true` flag in `METRICS` instead of hard-coded id checks, and metric-based category hiding now uses a `.metric-hidden` class so the crop search can't reveal hidden sections.)

## 2026-07-07

### Added
- **Eight new fruit crops** (production volume, provincial data with derived regional view): Avocado, Durian, Dragon Fruit, Calamansi, Pomelo, Rambutan, Dalandan, Pineapple. Fruit Crops list is now alphabetical.
- **Banana varieties** — Banana is now a sub-group holding Banana (Overall), Cardava (Saba), and Cavendish production.
- **Cacao and Pili** added to Non-Food & Industrial (now alphabetized), and **Asparagus** to Vegetables & Rootcrops — all production volume, provincial data. Total commodities: 46.

## 2026-07-06

### Added
- **☰ Burger tools menu** — the top-left stack was seven buttons tall; locate, measure, place search, fullscreen, and help are now tucked behind a burger toggle sitting beside the zoom bar. Opening it fans the tools out in a horizontal row. Each tool keeps its tooltip; the burger highlights blue while open.

### Fixed
- **Deeper zoom** — the map was capped at zoom 18, stopping short of house-level detail. Max zoom is now 22: tiles render at each provider's full native resolution (Carto/Esri 19, Stadia 20) and upscale beyond it so users can keep zooming.
- **Legend no longer covers the map buttons** — on shorter windows the (now taller) legend grew over the top-left control stack, blocking the search/fullscreen buttons and their tooltips. Its body now caps its height to the viewport and scrolls internally, on both desktop and mobile.

### Changed
- **"Yellow Onion" renamed to "White Onion"** everywhere (crop list, legend, popups, table, CSV filename) — the underlying data was already the White Onion series; the label was a mislabel.
- **Provincial class labels reverted to the original wording** — "Above Average Production" / "Below Average Production" are now "High Production" / "Low Production" in the legend, popup badges, and data table (matching the regional legend and the pre-July naming). The explanatory notes ("Above/Below national average") remain.

## 2026-07-05

### Added
- **Data table modal** — "📊 View data table" button in the legend opens a sortable-by-year table of regions (or provinces of the focused region): year columns 2021–2025, Share PH %, Share Region % (provinces), Variance vs previous year, Growth %, Lowest/Highest (with year), Average, Classification. Current-year column highlighted; sticky header and name column; Total row for additive metrics.
- **CSV export** from the table — raw numbers, UTF-8 BOM for Excel, self-describing header line, descriptive filename.
- **Popup statistics** — Lowest (year), Highest (year), Average (2021–2025) rows in region and province popups.
- **Popup sparkline** — compact 5-year trend chart with shaded area, current-year dot, "▲ +x% since 2021" colored summary, and per-year hover tooltips.
- **Crop search box** — live filtering of the crop tree with no-results state.
- **Startup auto-load** — map opens on the last-viewed crop (localStorage) or Overall Palay, instead of blank.
- **Interactive legend** — hover a class row to preview it on the map; click to pin the highlight.
- **Top-5 ranking** in the legend with click-to-zoom (currently hidden via CSS by request — see DOCUMENTATION.md §10 to restore).
- **Loading/error status pill** — spinner while data loads; red toast on fetch failures (previously silent).
- **Page metadata** — descriptive title, meta description, OG tags, 🌾 favicon.
- **Documentation set** — DOCUMENTATION.md (technical reference, also exported as DOCUMENTATION.docx) and USER_MANUAL.md (plain-language end-user guide, also exported as USER_MANUAL.docx).
- **❓ Help button** — new map control (top-left) opening an in-app quick guide: quick start, measurements, color classes, popup explanation, data table/export, tools, phone tips, and troubleshooting.
- **Accessibility** — keyboard operation of the crop tree (tabindex/Enter/Space), `aria-pressed`/`aria-expanded`, focus outlines, live-region status pill, dialog semantics on the table modal.

### Changed
- **Year scrubbing keeps the focused region** — auto-play now animates a region's provincial choropleth across years instead of resetting to national view.
- **Legend value ranges re-enabled** — each class shows its min–max values again.
- **Vegetable and livestock palettes** rebuilt to be lightness-monotonic for color-blind/grayscale legibility.
- **Typography floor** raised — no text below 10 px (was 8.5–9.5 px in places).
- **Data caching** — `?v=Date.now()` (re-downloaded everything every click) replaced with a `DATA_VERSION` constant bumped per data release.

### Fixed
- Metric tabs stayed locked forever if a data load failed.
- Growth ▲/▼ values in popups referenced CSS classes that didn't exist (now green/red).
- XLSX fetches did not check HTTP status (404s parsed an error page as a workbook).
- Boundary-file load failures were completely silent.

### Mobile
- Bottom sheet: `dvh` sizing, safe-area insets, swipe-to-expand/collapse on the handle, auto-collapse after crop selection.
- Popups sized and auto-panned for phones (was desktop-panel padding); fly-to bounds pad for the sheet.
- Legend starts collapsed on phones and is narrowed to clear the control stack; measure control hidden; bottom-left controls raised above the sheet; `viewport-fit=cover`.

## 2026-07-03 and earlier

- Initial public version (commits `70ce282` → `2d6c6b2`): Leaflet map with regional choropleths for ~35 crops/commodities across 5 categories; 3 metrics (Volume/Yield/Area); year controller 2021–2025 with auto-play; region → province drill-down with classification legend; NIR 2024 boundary handling; hillshade + basemap switcher; Photon place search; locate/measure/fullscreen controls; print stylesheet; first mobile bottom-sheet layout.
