# Production Atlas — User Manual

*A step-by-step guide to exploring Philippine agricultural production data. No technical knowledge needed.*

---

## 1. What is this map?

The Production Atlas shows **how much of each crop, fish, and livestock product the Philippines produces**, in every region and province, for the years **2021 to 2025**. Darker colors mean more production; lighter colors mean less. You can compare regions, watch changes over the years, drill down to provinces, and export the numbers to Excel.

It works in any modern web browser, on both computers and phones.

## 2. What you see on screen

**On a computer:**
- **Left side** — the dark navigation rail with all the map tools (hover an icon to see its name). The control panel — where you choose crops and switch measurements — starts tucked away for a clean map view: click the rail's **panel button** to open it beside the rail, and again to hide it. The rail's **Layers** button opens the basemap, terrain, boundaries, and opacity settings.
- **Bottom of the control panel** — the year timeline (2021–2025) with the ▶ auto-play button. When you're zoomed into a region, a small breadcrumb appears at the bottom-center of the map — click it (or press Esc) to zoom back out.
- **Bottom-right** — the legend (color guide) appears once you pick a crop. Drag its title bar to move it anywhere on the map.

**On a phone:**
- The control panel sits at the **bottom of the screen**. Tap the handle (or swipe up on it) to open it; swipe down to close it. The year timeline is inside it, at the bottom.
- The navigation rail collapses into a single ☰ button at the top-left — tap it to unfold the tools.
- The legend appears at the **top-right**, fully expanded — tap ▼ if you want to tuck it away.

💡 **Sharing a view:** the web address updates as you explore. Copy it at any time and whoever opens it sees the same crop, measurement, year, region, and basemap.

When the map is loading data, a small **"Loading data…"** message appears briefly. If something fails to load (e.g., poor internet), a red message will tell you.

**Below the map** — click the **"Top 10 Commodities ▼"** button at the bottom-center of the map (or just scroll down) to see the Top 10 Commodities catalogue. Click **"▲ Back to map"** to return.

## 2a. Top 10 Commodities catalogue

This section ranks every crop by **production volume**, for whichever year is currently selected on the map above. Pick how zoomed-in you want the ranking to be:

- **Philippines (National)** — the country-wide Top 10.
- **Island Group** — Luzon, Visayas, or Mindanao.
- **Region** — any of the 17 regions.
- **Province** — pick a region first, then a province within it.

A small map beside the cards highlights whichever island, region, or province you've picked, zooming in as you narrow down the area — it's just for visual context, not interactive.

Each card shows a rank number, an icon, the crop's name, and its total volume (in metric tons) for that area and year. **Click a card** (or press Enter/Space) to reveal a short description — click again to close it. The first three ranks get a gold/silver/bronze banner.

The first time you open this section, it fetches every crop's data — this can take a few seconds, and a "Loading commodity data…" message shows while it works. After that, switching areas or scrubbing the year above re-ranks instantly.

💡 A few crops (Palay, Corn, Fisheries, Livestock) only report at the region level in the source data, so they can't appear in a *specific province's* Top 10 — but they're still counted at the region, island, and national level.

## 3. Choosing what to view

