# Philippine Agricultural Production Atlas — Documentation

**Last updated:** 2026-09-08
**Live data coverage:** 2021–2025 · Volume (MT), Yield (MT/HA), Area Harvested (HA — **not** Mango, Banana or Coconut, see §Data coverage), Bearing Trees (Mango, Avocado, Banana Cardava, Calamansi, Dalandan, Dragon Fruit, Durian, Pomelo, Rambutan — Overall Banana is **hidden entirely** as of 2026-09-06, its only tree file being smaller than its own Cardava subset), Yield per Tree (Avocado, Banana Cardava/Saba, Calamansi, Dalandan, Rambutan, Pomelo, Durian, Dragon Fruit, Pili, Cacao)

An interactive Leaflet webmap of Philippine agricultural production by region and province. Users pick a crop, scrub through years, drill into regions for provincial detail, and view/export the underlying data as a table. A second section below the map — the **Top 10 Commodities catalogue** — ranks every published crop by production volume for the Philippines, an island group, a region, or a province.

## 1a. Page structure — two scrollable sections

The page is two full-height `<section>`s stacked in normal document flow:

- **`#map-view`** — the interactive map and every floating control (nav rail, crop panel, legend, breadcrumb, year timeline, layers flyout, status pill). Pinned to exactly one viewport (`height:100vh`, `overflow:hidden`, `position:relative`) so all the `position:absolute` overlay controls stay screen-relative instead of drifting once the page grows taller than one screen. A "Top 10 Commodities ▼" pill (`#catalogue-jump-btn`) sits bottom-center, always visible, and smooth-scrolls to section 2.
- **`#catalogue-section`** — the Top 10 catalogue (§13). A "▲ Back to map" button scrolls back up to `#map-view`.

Because `table-modal` and `help-modal` (both `position:fixed; inset:0`) happen to sit inside the `#map-view` markup, note they're unaffected by its `overflow:hidden` — fixed-position elements ignore an ancestor's overflow unless that ancestor also creates a new containing block (a `transform`/`filter`/etc.), which `#map-view` does not.

## 13. Top 10 Commodities catalogue

Ranks every crop that has a `data-crop` binding in the tree (i.e. is neither `category-disabled` nor `item-disabled`/`item-hidden`) by **Production Volume (MT) for the year currently shown on the map's timeline** — the catalogue has no year picker of its own; scrubbing the main year slider live-updates it via `refreshCatalogueForYearChange()`, called from `setYear()`.

**Area levels** (cascading `<select>`s in `#catalogue-scope-bar`): Philippines (national) → Island Group (Luzon/Visayas/Mindanao, `ISLAND_GROUPS` in `js/app.js`) → Region (17 regions, grouped by island via `<optgroup>`) → Province (populated from the chosen region). Region/province pcode lists come from the live boundary shapes (`getActiveShapes()`, `provincialShapes`), not a hardcoded list, so they stay correct across the 2024 NIR boundary cutover. The province list is also **year-dependent** — `populateCatalogueProvinceSelect()` runs each pcode through `effectiveProvincePcode()`, which folds a highly-urbanised city into its parent province for years before that city's `PROVINCE_SPLITS.since` — so `refreshCatalogueForYearChange()` must repopulate it whenever the year changes, not just on a level/region change. Leaving it stale left the picker holding a pcode that resolves to nothing for the new year (an empty Top 10 beside a correctly-rendered map). The rebuild preserves the current selection, follows a city back into its parent when the new year predates its split, and is guarded on `provincialShapes` so a boot with `&year=` in the hash cannot blank a deep-linked province. A fifth, always-visible **Category** `<select>` (`#catalogue-category-select`, populated by `populateCatalogueCategorySelect()` from every unique `CROP_META.primary` value, plus two extra hand-curated options — see below) sits alongside the area selects and restricts ranking to one category at a time across every view (cards, full ranking table, CSV export, compare) — Fisheries/Livestock/Palay/Corn have no category in the source dictionary and are excluded from any active category filter. Two curated cross-category lists don't fit the `CROP_META.primary` model, since each spans several different Primary Categories at once:
- **"HVC Priority"** (High Value Crops Development Program): Red Onion, Red Shallot, White Onion, Carrots, Tomato, Eggplant, Bitter Gourd (Ampalaya), Squash, String Beans, White Potato, Cabbage, Chinese Cabbage, Habitsuelas, Garlic, Chili Pepper — flagged `hvc: true`, matched via sentinel `HVC_CATEGORY_VALUE`.
- **"HVEC"**: Coconut, Banana (Saba/Cardava), Pineapple, Mango, Durian, Cacao, Lady Finger (Okra), Ube, Dragon Fruit, Calamansi, Pomelo, Dalandan, Avocado, Asparagus, Pili, Rambutan — flagged `hvec: true`, matched via sentinel `HVEC_CATEGORY_VALUE`.

Both sentinels are special-cased in `getAllCommodityValues()`'s category-filter check (`meta.hvc`/`meta.hvec` instead of `meta.primary === categoryFilter`). Since neither sentinel is something to leak into user-facing text, `categoryDisplayLabel()` maps them back to "HVC Priority"/"HVEC" wherever the active category is displayed (the empty-state message, the ranking-table subtitle) — every other consumer of `currentCatalogueCategory()`'s raw value (filtering logic, URL hash, CSV export) doesn't care and uses it as-is. All five selects write their state into the URL hash (`catScope`/`catIsland`/`catRegion`/`catProvince`/`catCategory`) via `updateUrlHash()`, restored on load through `hashBootCatalogue` (see §"Shareable URL state" below). The "📋 View full ranking" and "⇄ Compare areas" buttons (`#catalogue-toolbar`) live inside `#catalogue-scope-bar` itself, pushed to the trailing edge with `margin-left: auto` and a divider — one control strip (filters, then a divider, then view actions) rather than a separate row of buttons stacked above it.

**Data model:** unlike the main map (one crop loaded at a time), ranking needs every crop's value for one area. The first time the section is opened (via the jump button, the back-and-forth scroll, or an `IntersectionObserver` firing on scroll-into-view), `ensureCatalogueData()` fetches all ~75 crops' files once and caches them in `catalogueData` (crop name → `{ byRegion, byProvince }`). Per crop, `loadCropForCatalogue()`:
- Loads the crop's regional file (`cropConfig[name].file`) when one exists — this is the regional total the main map itself displays for that crop. **"Authoritative" is not the same as "correct":** **12 entries** deliberately have *no* `file:` — the six palay and corn ones since 2026-09-03 (their regional CSVs overstated the sum of their own provinces), and since **2026-09-05** Cattle, Chicken, Hog, Milkfish, Tilapia, Sugar and Coconut, whose regional CSVs turned out to hold **Overall Palay production** in their 2021–2024 columns — a pasted column, matched against the palay provincial rollup at **0.00% error in every region across all four years**. Their 2025 column is the right commodity. See `REGIONAL_DERIVED` above `cropConfig` in `js/app.js`. A regional file is only authoritative where it has been reconciled against the provincial data.
- Loads the crop's provincial file (`provConfig[name].file`) when one exists, for `byProvince` and — only when there's *no* regional file — to derive `byRegion` via the same `aggregateProvToRegional(provStats, false)` the main map uses (sum, since Volume is additive).
- A crop with no provincial file at all (Palay variants, Corn variants, Fisheries, Livestock) ends up with `byProvince: null` — `getTopCommodities()` skips such crops when ranking at province level, but they still count at region/island/national level. The catalogue's footnote states this.