### Pick a crop
1. Open the control panel (it's already open on a computer).
2. Crops are grouped into colored categories: 🌾 Palay, 🌽 Corn, 🥭 Fruit Crops, 🥥 Non-Food & Industrial, 🥬 Vegetables & Rootcrops, 🐟 Fisheries, 🐄 Livestock & Poultry. A few greyed-out crops (e.g. Melon, the fiber and tobacco crops, most new vegetables) are listed ahead of their data — they'll become clickable once their data is published.
3. Click a category to open it, then click a crop. The map colors in immediately.

💡 **Faster:** type the crop's name in the **🔍 Find a crop…** box — the list filters as you type.

The map remembers your last crop and reopens with it next time. When you first visit, it shows **Palay** production.

### Pick a measurement (the tabs at the top)
| Tab | Meaning | Unit |
|---|---|---|
| **Volume** | How much was produced | MT = metric tons (1 MT = 1,000 kg) |
| **Yield** | How productive the land is | MT/HA = tons per hectare |
| **Area** | How much land was harvested | HA = hectares |
| **Trees** | How many bearing trees/hills there are (most fruit crops — see the tab for which) | number of trees |

Grayed-out tabs mean that measurement isn't available for the selected crop. If you're viewing **Trees** or **Area** and pick a crop that only has the other one, the map switches over automatically. Fisheries and livestock only have Volume. On the **Trees** tab, the crop list shows only Fruit Crops.

### Pick a year
At the bottom of the panel is the **year timeline (2021–2025)**:
- Click any year, or drag the slider.
- Press **▶** to play through the years automatically like a short animation — great for spotting trends.
- If you've zoomed into a region, it stays selected while the years change, so you can watch that region evolve.

## 4. Understanding the colors

When zoomed out to the whole country, each region shows a short label (I, II, III … XIII, CAR, BARMM, NCR, NIR, MIMAROPA, …) so you can tell them apart at a glance. The labels disappear once you click into a region and reappear when you zoom back out.

The **legend** explains the colors for the current crop:

- **Peak Production** (darkest) — the top 3 producing regions.
- **High Production** — above the national average.
- **Average / Low Production** — at or below the national average.
- **No Data** — nothing reported that year.

Each legend row also shows the **value range** and **how many regions** fall in that class.

💡 **Try this:** hover over a legend row and the map dims everything except that class. Click the row to keep it highlighted; click again to release. The pinned highlight stays locked while you scrub or press ▶ to play through 2021–2025 — great for watching, say, the Peak Production areas shift from year to year.

## 5. Exploring a region and its provinces

1. **Click any region** on the map. The map flies in and shows that region's **provinces**, each colored by its own production level (the top province in the region is darkest).
2. **Click a province** to see its details.
3. Click the region again — or click the sea/empty area — to **zoom back out** to the whole country.

### Reading the popup card
When you click a region or province, a card appears with:

| Line | What it tells you |
|---|---|
| **Production (2025)** | The amount for the selected year |
| **Share to Region / Philippines** | What percentage this area contributes |
| **Variance in previous year** | How much more (green ▲) or less (red ▼) than last year |
| **Annual Growth Rate** | That change as a percentage |
| **Lowest / Highest / Average** | The best and worst years since 2021, and the 5-year average |
| **5-Year Trend** | A mini line chart of 2021–2025. Up-slope = growing. The blue dot is the year you're viewing; hover any dot for its exact value. The colored note (e.g. "▲ +12.4% since 2021") sums it up in one glance |
| **Colored badge** | The area's classification (e.g. Peak Production) |

## 6. The data table & exporting to Excel

Want the actual numbers, not just colors?

1. Pick a crop, then click **📊 View data table** at the bottom of the legend.
2. The table lists every region (or every province, if you're zoomed into a region) with:
   - all five years of values (the current year is highlighted in blue),
   - % share, change vs last year, growth rate, lowest/highest/average, and classification.
3. Scroll sideways to see all columns — the names stay pinned so you never lose track.
4. Need more room? Click the **expand** button (next to Export CSV) to grow the table to nearly the whole screen; click it again to shrink back.
4. Click **⬇ Export CSV** to download the table. The file opens directly in **Excel or Google Sheets** with clean numbers ready for your own charts and reports.
5. Close the table with **✕**, by clicking outside it, or pressing **Esc**.

The table always matches what you're viewing — same crop, measurement, year, and region.

## 7. Map tools

| Button | What it does |
|---|---|
| **+ / −** | Zoom in and out (or use your mouse wheel / pinch) |
| **Navigation rail** | The dark vertical bar at the top-left holds all the map tools below — hover over any icon to see what it does |
| **📍 (locate)** | Zooms to your current location |
| **📏 (measure)** | Measure distances and areas on the map *(computer only)* |
| **🔍 (search)** | Type any city or place name to jump there |
| **⛶** | Fullscreen mode — great for presentations |
| **❓ (help)** | Opens a built-in quick guide — a condensed version of this manual, right inside the map |
| **Crop panel button** | Hides the crop panel for a full, unobstructed view of the map; tap again to bring it back |
| **Layers button** | Opens the Layers panel: background map, terrain hillshade, administrative boundaries, and data opacity |
All display settings live in the rail's **Layers** panel:

| Setting | What it does |
|---|---|
| **Basemap** | Switch the background map: Carto Voyager (default), Stadia Smooth (minimal), Esri Satellite (aerial photos), OpenStreetMap (street detail), or Esri Hybrid (aerial photos with place names on top — like Google Hybrid) |
| **Terrain hillshade** | Toggles the terrain/mountain shading |
| **Administrative boundaries** | Show/hide the region outlines |
| **Opacity** | How strongly the production colors cover the basemap |
| **🎨 Opacity** | Make the colors more transparent so you can see the terrain underneath |

## 8. Using it on your phone

- Tap **"Tap for crops & settings"** at the bottom to open the crop list; it closes by itself after you pick a crop so you can see the map right away.
- Swipe the small handle bar up/down to open/close the panel.
- The legend sits fully expanded at the top-right — tap **▼** to tuck it away when you want more map.
- Everything else works the same: tap regions, tap provinces, play the years.

## 9. Tips & troubleshooting

- **The map looks empty** — you haven't picked a crop yet, or the selected measurement has no data for that crop (a note in the panel will say so).
- **A region shows "No data"** — that area didn't report production of that crop that year. It's not an error.
- **Negros Island Region disappears in 2021–2023** — correct behavior: NIR was only created in 2024. For earlier years its provinces are counted under Western/Central Visayas.
- **A red error message appeared** — check your internet connection and reload the page.
- **The numbers look outdated** — press Ctrl+F5 (hard refresh) to fetch the latest data.
- **Want to start over?** Click any empty sea area to zoom back out, or reload the page.

## 10. Glossary

| Term | Meaning |
|---|---|
| **MT** | Metric ton = 1,000 kilograms |
| **HA** | Hectare = 10,000 square meters (about 1.4 football fields) |
| **MT/HA (Yield)** | Tons harvested per hectare of land — a measure of farm productivity |
| **Trees** | Number of bearing trees (or hills, for banana) — available for Mango and Banana |
| **Palay** | Unmilled rice (rice before husking) |
| **Region / Province** | The Philippines' administrative levels shown on the map |
| **National average** | The average value across all reporting regions for that year |

---

*Data source: Philippine agricultural production statistics, 2021–2025. For technical documentation, see [DOCUMENTATION.md](DOCUMENTATION.md).*