**Region keys are load-order sensitive — the catalogue must wait for the provincial boundary.** For the 64 crops with no regional file, `byRegion` is built by `aggregateProvToRegional()`, which keys each bucket by `provinceRegionPcode()`. That function needs `provinceFeatureIndex`, and its last-resort fallback has to return a **real 10-digit region pcode** (`'1100000000'`), never a bare PSGC prefix (`'1102'`) — the key is what region and island ranking look up, using full pcodes from the boundary shapes and `ISLAND_GROUPS`. A prefix matches nothing, so every province-sourced commodity reads as zero at region and island scope while national scope stays correct (it sums `byRegion`'s values and ignores its keys), and the cards' Top Regions list prints the raw number. Unlike the map's first crop, the catalogue is *not* gated behind `bootLoadDone()` — it opens on a scroll, an `IntersectionObserver` or the jump button, any of which beats the 42 MB `Admin_Provincial_Boundary.json` — and `catalogueData` caches whatever it computed for the session, so the failure is sticky. `ensureCatalogueData()` therefore waits on `provincialShapesReady` before aggregating; that promise's `.catch()` resolves rather than rejects, so a failed boundary degrades to the (now correct) fallback instead of hanging the catalogue on "Loading…".

**The parent region comes from published PSGC codes, not from geometry or string arithmetic.** `data/psgc_parents_2026.json` (122 entries + 18 region names, **4.6 KB**) is generated by `tools/build_psgc_parents.py` from the `Region_PSGC_Code` / `Region_Name` / `Province_PSGC_Code` / `City_PSGC_Code` fields in `data/admin_boundary_2026/` — a folder that had been in the repo unreferenced. `provinceRegionPcode()` consults this table **first**, before the boundary index and long before the prefix fallback, and hands the result to `provinceParentRegion()` so every year-aware rule still applies on top: the Basilan override, the Sulu re-home, NIR reverting to R6/R7 before 2024. Notably the published data independently confirms `PROVINCE_REGION_OVERRIDES` — PSGC puts Basilan under BARMM where `Admin_Provincial_Boundary.json` has it under Region IX.

Because the table needs no polygons, `ensureCatalogueData()` gates on it (4.6 KB) rather than on the 42 MB provincial boundary: aggregation was the only thing that needed `provinceFeatureIndex`, so correctness no longer costs a 42 MB wait before the first card. `regionDisplayName()` likewise falls back to the published `Region_Name`, so a region reads as a name rather than a PSGC code while the ~103 MB of regional boundary GeoJSON is in flight (the shapes still win once loaded).

Two adjustments in the generator are deliberate, and both are about **vintage**. Seven entities carry a different code in the 2026 drop than the one this project and every data CSV join on — Sulu (`0906600000` vs `1906600000`), Zamboanga City (`0931700000` vs `0907400000`), the four Metro Manila districts, and the Special Geographic Area — so `TO_APP` re-keys them; adopting the 2026 codes as identity would silently break every data join. And Sulu is stored under **BARMM** as its base region rather than the Region IX the 2026 file states, because `PROVINCE_REHOMES` supplies Region IX from 2026 and PSA still books Sulu's 2025 output under BARMM. `provinceRegionPcode()` tries the incoming code and both alias directions, and passes **the key that matched** to `provinceParentRegion()` — passing the aliased code instead made the Sulu re-home miss and report BARMM for 2026.

**Ranking**: `valueForScopeEntry(entry, scope, scopeValue, year)` sums the relevant `byRegion`/`byProvince` rows for one crop/scope/year (returning `null`, distinct from a real zero, when the scope doesn't apply — e.g. province scope for a crop with no provincial source). `getAllCommodityValues(scope, scopeValue, year, categoryFilter)` runs that over every crop (skipping any whose `CROP_META.primary` doesn't match `categoryFilter`, when one's set), drops zero/no-data ones, and sorts descending — the *full* ranking, not just a slice. `getTopCommodities(scope, scopeValue, year, limit, categoryFilter)` is just `getAllCommodityValues(...).slice(0, limit)`. Island/national sums simply add up the member regions' `byRegion` values — since NIR's pre-2024 provinces still land under Visayas either way (whether bucketed under NIR's own pcode or its pre-2024 R6/R7 parents), there's no cross-island leakage from that cutover. The full (non-sliced) ranking is also what powers the year-over-year and rank-movement stats below, since those need a crop's position/value in a year it *isn't* necessarily in the top 10 for. `computeCatalogueRankings(scope, scopeValue, year, categoryFilter)` bundles the full ranking + total + previous-year lookup into one call, shared by the card grid, the full ranking table, and CSV export so all three can never disagree on a number.

**Illustration highlight map** (`#catalogue-map-panel`, left of the cards): a plain SVG rendering of the same boundary GeoJSON the main map uses — no basemap tiles, no pan/zoom interaction, just static context. `renderCatalogueMap()` redraws it on every scope change (and on year change, since region shapes differ pre/post the 2024 NIR cutover):
- `ringToPathD()`/`geometryToPathD()` convert a GeoJSON Polygon/MultiPolygon straight into an SVG `<path d="...">`, using `[lng, -lat]` as SVG coordinates directly (a plain equirectangular projection — accurate enough for a small illustrative map, not for measurement) and `fill-rule="evenodd"` so holes render correctly regardless of the source data's ring winding order.
- National/island/region levels render all regions (`getActiveShapes()`); province level renders only the provinces within the selected region (`provincialShapes` filtered by `provinceParentRegion`). The selected island's regions / the selected region / the selected province get the `.cmap-highlight` class (blue); everything else stays muted gray (`.cmap-shape`).
- `expandBoundsForFeature()` computes a bounding box over whichever feature set is shown, and the SVG `viewBox` is refit to it (6% padding) — since only the relevant subset is ever drawn, "zooming in" falls out of that refit for free, no separate crop step.
- The area name (`#catalogue-map-label`, e.g. "Philippines" / a region / a province) floats top-center over the map as a small white pill, rather than sitting below it as a caption — `position:absolute` anchored to `#catalogue-map-panel`. The mobile panel override keeps `position:relative` (not `static`) specifically so the label still has a containing block to anchor against at narrow widths.
- **Share-of-area bar** (`.catalogue-share-row`): a 3px proportional bar plus its label — `"12.4% of area"` — between the card header and the collapsible details, width = that crop's share of the area's total. **The bar never ships without the label.** Shipped bare first and it read as a progress meter or a score: green, partly filled, no caption, and the sentence explaining it was in the collapsed details where it could not help. A length with no referent is decoration. It sits in the **always-visible** part of the card deliberately — the same figure exists as "% of area total" text, but that text lives inside `.catalogue-card-details`, which is collapsed by default, so the one number that lets you compare rank 1 against rank 4 was hidden exactly while you were scanning the grid. Width is clamped 0–100 (a share can exceed 100 when the area total is itself a partial figure) and a 0.0% share keeps a 2px sliver, so "tiny" reads differently from "none". The bar is `aria-hidden`; the share is appended to the card's `aria-label` so it is announced once rather than twice.
- Layering gotcha worth remembering: `.catalogue-card-banner` needed `position:relative` so the rank number (`.catalogue-rank`) could anchor to it — but per CSS stacking rules, *any* positioned element paints above non-positioned siblings regardless of DOM order, so the banner was silently painting over `.catalogue-photo`'s overlapping top half. Fixed with explicit `z-index` on both (banner `1`, photo `2`).
- **Top-10 icon markers** *(currently hidden — gated off by `SHOW_CATALOGUE_TOP10_ICONS = false` in `js/app.js` while the feature is revisited; flip that flag to `true` to bring it back)*: once `catalogueData` is loaded, `renderCatalogueMap()` also computes `getTopCommodities()` for the current scope and places each crop's `CROP_META` emoji inside the *highlighted* area — a white `<circle>` disc sits behind each `<text>` emoji for legibility, since emoji glyphs ignore SVG `fill`/`stroke`, wrapped in a `<g>` with a `<title>` for a hover tooltip (name + rank). Since `renderCatalogueMap()` is also called before crop data has loaded (to draw the shapes immediately), it's called a second time once `ensureCatalogueData()` resolves so the icons appear without requiring another scope change.
  - **Province/region/island scope**: icons must land inside the actual selected shape(s), not merely their bounding box — an irregular or non-convex boundary (a slim province, an island group whose regions aren't one solid block) means a naive grid can drop a marker in the sea or over a neighbor. `pointInRing()`/`pointInGeometry()` do a standard ray-casting containment test (independent of the source data's ring winding order, unlike the `fill-rule="evenodd"` the rendered `<path>` relies on), and `sampleInteriorPoints()` samples a 12×12 candidate grid over the highlighted bounding box, keeps only points that pass that test, then evenly picks up to 10 of them. Icon radius is derived from the bounding box divided by that same 12-cell grid, so size scales with the area shown.
  - **National scope**: there's no single "selected shape" to sit inside at country scale, so the 10 icons instead ring an ellipse just outside the country's silhouette (radius 1.16× the half bounding-box dimensions), evenly spaced by angle — "in the sea, tracing the coastline" rather than scattered across the landmass. This needs more clearance than the usual 6% viewBox crop margin, so `renderCatalogueMap()`'s `padFrac` widens to 24% specifically at national scope *while `SHOW_CATALOGUE_TOP10_ICONS` is on* — with icons currently hidden, national scope uses the same 6% margin as everything else, so the country fills the panel rather than looking small/zoomed out. Re-enabling the icon flag automatically brings the wider margin back.

**Cards** (`renderCatalogueGrid()`): collapsed by default — a colored rank banner (gold/silver/bronze for 1st–3rd, green otherwise) with a circular "photo" overlapping it (avatar-over-cover-photo style; `.catalogue-photo` is the only piece that would need to become an `<img>` once real photos exist), the crop name, and its volume for the selected area/year, plus a small rank-movement indicator (see below). Clicking a card (or Enter/Space — cards are `role="button"`/`tabindex="0"`) toggles `aria-expanded`, which CSS uses to reveal expanded details below via a `max-height` transition; a delegated click/keydown listener on `#catalogue-grid` handles this (cards are re-rendered wholesale on every area/year change, so listeners aren't bound per-card; accordion behavior in `toggleCatalogueCard()` also collapses any other open card first, so a stretched grid row can't leave dead space under a still-collapsed neighbor). The expanded panel shows, in order: Primary Category / Sub-Category as small pill badges (`.catalogue-tag`/`.catalogue-tag-sub`), the Scientific Name (italic) and Local/Common Name (PH) as a text line, an analytics stats row, then the description. All of the tags/names/blurb — emoji, blurb, sci, local, primary, sub — comes from `CROP_META`, keyed by crop name and sourced from `data/Priority Commodities_working file - Commodity Dictionary.csv` wherever that dictionary covers the crop. The 8 Fisheries/Livestock crops aren't in the dictionary at all, and the Palay/Corn entries (Overall/Irrigated/Rainfed Palay, Overall/Yellow/White Corn) have blank category cells there — Overall Palay and Overall Corn do carry a scientific and local name (*Oryza sativa*/Palay, *Zea mays*/Mais), the four variants have neither — both cases leave `sci`/`local`/`primary`/`sub` empty, and `renderCatalogueGrid()` simply omits a tag/name row rather than rendering an empty badge.

**Card analytics** — added on top of the base ranking/description, kept to one compact stats row plus a small collapsed-view indicator so the card doesn't turn into a wall of numbers:
- **Rank movement** (`.catalogue-rank-delta`, next to the volume figure, visible without expanding): ▲N/▼N if the crop moved N spots up/down vs. its rank in `currentYear − 1` for the same scope, `–` if unchanged, `NEW` if it wasn't ranked (zero/no data) last year. Omitted entirely when `currentYear` is the first year in `YEARS` (2021) — there's nothing earlier to compare against.
- **Year-over-year % change** (`.catalogue-stat-yoy`): `(thisYear − lastYear) / lastYear`, colored green/red/gray for up/down/flat (±0.5% dead zone), or "New this year" if it had no prior-year value.
- **Share of area total**: this crop's value as a percentage of the sum of *every* ranked crop's value for the current scope/year (not just the top 10) — contextualizes the raw MT figure.
- **Yield (MT/HA)**: unlike the other stats (derived from `catalogueData`, already fully loaded), yield is fetched lazily — only the first time a card is expanded, via `loadYieldForCrop()`/`loadCardYield()`, and only for crops that have a `yieldFile` in `cropConfig`/`provConfig` (roughly half don't). This avoids doubling the ~75-file upfront catalogue load for a stat that's invisible until a card is opened. `loadCardYield()` updates the placeholder `<span data-yield-for="...">` in place rather than re-rendering the whole grid, so it can't disturb the currently-expanded card; if the scope/year changes before the fetch resolves, the span is already a detached, harmless no-op.
- **5-year sparkline** (`buildSparklineSvg()`): a tiny inline `<svg><polyline>` of the crop's own 2021–2025 values for this scope, normalized to its own min/max (shows the crop's trend shape, not a cross-crop comparison). Fed by **`getCommodityTrendSeries()`**, which walks `trendPeriods()` — complete periods only. Its sibling **`getCommodityYearSeries()`** walks the full `YEARS` and is what the ranking-table **CSV export** uses, because that header is built as `.concat(YEARS)` and a published figure, partial or not, belongs in a download of the figures. The two must not be swapped: the export needs 6 columns, the trend line needs 5.
- **Top 5 Regions / Top 5 Provinces** (`.catalogue-top-areas`, bottom of the expanded card, below the description): the reverse of the card grid's own ranking — instead of "which crops rank top in this area," this is "which areas rank top for this one crop," and it's always nationwide regardless of the currently selected scope. `getTopAreasForCommodity(cropName, year, level, limit)` reads directly off the crop's `catalogueData` entry (`byRegion`/`byProvince`, already fully loaded — no extra fetch), preferring the display name straight off the source row (`row.Province`, or `row.ADM1_EN` for crops with a dedicated regional file) over deriving one from the pcode, since derived names need alias/split lookups that don't always agree with what the CSV itself says for older rows. The Provinces column is simply absent for the crops with no provincial source at all (Palay/Corn variants, Fisheries, Livestock) — same crops that already have `byProvince: null`. Rows show rank + name only, no volume figure — the per-region/province MT total was dropped as visual noise, being a different number from the area-scoped Volume the rest of the card is built around. `.cta-name` carries a `title` attribute with the full name, since the list itself truncates long names with an ellipsis (`text-overflow: ellipsis`) — hovering reveals the untruncated name via the browser's native tooltip.

**The legend's national figure is not the colouring threshold.** `classifyEntries()` colours regions against the unweighted mean of those reporting, which is the right comparator for "above the typical region" — but it is not a national figure, and the legend used to print it as one for all five metrics. `legendNationalFigure()` now separates the two: additive metrics (Volume, Area, Trees) state the **national total**, ratio metrics (Yield, Yield/Tree) the **weighted quotient** — total volume ÷ total area, or ÷ total trees. The old figure was a mean of means for ratios, since regional yields are themselves unweighted means of provincial ones; measured across the 56 crops with volume, area and yield the median error was 26% and the worst 1109% (Squash 98.12 against a true 8.11; Carrots 4.42 against 13.33). Ratio metrics need a second and third file to weight properly, so `ensureRatioTotals()` loads and caches them per crop — the legend re-renders on every scrub and focus change — and leaves the line blank rather than printing `NaN` if either is missing. The figure is national at any zoom, computed from every province rather than from `classification`, which holds only what is on screen.

**Bearing-tree files are verifiable against their own yield-per-tree.** Σ(trees × published MT/tree) should reproduce the crop's volume. It does, to **0.0%**, for Avocado, Durian, Dragon Fruit, Calamansi, Pomelo, Rambutan and Dalandan, and to 2.5% for Banana Cardava (a 62-of-87 province overlap). Run that check before trusting any tree file. It is what condemned Overall Banana's — 276,209,633 trees against Banana Cardava's 303,648,834, a subset above its parent in 67 of 87 provinces — and `treesFile` is unwired there as a result. Mango is the one crop the check cannot reach, having no published yield-per-tree; it passes a plausibility test instead at a steady 73.8–80.0 kg per tree across 2020–2025. Note also that the two tree-file vintages cover opposite years: the old `*_yieldtree_*` files (Mango) run 2021–2025 with no 2026, the newer `*_provincial_bearing_area*` files 2025–2026 with no 2021–2024.

**Standing area never sums across quarters; cropped area does.** A perennial's planted area is a stock reported afresh each quarter — mango in Zambales is 8,658.99 ha in all four — so adding the quarters multiplies it. An annual vegetable's area harvested is a flow: the same land really is cropped more than once a year, so its quarters differ and the sum is the right figure. The two are separable by inspection — the share of provinces whose four quarterly areas are *identical* runs 79% (Durian), 64% (Calamansi), 55% (Mango) against 4% (Eggplant, Camote), 7% (Cassava, Peanut). Check that ratio before building any annual area file from a quarterly source.

**The catalogue is annual-only, and says so off the annual axis.** `catalogueData` is built from `cropConfig.file`/`provConfig.file`, whose columns are years, so in Quarter or Semester mode every lookup misses and all 75 commodities drop out. `catalogueAnnualOnlyNote()` supplies the explanation to both the coverage line and the empty grid; the previous wording (“no reported figure for this area”) blamed the area, which at national scope is the whole country. Related: `previousPeriod(period)` indexes `YEARS` rather than doing arithmetic on the period string — `parseInt('2025Q4') - 1` is `'2024'`, which is not a quarter, and that silently emptied the catalogue's YoY and rank-delta columns. `getPrevYear()` delegates to it. If the catalogue ever gains sub-annual data, the “YoY” column heading needs renaming: it would then compare against the previous quarter.

**Focused on a region, the legend header states that region's total AND the national one.** `legendHeaderText(figure, scopeLabel, regionTotal)` builds “2025 Mimaropa Region: 1,314,220.12 MT · 6.7% of the national 19,611,730.97 MT”. The region figure is `classification.total`, so it agrees with the province rows listed below it and with the region popup's Production line; the national figure stays because it is what the Above/Below bands are measured against, and the threshold line directly underneath is derived from it. Unfocused the header is the plain national figure. Ratio metrics (Yield, Yield/Tree) always show the national average instead — volume ÷ area has no regional “total”, and summing provincial yields is meaningless.

**The threshold line's count is the average's denominator, never the areas on screen.** `legendThresholdText(thr, areas, singular, plural)` builds “national average X · across N regions/provinces”, and N must be what X was divided by. Unfocused those coincide — the classification holds every reporting region. Focused they do not: the threshold becomes `nationalProvAvg`, taken over every reporting province in the country, while the classification holds only the focused region's provinces, so `renderProvincialChoropleth()` passes `nationalProvCount` alongside it. Getting this wrong is invisible in the national view and only shows on drill-down — Palay Q1 2025 on Bicol once read “58,655.28 MT · across 6 provinces” for a figure taken over 80. Sanity check when touching it: value × count should reproduce the national total.

**Highlighting the No-data class repaints it; fill opacity alone cannot carry it.** `palette[0]`, the No-data colour, is a near-white wash in every one of the 83 palettes, so picking "No data" lit the matching regions in a colour identical to the basemap while fading the rest to 0.08 — the map read as though every region were no-data. `highlightStyleFor(info, cls, opacity, restOpacity, baseFill)` therefore returns `NO_DATA_HIGHLIGHT_FILL` (`#8d93a1`) for a matched no-data area, and the area's own colour for everything else. The slate is cool deliberately: a warm grey would collide with the brown ramps (Coconut runs `#d7c6b6` through `#9e7956`), and a test asserts it matches no palette colour in use. `clearClassHighlight()` restores the fill colour as well as the opacity, so a released area cannot keep the slate. The choropleth stays strokeless throughout (`weight: 0`; regional borders come from the separate `boundaryLayer`) — an outline was tried for this and rejected as too heavy over a pale basemap.

**`classifyEntries()` always returns all six classes in `counts` and `rangeStrings`, even when nothing is reported.** The empty path used to return bare `{}`, and `renderLegend()` skips a band with `counts[cls] === 0` — `undefined === 0` is false, so three bands rendered with no range and no count over an empty map. Any new consumer of a classification may rely on every class key being present; any new skip test should stay a value test, not a truthiness accident.

**A metric tab being enabled does not mean the selected period has data.** `metricAvailableForCrop()` checks only that a file is configured. Eight tree crops carry a `treesFile` whose contents start at 2025 (`*_provincial_bearing_area.csv`), so Bearing Trees for Durian in 2022 used to paint an empty map with nothing said. `reportEmptyPeriod()` now writes a sentence into `#year-hint` — *"Bearing Trees for Durian is published from 2025 onwards — nothing to show for 2022."* — enumerating the periods instead when the series is scattered rather than a clean range. It runs from both `loadCropData()` branches and from `setYear()`, since scrubbing re-renders from cached stats without reloading. The notice tags itself with `dataset.emptyPeriod` so it clears only its own message: `#year-hint` is shared with the sub-annual notice and the "select a crop" prompt. Its `stats` and `period` arguments are injectable because `currentProvStats`/`currentCropStats`/`currentYear` are module-scope `let`s and therefore invisible to any test driving the page.

**Crop-tree sub-groups.** Fruit Crops carries **Banana**; Vegetable & Rootcrops carries **Highland Crops**, **Lowland Crops**, **Root Crops**, **Spices** and **Nuts & Legumes**; Non-Food & Industrial carries **Fibers** (12 entries, 6 of them `item-disabled` because PSA publishes nothing for them) and **Tobacco** (4, including a disabled Burley). Sub-groups always lead their section — a loose crop above a group makes the group read as an afterthought — and source order is preserved inside each rather than re-sorted. Grouping follows what the crop *is*, not whether it has data: Tobacco (Burley) sits with the tobaccos, not with Silk and the Agaves.

**Cards load their crop onto the map** (`showCropOnMap()`): clicking a card expands it *and* switches the map above to that commodity. The card carries a `data-crop` attribute holding the catalogue name rather than the displayed label — the card reads "Coconut", the crop is `Overall Coconut Production`, and the tree item is "Coconut with Husk". Two guards: `selectCrop()` toggles *off* when passed the element already active, so a click on the crop already shown would blank the map (guarded on `currentCropName`); and the crop's tree section is opened first, or the crop loads while the panel shows no highlight. Enter and Space behave identically. Nothing scrolls — the card expands in place and `▲ Back to map` returns to the map.

**Coverage line** (`#catalogue-coverage`, `renderCatalogueCoverageNote()`): the grid shows at most 10 cards and `getAllCommodityValues()` drops every commodity with no reported value, so a commodity could be absent for two very different reasons — ranked 11th or lower, or no data at all for this area/year — and the grid looked identical either way. Dragon Fruit ranks 62nd of 73 nationally in 2025 (3,393 MT) and can never reach a card; the ten commodities whose regional Agristat files stop at 2025 vanish entirely at year 2026. The line under the grid states both: the ranked count against the Category filter's pool (`catalogueCategoryPoolSize()`), how many have no reported figure, a reminder at province scope that several commodities are published only regionally, and — via `partialYearNote()` — the partial-year warning. It is hidden whenever the grid itself is empty of a scope (`hideCatalogueCoverageNote()`), and at a zero ranked count it drops the "Showing the top…" clause, since the grid's own empty message already says it in full.

**Partial-year warning.** `PARTIAL_ANNUAL_YEARS`/`partialYearNote()` mark 2026's annual column as incomplete. The function existed but was never called by anything — dead code — so nothing on screen explained why 2026 ranks 63 of 73 commodities against 2025's 73 of 73. The gap is a data-vintage asymmetry, not a bug: the fourteen regional Agristat files (`crop_dataAgristat_Database — *_2025.csv`) carry no `2026` column at all, while the provincial files were backfilled from Q1 (`PARTIAL_2026_FROM`), so Mango, Coconut, Lettuce and all seven Fisheries/Livestock commodities have nothing to rank on. The note is now rendered on the coverage line and appended to the full ranking table's subtitle.

**Nothing is excluded from the ranking.** The catalogue ranks every crop enabled in the tree: **76 enabled tree crops, 76 `CROP_META` entries, an exact match in both directions.** Overall Palay and Overall Banana were previously held out of `CROP_META` because their volume dominated the rankings; they are now back, Overall Corn was added alongside them (and given the tree item it never had, so the "every ranked commodity is also selectable on the map" invariant still holds), and all three rank normally at every area level.

The three carry a **`CROP_META.aggregate`** string naming what they contain (`'Irrigated + Rainfed Palay'`, `'Yellow + White Corn'`, `'all banana varieties'`). Verified against the data: Overall Palay's 2025 national figure of 19,611,731 MT is *exactly* Irrigated (15,104,168) + Rainfed (4,507,563). So a combined commodity and its sub-types are all in the list at once and the same tonnage is counted more than once — deliberately. Two consequences are handled explicitly rather than left to surprise the reader:

- **They are excluded from the share denominator** in `computeCatalogueRankings()`, and *only* from that. Counting them would put the 2025 national total at 94,828,455 MT instead of 58,353,307 MT — **63% inflated** — dragging every "% of area total" on the page down with it, aggregates included. Ranking, sorting, the trend sparkline, YoY and rank movement all treat them as ordinary commodities.
- **Every surface that shows one labels it.** Cards get a `Combined total` pill (`.catalogue-tag-agg`) whose `title` names the sub-types; the ranking table prefixes its Category cell in both sort modes; the CSV export gains a **`Combined Total`** column reading `includes Yellow + White Corn`, because totalling the exported Volume column without it overstates output by that same 63%. `#catalogue-footnote` says it in prose.

At national scope in 2025 this puts Palay 1st, Irrigated Palay 2nd, Coconut 3rd, Banana 4th, Corn 5th, Yellow Corn 6th and Rainfed Palay 7th — the staples crowd the top of the list, which is the accepted cost of excluding nothing.

Five crops remain `item-hidden` in the tree and so stay out of the ranking — Banana Cavendish, Sugarcane, Broccoli, Chayote and Celery. That is a *publication* decision about the whole app (they are hidden on the map too), not a ranking one; removing the class from a tree item in `index.html` is all it takes to bring one back, and `CROP_META` would then need an entry for it.

**Full ranking table** (`#catalogue-view-ranking-btn` → `#catalogue-table-modal`): the cards only ever show the top 10, but sometimes you want to see the whole list — this button opens a modal with every commodity that has a reported value for the current scope/year/category, one row each. `renderCatalogueRankingTable()` calls `computeCatalogueRankings()` — the same function the card grid uses — over the full list instead of a 10-item slice. The modal reuses the same chrome pattern as the main map's `#table-modal` (backdrop, header, close button) under new IDs, and is wired into the same global Escape-key close chain as the other modals. Its toolbar (`#catalogue-table-toolbar`) adds three things:
- **Search** (`#catalogue-table-search`): live-filters rows on every keystroke by name, scientific name, local name, or category (`catalogueCropMatchesSearch()`). The displayed rank number stays the crop's *true* rank in the full list (`rankings.all.indexOf(r)`), not its position in the filtered subset — searching "cassava" shows rank 23, not rank 1.
- **Opening it** (`openCatalogueRankingTable()`): the button sits in the scope bar, which is interactive well before the ~73-file catalogue load settles, so opening has to tolerate `catalogueData` still being null — it used to `return` there, and the click did nothing whatsoever (no modal, no message, no error). It now opens the modal on a "Loading commodity data…" subtitle and fills in from `ensureCatalogueData()`, or reports the failure in place.
- **`refreshCatalogueRankingTable()`** fronts every path that rebuilds the table and is the *only* one that should be called directly. Yield is lazy and `catalogueTableSortBy` persists across modal opens, so a path that goes straight to `renderCatalogueRankingTable()` while in Yield mode renders whatever `catalogueYieldData` happens to hold — reopening after a Category change showed "—" for every newly-included commodity (worst under HVEC, where only 6 of 16 crops have a yield source). This helper loads yield for the current view first, then renders.
- **Volume/Yield sort toggle** (`#catalogue-sort-volume-btn` / `#catalogue-sort-yield-btn`, `switchCatalogueTableSort()`): Volume is the default — same columns as the cards (Δ, Category, Volume, Share, YoY, 5-yr trend). Switching to Yield lazily fetches yield (`loadYieldsForCrops()`) only for the commodities currently in view, then swaps in a Yield-specific column set (`#`, Commodity, Category, Yield MT/HA, Volume) — Δ/Share/YoY/trend are dropped in Yield mode since they're volume-rank concepts that would be misleading attached to a different ordering. This mirrors the per-card yield stat's lazy-loading principle: yield is never fetched for all ~75 crops upfront, only for what's actually being shown, and only when the user asks for it.
- **Export CSV** (`exportCatalogueRankingCSV()`): downloads the *full* (unfiltered-by-search) current ranking — rank, name, Primary/Sub-Category, one column per year in `YEARS` (2021–2025 Volume), share of total, and YoY % — UTF-8 BOM-prefixed so Excel renders accented names correctly, matching the main map's `exportDataTableCSV()` convention.

**Compare areas** (`#catalogue-compare-btn` → `#catalogue-compare-modal`): two independent area pickers side by side, each showing its own top-10 commodities for the current year (respecting the active Category filter). `compareAreaOptionsHtml()` builds one shared `<option>`/`<optgroup>` list — Philippines, each island group, then every region with its provinces nested under it, values encoded as `"scope:value"` (e.g. `"province:0128000000"`) — and both `<select>`s reuse it independently. `populateCompareSelects()` rebuilds this list fresh *every time the modal opens* (preserving each select's current choice if it's still a valid option, defaulting to Philippines vs. Luzon otherwise) rather than once at page load — `getActiveShapes()`/`provincialShapes` are fetched asynchronously, so a one-time build risked running before they'd resolved and permanently omitting every region/province option. Selecting an area re-renders just that side's list (`renderCompareList()`); switching to Yield/searching/etc. in the *other* modals doesn't affect this one since each is a snapshot rendered at open/change time, not a live-bound view.

---

## 1. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Map engine | Leaflet 1.x (local `js/leaflet.js`) | No build step — plain HTML/CSS/JS |
| CSV parsing | PapaParse 5.4.1 (CDN) | Regional + provincial CSV files |
| XLSX parsing | SheetJS 0.18.5 (CDN, **lazy-loaded** by `ensureXLSX()` on first .xlsx request) | Provincial workbooks, sheet-per-crop |
| Fonts | DM Sans (UI) + DM Mono (numbers) | Google Fonts import in `css/app.css` |
| Plugins | Locate, Measure, Photon search (CSS only) | Photon geocoding called directly via fetch |

There is **no framework and no bundler** — `js/app.js` is a single file loaded at the end of `index.html`. State lives in top-level variables.

## 2. File structure

```
index.html              Page skeleton: control panel, legend, table modal, status pill
css/app.css             All custom styling incl. mobile + print rules
js/app.js               All application logic (~1,700 lines, numbered sections)
data/
  Admin_Boundary_Regional.json          Regions, 2024–2025 (NIR exists, Sulu still BARMM)
  Admin_Boundary_Regional_pre2024.json  Regions before the 2024 NIR split
  Admin_Boundary_Regional_2026.json     Regions, 2026+ (Sulu moved to Region IX)
  Admin_Provincial_Boundary.json        Provinces (ADM2)
  Hillshade_18.png                      Terrain overlay image
  crop_data*.csv                        Regional series per crop
  *_Provincial.(csv|xlsx)               Provincial series per crop/metric
```

`js/app.js` is organized in numbered banner comments (`── 1. Map init ──` … `── 18. Wire up event listeners ──`) plus helper clusters (mobile helpers, status pill, sparkline, data table).

## 3. Data model

### 3.1 Geographic keys (PSGC)

- Regions are keyed by **`ADM1_PCODE`** (10-digit PSGC, e.g. `0300000000`).
- Provinces by **`ADM2_PCODE`** (e.g. `0304900000`).
- CSV rows with 9-digit codes get a leading `0` prepended on load.
- Legacy `PH#####` codes in xlsx files are converted (`PH01028` → `0102800000`), with explicit overrides for the three NIR provinces.
- Province features are indexed once at load (`provinceFeatureIndex`, ADM2_PCODE → feature) — `provinceRegionPcode`/`provinceDisplayName` use it instead of linear scans.

### 3.2 Crop registry

Two config objects at the top of `app.js`:

- **`cropConfig`** — one entry per crop: regional CSV path(s) and the 5-step color palette `[noData, low, average, high, peak]`. Crops without a regional file derive regional values by aggregating provincial data. **Only 2 crops still carry an independent regional `file:`** — Mango, whose regional file matches `data/fruits_long.csv` to the tonne and is therefore the correct side, and Egg, within 0.4%. Coconut was moved to derived on 2026-09-05: its regional file matches the provinces exactly for 2021–2023 but its 2024 column is short by 858,653 MT in Region IX, Caraga and Mimaropa. Coconut is defined as `Coconut (w/ husk)` — the sole Commodity Type in all 92 rows of its volume, area and yield files — and its Area and Yield begin at 2025. Every other crop with provincial data derives its regions, so the two views cannot drift apart.
- **`provConfig`** — provincial file per crop and metric (`file`, `yieldFile`, `areaFile`, `treesFile`). XLSX sheet names are encoded after `#`: `data/Workbook.xlsx#SheetName`.

### 3.3 Time & boundary quirks (important!)

- **`YEARS`** = 2021–2026 in the annual view (`ANNUAL_YEARS`). Adding a year = extend this array, update the year controller markup in `index.html`, ship data columns for it. In the Quarter/Semester views `YEARS` is **not** this array — it is rebuilt from the sub-annual CSV's own header columns on each load, so adding a quarter to the sheet needs no code change.
- **2026 is a partial year** (`PARTIAL_ANNUAL_YEARS`). PSA publishes an annual figure only after Q4 closes, so the `2026` column holds whatever had been reported when the sheet was pulled. **How much varies by commodity** — measured against each file's own 2025, 66 provincial volume files sit near a single quarter, 12 near a semester, and 36 fall outside both, so there is no honest fixed sub-title like "Q1–Q2". Selecting 2026 in the annual view shows an amber note under the timeline (`#partial-year-note`, `updatePartialYearNote()`); the help panel carries the longer explanation. `currentYear` still defaults to **2025**, the last complete year, so the map does not open on partial data.

  Only the *annual* 2026 column is partial — the sub-annual periods that appear are complete ones, so those views show no warning, and their period lists stop at the last period PSA published. **2026Q2 exists for six crops only** (Palay, Irrigated/Rainfed Palay, Corn, White/Yellow Corn), which come from Agristat; the fruit and vegetable quarters stop at 2026Q1. That mattered because the fruit/vegetable **semester files are summed from quarters, not read from a semester row** (`sync_fruits.py`: *“semester here is summed (Q1+Q2, Q3+Q4), not read”*), and nothing checked both quarters existed — so `2026S1` was written as exactly `2026Q1` for **54 of 60** crops and shown with no warning, since by this rule a semester is not partial. Against 2025S1 that read as a **−46.3% median collapse** (Mango −85.4%, Asparagus −94.3%), entirely an artefact of comparing one quarter with two. Fixed 2026-09-08: the column was dropped from those 54 files (58,643 surviving cells verified unchanged) and both sync tools now emit a semester only when both of its quarters are present, so the semester button simply does not appear for 2026 on those crops. Palay and Corn keep theirs.

  **A partial column is shown, but never trended** (`trendPeriods()` = `YEARS` minus any partial one). Comparing a full 2021 against a single quarter of 2026 is a category error, not a comparison, and every trend surface was making it: **67 of the 75 commodities were affected, the median trend was wrong by 75.7 percentage points, and for 33 of them the arrow pointed the wrong way** — Irrigated Palay showed “−77.3% since 2021” against an actual **+0.1%**, Yellow Corn “−70.6%” against **+4.1%**, Dragon Fruit “−96.0%” against **+62.5%**. (The eight unaffected commodities are those whose regional files carry no `2026` column at all.) It also wrecked the chart's *shape* — the low outlier stretched the y-axis until the five real years collapsed into 0.6px of a 26px chart with a cliff on the end, so the trend a user saw was an artifact of the axis rather than anything the crop did. `trendPeriods()` now backs the popup sparkline (`buildSparklineHTML()`), its Lowest/Highest/Average rows (`buildStatsRowsHTML()`), the catalogue card sparkline and the ranking table's “5-yr trend” column. The header counts the periods it actually drew, so it reads **“5-Year Trend”**, not “6-Year”.

  **What still shows 2026:** the map, the legend, popup values, the data table, the rankings and both CSV exports. The rule is *don't trend it*, not *don't show it* — withholding a published figure would break the project's own “never alter published numbers” rule. Only the sub-annual axes are untouched, since `partialYearNote()` fires in annual mode alone and a quarter of data is a whole quarter.
- **Three regional boundary vintages.** `getActiveShapes()` picks by year, because the regions themselves changed twice inside the data range:

  | Years | File | State |
  |---|---|---|
  | 2021–2023 | `Admin_Boundary_Regional_pre2024.json` | No NIR; Negros Occidental in R6, Negros Oriental + Siquijor in R7 (`NIR_PROV_TO_PRE2024`) |
  | 2024–2025 | `Admin_Boundary_Regional.json` | NIR exists; Sulu still in BARMM |
  | 2026+ | `Admin_Boundary_Regional_2026.json` | Sulu moved to Region IX (see `PROVINCE_REHOMES`) |

  The switch uses `parseInt(currentYear)`, which is deliberate: in the Quarter/Semester views `currentYear` is a string like `'2026Q1'`, and `parseInt('2026Q1')` is `2026`, so sub-annual periods land on the right vintage without a separate branch.

  The three files load via `Promise.allSettled`, **not** `Promise.all` — one missing vintage costs you that era's borders, not the whole atlas — and `getActiveShapes()` falls back to the nearest vintage that did load. They are cache-busted with **`BOUNDARY_VERSION`**, separate from `DATA_VERSION`: the boundary files total ~103 MB, and `DATA_VERSION` bumps on every crop-CSV edit, so sharing it forced a full re-download on routine data changes. Bump `BOUNDARY_VERSION` only when a boundary file itself changes.

  The 2026 file was **dissolved from the 2026 provincial layer on `Region_PSGC_Code`**, not exported as its own regional layer. A directly-exported regional file had Sulu added to Region IX *without* being erased from BARMM, leaving the two regions overlapping by 1,519 km² — Sulu's entire area, claimed twice. Dissolving from provinces makes that class of error impossible, since each province belongs to exactly one region by construction. If the file is ever regenerated, dissolve it the same way.
- **Province splits** (`PROVINCE_SPLITS`): five highly-urbanised cities have their own carved polygon and their own PSA series, but only from the year PSA began reporting them separately. `effectiveProvincePcode()` aliases the polygon to its parent before that year, so the city takes the province's colour and its popup reads "reported under parent".

  | City | Parent | `since` |
  |---|---|---|
  | Zamboanga City `0907400000` | Zamboanga del Sur | 2025 |
  | Davao City `1130700000` | Davao del Sur | 2025 |
  | Bacolod City `1830200000` | Negros Occidental | **2026** |
  | Butuan City `1630400000` | Agusan del Norte | **2026** |
  | Puerto Princesa `1731500000` | Palawan | **2026** |

  `since` is **per city**, not one cutover year — a wrong value moves real tonnage between a city and its province. The polygons are carved out of their parents (city ∩ province = 0), and `sync_agristat.py` must *not* also fold these cities via `HUC_PARENT_PCODE`: folding and splitting together would post the tonnage to the parent while the city polygon rendered as no-data.
- **Basilan** (`PROVINCE_REGION_OVERRIDES`): the provincial boundary GeoJSON tags Basilan's polygon under Region IX, but PSA statistics (and all data files) report it under BARMM. The override makes it drill down, classify, and aggregate with BARMM.
## Reporting periods (Annual / Semester / Quarter)

The timeline can show yearly, half-yearly or quarterly figures. The switch sits
above the slider in the crop panel, because it changes what the timeline
*means* rather than what is selected on it.

The control is two levels, matching the shape of the data: the slider picks a
**year**, and a branch row beneath it picks the **period inside that year**
(1st SEM / 2nd SEM, or Q1-Q4). A connector descends from the selected year into
that row, so the periods read as its children rather than as a second switch.
Only periods that exist are offered - 2026 stops at Q2. Moving the year keeps
the period you were on where it exists (Q3 2023 to Q3 2024) and falls back to
that year's last period where it does not.

An earlier version put all 22 quarters on one track; every dot was 3px wide,
the labels smeared together, and it hid the fact that a quarter belongs to a
year at all.

- **`YEARS` is the active period list, not a fixed set of years.** It holds
  `'2021'…'2025'` for Annual and period keys like `'2024Q3'` / `'2024S1'`
  otherwise. Around 70 places walk it to build trend charts, popups, the
  auto-play loop and the regional rollup, and all of them keep working because
  the keys are also the csv column names — `row[period]` is unchanged. Any
  `parseInt()` on a key still yields the year, which is what
  `provinceParentRegion()` needs.
- **Sub-annual data exists only for Palay and Corn.** The Agristat sheet carries
  nothing else, so Semester and Quarter grey out for the other ~80 crops and say
  why instead of drawing an empty map. Only the volume, area and yield metrics
  apply — bearing trees and yield/tree are tree-crop metrics.
- **Provincial only.** There is no regional sub-annual file; regional totals are
  derived by `aggregateProvToRegional()`, the same path an annual crop with no
  regional file already takes.
- **The period list comes from the file's own header**, not from a constant, so
  adding a quarter to the sheet needs no code change.
- **Three label registers**, picked by how much room the context has:
  `periodLabel()` spells it out (`2025 2nd Semester`) for standalone headers -
  the legend average, the period pill, the chart caption. `periodShort()`
  (`2nd SEM 2025`) is for dense repeated rows, chart axis ends and tooltips; the
  long form there wrapped every popup row onto two lines. `childLabel()` (`Q1`,
  `1st SEM`) is for the branch buttons, which sit under the year already. The
  raw `2025Q4` key stays in the csv columns and the URL hash, where it belongs.
- **The chart states its selected period in words.** A dashed guide, a
  white-ringed marker and a "Showing ..." caption, because a 3px colour change
  was the only thing distinguishing it and colour must not be the sole carrier
  of meaning.
- **Annual will not always equal the sum of the quarters**, and that is correct.
  PSA rounds each period's figure to two decimals on its own, so round-then-sum
  and sum-then-round land a centavo apart. Verified with exact decimal
  arithmetic on 2025 irrigated palay: 7 of 84 provinces differ by 0.01 MT, net
  -0.01 MT nationally against 15,104,167.77 MT. Do NOT "fix" this by deriving
  one axis from another - that would mean publishing figures PSA did not.
- **Known gaps.** PSA publishes no NCR rows sub-annually, so NCR stays unpainted
  on Semester and Quarter (it has annual figures). 2026 is reported only through
  Q1–Q2. The catalogue view remains annual regardless of the switch.

**Codeless rows are dropped, so a missing PSGC code is missing production.** `loadDataFile()` skips any row without one (`if (!row.ADM2_PCODE) return;`). The five highly-urbanised cities used to arrive with an empty `ADM2_PCODE` in most of `data/`, which silently removed them from the choropleth, the regional rollup, the Top 10 and the CSV export — 358,062 MT of 2025 volume across 48 files, and **55.9% of national durian**, since Davao City is the durian industry. `tools/fix_codeless_provinces.py` fills those codes (708 rows, 146 files); it pins them rather than harvesting by name, because several files gave a city a code belonging to a real province (`1804600000` is Negros *Oriental*, `1108600000` is Davao *Occidental*), which would post city output onto a neighbour while leaving the national total looking right. Undivided `Maguindanao` folds into **Maguindanao del Sur** (`1908800000`) — PSA's own convention, since `palay_corn_long.csv` carries no undivided row at all and books every pre-split year under del Sur, del Norte staying at zero until 2024. It is guarded per file rather than applied blanket: `fruits_long` hands over cleanly (2024 undivided only, 2025 successors only), but in `vegetables_long` the undivided row is a rolled-up **parent** of the other two for 2025–26 (54,772.4 == 33,918.2 + 20,854.2), so folding it in would double-count del Sur. `is_aggregate` reads 0 on every row of all three sources and cannot be used to tell parent from leaf, so `maguindanao_is_safe()` detects the overlap from the values — 81 files changed, 61 refused. `sync_fruits.py` asserts the same property with `assert_eras_disjoint()`. `maguindanao_is_safe()` checks **both** successors, not just del Sur — a file can carry del Norte data in a year del Sur is still zero, and checking one would pass a parent-aggregate row as safe.

  **Run `fix_codeless_provinces.py` AFTER `xlsx_to_csv.py`, never before.** The converter fills a blank code only when the Province name is in the boundary-derived `names` map, and undivided "Maguindanao" is not in it — the 2026 boundary has only del Norte and del Sur. So the converted files arrive with that cell still blank, and a repair pass that already ran cannot fix files that did not yet exist. On 2026-09-05 that ordering was found to have cost **3,105,804 MT** across 25 live files — coconut's whole 2021–2024 series (3.05M MT) and mango's 51,412 MT — while the pre-conversion `.csv` files had the code filled correctly all along. Comparing old against new is what identified it: 92 rows identical province by province, one lost code.

  Three shapes turn up and only one is fillable. **(A) clean era-split** — parent 2021–24, successors 2025–26, no overlap: fill. **(B) parent is a duplicate total** — parent holds only 2025–26 and equals `del Norte + del Sur` exactly (cucumber 953.36 = 42.40 + 910.96): leave blank, since the app dropping it is the correct outcome; ~62 files are this shape. **(C) mixed** — the parent has years of its own *and* years overlapping its successors (hog: 2021–24 plus a 2025 value of 1,404.80 against successors' 4,195.66). Seven files: Cattle, Chayote, Chicken, Egg, Hog, Ube area and Ube yield. The guard rejected these wholesale because *one* year overlapped, discarding four clean years with it. Resolved 2026-09-05: the overlap year is a genuine **residual**, not a duplicate — excluding it left BARMM 2025 short 1,474.85 MT on hog, including it closes to 70.05 — so for **additive** metrics it is folded into del Sur and the parent's own years are restored. For **ratio** metrics (yield) it is dropped instead: a yield cannot be summed, and each successor publishes its own. Province-level del Sur is overstated by the residual for that year; regional and national totals are correct. Note this is a *keying* decision, not a value one — see the “never re-round or re-derive a published figure” rule in `CLAUDE.md`, which governs values only.

  **No live file loses volume to a codeless row.** What remains is 29 area files whose undivided row equals `del Norte + del Sur` exactly — duplicates that must stay dropped — and their 27 yield counterparts; verified file by file with 0 mismatches. A residual of ~70–390 MT in BARMM 2025 is still unaccounted for across Cattle, Chicken, Egg and Hog; the likely candidate is the **Special Geographic Area** (`1909900000`), absent from those provincial files entirely.

**Fruits have a sub-annual axis too, volume only.** `tools/sync_fruits.py` builds `data/subannual/<Stem>_volume_{quarter,semester}.csv` for the 13 catalogue fruits from `data/fruits_long.csv` — 21 quarterly periods, 2021Q1–2026Q1. It imports province resolution, `HUC_OWN_PCODE` and the collision guard from `sync_agristat.py` rather than duplicating them. Area is absent by necessity: `fruits_long` fills `area_ha` on 3.8% of rows against 89.9% for `palay_corn_long`, so there is nothing to publish for Area and nothing to divide for Yield — `SUBANNUAL_VOLUME_ONLY` makes `subAnnualFile()` return null for those metrics so the tabs stay unavailable rather than 404-ing. Semester is summed (Q1+Q2, Q3+Q4) because `fruits_long` publishes quarters only, and annual files are left untouched for the same reason `sync_agristat.py` leaves them: PSA rounds each published period on its own, so a summed annual and a published one differ slightly (measured on `palay_corn_long`, which carries both: 99.3% identical, 46 rows differing by at most 0.01 MT).

**Vegetables, roots and spices come from `data/vegetables_long.csv`** via `tools/sync_vegetables.py` — 39 crops, 117 files (annual + quarter + semester), reconciling with the source exactly. Two hazards in that source are handled in code because nothing in the file declares them. First, in 2025–26 it carries undivided `Maguindanao` **and** both successors for all 128 crop groups, with the parent equal to their sum, so `drop_maguindanao_parents()` removes those 1,088 rows or every vegetable double-counts the province. Second, it writes **0.0** for quarters not yet reported (where `fruits_long` leaves them blank), so 2026 arrives with four quarters of which Q2–Q4 are nationally zero; periods that are empty everywhere are dropped, leaving 2021Q1–2026Q1. `Overall X` means all subtypes of X, as it does for Overall Banana — **except where the Atlas already tracked one deliberately**, which was established by matching each original file against every candidate series. **Pechay is `Pechay`, excluding `Pechay, native`** (the original matches it to 0.1%), so it stays pinned to that subtype in `SERIES`. **Cassava was the same situation** — the original file matched `Cassava for industrial use, fresh tubers` exactly, 0.0% off every year — but there the answer was to publish the missing half rather than pin: cassava is now a group of three (`Overall Cassava Production` combined and badged, plus `Cassava Food Production` and `Cassava Industrial Production`), following the Banana pattern. Food cassava, 1,046,442 MT in 2025, had never been on the map, and it is a different crop geographically: a BARMM staple led by Basilan, Sulu, Lanao del Sur and Tawi-Tawi, all of which read zero under the industrial series. Reading them as all-subtypes would have inflated Cassava 82% and Pechay 36% and redefined what the commodity means — and the provinces that look missing from Cassava are not: Basilan, Sulu and Tawi-Tawi grow food cassava and essentially no industrial cassava, so zero is right for the series shown. The crops that *were* genuinely short each have a single subtype — Stringbeans, Malabar Spinach, Sweet Potato Leaves, Ampalaya, Ube and Spinach ran 5–9% under from missing provinces and codeless cities.

**Data coverage** (`metricCoverage()`, `#coverage-modal`, `#help-coverage`): which commodities carry which of the five metrics, derived live from `cropConfig`/`provConfig` via `metricAvailableForCrop()` — there is no list to maintain. PSA publishes no Area for 25 of 78 commodities and no Yield for any of those, since yield is volume ÷ area. **Mango, Banana and Coconut joined that group on 2026-09-05**: they had been wired to `conv_*_area/yield` files that summed a *standing* planted area across four quarters, inflating 2025 about fourfold (mango 707,518 HA against a real ~176,000; banana 1,762,161 against ~440,000; coconut 14,651,870 against ~3.6M — the 2026 column was right only because it holds a single unsummed quarter), with yield then derived as `volume ÷ area` over that bad area. Those two keys are gone, so the tabs disable themselves; see CHANGELOG 2026-09-05. Two groups fall out of the config: **Trees instead of hectares** (8 tree crops carrying `treesFile`/`yieldTreeFile`, which `autoSwitchMetricCounterpart()` already routes the reader to) and **Volume only** (14 — livestock, fisheries, and crops PSA reports by volume alone). Surfaced twice from that one source: as prose in the help modal, replacing a hand-written sentence that had drifted stale, and as a 78 × 5 matrix behind **📊 Data coverage** in the catalogue scope bar. The matrix defaults to the **14 crops with Volume only** and toggles to all 78. "Gap" survived two narrower definitions: *missing any metric* selects all 78, since Trees and Yield/Tree only ever apply to tree crops; and *no Area* still pulled in the 8 tree crops, which are not missing anything — they carry Trees and Yield/Tree, the right measure for an orchard, so listing them implies an absence when the substitute sits in the same row. What is left is the commodities with no productivity measure at all.

**All provincial sources are `.csv`; the Atlas reads no `.xlsx`.** `tools/xlsx_to_csv.py` converted the 55 crop/metric combos that used to come from workbooks (`conv_*.csv`), filling 374 codeless `ADM2_PCODE` cells and canonicalising the legacy `PH#####` codes on the way. That took codeless-row loss from 94 files / 613,809 MT / 455,208 HA down to 63 / 2,333 MT / 9,916 HA. Three things follow: `ensureXLSX()` never fires so SheetJS is never fetched (verified in-browser), data changes diff in git rather than hiding in a binary blob, and `fix_codeless_provinces.py` — which uses Python's `csv` module — can now repair every source rather than half of them. The `.xlsx` originals are kept; only `js/app.js` is repointed.

**`index.html` cache-busters are hand-maintained and separate from `DATA_VERSION`.** `css/app.css?v=` and `js/app.js?v=` must be bumped by hand whenever those files change; they had drifted to `2026-09-02s` and `2026-09-03b` while both files moved on, so returning visitors were served stale code. Keep them equal to `DATA_VERSION` so there is one string to remember.

Files are built by `tools/sync_agristat.py` into `data/subannual/`, named
`<Stem>_<metric>_<granularity>.csv`. See that script's docstring for how the
published sheet's long format is pivoted, how re-homed provinces are
de-duplicated, and why three highly-urbanised cities are folded into their
parent province.

**`--annual` also rewrites the annual provincial files** listed in `ANNUAL_FILE`
(currently the two corn variants), reusing the same aliases, HUC folding and
collision assertion, so the annual and sub-annual files cannot disagree on how
a province resolves. Run it as:

```
python tools/sync_agristat.py --annual            # fetches the sheet
python tools/sync_agristat.py --offline sheet.csv --annual
```

The `2026` column is filled from **Q1** (`PARTIAL_2026_FROM`). PSA publishes no
annual figure until Q4 closes, and Q1 is what two-thirds of the existing
provincial volume files already hold. Q1 rather than the fuller S1 because the
Top 10 catalogue ranks crops *against each other* within one year — a half-year
crop beside a quarter-year crop would rank on period coverage, not production.

> **The corn files were wrong until 2026-09-03.** `YellowCorn_…` and
> `WhiteCorn_…` were byte-identical to each other and held irrigated palay
> (2025: 15,104,167.77 MT, exactly `IrrigatedPalay2024onwards.csv`). Nothing in
> the map could reveal it — a wrong number still draws a plausible choropleth,
> and both variants being equally wrong meant they agreed with each other. If
> you add a crop here, reconcile its national total against the source before
> trusting the map.

- **Sulu → Region IX** (`PROVINCE_REHOMES`): after the 2024 Supreme Court ruling, Sulu's PSGC code changed from `1906600000` (BARMM) to `0906600000` (Region IX), effective 2026. Data files carry the new code and the boundary GeoJSON the old one, so *codes* always normalize to `0906600000` (data joins its polygon in every year), while the *regional rollup* is year-aware: Sulu counts under BARMM through 2025 and under Region IX from 2026 — PSA still books Sulu’s 2025 output under BARMM, so an earlier cutoff moved real 2025 tonnage into the wrong regional total. To support this, `aggregateProvToRegional` buckets each year's value under that year's parent region (which also keeps NIR's 2021–2023 values in R6/R7 regardless of which year was active when the data loaded).
- **`DATA_VERSION`** constant — append-only cache buster on every data request. **Bump it whenever any data file changes**, otherwise returning visitors get stale cached data.
- **`?v=` query on the `app.css`/`app.js` `<link>`/`<script>` tags in `index.html`** — same idea, for the app files themselves. **Bump the date whenever either file changes**; without it, a code/style change can silently not appear for a visitor (or developer) with a cached copy.

## 4. Core flow

```
page load
  └─ fetch boundary JSONs (regional ×2 + provincial)
       └─ bootLoadDone() ×2 → autoSelectInitialCrop()
            └─ last crop from localStorage, else "Overall Palay Production"

selectCrop(el, cropName)
  └─ loadCropData(cropName)
       ├─ regional CSV → classifyRegions() → renderMap() + renderLegend()
       └─ provincial file (if any) → stored in currentProvStats

click region → focusRegion()
  ├─ flyToBounds (mobile-aware padding)
  ├─ applyRegionFocusStyles()  — hides other regions, shows province outlines
  └─ renderProvincialChoropleth() + provincial legend

year change → setYear()
  ├─ re-render map/legend for the new year
  └─ restoreFocus() — the focused region survives scrubbing/play
      (silently resets if the region doesn't exist that year, e.g. NIR pre-2024)
```

### 4.1 Classification (`classifyEntries`)

**“Average mode” covers the additive count metrics** — `metricUsesAverageMode()`, driven by `AVERAGE_MODE_METRICS = ['volume', 'area', 'trees']`. Under it the rank-based Peak band is dropped, the middle class becomes a ±`NEAR_AVERAGE_TOLERANCE` band, and the labels are stated against the average (Above / Near / Below average).

  The split is **additive counts vs ratios**: Volume (MT), Area Harvested (HA) and Bearing Trees (trees) are in; **Yield (MT/HA) and Yield per Bearing Tree (MT/tree) are not** and keep Peak (top 3 regional / top 1 provincial), the exact-equality `1e-6` middle class regionally with none provincially, and the original Peak/High/Average/Low Production wording.

  Volume joined first for its own reason — its ranking is already stated twice over (the legend's Top 5 and the Top 10 catalogue), so a third rank-based band said nothing new. Area and Trees joined on a different and simpler ground: **the word “Production” is plainly wrong over hectares and tree counts**, and the average-relative labels are unit-neutral. Accepting Volume's treatment there means accepting the lost Peak band — a former peak area falls to `high`/`medHigh` and takes `palette[3]` instead of the darkest `palette[4]`. Measured on Palay Area 2025 across 82 provinces, **75 keep their colour and 7 move**: 3 are that peak→above-average shift, and 4 are pulled into the new near-average band (2 from above, 2 from below).

  The three `clsLabels` maps in the region popup, province popup and data table are conditional on the same predicate, so a badge cannot use one vocabulary while its legend uses the other. **Do not extend this list to the ratio metrics** — it was applied to all five once by mistake and had to be scoped back.

  **Colour in average mode.** `getColor()` returns `palette[4]` — the darkest tone — for `high`/`medHigh` whenever `metricUsesAverageMode()`. Without that branch the darkest colour is unreachable, because it is otherwise only ever produced by the `peak` class that average mode does not assign: the top band would be drawn in `palette[3]`, the shade meaning “second tier” in the peak-band metrics, and the top of every average-mode map would visibly lighten. It also kept the two vocabularies from agreeing — Yield's “Peak Production” chip was `#003d10` while Area's “Above average”, meaning the same thing, was `#1a7a3a`. The resulting ramp (`palette` 0 → 1 → 2 → 4, skipping 3) stays lightness-monotonic, and the darker chip lifts white badge text from 5.40:1 to 12.54:1.

  In average mode the threshold is the **national average**: the national total divided by the number of areas reporting (Palay 2025: 19,611,730.97 ÷ 17 = 1,153,631.23 MT), or `overrideAvg` — the average across all provinces nationwide — when a region is focused. `#legend-threshold` prints it verbatim under the national figure, because the line above states a national *total* and without this the average appears nowhere; the element is left empty outside average mode and `.legend-threshold:empty` collapses it. Bands are named against that average, not by magnitude: Top-Producing / Above average / Near average / Below average / No data. The threshold differs by scope and the legend says which — the regional view compares against **the average region** (the unweighted mean of the regions on screen), a focused region compares its provinces against **the national province average** (`nationalProvAvg`). Neither is the national figure on the line above; for Volume that line is a national *total*, so a label reading “above national average” there would be claiming a comparison the code does not make.

  **Near average** spans `NEAR_AVERAGE_TOLERANCE` (0.10) either side of that threshold. It replaced an exact-equality test that matched within `1e-6` and fired in **1 of 727** crop/metric/year combinations — Banana Cardava yield/tree 2025, purely because PSA rounds it to 2 decimals — leaving `palette[2]` unused. Production is right-skewed so the band is still often empty (±2% empty 83% of the time, ±5% 70%, ±10% 55%); at ±10% it fires for 35 of 75 crops at 2025 Volume, and an empty class simply does not render. Peak is still rank-based (top 3 regionally, top 1 within a focused region) and is tested before the band, so a top producer is never relabelled “near average”.

  Region popups, province popups and the data table share the legend's `clsLabels` wording; they each carried their own copy until 2026-09-05 and could contradict it.


- **Regions (5-tier):** Peak = top 3 by value; High = above national average; Average = equal; Low = below; No Data = zero/missing.
- **Provinces (3-tier):** Peak = top 1 within the region; then "High Production" (above the *national provincial* average) / "Low Production" (below it). Internally the classes are still `medHigh`/`medLow`; only the display labels say High/Low.
- Legend shows per-class value ranges and counts.
- **Number formatting (`fmtMetricValue`):** every spot that displays the currently active metric's raw value (legend ranges/average, region/province popups, the growth/stats-row/sparkline-tooltip popup helpers, the Top 5 ranking list, the data table + its variance column, the catalogue's lazy per-card Yield stat, and the ranking-table's Yield-sort column) shares one formatter that scales decimal precision to the value's own magnitude — 4 decimals under 0.01, 3 under 1, 2 otherwise. A flat `maximumFractionDigits: 2` used to back all of these, which was invisible for Volume/Area (always ≫1) but broke once Yield/Tree and several smaller Yield crops (Abaca, Cacao, Pili, etc.) introduced values well under 1: e.g. Cacao's Yield/Tree legend showed "0 – 0 MT/tree" for every class, rounding real (if tiny) differences straight to zero despite the map correctly shading by magnitude underneath. Catalogue Volume figures are formatted separately (`maximumFractionDigits: 0`) since Volume is always MT-scale and never needs this.

### 4.2 Metrics

**The legend's national figure.** Additive metrics (Volume, Area, Trees) show a **national total** — `legendNationalFigure()` sums `currentProvStats`, which `loadCropData()` has already merged. Ratio metrics (Yield, Yield/Tree) show a **national average** computed as Σnumerator ÷ Σdenominator — a weighted quotient, never the mean of the provincial ratios. `ensureRatioTotals()` loads the volume file and the metric's denominator (`RATIO_DENOMINATOR`: yield→`areaFile`, yieldtree→`treesFile`), caches them per crop, and refreshes that one line when they land; a failure caches nulls so a 404 is not retried on every scrub.

  Both paths **must** collapse duplicate rows with `mergeRowsByArea()` — period by period, first *positive* value wins. First-row-wins is wrong here: era-disjoint files split one province across two rows, each zero where the other carries data. `ensureRatioTotals()` did exactly that until 2026-09-05, and because numerator and denominator lost different rows, **97 crop/metric/year national averages read wrong** in both directions (Cassava Industrial +10.3%, Mango Yield/Tree −7.3%). `mergeRowsByArea()` derives its period columns from the row itself, so it survives a sub-annual axis swap.

  **Thin averages are labelled.** When a ratio's denominator spans `THIN_AVERAGE_AREAS` (3) or fewer areas, `legendAvgText()` appends the count — *“2025 national average: 0.0096 MT/tree (2 provinces)”*. The count is of the **denominator**, since that is what the figure divides by: Dalandan 2025 has Occidental Mindoro producing 2.22 MT on 136 trees and Biliran carrying 96 bearing trees with no production, so the national figure is 2.22÷232 = 0.0096 rather than Occidental Mindoro's own 0.0163 — computed over two areas, not one. Totals (Volume/Area/Trees) get no note; a total over one province is still a correct total. `legendAvgText()` is the single builder for this line because `renderLegend()` writes it twice.


**Placeholder crops:** individual crops without data yet (e.g. most new Vegetable & Rootcrops entries) carry the `item-disabled` class and no `data-crop` attribute — greyed, unclickable, "Data not yet published" tooltip. To activate one: add its data file + config, set `data-crop`, and drop the class.

**Delisted crops:** crops with data that aren't on the published crop list (currently Cavendish, Sugarcane, Broccoli, Chayote, Celery) carry the `item-hidden` class — invisible in the tree, skipped by search and by remembered-crop/deep-link auto-select. Data and config stay; remove the class to relist.

**Unpublishing a category:** adding the `category-disabled` class to a `tree-section` in `index.html` locks it — only the dimmed header shows (not-allowed cursor, "Data not yet published" tooltip, `aria-disabled`, no chevron), its crop lists are hidden, search excludes it, and crop auto-select/deep-links fall back to Overall Palay. No sections are currently locked (all seven categories are published).

Five tabs — Volume / Yield / Area / Trees / Y/Tree (Yield per Tree). Ratio metrics carry `average: true` in `METRICS` (Yield and Yield/Tree) and aggregate provinces by **average**; additive metrics (Volume/Area/Trees) aggregate by **sum** (`aggregateProvToRegional`). The `average` flag also suppresses the Total row in the data table. Crop categories the active metric can't apply to are hidden via the `.metric-hidden` class (`updateTreeVisibilityForMetric`): Fisheries and Livestock hide on every metric except Volume; **Trees** additionally hides every category except Fruit Crops (bearing-tree data is fruit-only). **Yield/Tree does *not* get that same fruit-only restriction** — unlike Trees, it falls through to the generic branch (hide only Fisheries/Livestock), since its coverage spans both the Fruit Crops category (Avocado, Rambutan, Pomelo, Durian, Dragon Fruit) *and* Industrial & Stimulant/Fiber Crops (Cacao, Pili is Fruits too) — a fruits-only filter would have wrongly hidden Cacao's category. The class uses `display:none !important` so the crop search filter can't reveal hidden sections, and search's no-results check ignores items inside them. Selecting a crop while on **Trees**/**Area** or **Yield**/**Yield-per-Tree** auto-switches to the paired metric if the new crop lacks data for the active one but has it for its counterpart (`autoSwitchMetricCounterpart()`, called from `selectCrop` — its `counterpart` map holds both pairs: `trees↔area`, `yield↔yieldtree`). The Yield pairing exists for the same reason as Trees/Area: Yield/Tree only covers ~10 tree crops while Yield covers dozens of non-tree ones, so picking e.g. Abaca while on Yield/Tree, or Cacao while on Yield, would otherwise land on an empty "not available" view. Tabs lock while a load is in flight (`metricLoading`) and show "unavailable" when a crop lacks that metric's file — **Trees** (`trees`, number of bearing trees/hills) has data for Mango, Banana (Cardava/Saba), Avocado, Calamansi, Dalandan, Dragon Fruit, Durian, Pomelo, and Rambutan; **Yield/Tree** (`yieldtree`, `yieldTreeFile`, MT per bearing tree) covers Avocado, Banana Cardava (Saba), Calamansi, Dalandan, Rambutan, Pomelo, Durian, Dragon Fruit, Pili, and Cacao. Note the naming overlap in `data/`: `banana_yieldtree_provincial.csv`/`mango_yieldtree_provincial.csv` are actually **Trees**-metric files (bearing-tree counts, wired to `treesFile`) despite the "yieldtree" filename, left over from an earlier naming choice — don't confuse them with the genuine `*_yieldtree_provincial.csv`/`*_provincial_yield.csv` files wired to `yieldTreeFile`. Classification for each new file was decided by checking its actual value scale, not its filename: tree crops with tiny per-tree-ratio values (≈0.0001–0.03) went to Yield/Tree; non-tree crops with MT/HA-scale values (≈0.06–8.5) — Pineapple, Melon, Abaca, Pinya Fiber, Cotton, Bariw, Salago, and the 3 Tobacco variants — went to the standard **Yield** metric (`yieldFile`) instead, filling in a tab those 8 crops previously lacked entirely.

**Region labels:** in the national (unfocused) view, each region shows a short label (`regionShortLabel()`: abbreviations in parentheses win — "…(BARMM)" → `BARMM`; numbered regions collapse to just the numeral, `IX`; others fall through, e.g. `MIMAROPA`). Rendered as non-interactive `L.divIcon` markers in `regionLabelPane` (z-index 245 — above the hillshade's multiply blend so it can't darken the text, below the boundary lines), positioned via `featureLandCentroid()` on the centroid of each region's *largest landmass* (per-ring shoelace area/centroid, `ringCentroid()`) rather than the whole feature's bounding-box center — the latter regularly falls in open water for archipelagic regions (Mimaropa, Region IX, Region VII). BARMM (`ADM1_PCODE '1900000000'`) is hard-coded to keep the plain bounding-box center instead — its islands and mainland pieces are close enough in size that the largest-landmass pick landed somewhere worse. Built by `renderRegionLabels()`, called from `drawBoundaryLayer()` so labels regenerate whenever the active shape set changes (e.g. the 2024 NIR cutover). Hidden while a region is focused (`toggleRegionLabels(false)` in `focusRegion`/`restoreFocus`) and restored on `resetFocus()` and on every fresh crop/metric render.

## 5. UI components

| Component | Where | Behavior |
|---|---|---|
| **Control panel** | docked beside the nav rail, top-left (desktop) / bottom sheet (mobile) | Crop tree, metric tabs, search; toggled by the rail's panel button (`body.panel-hidden`), which stays highlighted while the panel is open. **Starts hidden on desktop** (the initial crop still auto-loads); the mobile sheet starts visible |
| **Crop search** | above the tree | Live filter; force-opens matching sections; "no results" message |
| **Year controller** | bottom of the crop panel | Slider + dots + tick labels + ▶ auto-play (1.2 s/year, stops at 2025); collapsible; hidden with the panel (and with the collapsed sheet on mobile) |
| **Breadcrumb** | bottom-center of map | Appears when a region is focused ("Philippines › Region …"); click (or Esc) resets to the national view. Updated by `updateBreadcrumb()` from `applyRegionFocusStyles`/`resetFocus`/`renderMap` |
| **Layers flyout** | opened from the rail's layers button | Basemap select, hillshade toggle, boundaries toggle, opacity slider (`#layers-flyout`, anchored beside the button; outside-click and Esc close it) |
| **Legend** | bottom-right (desktop, **draggable by its header**, viewport-clamped) / top-right (mobile, fixed) | Class swatches + ranges + counts + data-source line (`#legend-source`); **hover/click a row to highlight that class on the map** (click pins it). A pinned class stays locked while scrubbing or playing 2021–2025 — each year re-lights that year's members (`stickyHighlightKey` ties the pin to crop+metric+scope; changing any of those clears it); collapsible via ▼, always starts expanded (mobile included) |
| **Top-5 ranking** | in legend, **currently hidden** | Remove `display:none` on `#legend-ranking` to restore; region rows click-to-zoom |
| **Popups** | region/province click | Production, share(s), variance + growth (▲/▼, colored), Lowest/Highest/Average, 5-year sparkline, classification badge |
| **Sparkline** | inside popups | 248×56 viewBox at `width:100%` (renders ~290×66 px desktop, scales down on a phone) over `trendPeriods()` (complete periods only), shaded area, current-period dot emphasized + dashed guide line, "▲ +12.4% since 2021" summary, per-dot tooltips, caption naming the selected period. With the partial year selected there is no dot to emphasize, so the caption switches to the amber `.spark-partial` form — "Showing **2026** · partial year, not plotted" |
| **Data table** | "📊 View data table" button in legend (outside the collapsible body — visible even when the legend is tucked away) | Modal: rows = regions (or provinces of focused region), year columns + Share %, Variance, Growth, Lowest/Highest/Average, Class; current-year column highlighted; grey grid borders on all cells; sticky header + name column; expand button toggles near-fullscreen (`#table-modal-card.expanded`); Total row (not for ratio metrics like Yield); **Export CSV** (raw numbers, BOM for Excel) |
| **Status pill** | top-center / above sheet on mobile | "Loading data…" spinner while any fetch is in flight; red error toast (5 s) on failure |
| **Map controls** | top-left | Dark **vertical navigation rail**: zoom, locate, measure (hidden on mobile), Photon search, fullscreen, help, crop-panel toggle, layers — all rendered with a shared inline **SVG icon set** (`RAIL_ICONS`, Feather-style, `stroke: currentColor`; zoom/locate/measure icons swapped in after control creation). Hover shows tooltip chips (`data-tip`, converted from `title`s at startup with `aria-label` backfill); active states highlight purple. On mobile (≤640 px) the rail collapses behind a single ☰ toggle (`body.rail-open`). The search input and results fly out to the right of the rail. Its dark background (`#221d3d`) is shared by every other floating "dark chrome" piece on the map (`#breadcrumb`, `#status-pill`) — one unified dark hue rather than each having picked its own tone independently; the actual z-index stacking order for all floating map controls is documented in one comment block in `css/app.css`, directly above `#control-panel` |
| **Help modal** | help button in rail | In-app condensed user manual (quick start, measurements, colors, popup guide, table/export, rail tools, phone tips, troubleshooting); Esc/backdrop/✕ to close |
| **Basemaps** | Layers flyout | Carto Voyager / Stadia Smooth / Esri Satellite / OpenStreetMap / Esri Hybrid, applied via `applyBasemap()`. Hybrid = Esri imagery + Carto labels-only tiles in `labelsPane` (z 250, above data fills) so names stay readable over the choropleth. Carto tile URLs are built by `cartoUrl()`, which appends `CARTO_API_KEY` when one is set — see [Carto API key](#carto-api-key) |
| **Shareable URL state** | address bar | `#crop=..&metric=..&year=..&region=..&basemap=..&catScope=..&catIsland=..&catRegion=..&catProvince=..&catCategory=..` written with `history.replaceState` on every state change (`updateUrlHash`); parsed once at boot (`bootFromHash`) — deep-linked crop wins over the `localStorage` remembered crop, region focus applies after the crop's first render (`consumePendingFocus`), and catalogue scope/category apply once `initCatalogue()` finishes wiring up its selects (`hashBootCatalogue`, best-effort — a deep link landing before boundary data finishes loading can restore the level/category but leave the region/province dropdown empty) |

## 6. Design system

- **Fonts:** DM Sans for UI text, DM Mono for all numbers/years (tabular alignment).
- **Blue accent:** `#0d4f8c` / `#2a91d8` / `#1a5fa8` for interactive elements.
- **Growth colors:** green `#1a7a3a` up, red `#c0392b` down — always paired with ▲/▼ so color isn't the only signal.
- **Category colors** (crop tree section headers): each food group has a gradient (Palay green, Corn yellow-green, Fruits orange, Non-food brown, Vegetables purple, Fisheries blue, Livestock pink).
- **Choropleth palettes:** per-crop 5-step ramps in `cropConfig`. Vegetable and livestock ramps are lightness-monotonic (checked for grayscale/color-blind legibility). Keep new palettes monotonic in lightness.
- **Radii:** 12–16 px panels, 6–8 px inner elements. Cards use the same double shadow.
- **Type floor:** nothing below 10 px.

## 7. Mobile (≤ 640 px breakpoint)

- Control panel becomes a **bottom sheet**: collapsed ~132 px (handle + header + tabs), expands to 75 dvh via tap or **swipe on the handle**. Auto-collapses after picking a crop.
- Legend moves top-right, always expanded, width capped to clear the left control stack.
- Popups: width ≤ `100vw − 40px`; region auto-pan pads for the sheet, not the desktop side panel; fly-to bounds add ~180 px bottom padding so the target clears the sheet.
- `dvh` units + `env(safe-area-inset-bottom)` for URL-bar resize and iPhone home indicator; `viewport-fit=cover` in the meta tag.
- Measure control hidden; bottom-left controls raised above the sheet.
- Data table modal docks to the bottom, 85 dvh max.

## 8. Accessibility

- Tree items: `role="button"`, `tabindex="0"`, `aria-pressed`, Enter/Space activation.
- **Page zoom is not locked.** The viewport meta is
  `width=device-width,initial-scale=1,viewport-fit=cover` — deliberately *without*
  `maximum-scale=1,user-scalable=no`, which used to be there. Those two block
  pinch-zoom on the whole page and fail WCAG 1.4.4 (Resize Text): a low-vision
  reader could not enlarge the legend, the tree or the catalogue. Leaflet installs
  its own gesture handlers on `#map`, so map pinch-zoom stays map pinch-zoom and
  only the surrounding chrome becomes zoomable. Do not re-add them.
- **The document starts at `<h1>`.** `<h1 class="sr-only">Philippine Agricultural
  Production Atlas</h1>` opens `#map-view`. Before it the first heading on the page
  was an `<h3>`, so screen-reader "list headings" gave no top-level title and the
  outline began two levels down. `.sr-only` is the standard 1px-clip pattern
  (`position:absolute; width:1px; height:1px; clip-path:inset(50%)`) — hidden
  visually, still in the accessibility tree, unlike `display:none` or
  `visibility:hidden`.
- **Every control has an accessible name.** Most get one from a wrapping
  `<label><span>…</span><select></label>`; the four that have no visible label text
  carry `aria-label` instead — `#compare-area-a` ("First area to compare"),
  `#compare-area-b` ("Second area to compare"), `#basemap-select` ("Basemap style")
  and `#opacity-slider` ("Layer opacity"). Check any new control with
  `el.labels.length || el.getAttribute('aria-label')` before shipping it; an
  unnamed `<select>` is announced only as "combo box".
- Section headers: `aria-expanded` kept in sync.
- Legend rows focusable; status pill is `role="status" aria-live="polite"`; table modal is `role="dialog" aria-modal` with focus moved to Close and Escape-to-close.
- Visible `:focus-visible` outline (2 px blue) on tree/legend controls.
- **Reduced motion** (`@media (prefers-reduced-motion: reduce)`, end of `app.css`): decorative animation and transitions collapse to `0.01ms`. Not `0s` — some engines skip `transitionend` when the duration is exactly zero, so a handler waiting on that event never runs. The loading spinner is exempted and keeps turning at a slow 1.6s, because freezing it would report "stalled" when the truth is "loading". Leaflet's pan/zoom is included on purpose: a reader who asked the OS for less motion did not ask for the map to slide across the viewport.

  CSS cannot reach `scrollIntoView({behavior:'smooth'})` — a `behavior` passed in script beats the `scroll-behavior` property — so the two map↔catalogue jumps go through `scrollToEl()`, which consults `prefersReducedMotion()`. Query it live rather than caching: the OS setting can change mid-session.
- **Contrast**: catalogue and legend text meet WCAG AA (4.5:1 text, 3:1 icons). The legend's four muted roles were all under AA until 2026-09-05 — `.legend-count` at **1.92:1** while carrying each band's meaning, `#legend-avg` / `.legend-range` / `#legend-unit-explanation` at 3.54:1. They are now `#6b7480` (4.74:1) and `#5f6873` (5.65:1), still ranked lightest-to-darkest so the hierarchy reads the same.
- **A legend swatch is delineated by its border, not its fill.** `palette[0]` — the No-data colour — is a near-white wash in all 83 palettes (1.05–1.12:1 on the white panel), so the outline is what makes the square a visible object. No-data carries a solid `#7d8794` border (3.64:1 on the panel, 3.48:1 against its own fill, clearing WCAG 1.4.11); the others use `rgba(0,0,0,0.22)`. **Never fix this by changing the fill** — the swatch has to keep matching the polygon on the map.
- **The legend's height budget is measured, not guessed.** `#legend-body` is `clamp(230px, calc(100dvh - 300px), 420px)`. The panel's non-body chrome is **164px** (header + table button + padding) and it clears the scale bar by 44px, so ~210px is the real reserve; an earlier 440px left 220px for 223px of content and the last band could not be reached. The ceiling only needs to clear the tallest legend — 5 bands, ~280px. `#legend-source` sits **outside** `#legend-body` because it is constant attribution, not content to scroll, and the header/list hairline sits on `#legend-body` itself — on `#legend-items`, its first child, it scrolled away with the first band.
- **The legend must never scroll sideways.** `.legend-row` is a flex row and its text column needs `min-width: 0` (`.legend-row-text`) — a flex child defaults to `min-width: auto` and will not shrink below its content, so one long monospace range widens the whole panel. Ranges also carry `overflow-wrap: anywhere`; `overflow-x: hidden` on `#legend-body` is only a backstop. Measure against the colour actually *behind* the text, not the page background — `.catalogue-tag` sits on a `#e5f4ec` pill, where it scores 4.55:1; measured against white it would have shown a misleading 5.0:1 pass. The rank digits in the "Top Regions/Provinces" lists (`.cta-rank`) were `#bbb` at **1.92:1**, the worst in the file and on the element carrying the list's meaning.

## 9. Security & robustness

- All dynamic strings pass through `esc()` before HTML insertion (XSS guard — keep doing this for any new interpolated content).
- Every fetch path reports failures to the status pill; xlsx fetches check `response.ok`; error paths also unlock the metric tabs.
- `localStorage` access wrapped in try/catch (private-mode safe).

## 10. How-to recipes

**Add a crop:** add the tree item in `index.html` (`data-crop` must match), an entry in `cropConfig` (palette required; regional file optional), and optionally `provConfig` entries per metric. Done — search, metrics, popups, table, export all pick it up.

**Update data files:** replace the file in `data/`, then **bump `DATA_VERSION`** in `js/app.js`.

**Add a year:** extend `YEARS`, add the dot/tick markup in `index.html` year controller, update slider `min`/`max`, ship the new data columns.

**Restore the Top-5 ranking:** delete the `display: none;` line under `#legend-ranking` in `css/app.css`.

## 11. Known limitations / ideas

- No keyboard navigation of the map polygons themselves (Leaflet limitation without extra work).
- XLSX parsing happens on the main thread; converting provincial workbooks to CSV would shrink payloads and drop the SheetJS dependency.
- Sparkline stretches min→max, so small fluctuations can look dramatic; a zero-baseline variant is possible if desired.
- Missing years plot as dips in the sparkline (they're skipped in stats but not in the line).
- Region auto-focus is lost when scrubbing to a year where the region doesn't exist (NIR → pre-2024) — by design.

### Deferred: migrate the map onto the 2026 boundary (`data/admin_boundary_2026/`)

Postponed 2026-09-05 by jayve, not rejected. Sizing, measured rather than guessed:

| | live `Admin_Provincial_Boundary.json` | `Admin_Boundary_Provincial_NCR_HUC_2026.geojson` |
|---|---|---|
| size | **42.6 MB** | **3.9 MB** |
| areas | 92 | **122** (real Polygon/MultiPolygon geometry) |
| HUCs as their own polygon | 5 | **34** |
| code columns | `ADM2_PCODE`, `ADM1_PCODE` | `Province_PSGC_Code`, `Region_PSGC_Code`, `City_PSGC_Code` |

The **column rename is cosmetic; the migration is not.** A 91% smaller boundary is
the single biggest performance change available to this app — that 42.6 MB fetch
is what `ensureCatalogueData()` has to wait on, and why `psgcParentsReady` exists
as a 4.6 KB shortcut in the first place. The 2026 file already carries 34 HUCs as
separate polygons against today's 5, which is the same problem
`PROVINCE_SPLITS` and the codeless-city repair keep working around.

Scope if picked up: 43 `ADM2_PCODE` + 30 `ADM1_PCODE` + 9 `ADM2_EN`/`ADM1_EN`
references in `js/app.js`, the 218 data files' key column, and `PROVINCE_SPLITS`
would need revisiting since HUCs stop needing to be folded into a parent. Do it as
one planned change, not incrementally — a half-migrated key column silently drops
rows, which is exactly the failure mode that cost 3.1M MT on 2026-09-04.

---

*Maintenance rule: whenever a feature or behavior changes, update this file and add a dated entry to [CHANGELOG.md](CHANGELOG.md) in the same commit. See [CLAUDE.md](CLAUDE.md).*

## Carto API key

Carto issues API keys for its basemaps (<https://carto.com/basemaps/apikey/>). The tiles
still serve unauthenticated as of 2026-08-28, so this is set up ahead of enforcement
rather than in response to an outage.

**Enforcement has begun, and it does not look like a failure.** Carto serves
unauthenticated tiles as a valid 200 PNG with "API KEY REQUIRED" watermarked across the
image. No request fails, so no amount of error handling can detect it — the `tileerror`
fallback below catches a hard outage, not this. The default basemap is therefore Esri
World Light Gray Canvas, which needs no key; Carto and Stadia remain selectable and are
labelled accordingly.

**Where it goes.** `CARTO_API_KEY` near the top of `js/app.js`, beside
`CARTO_KEY_PARAM`, which is `key` — matching Carto's documented tile URL
`.../voyager/{z}/{x}/{y}.png?key=YOUR_KEY`. It is isolated as a constant because Carto
ignores unrecognised query parameters and serves the same watermarked tile, so a wrong
name here is indistinguishable from a rejected key. `cartoUrl()` builds both Carto layer URLs and appends the key only when one is
set, so an empty key leaves today's behaviour untouched.

**The key is public.** A static site has nowhere to hide it and no build step to inject
it at deploy time, so anyone can read it in view-source. That is normal for a basemap
key: the protection is to restrict it to this project's domains in the Carto dashboard.
An unrestricted key in a public repo is someone else's free tile quota.

**Fallback.** Carto is the *default* basemap here, so a refusal would otherwise render a
blank grey grid with the choropleth floating on nothing and no explanation. `cartoVoyager`
and `cartoLabels` both listen for Leaflet's `tileerror`; after **four** failures (one bad
tile at a deep zoom is ordinary, and switching basemap under someone mid-pan would be
worse than the problem) the map switches to OpenStreetMap and reports it through
`showDataError()`. OpenStreetMap is the fallback because it is the only basemap here
needing no key at all — Stadia requires one too, so falling back to it would just move
the failure.

## Running it locally

The page **must be served over http**. Boundaries load with `fetch()`, and a `file://`
origin is opaque, so opening `index.html` directly gives a working basemap with no
boundaries and no choropleth — the tiles come from the network, the data does not.

    python -m http.server 8000        # then open http://localhost:8000

`loadFailureHint()` detects `location.protocol === 'file:'` and says this in the status
pill rather than the generic "try reloading", which cannot help against CORS.
