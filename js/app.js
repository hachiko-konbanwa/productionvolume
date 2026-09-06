// ── SECURITY ─────────────────────────────────────────────────────────────────
function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── CONSTANTS ────────────────────────────────────────────────────────────────
// Bump this whenever the data files change — it busts the browser's HTTP cache
// once per release instead of on every single request (Date.now() defeated
// caching entirely and re-downloaded every file on every crop click).
const DATA_VERSION = '2026-09-05f';

// Boundaries get their OWN version, deliberately. DATA_VERSION bumps whenever
// any file in data/ changes — a single crop CSV edit is enough — and the three
// regional files plus the provincial one total ~103 MB. Hanging them off
// DATA_VERSION meant every routine data update forced every visitor to
// re-download all of it, and left the map blank while they waited.
// Bump this one ONLY when a boundary file itself changes.
const BOUNDARY_VERSION = '2026-09-03-boundaries-2';

// The annual series the yearly files carry. YEARS below is the ACTIVE period
// list and is swapped when the granularity changes, because ~70 places read it
// to walk the time axis — trend charts, popups, the play loop, aggregation.
// Period keys are strings like '2024', '2024S1', '2024Q3', which is also
// exactly how the csv columns are named, so row[period] keeps working
// unchanged. parseInt() on any of them still yields the year, which is what
// provinceParentRegion() needs for the year-aware regional rollup.
const ANNUAL_YEARS = ['2021', '2022', '2023', '2024', '2025', '2026'];
let YEARS = ANNUAL_YEARS.slice();

// Years whose annual column is not a finished year. PSA publishes an annual
// figure only after Q4 closes, so 2026's "annual" column is whatever part of
// the year had been reported when the sheet was pulled — and the amount varies
// by commodity: measured against each file's own 2025, 66 provincial volume
// files sit near a single quarter, 12 near a semester, and 36 fall outside
// both. There is no one honest sub-title like "Q1-Q2" to put on it, so the
// note says partial and refuses to imply a specific span.
//
// Only the ANNUAL 2026 column is partial. 2026Q1/Q2/S1 are complete periods in
// their own right — a quarter of data is a whole quarter — so the sub-annual
// views carry no warning, and the period lists there already stop at the last
// period PSA actually published.
const PARTIAL_ANNUAL_YEARS = { '2026': 'Partial year — incomplete, not comparable with earlier years' };

function partialYearNote(period) {
    return activeGranularity === 'annual' ? (PARTIAL_ANNUAL_YEARS[String(period)] || '') : '';
}

// The periods a TREND may be computed over - YEARS minus any partial one.
//
// 2026 holds a single quarter, so putting it in a trend is not a comparison, it
// is a category error. Every popup was doing exactly that: Palay's sparkline
// read "-78.0% since 2021" because it measured full-year 2021 against Q1-2026,
// where the honest five-year figure is -1.7%. The same partial point dragged the
// Lowest/Highest/Average rows and bent the last segment of the line off a cliff.
//
// Sub-annual axes are untouched: partialYearNote() only fires in annual mode,
// because a quarter of data IS a whole quarter.
function trendPeriods() {
    return YEARS.filter(function (y) { return !partialYearNote(y); });
}

// Granularities. Sub-annual data exists only for Palay and Corn (the Agristat
// sheet carries nothing else), so most crops stay annual-only and say so.
const GRANULARITIES = {
    annual:   { label: 'Annual',   badge: 'Production Year',     suffix: ''  },
    semester: { label: 'Semester', badge: 'Production Semester', suffix: 'S' },
    quarter:  { label: 'Quarter',  badge: 'Production Quarter',  suffix: 'Q' }
};
let activeGranularity = 'annual';

// Built by tools/sync_agristat.py. Provincial only — the regional view is
// derived from these by aggregateProvToRegional(), the same path annual crops
// without a regional file already take.
const SUBANNUAL_STEMS = {
    'Overall Palay Production':   'Palay',
    'Irrigated Palay Production': 'IrrigatedPalay',
    'Rainfed Palay Production':   'RainfedPalay',
    'Overall Corn Production':    'Corn',
    'Yellow Corn Production':     'YellowCorn',
    'White Corn Production':      'WhiteCorn',
    // Fruits, from tools/sync_fruits.py. VOLUME ONLY — fruits_long.csv fills
    // area on just 3.8% of its rows against 89.9% for palay/corn, so there is
    // nothing to publish for Area and nothing to divide for Yield.
    // hasSubAnnual() already gates per metric, so Quarter/Semester simply stay
    // unavailable for those two on these crops.
    'Overall Banana Production':      'Banana',
    'Banana Cardava Production':      'BananaCardava',
    'Banana Cavendish Production':    'BananaCavendish',
    'Overall Avocado Production':     'Avocado',
    'Overall Calamansi Production':   'Calamansi',
    'Overall Dalandan Production':    'Dalandan',
    'Overall Dragon Fruit Production':'DragonFruit',
    'Overall Durian Production':      'Durian',
    'Overall Mango Production':       'Mango',
    'Overall Melon Production':       'Melon',
    'Overall Pineapple Production':   'Pineapple',
    'Overall Pomelo Production':      'Pomelo',
    'Overall Rambutan Production':    'Rambutan',
    // Vegetables, roots and spices, from tools/sync_vegetables.py.
    // Volume only, same reason as the fruits above.
    'Overall Ampalaya Production':       'Ampalaya',
    'Overall Asparagus Production':      'Asparagus',
    'Overall Bell Pepper Production':    'BellPepper',
    'Overall Bottle Gourd Production':   'BottleGourd',
    'Overall Cabbage Production':        'Cabbage',
    'Overall Carrots Production':        'Carrots',
    'Overall Cassava Production':        'Cassava',
    'Cassava Food Production':           'CassavaFood',
    'Cassava Industrial Production':     'CassavaIndustrial',
    'Overall Cauliflower Production':    'Cauliflower',
    'Overall Chili Pepper Production':   'ChiliPepper',
    'Overall Chinese Cabbage Production': 'ChineseCabbage',
    'Overall Cucumber Production':       'Cucumber',
    'Overall Eggplant Production':       'Eggplant',
    'Overall Garlic Production':         'Garlic',
    'Overall Ginger Production':         'Ginger',
    'Overall Habitsuelas Production':    'Habitsuelas',
    'Overall Jute Mallow Production':    'JuteMallow',
    'Overall Lemongrass Production':     'Lemongrass',
    'Overall Lettuce Production':        'Lettuce',
    'Overall Malabar Spinach Production': 'MalabarSpinach',
    'Overall Moringa Production':        'Moringa',
    'Overall Mushroom Production':       'Mushroom',
    'Overall Okra Production':           'Okra',
    'Overall Peanut Production':         'Peanut',
    'Overall Pechay Production':         'Pechay',
    'Overall Radish Production':         'Radish',
    'Overall Spinach Production':        'Spinach',
    'Overall Sponge Gourd Production':   'SpongeGourd',
    'Overall Spring Onion Production':   'SpringOnion',
    'Overall Squash Production':         'Squash',
    'Overall Stringbeans Production':    'Stringbeans',
    'Overall Sweet Potato Leaves Production': 'SweetPotatoLeaves',
    'Overall Sweet Potato Production':   'SweetPotato',
    'Overall Tomato Production':         'Tomato',
    'Overall Ube Production':            'Ube',
    'Overall White Potato Production':   'WhitePotato',
    'Overall Winged Beans Production':   'WingedBeans',
    'Red Onion Production':              'RedOnion',
    'Red Shallot Production':            'RedShallot',
    'White Onion Production':            'WhiteOnion'
};
const SUBANNUAL_METRIC = { volume: 'volume', area: 'area', yield: 'yield' };

// Crops whose sub-annual coverage is volume-only (see SUBANNUAL_STEMS above).
const SUBANNUAL_VOLUME_ONLY = new Set([
    'Overall Banana Production', 'Banana Cardava Production', 'Banana Cavendish Production',
    'Overall Avocado Production', 'Overall Calamansi Production', 'Overall Dalandan Production',
    'Overall Dragon Fruit Production', 'Overall Durian Production', 'Overall Mango Production',
    'Overall Melon Production', 'Overall Pineapple Production', 'Overall Pomelo Production',
    'Overall Rambutan Production',
    'Overall Ampalaya Production',
    'Overall Asparagus Production',
    'Overall Bell Pepper Production',
    'Overall Bottle Gourd Production',
    'Overall Cabbage Production',
    'Overall Carrots Production',
    'Overall Cassava Production',
    'Cassava Food Production',
    'Cassava Industrial Production',
    'Overall Cauliflower Production',
    'Overall Chili Pepper Production',
    'Overall Chinese Cabbage Production',
    'Overall Cucumber Production',
    'Overall Eggplant Production',
    'Overall Garlic Production',
    'Overall Ginger Production',
    'Overall Habitsuelas Production',
    'Overall Jute Mallow Production',
    'Overall Lemongrass Production',
    'Overall Lettuce Production',
    'Overall Malabar Spinach Production',
    'Overall Moringa Production',
    'Overall Mushroom Production',
    'Overall Okra Production',
    'Overall Peanut Production',
    'Overall Pechay Production',
    'Overall Radish Production',
    'Overall Spinach Production',
    'Overall Sponge Gourd Production',
    'Overall Spring Onion Production',
    'Overall Squash Production',
    'Overall Stringbeans Production',
    'Overall Sweet Potato Leaves Production',
    'Overall Sweet Potato Production',
    'Overall Tomato Production',
    'Overall Ube Production',
    'Overall White Potato Production',
    'Overall Winged Beans Production',
    'Red Onion Production',
    'Red Shallot Production',
    'White Onion Production'
]);

function subAnnualFile(cropName, metricId, gran) {
    const stem = SUBANNUAL_STEMS[cropName];
    const metric = SUBANNUAL_METRIC[metricId];
    if (!stem || !metric || gran === 'annual') return null;
    // Asking for a file that was never written would 404 and surface as a data
    // error; the honest answer is that this crop has no sub-annual series for
    // this metric, which is what null means to every caller.
    if (metricId !== 'volume' && SUBANNUAL_VOLUME_ONLY.has(cropName)) return null;
    return 'data/subannual/' + stem + '_' + metric + '_' + gran + '.csv';
}

function hasSubAnnual(cropName, metricId, gran) {
    return !!subAnnualFile(cropName, metricId, gran);
}

// `average: true` marks ratio metrics — provinces are averaged (not summed) into
// regions, and totals rows are suppressed in the data table.
const METRICS = [
    { id: 'volume',    label: 'Volume',   unit: 'MT',      fileKey: 'file',          provFileKey: 'file',          title: 'Production Volume' },
    { id: 'yield',     label: 'Yield',    unit: 'MT/HA',   fileKey: 'yieldFile',     provFileKey: 'yieldFile',     title: 'Average Yield', average: true },
    { id: 'area',      label: 'Area',     unit: 'HA',      fileKey: 'areaFile',      provFileKey: 'areaFile',      title: 'Area Harvested' },
    { id: 'trees',     label: 'Trees',    unit: 'trees',   fileKey: 'treesFile',     provFileKey: 'treesFile',     title: 'Bearing Trees' },
    { id: 'yieldtree', label: 'Yield/Tree', unit: 'MT/tree', fileKey: 'yieldTreeFile', provFileKey: 'yieldTreeFile', title: 'Yield per Bearing Tree', average: true }
];

// ── GLOBAL STATE ─────────────────────────────────────────────────────────────
let layerOpacity = 0.92;
let activeMetric = 'volume';
let currentYear = '2025';
let activeItem = null;
let focusedPcode = null;
let focusedRegionName = null;
let currentCropStats = null;
let currentCropName = null;
let currentClsMap = {};
let currentProvStats = null;
let currentProvClsMap = {};
let provincialDataLayer = null;
let selectedProvLayer = null;
let playInterval = null;
let metricLoading = false;
let stickyHighlightCls = null;
let stickyHighlightKey = null; // view (crop|metric|scope) the pinned class belongs to

// ── Mobile helpers ───────────────────────────────────────────────────────────
function isMobileView() {
    return window.matchMedia('(max-width: 640px)').matches;
}

function collapseMobileSheet() {
    if (!isMobileView()) return;
    const panel = document.getElementById('control-panel');
    if (panel && panel.classList.contains('sheet-expanded')) {
        panel.classList.remove('sheet-expanded');
        const handle = document.getElementById('sheet-handle');
        if (handle) handle.title = 'Expand panel';
    }
}

function popupMaxWidth() {
    return isMobileView() ? Math.min(340, window.innerWidth - 40) : 340;
}

// ── Loading / error status pill ──────────────────────────────────────────────
let pendingLoads = 0;
let statusErrorTimer = null;

function updateStatusPill() {
    const pill = document.getElementById('status-pill');
    if (pill.classList.contains('error')) return; // error message owns the pill until it times out
    if (pendingLoads > 0) {
        document.getElementById('status-text').textContent = 'Loading data…';
        pill.classList.add('visible');
    } else {
        pill.classList.remove('visible');
    }
}

function beginDataLoad() {
    pendingLoads++;
    updateStatusPill();
}

function endDataLoad() {
    pendingLoads = Math.max(0, pendingLoads - 1);
    updateStatusPill();
}

// Both boundary files must be in before the initial crop auto-loads, so the
// choropleth has shapes to draw on and provinces aggregate with real pcodes
let bootLoadsRemaining = 2;
function bootLoadDone() {
    bootLoadsRemaining--;
    if (bootLoadsRemaining === 0) autoSelectInitialCrop();
}

// Why a data fetch failed, in words that suggest the right next move.
//
// "Try reloading" is sound advice for a flaky network and useless advice for a
// file:// origin, which is opaque: the browser refuses every fetch to a local
// file and will refuse them identically on every reload, forever. Opening
// index.html by double-clicking it is a completely reasonable thing to try,
// and the map half-works when you do - tiles come from the network, so you get
// a basemap with no country on it and a message telling you to do the one
// thing that cannot help.
function loadFailureHint(what) {
    if (location.protocol === 'file:') {
        return 'Could not load ' + what + ' — this page has to be served over '
             + 'http, not opened as a file. Run a local server from this folder '
             + '(python -m http.server) or use the deployed site.';
    }
    return 'Could not load ' + what + ' — try reloading the page.';
}

function showDataError(msg) {
    const pill = document.getElementById('status-pill');
    document.getElementById('status-text').textContent = msg;
    pill.classList.add('error', 'visible');
    clearTimeout(statusErrorTimer);
    statusErrorTimer = setTimeout(function () {
        pill.classList.remove('error');
        updateStatusPill();
    }, 5000);
}

// ── 1. Map init ──────────────────────────────────────────────────────────────
var phBounds = L.latLngBounds(L.latLng(2.5, 114.0), L.latLng(23.0, 129.5));
var map = L.map('map', {
    zoomControl: false,
    minZoom: 5,
    maxZoom: 22,
    maxBounds: phBounds,
    maxBoundsViscosity: 1.0
}).setView([12.8797, 121.7740], 6);

// ── Nav-rail SVG icon set (Feather-style, stroke = currentColor) ─────────────
function svgIcon(inner) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
        + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
}
var RAIL_ICONS = {
    menu:     svgIcon('<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>'),
    close:    svgIcon('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
    plus:     svgIcon('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
    minus:    svgIcon('<line x1="5" y1="12" x2="19" y2="12"/>'),
    locate:   svgIcon('<circle cx="12" cy="12" r="7"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>'),
    measure:  svgIcon('<rect x="2" y="9" width="20" height="6" rx="1"/><line x1="6" y1="9" x2="6" y2="12"/><line x1="10" y1="9" x2="10" y2="12"/><line x1="14" y1="9" x2="14" y2="12"/><line x1="18" y1="9" x2="18" y2="12"/>'),
    search:   svgIcon('<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),
    maximize: svgIcon('<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>'),
    minimize: svgIcon('<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>'),
    help:     svgIcon('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
    panel:    svgIcon('<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>'),
    layers:   svgIcon('<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>')
};

// Mobile-only toggle: on small screens the rail collapses behind this button
var RailToggleControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
        var btn = L.DomUtil.create('button', 'rail-toggle-btn leaflet-bar');
        btn.setAttribute('aria-label', 'Show map tools');
        btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = RAIL_ICONS.menu;
        L.DomEvent.disableClickPropagation(btn);
        L.DomEvent.on(btn, 'click', function () {
            var open = document.body.classList.toggle('rail-open');
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            btn.innerHTML = open ? RAIL_ICONS.close : RAIL_ICONS.menu;
        });
        return btn;
    }
});
new RailToggleControl().addTo(map);

L.control.zoom({ position: 'topleft' }).addTo(map);

L.control.scale({ position: 'bottomright', imperial: false, maxWidth: 150 }).addTo(map);
L.control.locate({ position: 'topleft', strings: { title: 'Show my location' }, flyTo: true }).addTo(map);
new L.Control.Measure({
    position: 'topleft',
    primaryLengthUnit: 'kilometers',
    secondaryLengthUnit: 'meters',
    primaryAreaUnit: 'sqkilometers'
}).addTo(map);

// ── 2. Base layers ───────────────────────────────────────────────────────────
// maxNativeZoom = deepest level the provider actually serves tiles for;
// past it Leaflet upscales the last tiles so users can keep zooming in

// CARTO now issues API keys for its basemaps: https://carto.com/basemaps/apikey/
// The tiles still serve unauthenticated today, so this is set up ahead of
// enforcement rather than in response to a breakage.
//
// Paste the key here. It WILL be visible to anyone who views source - a static
// site has nowhere to hide it, and no build step to inject it at deploy time.
// That is expected for a basemap key; the protection is to restrict it to this
// project's domains in the CARTO dashboard, NOT to try to conceal it. An
// unrestricted key in a public repo is someone else's free tile quota.
var CARTO_API_KEY = 'cb1_2lk5_1_8ee29b2eff2a4b7436609681';
// Confirmed against CARTO's documented tile URL, which is
//   .../rastertiles/voyager/{z}/{x}/{y}.png?key=YOUR_KEY
// It is 'key', not 'api_key' - that earlier guess would have appended a
// parameter CARTO ignores, leaving the watermark in place and looking like a
// bad key rather than a wrong URL.
var CARTO_KEY_PARAM = 'key';

function cartoUrl(style) {
    var u = 'https://{s}.basemaps.cartocdn.com/rastertiles/' + style + '/{z}/{x}/{y}{r}.png';
    return CARTO_API_KEY
        ? u + '?' + CARTO_KEY_PARAM + '=' + encodeURIComponent(CARTO_API_KEY)
        : u;
}

// Esri World Light Gray Canvas: pale, neutral, and needs no key. It replaces
// Carto Voyager as the default because Carto now watermarks unauthenticated
// tiles - they still return HTTP 200 with a valid PNG, so nothing errors and
// nothing can detect it in code; the map simply renders with "API KEY
// REQUIRED" printed diagonally across every tile.
//
// This canvas is designed for exactly this job: a light ground that a
// choropleth sits on without fighting it.
var esriGray = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    { maxNativeZoom: 16, maxZoom: 22, attribution: '© Esri' }
);

// Its matching labels, and the replacement for Carto's labels-only tiles in
// the hybrid basemap - those were watermarked too, so hybrid was showing
// "API KEY REQUIRED" over the satellite imagery.
var esriLabels = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    { maxNativeZoom: 16, maxZoom: 22, pane: 'labelsPane', attribution: '© Esri' }
);

var cartoVoyager = L.tileLayer(
    cartoUrl('voyager_nolabels'),
    { subdomains: 'abcd', maxNativeZoom: 19, maxZoom: 22, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>' }
).addTo(map);
var stadiaSmooth = L.tileLayer(
    'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png',
    { maxNativeZoom: 20, maxZoom: 22, attribution: '© Stadia Maps' }
);
// maxNativeZoom 17: Esri's high-res coverage over much of the Philippines ends
// around z17–18; beyond it the server returns "Map data not available"
// placeholder tiles (valid images, so Leaflet shows them instead of upscaling).
// Stopping at 17 stretches the last real imagery for deeper zooms.
var esriSatellite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxNativeZoom: 17, maxZoom: 22, attribution: '© Esri' }
);
var osmStandard = L.tileLayer(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxNativeZoom: 19, maxZoom: 22, attribution: '© OpenStreetMap contributors' }
);
// Transparent labels-only tiles that turn Esri Satellite into a "hybrid"
// basemap. Rendered in labelsPane, above the choropleth fills, so place
// names stay readable over the data (added/removed together with the
// imagery by the basemap switcher).
var cartoLabels = L.tileLayer(
    cartoUrl('voyager_only_labels'),
    { subdomains: 'abcd', maxNativeZoom: 19, maxZoom: 22, pane: 'labelsPane', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>' }
);

// ── 3. Panes ─────────────────────────────────────────────────────────────────
map.createPane('hillshadePane');
map.getPane('hillshadePane').style.zIndex = 240;
map.getPane('hillshadePane').style.pointerEvents = 'none';
map.getPane('hillshadePane').style.mixBlendMode = 'multiply';

map.createPane('cropPane');
map.getPane('cropPane').style.zIndex = 220;

// Provincial fills — sits below hillshade so multiply blend applies to it too
map.createPane('provDataPane');
map.getPane('provDataPane').style.zIndex = 225;

map.createPane('boundaryPane');
map.getPane('boundaryPane').style.zIndex = 260;
map.getPane('boundaryPane').style.pointerEvents = 'none';

// Hybrid-basemap labels — above data fills and hillshade, below region outlines
map.createPane('labelsPane');
map.getPane('labelsPane').style.zIndex = 250;
map.getPane('labelsPane').style.pointerEvents = 'none';

// Region name labels (national view only) — above hillshade so the multiply
// blend doesn't darken the text, below the boundary lines/basemap labels
map.createPane('regionLabelPane');
map.getPane('regionLabelPane').style.zIndex = 245;
map.getPane('regionLabelPane').style.pointerEvents = 'none';

// Provincial boundary lines — above fills, below regional outlines
map.createPane('provincialPane');
map.getPane('provincialPane').style.zIndex = 248;
map.getPane('provincialPane').style.pointerEvents = 'none';

// ── 4. Hillshade ─────────────────────────────────────────────────────────────
var hillshadeOverlay = L.imageOverlay(
    'data/boundaries/Hillshade_18.png',
    [[4.500000668000002, 116.8], [21.2, 126.699999604]],
    { pane: 'hillshadePane', opacity: 0.85 }
).addTo(map);

// ── 5. Layer settings (live in the Layers flyout, opened from the nav rail) ──
document.getElementById('hillshade-cb').addEventListener('change', function () {
    if (this.checked) hillshadeOverlay.addTo(map);
    else map.removeLayer(hillshadeOverlay);
});

var currentBasemap = 'carto';
function applyBasemap(key) {
    var choices = {
        gray:   [esriGray],
        carto:  [cartoVoyager],
        stadia: [stadiaSmooth],
        esri:   [esriSatellite],
        osm:    [osmStandard],
        // Esri labels, not Carto's - Carto's were watermarked, which put
        // "API KEY REQUIRED" over the satellite imagery.
        hybrid: [esriSatellite, esriLabels]
    };
    if (!choices[key]) return;
    currentBasemap = key;
    [esriGray, cartoVoyager, stadiaSmooth, esriSatellite, osmStandard,
     esriLabels, cartoLabels]
        .forEach(l => { if (map.hasLayer(l)) map.removeLayer(l); });
    choices[key].forEach(l => l.addTo(map));
    document.getElementById('basemap-select').value = key;
    updateUrlHash();
}
document.getElementById('basemap-select').addEventListener('change', function () {
    applyBasemap(this.value);
});

// ── Basemap fallback ─────────────────────────────────────────────────────────
// CARTO is the DEFAULT basemap here, so the day it starts refusing
// unauthenticated tiles this map loads as a blank grey grid with the
// choropleth floating on nothing - and nothing on screen says why.
//
// Leaflet reports every failed tile through 'tileerror', so the failure is
// detectable. It is deliberately not treated as fatal on the first one: a
// single missing tile at a deep zoom is ordinary, and switching basemap under
// someone mid-pan because one request timed out would be worse than the
// problem. Four failures is an outage, not noise.
//
// OpenStreetMap is the fallback because it is the only basemap here that needs
// no key at all - Stadia requires one too, so falling back to it would just
// move the failure.
var cartoTileFailures = 0;
var cartoFellBack = false;

function onCartoTileError() {
    if (cartoFellBack || currentBasemap !== 'carto') return;
    if (++cartoTileFailures < 4) return;
    cartoFellBack = true;
    applyBasemap('osm');
    var msg = CARTO_API_KEY
        ? 'Carto basemap refused the API key — switched to OpenStreetMap.'
        : 'Carto basemap unavailable (it now needs an API key) — switched to '
          + 'OpenStreetMap.';
    // showDataError is this project's own channel for a failed fetch, and a
    // tile request is a fetch - CLAUDE.md requires failures to surface there
    // rather than only in the console.
    showDataError(msg);
}

cartoVoyager.on('tileerror', onCartoTileError);
cartoLabels.on('tileerror', onCartoTileError);

// ── 6. Crop config ───────────────────────────────────────────────────────────
// REGIONAL_DERIVED — why six entries below carry no `file:`.
//
// Every crop that had BOTH a regional CSV and a provincial one disagreed with
// itself, and always in the same direction: the regional file read higher than
// the sum of its own provinces. For palay and corn the entire gap sat in BARMM
// (Overall Palay +62,659 MT; Yellow Corn +62,882 MT), and the provincial files
// reconcile with the published PSA sheet to the centavo, so the regional file
// is the one that is wrong.
//
// Removing `file:` makes loadCropData() take the `!file && provFile` path and
// derive regional totals with aggregateProvToRegional() — which is year-aware,
// so Sulu still counts under BARMM through 2025 and Region IX from 2026. The
// map's regional and provincial views now come from one source and cannot
// drift apart again.
//
// 2026-09-05 — six more entries joined them: Cattle, Chicken, Hog, Milkfish,
// Tilapia and Sugar. They were held back before on the grounds that their gap
// was unexplained and "unverified is not the same as wrong". That is settled
// now. Their regional file's 2021-2024 columns ARE Overall Palay production:
// matched region by region against the palay provincial rollup, the error is
// 0.00% in every region and all four years (Region I 1,902,343; Region II
// 2,909,950; Region III 3,741,211 — identical, not merely close). Only VI/VII/
// NIR differ, because the regional file predates the Negros Island Region
// split and still books Negros inside Western and Central Visayas. A wrong
// column was pasted in. The 2025 column in all six IS the right commodity.
//
// 2026-09-05, later — Coconut joined them too, on a different finding. Its
// regional and provincial files agree EXACTLY for 2021, 2022 and 2023 once the
// codeless Maguindanao row is restored, and 0.29% apart in 2025 — but the
// regional file's 2024 column is short by 858,653 MT, missing coconut in
// Region IX, Caraga and Mimaropa specifically. (The Region IX/BARMM and
// VI/VII/NIR offsets that show in every year are NOT errors: they are the Sulu
// and Negros handovers, which aggregateProvToRegional() already books
// year-aware.) The provincial file is the complete series and is what the
// commodity is defined by: `Coconut (w/ husk)`, 92 rows, sole Commodity Type in
// both the pre- and post-conversion file. The tree label already says "Coconut
// with Husk".
//
// Mango and Egg still carry `file:`. Mango's regional file is right — it matches
// fruits_long to the tonne — and Egg is within 0.4%. Leave them.
//
// Sugar's PROVINCIAL file has a separate, still-unexplained problem: it swings
// 23.9M MT (2021) -> 8.6M (2024) -> 13.7M (2025). Deriving its region from its
// provinces makes the two views agree with each other; it does not make that
// swing go away.
const cropConfig = {
    'Overall Palay Production': {
        // no `file:` — regional derived from provincial, see REGIONAL_DERIVED above
        palette: ['#fefae8', '#b7e4a8', '#52c45e', '#1a7a3a', '#003d10']
    },
    'Irrigated Palay Production': {
        // no `file:` — regional derived from provincial, see REGIONAL_DERIVED above
        palette: ['#fefae8', '#82dfc8', '#1a9e52', '#005a22', '#003010']
    },
    'Rainfed Palay Production': {
        // no `file:` — regional derived from provincial, see REGIONAL_DERIVED above
        palette: ['#fefae8', '#c8ee88', '#5ab858', '#1a7a3a', '#003d18']
    },
    'Overall Corn Production': {
        // no `file:` — regional derived from provincial, see REGIONAL_DERIVED above
        palette: ['#fefae8', '#f2d194', '#f2be22', '#f2a922', '#f28705']
    },
    'Yellow Corn Production': {
        // no `file:` — regional derived from provincial, see REGIONAL_DERIVED above
        palette: ['#fefae8', '#fff6cb', '#fff69b', '#fff63b', '#fae500']
    },
    'White Corn Production': {
        // no `file:` — regional derived from provincial, see REGIONAL_DERIVED above
        palette: ['#fefae8', '#fff8c3', '#ffee8c', '#e6d67a', '#ccc160']
    },
    'Overall Mango Production': {
        file: 'data/volume/mango-regional.csv',
        palette: ['#fefae8', '#ffc97c', '#ffae3b', '#db7420', '#ae5209']
    },
    'Overall Banana Production': {
        // No regional file on purpose. The Agristat one
        // (Overall_Banana_Production_2025.csv) has no 2026 column at all, so
        // Banana read as zero for 2026, and its 2024/2025 totals disagreed with
        // the published source by ~2,000 MT. Regional totals are now derived
        // from the provincial file below, the same path 64 other crops take.
        palette: ['#fefae8', '#ffc97c', '#ffae3b', '#db7420', '#ae5209']
    },
    'Overall Avocado Production': {
        palette: ['#fefae8', '#ffc97c', '#ffae3b', '#db7420', '#ae5209']
    },
    'Overall Melon Production': {
        palette: ['#fefae8', '#ffc97c', '#ffae3b', '#db7420', '#ae5209']
    },
    'Banana Cavendish Production': {
        palette: ['#fefae8', '#ffc97c', '#ffae3b', '#db7420', '#ae5209']
    },
    'Banana Cardava Production': {
        palette: ['#fefae8', '#ffc97c', '#ffae3b', '#db7420', '#ae5209']
    },
    'Overall Durian Production': {
        palette: ['#fefae8', '#ffc97c', '#ffae3b', '#db7420', '#ae5209']
    },
    'Overall Dragon Fruit Production': {
        palette: ['#fefae8', '#ffc97c', '#ffae3b', '#db7420', '#ae5209']
    },
    'Overall Calamansi Production': {
        palette: ['#fefae8', '#ffc97c', '#ffae3b', '#db7420', '#ae5209']
    },
    'Overall Pomelo Production': {
        palette: ['#fefae8', '#ffc97c', '#ffae3b', '#db7420', '#ae5209']
    },
    'Overall Rambutan Production': {
        palette: ['#fefae8', '#ffc97c', '#ffae3b', '#db7420', '#ae5209']
    },
    'Overall Dalandan Production': {
        palette: ['#fefae8', '#ffc97c', '#ffae3b', '#db7420', '#ae5209']
    },
    'Overall Pineapple Production': {
        palette: ['#fefae8', '#ffc97c', '#ffae3b', '#db7420', '#ae5209']
    },
    'Overall Cabbage Production': {
        palette: ['#f2f9d9', '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Lettuce Production': {
        palette: ['#f2f9d9', '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Bell Pepper Production': {
        palette: ['#f2f9d9', '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Chili Pepper Production': {
        palette: ['#f2f9d9', '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Carrots Production': {
        palette: ['#f2f9d9', '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Cauliflower Production': {
        palette: ['#f2f9d9', '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Broccoli Production': {
        palette: ['#f2f9d9', '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Celery Production': {
        palette: ['#f2f9d9', '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Habitsuelas Production': {
        palette: ['#f2f9d9', '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Chinese Cabbage Production': {
        palette: ['#f2f9d9', '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Chayote Production': {
        palette: ['#f2f9d9', '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Ampalaya Production': {
        palette: ['#f2f9e8',  '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Bottle Gourd Production': {
        palette: ['#f2f9e8',  '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Sponge Gourd Production': {
        palette: ['#f2f9e8',  '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Tomato Production': {
        palette: ['#f2f9e8',  '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Cucumber Production': {
        palette: ['#f2f9e8',  '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Mushroom Production': {
        palette: ['#f2f9e8',  '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Pechay Production': {
        palette: ['#f2f9e8',  '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Spinach Production': {
        palette: ['#f2f9e8',  '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Malabar Spinach Production': {
        palette: ['#f2f9e8',  '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Moringa Production': {
        palette: ['#f2f9e8',  '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Radish Production': {
        palette: ['#f2f9e8',  '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Sweet Potato Leaves Production': {
        palette: ['#f2f9e8',  '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Jute Mallow Production': {
        palette: ['#f2f9e8',  '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Winged Beans Production': {
        palette: ['#f2f9e8',  '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Squash Production': {
        palette: ['#fefae8',  '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Okra Production': {
        palette: ['#f2f9e8',  '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Eggplant Production': {
        palette: ['#f5f0ff', '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Stringbeans Production': {
        palette: ['#f2f9e8',  '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Ube Production': {
        palette: ['#f2f9d9', '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Cassava Food Production': {
        palette: ['#f2f9d9', '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Cassava Industrial Production': {
        palette: ['#f2f9d9', '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Cassava Production': {
        palette: ['#f2f9d9', '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Sweet Potato Production': {
        palette: ['#f2f9d9', '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall White Potato Production': {
        palette: ['#f2f9d9', '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Red Onion Production': {
        palette: ['#fff0f0', '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Garlic Production': {
        palette: ['#f2f9d9', '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Ginger Production': {
        palette: ['#f2f9d9', '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Lemongrass Production': {
        palette: ['#f2f9d9', '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Spring Onion Production': {
        palette: ['#f2f9d9', '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Peanut Production': {
        palette: ['#f2f9d9', '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'White Onion Production': {
        palette: ['#fefae8', '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Red Shallot Production': {
        palette: ['#fff0f5', '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Cacao Production': {
        palette: ['#fefae8', '#d7c6b6', '#c5ac95', '#b39274', '#9e7956']
    },
    'Overall Abaca Production': {
        palette: ['#fefae8', '#d7c6b6', '#c5ac95', '#b39274', '#9e7956']
    },
    'Overall Pinya Fiber Production': {
        palette: ['#fefae8', '#d7c6b6', '#c5ac95', '#b39274', '#9e7956']
    },
    'Overall Cotton Production': {
        palette: ['#fefae8', '#d7c6b6', '#c5ac95', '#b39274', '#9e7956']
    },
    'Overall Bariw Production': {
        palette: ['#fefae8', '#d7c6b6', '#c5ac95', '#b39274', '#9e7956']
    },
    'Overall Salago Production': {
        palette: ['#fefae8', '#d7c6b6', '#c5ac95', '#b39274', '#9e7956']
    },
    'Overall Coir Production': {
        palette: ['#fefae8', '#d7c6b6', '#c5ac95', '#b39274', '#9e7956']
    },
    'Overall Tobacco Production': {
        palette: ['#fefae8', '#d7c6b6', '#c5ac95', '#b39274', '#9e7956']
    },
    'Tobacco Virginia Production': {
        palette: ['#fefae8', '#d7c6b6', '#c5ac95', '#b39274', '#9e7956']
    },
    'Tobacco Native Production': {
        palette: ['#fefae8', '#d7c6b6', '#c5ac95', '#b39274', '#9e7956']
    },
    'Overall Pili Production': {
        palette: ['#fefae8', '#d7c6b6', '#c5ac95', '#b39274', '#9e7956']
    },
    'Overall Asparagus Production': {
        palette: ['#f2f9d9', '#d8a7d8', '#b060b0', '#8a1f8a', '#570057']
    },
    'Overall Coconut Production': {
        // no `file:` — regional derived from provincial, see REGIONAL_DERIVED above
        palette: ['#fefae8', '#d7c6b6', '#c5ac95', '#b39274', '#9e7956']
    },
    'Overall Sugar Production': {
        // no `file:` — regional derived from provincial, see REGIONAL_DERIVED above
        palette: ['#fefae8', '#d7c6b6', '#c5ac95', '#b39274', '#9e7956']
    },
    'Overall Milkfish Production': {
        // no `file:` — regional derived from provincial, see REGIONAL_DERIVED above
        palette: ['#fefae8', '#99c7f5', '#66b8ea', '#3385ec', '#0059bd']
    },
    'Overall Tilapia Production': {
        // no `file:` — regional derived from provincial, see REGIONAL_DERIVED above
        palette: ['#fefae8', '#a6bbd9', '#7b9ac5', '#5279b1', '#28589c']
    },
    'Overall Chicken Production': {
        // no `file:` — regional derived from provincial, see REGIONAL_DERIVED above
        palette: ['#fefae8', '#ffd1e2', '#ff9ec4', '#f25c94', '#c2185b']
    },
    'Overall Cattle Production': {
        // no `file:` — regional derived from provincial, see REGIONAL_DERIVED above
        palette: ['#fefae8', '#ffd1e2', '#ff9ec4', '#f25c94', '#c2185b']
    },
    'Overall Hog Production': {
        // no `file:` — regional derived from provincial, see REGIONAL_DERIVED above
        palette: ['#fefae8', '#ffd1e2', '#ff9ec4', '#f25c94', '#c2185b']
    },
    'Overall Dairy Production': {
        file: 'data/volume/dairy-regional.csv',
        palette: ['#fefae8', '#ffd1e2', '#ff9ec4', '#f25c94', '#c2185b']
    },
    'Overall Egg Production': {
        file: 'data/volume/egg-regional.csv',
        palette: ['#fefae8', '#ffd1e2', '#ff9ec4', '#f25c94', '#c2185b'],
        footnote: '* Total of Chicken and Duck Egg Production Volume'
    }
};

// Provincial CSV registry — add more crops here as files become available
const provConfig = {
    'Irrigated Palay Production': {
        file: 'data/volume/irrigated-palay.csv',
        yieldFile: 'data/yield/irrigated-palay.csv',
        areaFile: 'data/area/irrigated-palay.csv'
    },
    'Overall Palay Production': {
        file: 'data/volume/palay.csv',
        yieldFile: 'data/yield/palay.csv',
        areaFile: 'data/area/palay.csv'
    },
    'Rainfed Palay Production': {
        file: 'data/volume/rainfed-palay.csv',
        yieldFile: 'data/yield/rainfed-palay.csv',
        areaFile: 'data/area/rainfed-palay.csv'
    },
    'Overall Corn Production': {
        file: 'data/volume/corn.csv'
    },
    'Yellow Corn Production': {
        file: 'data/volume/yellow-corn.csv',
        yieldFile: 'data/yield/yellow-corn.csv',
        areaFile: 'data/area/yellow-corn.csv'
    },
    'White Corn Production': {
        file: 'data/volume/white-corn.csv',
        yieldFile: 'data/yield/white-corn.csv',
        areaFile: 'data/area/white-corn.csv'
    },
    'Overall Cabbage Production': {
        file: 'data/volume/cabbage.csv',
        yieldFile: 'data/yield/cabbage.csv',
        areaFile: 'data/area/cabbage.csv'
    },
    'Overall Lettuce Production': {
        file: 'data/volume/lettuce.csv',
        areaFile: 'data/area/lettuce.csv',
        yieldFile: 'data/yield/lettuce.csv'
    },
    'Overall Bell Pepper Production': {
        file: 'data/volume/bell-pepper.csv',
        areaFile: 'data/area/bell-pepper.csv',
        yieldFile: 'data/yield/bell-pepper.csv'
    },
    'Overall Chili Pepper Production': {
        file: 'data/volume/chili-pepper.csv',
        areaFile: 'data/area/chili-pepper.csv'
    },
    'Overall Carrots Production': {
        file: 'data/volume/carrots.csv',
        yieldFile: 'data/yield/carrots.csv',
        areaFile: 'data/area/carrots.csv'
    },
    'Overall Cauliflower Production': {
        file: 'data/volume/cauliflower.csv',
        yieldFile: 'data/yield/cauliflower.csv',
        areaFile: 'data/area/cauliflower.csv'
    },
    'Overall Celery Production': {
        file: 'data/volume/celery.csv',
        yieldFile: 'data/yield/celery.csv',
        areaFile: 'data/area/celery.csv'
    },
    'Overall Broccoli Production': {
        file: 'data/volume/broccoli.csv',
        yieldFile: 'data/yield/broccoli.csv',
        areaFile: 'data/area/broccoli.csv'
    },
    'Overall Habitsuelas Production': {
        file: 'data/volume/habitsuelas.csv',
        yieldFile: 'data/yield/habitsuelas.csv',
        areaFile: 'data/area/habitsuelas.csv'
    },
    'Overall Chinese Cabbage Production': {
        file: 'data/volume/chinese-cabbage.csv',
        yieldFile: 'data/yield/chinese-cabbage.csv',
        areaFile: 'data/area/chinese-cabbage.csv'
    },
    'Overall Chayote Production': {
        file: 'data/volume/chayote.csv',
        yieldFile: 'data/yield/chayote.csv',
        areaFile: 'data/area/chayote.csv'
    },
    'Overall Bottle Gourd Production': {
        file: 'data/volume/bottle-gourd.csv',
        areaFile: 'data/area/bottle-gourd.csv',
        yieldFile: 'data/yield/bottle-gourd.csv'
    },
    'Overall Sponge Gourd Production': {
        file: 'data/volume/sponge-gourd.csv',
        areaFile: 'data/area/sponge-gourd.csv',
        yieldFile: 'data/yield/sponge-gourd.csv'
    },
    'Overall Tomato Production': {
        file: 'data/volume/tomato.csv',
        areaFile: 'data/area/tomato.csv',
        yieldFile: 'data/yield/tomato.csv'
    },
    'Overall Cucumber Production': {
        file: 'data/volume/cucumber.csv',
        areaFile: 'data/area/cucumber.csv',
        yieldFile: 'data/yield/cucumber.csv'
    },
    'Overall Mushroom Production': {
        file: 'data/volume/mushroom.csv'
    },
    'Overall Pechay Production': {
        file: 'data/volume/pechay.csv',
        areaFile: 'data/area/pechay.csv',
        yieldFile: 'data/yield/pechay.csv'
    },
    'Overall Spinach Production': {
        file: 'data/volume/spinach.csv',
        areaFile: 'data/area/spinach.csv',
        yieldFile: 'data/yield/spinach.csv'
    },
    'Overall Malabar Spinach Production': {
        file: 'data/volume/malabar-spinach.csv',
        areaFile: 'data/area/malabar-spinach.csv',
        yieldFile: 'data/yield/malabar-spinach.csv'
    },
    'Overall Moringa Production': {
        file: 'data/volume/moringa.csv'
    },
    'Overall Radish Production': {
        file: 'data/volume/radish.csv',
        areaFile: 'data/area/radish.csv',
        yieldFile: 'data/yield/radish.csv'
    },
    'Overall Sweet Potato Leaves Production': {
        file: 'data/volume/sweet-potato-leaves.csv'
    },
    'Overall Jute Mallow Production': {
        file: 'data/volume/jute-mallow.csv',
        areaFile: 'data/area/jute-mallow.csv',
        yieldFile: 'data/yield/jute-mallow.csv'
    },
    'Overall Winged Beans Production': {
        file: 'data/volume/winged-beans.csv',
        areaFile: 'data/area/winged-beans.csv'
    },
    'Overall Ampalaya Production': {
        file: 'data/volume/ampalaya.csv',
        yieldFile: 'data/yield/ampalaya.csv',
        areaFile: 'data/area/ampalaya.csv'
    },
    'Overall Squash Production': {
        file: 'data/volume/squash.csv',
        yieldFile: 'data/yield/squash.csv',
        areaFile: 'data/area/squash.csv'
    },
    'Overall Okra Production': {
        file: 'data/volume/okra.csv',
        yieldFile: 'data/yield/okra.csv',
        areaFile: 'data/area/okra.csv'
    },
    'Overall Eggplant Production': {
        file: 'data/volume/eggplant.csv',
        yieldFile: 'data/yield/eggplant.csv',
        areaFile: 'data/area/eggplant.csv'
    },
    'Overall Stringbeans Production': {
        file: 'data/volume/stringbeans.csv',
        yieldFile: 'data/yield/stringbeans.csv',
        areaFile: 'data/area/stringbeans.csv'
    },
    'Overall Coconut Production': {
        // Area and Yield are deliberately NOT wired. The provincial area source
        // reports a STANDING planted area and repeats it every quarter — mango
        // Zambales 2025 reads 8,658.99 ha in all four — so summing the quarters
        // inflated the annual figure ~4x (mango 707,518 ha against a real
        // ~176,000; banana 1,762,161 against ~440,000; coconut 14,651,870
        // against ~3.6M). The 2026 column happens to be right only because it
        // holds a single quarter. Yield was then volume/area over that bad
        // area, giving mango 1.0 MT/HA where the true figure is ~4.0, and it
        // was a DERIVED number besides — tools/sync_fruits.py refuses to write
        // exactly these two files for exactly this reason ("VOLUME ONLY … yield
        // is volume/area so it cannot be derived either"). 2021-2024 carried no
        // area at all, so four of six years were empty regardless.
        //
        // Annual vegetables are a different case and keep their area: their
        // quarterly areas genuinely differ (Eggplant 4% of provinces repeat a
        // value, against Durian 79%), because the same land really is cropped
        // more than once a year, so there the sum is the right figure.
        file: 'data/volume/coconut.csv'
    },
    'Overall Sugar Production': {
        file: 'data/volume/sugar.csv',
        yieldFile: 'data/yield/sugar.csv',
        areaFile: 'data/area/sugar.csv'
    },
    'Overall Mango Production': {
        // See the Area/Yield note on Overall Coconut Production above.
        // treesFile is named *_yieldtree_* but its CONTENT is bearing-tree
        // counts (Abra 2025: 8,462), which is what treesFile wants.
        file: 'data/volume/mango.csv',
        treesFile: 'data/trees/mango.csv'
    },
    'Overall Banana Production': {
        // Built from data/fruits_long.csv (all six varieties summed) rather
        // than FruitCrops_ProductionVolume_Provincial.xlsx#Banana, which
        // carries the five highly-urbanised cities with a BLANK ADM2_PCODE and
        // so silently lost 238,545 MT in 2025 alone — City of Davao 172,495 and
        // City of Zamboanga 66,050. tools/fix_codeless_provinces.py repaired
        // that fault across data/*.csv but does not write .xlsx, so the sheet
        // is still short; this file sidesteps it and matches the source exactly
        // for every year, 2026 included.
        file: 'data/volume/banana.csv',
        // See the Area/Yield note on Overall Coconut Production above.
        //
        // treesFile is unwired too, and for a separate reason. The only
        // all-banana tree file (banana_yieldtree_provincial.csv, self-labelled
        // 'Banana') puts 2025 at 276,209,633 bearing trees — but Banana Cardava
        // ALONE, from the newer 2026-release file, is 303,648,834. A subset
        // cannot exceed its parent, and it does so in 67 of 87 provinces.
        // Cardava is 29.7% of banana VOLUME yet 109.9% of this "all banana"
        // tree count, and the implied per-tree yields differ 3.7x (0.0312
        // against Cardava's 0.0084 MT/tree). Cardava's own numbers check out
        // — trees x published yield/tree = 2,626,117 MT against an actual
        // 2,560,921 MT — so this file is the wrong one: either a single
        // variety mislabelled 'Banana', or an older vintage that must not sit
        // beside the 2026-release files. Saba needs 303M hills for 2.56M MT,
        // so a real all-varieties count is far above 303M, not below it.
        //
        // Overall Banana therefore shows VOLUME only. Its volume is sound (all
        // six varieties summed from fruits_long); only the tree count is not.
    },
    'Cassava Food Production': {
        file: 'data/volume/cassava-food.csv'
    },
    'Cassava Industrial Production': {
        file: 'data/volume/cassava-industrial.csv',
        areaFile: 'data/area/cassava-industrial.csv',
        yieldFile: 'data/yield/cassava-industrial.csv'
    },
    'Overall Cassava Production': {
    // Area and Yield deliberately absent. The files that exist
    // (cassava_provincial_area.csv, cassava_yield_provincial.csv) describe
    // INDUSTRIAL cassava - they agree with that series to 0.1% per province
    // and are 78% off this combined one - so they are configured on
    // 'Cassava Industrial Production' instead. No area or yield source
    // exists for food + industrial combined, and inventing one by adding
    // two published averages together would be wrong.
        file: 'data/volume/cassava.csv'
    },
    'Overall Sweet Potato Production': {
        file: 'data/volume/sweet-potato.csv',
        areaFile: 'data/area/sweet-potato.csv',
        yieldFile: 'data/yield/sweet-potato.csv'
    },
    'Overall White Potato Production': {
        file: 'data/volume/white-potato.csv',
        areaFile: 'data/area/white-potato.csv',
        yieldFile: 'data/yield/white-potato.csv'
    },
    'Overall Ube Production': {
        file: 'data/volume/ube.csv',
        yieldFile: 'data/yield/ube.csv',
        areaFile: 'data/area/ube.csv'
    },
    'White Onion Production': {
        file: 'data/volume/white-onion.csv',
        yieldFile: 'data/yield/white-onion.csv',
        areaFile: 'data/area/white-onion.csv'
    },
    'Red Onion Production': {
        file: 'data/volume/red-onion.csv',
        yieldFile: 'data/yield/red-onion.csv',
        areaFile: 'data/area/red-onion.csv'
    },
    'Overall Garlic Production': {
        file: 'data/volume/garlic.csv',
        areaFile: 'data/area/garlic.csv',
        yieldFile: 'data/yield/garlic.csv'
    },
    'Overall Ginger Production': {
        file: 'data/volume/ginger.csv',
        areaFile: 'data/area/ginger.csv',
        yieldFile: 'data/yield/ginger.csv'
    },
    'Overall Lemongrass Production': {
        file: 'data/volume/lemongrass.csv',
        areaFile: 'data/area/lemongrass.csv',
        yieldFile: 'data/yield/lemongrass.csv'
    },
    'Overall Spring Onion Production': {
        file: 'data/volume/spring-onion.csv',
        areaFile: 'data/area/spring-onion.csv',
        yieldFile: 'data/yield/spring-onion.csv'
    },
    'Overall Peanut Production': {
        file: 'data/volume/peanut.csv',
        areaFile: 'data/area/peanut.csv',
        yieldFile: 'data/yield/peanut.csv'
    },
    'Red Shallot Production': {
        file: 'data/volume/red-shallot.csv',
        yieldFile: 'data/yield/red-shallot.csv',
        areaFile: 'data/area/red-shallot.csv'
    },
    'Overall Avocado Production': {
        file: 'data/volume/avocado.csv',
        treesFile: 'data/trees/avocado.csv',
        yieldTreeFile: 'data/yieldtree/avocado.csv'
    },
    'Overall Melon Production': {
        file: 'data/volume/melon.csv',
        areaFile: 'data/area/melon.csv',
        yieldFile: 'data/yield/melon.csv'
    },
    'Banana Cavendish Production': {
        file: 'data/volume/banana-cavendish.csv'
    },
    'Banana Cardava Production': {
        file: 'data/volume/banana-cardava.csv',
        treesFile: 'data/trees/banana-cardava.csv',
        yieldTreeFile: 'data/yieldtree/banana-cardava.csv'
    },
    'Overall Durian Production': {
        file: 'data/volume/durian.csv',
        treesFile: 'data/trees/durian.csv',
        yieldTreeFile: 'data/yieldtree/durian.csv'
    },
    'Overall Dragon Fruit Production': {
        file: 'data/volume/dragon-fruit.csv',
        treesFile: 'data/trees/dragon-fruit.csv',
        yieldTreeFile: 'data/yieldtree/dragon-fruit.csv'
    },
    'Overall Calamansi Production': {
        file: 'data/volume/calamansi.csv',
        treesFile: 'data/trees/calamansi.csv',
        yieldTreeFile: 'data/yieldtree/calamansi.csv'
    },
    'Overall Pomelo Production': {
        file: 'data/volume/pomelo.csv',
        treesFile: 'data/trees/pomelo.csv',
        yieldTreeFile: 'data/yieldtree/pomelo.csv'
    },
    'Overall Rambutan Production': {
        file: 'data/volume/rambutan.csv',
        treesFile: 'data/trees/rambutan.csv',
        yieldTreeFile: 'data/yieldtree/rambutan.csv'
    },
    'Overall Dalandan Production': {
        file: 'data/volume/dalandan.csv',
        treesFile: 'data/trees/dalandan.csv',
        yieldTreeFile: 'data/yieldtree/dalandan.csv'
    },
    'Overall Pineapple Production': {
        file: 'data/volume/pineapple.csv',
        areaFile: 'data/area/pineapple.csv',
        yieldFile: 'data/yield/pineapple.csv'
    },
    'Overall Cacao Production': {
        file: 'data/volume/cacao.csv',
        areaFile: 'data/area/cacao.csv',
        yieldTreeFile: 'data/yieldtree/cacao.csv'
    },
    'Overall Abaca Production': {
        file: 'data/volume/abaca.csv',
        areaFile: 'data/area/abaca.csv',
        yieldFile: 'data/yield/abaca.csv'
    },
    'Overall Pinya Fiber Production': {
        file: 'data/volume/pinya-fiber.csv',
        areaFile: 'data/area/pinya-fiber.csv',
        yieldFile: 'data/yield/pinya-fiber.csv'
    },
    'Overall Cotton Production': {
        file: 'data/volume/cotton.csv',
        areaFile: 'data/area/cotton.csv',
        yieldFile: 'data/yield/cotton.csv'
    },
    'Overall Bariw Production': {
        file: 'data/volume/bariw.csv',
        areaFile: 'data/area/bariw.csv',
        yieldFile: 'data/yield/bariw.csv'
    },
    'Overall Salago Production': {
        file: 'data/volume/salago.csv',
        areaFile: 'data/area/salago.csv',
        yieldFile: 'data/yield/salago.csv'
    },
    'Overall Coir Production': {
        file: 'data/volume/coir.csv'
    },
    'Overall Tobacco Production': {
        file: 'data/volume/tobacco.csv',
        areaFile: 'data/area/tobacco.csv',
        yieldFile: 'data/yield/tobacco.csv'
    },
    'Tobacco Virginia Production': {
        file: 'data/volume/tobacco-virginia.csv',
        areaFile: 'data/area/tobacco-virginia.csv',
        yieldFile: 'data/yield/tobacco-virginia.csv'
    },
    'Tobacco Native Production': {
        file: 'data/volume/tobacco-native.csv',
        areaFile: 'data/area/tobacco-native.csv',
        yieldFile: 'data/yield/tobacco-native.csv'
    },
    'Overall Pili Production': {
        file: 'data/volume/pili.csv',
        areaFile: 'data/area/pili.csv',
        yieldTreeFile: 'data/yieldtree/pili.csv'
    },
    'Overall Asparagus Production': {
        file: 'data/volume/asparagus.csv',
        areaFile: 'data/area/asparagus.csv',
        yieldFile: 'data/yield/asparagus.csv'
    },
    'Overall Milkfish Production': {
        file: 'data/volume/milkfish.csv'
    },
    'Overall Tilapia Production': {
        file: 'data/volume/tilapia.csv'
    },
    'Overall Hog Production': {
        file: 'data/volume/hog.csv'
    },
    'Overall Egg Production': {
        file: 'data/volume/egg.csv'
    },
    'Overall Chicken Production': {
        file: 'data/volume/chicken.csv'
    },
    'Overall Cattle Production': {
        file: 'data/volume/cattle.csv'
    }
};

// NIR provinces revert to R6/R7 for years < 2024.
// Keyed by the province's PSGC ADM2 code → the pre-2024 regional PSGC code.
const NIR_PROV_TO_PRE2024 = {
    '1804500000': '0600000000',  // Negros Occidental → R6
    '1804600000': '0700000000',  // Negros Oriental  → R7
    '1806100000': '0700000000'   // Siquijor         → R7
};

// The boundary GeoJSON tags Basilan's polygon under Region IX, but PSA
// statistics (and all data files) report Basilan under BARMM — override the
// polygon's region so it drills down, classifies, and aggregates with BARMM.
const PROVINCE_REGION_OVERRIDES = {
    '1900700000': '1900000000' // Basilan → BARMM
};

// Returns the province's parent region PSGC so it matches whichever
// regional boundary layer is currently displayed.
function provinceParentRegion(props, year) {
    const yr = parseInt(year || currentYear);
    if (PROVINCE_REGION_OVERRIDES[props.ADM2_PCODE]) {
        return PROVINCE_REGION_OVERRIDES[props.ADM2_PCODE];
    }
    // Re-homed provinces (e.g. Sulu → Region IX) count under the new region
    // from the re-homing year; earlier years stay with the boundary file's region
    const rehome = PROVINCE_REHOMES[props.ADM2_PCODE];
    if (rehome && yr >= rehome.since) return rehome.newRegion;
    if (yr >= 2024) return props.ADM1_PCODE;
    // NIR didn't exist before 2024 — its provinces revert to R6/R7,
    // which is encoded in the first 4 chars of their ADM2_PCODE
    if (props.ADM1_PCODE === '1800000000') {
        return NIR_PROV_TO_PRE2024[props.ADM2_PCODE] || props.ADM1_PCODE;
    }
    // All other regions use the same PSGC code in both boundary layers
    return props.ADM1_PCODE;
}

// Areas only reported separately starting in a given year. Before that year
// their polygon displays as part of the parent province (same color/data),
// like the NIR provinces reverting to R6/R7.
// Highly-urbanised cities that PSA began reporting separately from `since`.
// Each has its own carved polygon in Admin_Provincial_Boundary.json, so before
// `since` effectiveProvincePcode() resolves it to the parent — the city takes
// the province's colour and its popup says "reported under parent", which is
// what the data actually means — and from `since` it carries its own value.
//
// `since` is per city and comes from the published series, not from a single
// cutover year: Davao City and Zamboanga City are broken out from 2025, the
// other three only from 2026. Getting this wrong in either direction moves real
// tonnage between a city and its province.
const PROVINCE_SPLITS = {
    '0907400000': { parent: '0907300000', since: 2025 }, // Zamboanga City ← Zamboanga del Sur
    '1130700000': { parent: '1102400000', since: 2025 }, // Davao City      ← Davao del Sur
    '1830200000': { parent: '1804500000', since: 2026 }, // Bacolod City    ← Negros Occidental
    '1630400000': { parent: '1600200000', since: 2026 }, // Butuan City     ← Agusan del Norte
    '1731500000': { parent: '1705300000', since: 2026 }  // Puerto Princesa ← Palawan
};

// Provinces re-homed to another region: Sulu left BARMM (1906600000) for
// Region IX (0906600000) by the 2024 Supreme Court ruling; statistics carry
// the move starting `since`. Data files use the new code for the whole series
// and the boundary GeoJSON still has the old one, so codes always normalize
// to `newPcode`, while the regional rollup flips at `since` — BARMM through
// 2024, Region IX from 2025.
const PROVINCE_REHOMES = {
    // Sulu: BARMM → R9 from 2026. Not 2025 — PSA still books Sulu's 2025
    // output under BARMM (its Region IX row for that year is empty), so
    // re-homing a year early moved real 2025 tonnage out of BARMM's total and
    // into Region IX's, disagreeing with the published regional figures.
    '1906600000': { newPcode: '0906600000', newRegion: '0900000000', since: 2026 }
};
const PROVINCE_PCODE_ALIASES = {};      // old → new (data/polygon normalization)
const PROVINCE_PCODE_ALIASES_REV = {};  // new → old (GeoJSON lookups)
Object.entries(PROVINCE_REHOMES).forEach(([oldPcode, r]) => {
    PROVINCE_PCODE_ALIASES[oldPcode] = r.newPcode;
    PROVINCE_PCODE_ALIASES_REV[r.newPcode] = oldPcode;
});

function effectiveProvincePcode(adm2Pcode) {
    adm2Pcode = PROVINCE_PCODE_ALIASES[adm2Pcode] || adm2Pcode;
    const split = PROVINCE_SPLITS[adm2Pcode];
    return (split && parseInt(currentYear) < split.since) ? split.parent : adm2Pcode;
}

function provinceRegionPcode(adm2Pcode, year) {
    // Preferred path: the published PSGC parent code. No polygons involved, so
    // this works from the moment the ~5 KB table lands rather than waiting on
    // 42 MB, and it is a lookup of what PSA publishes instead of a guess.
    // The result is fed through provinceParentRegion() exactly as the boundary
    // properties were, so every year-aware rule still applies on top of it:
    // PROVINCE_REGION_OVERRIDES, the Sulu re-home, and NIR reverting to R6/R7
    // before 2024. The table deliberately stores Sulu's *pre*-re-home region
    // for that reason (see tools/build_psgc_parents.py).
    if (psgcParents) {
        // Try the code as given, then its alias in either direction — a data
        // file may carry Sulu as either 1906600000 or 0906600000.
        const base = /^PH\d{5}$/.test(adm2Pcode) ? adm2Pcode.slice(2) + '00000' : adm2Pcode;
        const candidates = [base, PROVINCE_PCODE_ALIASES[base], PROVINCE_PCODE_ALIASES_REV[base]];
        for (let i = 0; i < candidates.length; i++) {
            const key = candidates[i];
            if (!key || !psgcParents[key]) continue;
            // Pass the key that MATCHED, not the one that came in:
            // PROVINCE_REHOMES and PROVINCE_REGION_OVERRIDES are keyed by the
            // project's own vintage, so handing provinceParentRegion() the
            // aliased code made it miss the Sulu re-home and report BARMM for
            // 2026 instead of Region IX.
            return provinceParentRegion({ ADM2_PCODE: key, ADM1_PCODE: psgcParents[key] }, year);
        }
    }
    if (provinceFeatureIndex) {
        // Fast path: PSGC format (10-digit) — direct index match; re-homed
        // codes (e.g. Sulu's Region IX code) fall back to their old polygon
        let feature = provinceFeatureIndex[adm2Pcode]
            || (PROVINCE_PCODE_ALIASES_REV[adm2Pcode] && provinceFeatureIndex[PROVINCE_PCODE_ALIASES_REV[adm2Pcode]]);
        if (feature) return provinceParentRegion(feature.properties, year);
        // Compatibility path: legacy PH-format xlsx files (e.g. PH14001 → 1400100000).
        // NIR provinces carried their pre-NIR R6/R7 codes so need explicit overrides.
        if (/^PH\d{5}$/.test(adm2Pcode)) {
            const nirOverride = { PH06045: '1804500000', PH07046: '1804600000', PH07061: '1806100000' };
            const psgc = nirOverride[adm2Pcode] || (adm2Pcode.slice(2) + '00000');
            feature = provinceFeatureIndex[psgc];
            if (feature) return provinceParentRegion(feature.properties, year);
        }
    }
    // Last-resort fallback, reached when the provincial boundary index is not
    // loaded yet (or the province is absent from it). It has to return a REAL
    // region pcode — '1100000000', not the bare 4-character PSGC prefix
    // '1102'. This value KEYS catalogueData's byRegion, and the region and
    // island rankings look those keys up with full 10-digit pcodes taken from
    // the boundary shapes and ISLAND_GROUPS, so a prefix matched nothing:
    // every province-sourced commodity silently read as zero at region and
    // island scope, and the cards' "Top Regions" list printed the raw numbers
    // instead of names. National scope hid the bug by summing byRegion's
    // values without caring about its keys.
    const digits = /^PH\d{5}$/.test(adm2Pcode) ? adm2Pcode.slice(2) : adm2Pcode;
    return /^\d{2}/.test(digits) ? digits.substring(0, 2) + '00000000' : adm2Pcode;
}

function getActiveMetricDef() { return METRICS.find(m => m.id === activeMetric); }
function getActiveUnit() { return getActiveMetricDef().unit; }
function getActiveUnitExplanation() {
    const unit = getActiveUnit();
    const parts = [];
    if (unit.includes('MT')) parts.push('MT = Metric Tons');
    if (unit.includes('HA')) parts.push('HA = Hectares');
    if (unit === 'trees') parts.push('Number of bearing trees/hills');
    if (unit === 'MT/tree') parts.push('tree = one bearing tree');
    return parts.join(' · ');
}

// Metric values span wildly different scales — Volume in the thousands,
// Yield/Tree ratios as small as 0.0001 MT/tree (e.g. Cacao). A flat
// maximumFractionDigits:2 rounds every one of those small ratios straight to
// "0.00", which is what made Cacao's Yield/Tree legend show "0 – 0 MT/tree"
// for every class despite the map correctly shading by actual magnitude.
// Precision now scales up for small values instead of being fixed.
function fmtMetricValue(v) {
    const abs = Math.abs(v);
    const maxFrac = abs < 0.01 ? 4 : abs < 1 ? 3 : 2;
    return v.toLocaleString('en-PH', { maximumFractionDigits: maxFrac });
}

function getNationalTotal() {
    if (!currentCropStats) return 0;
    return Object.values(currentCropStats).reduce((s, row) => s + (parseFloat(row[currentYear]) || 0), 0);
}

// The period immediately before this one ON THE ACTIVE AXIS — the previous
// quarter in quarter mode, the previous year in annual mode. Never arithmetic on
// the period string: parseInt('2025Q4') - 1 is 2024, which is not a quarter, so
// anything relying on it silently found no previous period at all.
function previousPeriod(period) {
    const i = YEARS.indexOf(String(period));
    return i > 0 ? YEARS[i - 1] : null;
}

function getPrevYear() {
    return previousPeriod(currentYear);
}

function buildGrowthHTML(val, prevRow, prevYearKey) {
    if (!prevYearKey || !prevRow || !val) return '';
    const prev = parseFloat(prevRow[prevYearKey]) || 0;
    if (!prev) return '';
    const diff = val - prev;
    const rate = (diff / prev) * 100;
    const sign = diff >= 0 ? '+' : '';
    const cls  = diff >= 0 ? 'growth-pos' : 'growth-neg';
    const arrow = diff >= 0 ? '▲' : '▼';
    const fmt = fmtMetricValue;
    const unit = getActiveUnit();
    // Name the period being compared against. "Variance in previous year" was
    // simply wrong once the axis could be semesters or quarters — this row
    // compares against the PREVIOUS PERIOD, whatever that is, and saying which
    // one removes the guesswork in every granularity.
    const vsLabel = 'vs ' + periodShort(prevYearKey);
    return '<div class="info-row"><span class="info-label">Change ' + esc(vsLabel) + '</span>'
        + '<span class="info-val ' + cls + '">' + sign + fmt(diff) + ' ' + unit + '</span></div>'
        + '<div class="info-row"><span class="info-label">Growth ' + esc(vsLabel) + '</span>'
        + '<span class="info-val ' + cls + '">' + arrow + ' ' + sign + rate.toFixed(2) + '%</span></div>';
}

// Min / max / mean rows for the area's 5-year series, shown alongside the
// sparkline. Skips years without data so gaps don't drag the stats down.
function buildStatsRowsHTML(row) {
    if (!row) return '';
    const P = trendPeriods();
    const entries = P.map(y => ({ yr: y, val: parseFloat(row[y]) || 0 })).filter(e => e.val > 0);
    if (entries.length < 2) return '';
    const fmt = fmtMetricValue;
    const unit = getActiveUnit();
    let minE = entries[0], maxE = entries[0], sum = 0;
    entries.forEach(e => {
        if (e.val < minE.val) minE = e;
        if (e.val > maxE.val) maxE = e;
        sum += e.val;
    });
    const mean = sum / entries.length;
    return '<div class="info-row"><span class="info-label">Lowest (' + esc(periodShort(minE.yr)) + ')</span><span class="info-val">' + fmt(minE.val) + ' ' + esc(unit) + '</span></div>'
         + '<div class="info-row"><span class="info-label">Highest (' + esc(periodShort(maxE.yr)) + ')</span><span class="info-val">' + fmt(maxE.val) + ' ' + esc(unit) + '</span></div>'
         // Year span only. The trend header immediately below already says how
         // many periods that covers ("11-Semester Trend"), and the full form
         // wrapped this row onto two lines in a 300px popup.
         + '<div class="info-row"><span class="info-label">Average (' + esc(String(P[0]).slice(0, 4)) + '\u2013' + esc(String(P[P.length - 1]).slice(0, 4)) + ')</span><span class="info-val">' + fmt(mean) + ' ' + esc(unit) + '</span></div>';
}

// Compact inline-SVG sparkline of the 5-year series. Reads at a glance:
// a colored "▲ +12.4% since 2021" summary, year labels under the chart,
// a shaded area under the line, and hover tooltips on each year's dot.
//
// Drawn over trendPeriods(), NOT YEARS: the partial annual column is a
// fraction of a year and belongs to no comparison. Including it did three
// separate kinds of damage at once — the header over-counted ("6-Year Trend"
// for five years of data), the summary compared a full 2021 against a single
// quarter of 2026 (Palay read "-78.0% since 2021" where the honest five-year
// figure is -1.7%), and the low outlier stretched the y-axis so the five real
// years collapsed into 0.6px of a 26px chart with a cliff on the end. The
// shape the user actually saw was an artifact of the axis, not the crop.
function buildSparklineHTML(row) {
    if (!row) return '';
    const P = trendPeriods();
    const vals = P.map(y => parseFloat(row[y]) || 0);
    // Two points are the minimum for a line, and P.length >= 2 follows from
    // it — so the (P.length - 1) divisor below can never be zero.
    if (vals.filter(v => v > 0).length < 2) return '';

    // 248x56 in viewBox units, drawn at width:100% so it fills whatever the
    // popup gives it (min-width 290px less 32px of padding) and still scales
    // down on a narrow phone. It was 130x26 — half the available width and
    // barely a centimetre tall, which made a five-point series unreadable.
    // Everything below is expressed in w/h/pad, so the shape follows.
    const w = 248, h = 56, pad = 5;
    const max = Math.max(...vals), min = Math.min(...vals);
    const span = (max - min) || 1;
    const pts = vals.map((v, i) => [
        pad + (i / (P.length - 1)) * (w - pad * 2),
        h - pad - ((v - min) / span) * (h - pad * 2)
    ]);
    const line = pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const area = line + ' ' + (w - pad) + ',' + (h - 1) + ' ' + pad + ',' + (h - 1);

    const unit = getActiveUnit();
    const fmt = fmtMetricValue;
    const curIdx = P.indexOf(currentYear);
    // A bigger blue dot alone did not read as "you are here" — with 11 points
    // at 130px wide it is 3px of colour, and the only period TEXT on the chart
    // was the two end labels, so a chart of 2nd-semester data looked like a
    // chart about 1st semester. A full-height guide line plus a named caption
    // below says which point is selected in words, not just in colour.
    const guide = curIdx >= 0
        ? '<line x1="' + pts[curIdx][0].toFixed(1) + '" y1="1" x2="' + pts[curIdx][0].toFixed(1)
          + '" y2="' + (h - 1) + '" stroke="#2a91d8" stroke-width="1.3" stroke-dasharray="3 3" opacity="0.55"/>'
        : '';
    const dots = pts.map((p, i) =>
        '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (i === curIdx ? 4.6 : 2.4) + '" fill="' + (i === curIdx ? '#1c6fa8' : '#9db8cf') + '"'
        + (i === curIdx ? ' stroke="#fff" stroke-width="1.6"' : '') + '>'
        + '<title>' + periodShort(P[i]) + ': ' + (vals[i] > 0 ? fmt(vals[i]) + ' ' + unit : 'no data') + '</title></circle>'
    ).join('');

    // Overall change between the first and last years that actually have data
    const firstIdx = vals.findIndex(v => v > 0);
    let lastIdx = firstIdx;
    vals.forEach((v, i) => { if (v > 0) lastIdx = i; });
    const change = ((vals[lastIdx] - vals[firstIdx]) / vals[firstIdx]) * 100;
    const dir = change >= 0.05 ? 'up' : change <= -0.05 ? 'down' : 'flat';
    const changeCls = dir === 'up' ? 'growth-pos' : dir === 'down' ? 'growth-neg' : 'spark-flat';
    const changeTxt = dir === 'flat'
        ? 'steady since ' + periodShort(P[firstIdx])
        : (dir === 'up' ? '▲ +' : '▼ ') + change.toFixed(1) + '% since ' + periodShort(P[firstIdx]);

    return '<div class="info-spark">'
        // "22-Year Trend" would be a lie in quarter mode — the axis is however
        // many periods the active granularity has, not years.
        + '<div class="spark-head"><span class="info-label">' + P.length + '-'
        + (activeGranularity === 'annual' ? 'Year'
           : activeGranularity === 'quarter' ? 'Quarter' : 'Semester') + ' Trend</span>'
        + '<span class="spark-change ' + changeCls + '">' + changeTxt + '</span></div>'
        + '<div class="spark-chart">'
        + '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">'
        + '<polygon points="' + area + '" fill="rgba(42,145,216,0.10)"/>'
        + '<polyline points="' + line + '" fill="none" stroke="#2a91d8" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'
        + guide + dots + '</svg>'
        // Just the years at the ends. Two "1st SEM 2021" labels need ~120px of
        // a 130px chart and ran into each other; the caption underneath names
        // the exact period anyway, so repeating it here bought nothing.
        + '<div class="spark-years"><span>' + esc(String(P[0]).slice(0, 4)) + '</span>'
        + '<span>' + esc(String(P[P.length - 1]).slice(0, 4)) + '</span></div>'
        // The value is already the first row of this popup; repeating it here
        // pushed the caption onto three lines. The period NAME is the part the
        // chart was missing, so that is all this carries.
        // The selected period is off this chart whenever it is the partial one.
        // Dropping the caption there would be the worst of both worlds \u2014 the
        // popup would show a 2026 figure above a 2021-2025 chart with nothing
        // saying they are different spans \u2014 so the partial case gets a caption
        // of its own that names the year and says why it has no dot.
        + (curIdx >= 0
            ? '<div class="spark-current"><span class="spark-dot" aria-hidden="true"></span>'
              + 'Showing <b>' + esc(periodLabel(currentYear)) + '</b>'
              + (vals[curIdx] > 0 ? '' : ' \u00b7 no data')
              + '</div>'
            : partialYearNote(currentYear)
            ? '<div class="spark-current spark-partial">'
              + 'Showing <b>' + esc(periodLabel(currentYear)) + '</b>'
              + ' \u00b7 partial year, not plotted'
              + '</div>'
            : '')
        + '</div></div>';
}

function buildRegionPopupHTML(regionPcode, regionName, val, info) {
    const fmt = fmtMetricValue;
    const unit = getActiveUnit();
    const natTotal = getNationalTotal();
    const prevYear = getPrevYear();
    const regionRow = currentCropStats && currentCropStats[regionPcode];
    const sharePhil = natTotal > 0 && val ? ((val / natTotal) * 100).toFixed(2) : null;
    const growthHTML = buildGrowthHTML(val, regionRow, prevYear);
    const clsLabels = metricUsesAverageMode() ? { peak: 'Top-Producing', high: 'Above average', average: 'Near average', low: 'Below average', medHigh: 'Above average', medLow: 'Below average' }
                            : { peak: 'Peak Production', high: 'High Production', average: 'Average Production', low: 'Low Production', medHigh: 'High Production', medLow: 'Low Production' };
    const badgeCls = info ? info.cls : null;
    const badgeColor = badgeCls ? getColor(currentCropName, badgeCls) : null;
    const badgeStyle = badgeColor
        ? 'background:' + badgeColor + ';color:' + contrastText(badgeColor) + ';border:1.5px solid ' + darkenColor(badgeColor, 0.82)
        : '';

    return '<div class="info-popup">'
        + '<div class="info-popup-title">' + esc(regionName) + '</div>'
        + '<div class="info-popup-rows">'
        + (val
            ? '<div class="info-row"><span class="info-label">Production (' + esc(periodShort(currentYear)) + ')</span><span class="info-val">' + fmt(val) + ' ' + esc(unit) + '</span></div>'
            : '<div class="info-row"><i style="color:#aaa">No data for ' + esc(periodShort(currentYear)) + '</i></div>')
        + (sharePhil !== null
            ? '<div class="info-row"><span class="info-label">Share to Philippines</span><span class="info-val">' + sharePhil + '%</span></div>'
            : '')
        + growthHTML
        + buildStatsRowsHTML(regionRow)
        + buildSparklineHTML(regionRow)
        + (badgeCls ? '<div class="info-badge" style="' + badgeStyle + '">' + esc(clsLabels[badgeCls]) + '</div>' : '')
        + '</div></div>';
}

function buildProvincePopupHTML(provPcode, provinceName, regionPcode, regionName, val, info, aliasNote) {
    const fmt = fmtMetricValue;
    const unit = getActiveUnit();
    const natTotal = getNationalTotal();
    const prevYear = getPrevYear();
    const regionRow = currentCropStats && currentCropStats[regionPcode];
    const regionTotal = regionRow ? (parseFloat(regionRow[currentYear]) || 0) : 0;
    const shareRegion = regionTotal > 0 && val ? ((val / regionTotal) * 100).toFixed(2) : null;
    const sharePhil   = natTotal   > 0 && val ? ((val / natTotal)   * 100).toFixed(2) : null;
    const provRow = currentProvStats && currentProvStats[provPcode];
    const growthHTML = buildGrowthHTML(val, provRow, prevYear);
    const clsLabels = metricUsesAverageMode() ? { peak: 'Top-Producing', high: 'Above average', average: 'Near average', low: 'Below average', medHigh: 'Above average', medLow: 'Below average' }
                            : { peak: 'Peak Production', high: 'High Production', average: 'Average Production', low: 'Low Production', medHigh: 'High Production', medLow: 'Low Production' };
    const badgeCls = info ? info.cls : null;
    const badgeColor = badgeCls ? getColor(currentCropName, badgeCls) : null;
    const badgeStyle = badgeColor
        ? 'background:' + badgeColor + ';color:' + contrastText(badgeColor) + ';border:1.5px solid ' + darkenColor(badgeColor, 0.82)
        : '';

    return '<div class="info-popup">'
        + '<div class="info-popup-title">' + esc(provinceName) + '</div>'
        + '<div class="info-popup-subtitle">' + esc(regionName) + '</div>'
        + '<div class="info-popup-rows">'
        + (val
            ? '<div class="info-row"><span class="info-label">Production (' + esc(periodShort(currentYear)) + ')</span><span class="info-val">' + fmt(val) + ' ' + esc(unit) + '</span></div>'
            : '<div class="info-row"><i style="color:#aaa">No data for ' + esc(periodShort(currentYear)) + '</i></div>')
        + (regionTotal > 0
            ? '<div class="info-row"><span class="info-label">Regional Total (' + esc(periodShort(currentYear)) + ')</span><span class="info-val">' + fmt(regionTotal) + ' ' + esc(unit) + '</span></div>'
            : '')
        + (shareRegion !== null
            ? '<div class="info-row"><span class="info-label">Share to Region</span><span class="info-val">' + shareRegion + '%</span></div>'
            : '')
        + (sharePhil !== null
            ? '<div class="info-row"><span class="info-label">Share to Philippines</span><span class="info-val">' + sharePhil + '%</span></div>'
            : '')
        + growthHTML
        + buildStatsRowsHTML(provRow)
        + buildSparklineHTML(provRow)
        + (badgeCls ? '<div class="info-badge" style="' + badgeStyle + '">' + esc(clsLabels[badgeCls]) + '</div>' : '')
        + (aliasNote || '')
        + '</div></div>';
}

// ── 7. Boundary layers ───────────────────────────────────────────────────────
let boundaryLayer, cropLayer;
let baseShapes = null;
let baseShapesPre = null;
let baseShapes2026 = null;
let activeShapesRef = null;

const regionalStyle = { color: 'rgba(83,93,115,1.0)', weight: 1, fillOpacity: 0 };

// allSettled, not all: three files now instead of two, and with Promise.all a
// single failure left all three null and blanked the whole map — main view and
// catalogue illustration both — when two of the three had arrived fine. A
// missing 2026 vintage should cost you 2026's borders, not the atlas.
Promise.allSettled([
    fetch('data/boundaries/Admin_Boundary_Regional.json?v=' + BOUNDARY_VERSION).then(r => r.json()),
    fetch('data/boundaries/Admin_Boundary_Regional_pre2024.json?v=' + BOUNDARY_VERSION).then(r => r.json()),
    fetch('data/boundaries/Admin_Boundary_Regional_2026.json?v=' + BOUNDARY_VERSION).then(r => r.json())
]).then(function (results) {
    const NAMES = ['2024-2025', 'pre-2024', '2026'];
    const failed = [];
    results.forEach(function (res, i) {
        if (res.status === 'fulfilled') return;
        failed.push(NAMES[i]);
        console.error('Boundary load error (' + NAMES[i] + '):', res.reason);
    });
    baseShapes     = results[0].status === 'fulfilled' ? results[0].value : null;
    baseShapesPre  = results[1].status === 'fulfilled' ? results[1].value : null;
    baseShapes2026 = results[2].status === 'fulfilled' ? results[2].value : null;

    if (failed.length === results.length) {
        showDataError(loadFailureHint('map boundaries'));
    } else if (failed.length) {
        // Name the vintage: "boundaries failed" sends you looking at the map,
        // when the fix is one specific file.
        showDataError('Some map boundaries failed to load (' + failed.join(', ')
            + '). Those years fall back to the nearest available borders.');
    }
    drawBoundaryLayer();
    bootLoadDone();
});

// Three vintages of regional boundary, because the regions themselves changed
// twice inside the data range:
//   2021-2023  Negros Occidental sits in R6, Negros Oriental and Siquijor in
//              R7. NIR does not exist yet (see NIR_PROV_TO_PRE2024).
//   2024-2025  NIR exists. Sulu is still BARMM - PSA books Sulu's 2025 output
//              under BARMM, so moving it early would misattribute a province.
//   2026+      Sulu moves to Region IX, carrying a new PSGC code (1906600000
//              -> 0906600000; PROVINCE_PCODE_ALIASES normalises the pair).
// parseInt is deliberate: currentYear is '2026Q1' in the quarter/semester
// views, and parseInt('2026Q1') is 2026, so sub-annual periods land on the
// right vintage without a separate branch.
function getActiveShapes() {
    const y = parseInt(currentYear);
    // Preference order per era, then fall through to whatever did load. The
    // fallback matters because these are ~50 MB files on a public site: one
    // slow or failed request should degrade the borders for those years, not
    // leave the map and the catalogue illustration blank.
    const order = y >= 2026 ? [baseShapes2026, baseShapes, baseShapesPre]
                : y >= 2024 ? [baseShapes, baseShapes2026, baseShapesPre]
                            : [baseShapesPre, baseShapes, baseShapes2026];
    return order.find(function (s) { return s; }) || null;
}

function drawBoundaryLayer() {
    const shapes = getActiveShapes();
    if (!shapes) return;
    if (boundaryLayer) map.removeLayer(boundaryLayer);
    boundaryLayer = L.geoJson(shapes, {
        pane: 'boundaryPane',
        style: regionalStyle,
        interactive: false
    }).addTo(map);
    activeShapesRef = shapes;
    renderRegionLabels(boundaryLayer);
}

// Shortens a region's full ADM1_EN name to what fits on the map:
// abbreviations in parentheses win ("...( BARMM)" → "BARMM"), numbered
// regions collapse to just the numeral ("Region IX" → "IX"), everything
// else (Mimaropa) falls through.
function regionShortLabel(name) {
    if (!name) return '';
    const abbr = name.match(/\(([A-Z]+)\)\s*$/);
    if (abbr) return abbr[1];
    const numbered = name.match(/^Region\s+([IVXL]+-?[A-Z]?)/i);
    if (numbered) return numbered[1];
    return name.replace(/\s+Region$/i, '').toUpperCase();
}

// Signed area (shoelace) + area-weighted centroid of one [lng,lat] ring.
// Used to find each region's biggest landmass — a plain bounding-box center
// (the previous approach) regularly falls in open water for archipelagic
// regions, since it's the midpoint of the whole feature's envelope, not a
// point actually inside any of its islands.
function ringCentroid(ring) {
    let area = 0, cx = 0, cy = 0;
    for (let i = 0; i < ring.length; i++) {
        const p0 = ring[i], p1 = ring[(i + 1) % ring.length];
        const cross = p0[0] * p1[1] - p1[0] * p0[1];
        area += cross;
        cx += (p0[0] + p1[0]) * cross;
        cy += (p0[1] + p1[1]) * cross;
    }
    area *= 0.5;
    if (Math.abs(area) < 1e-9) {
        // Degenerate ring (near-zero area) — fall back to a plain vertex average
        const n = ring.length || 1;
        const sum = ring.reduce((s, p) => [s[0] + p[0], s[1] + p[1]], [0, 0]);
        return { lng: sum[0] / n, lat: sum[1] / n, area: 0 };
    }
    return { lng: cx / (6 * area), lat: cy / (6 * area), area: Math.abs(area) };
}

// For MultiPolygon regions (Mimaropa's scattered islands, Region IX's
// peninsula-plus-islands, …) this picks the biggest sub-polygon's own
// centroid — reliably solid ground — instead of the whole feature's
// bounding-box center, which can land in the sea between the pieces.
// Interior rings (holes) are ignored; irrelevant for label placement.
function featureLandCentroid(geometry) {
    const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
    let best = null;
    polygons.forEach(function (rings) {
        const c = ringCentroid(rings[0]);
        if (!best || c.area > best.area) best = c;
    });
    return L.latLng(best.lat, best.lng);
}

let regionLabelsLayer = null;

// One label per region polygon, positioned on its largest landmass. Only
// meaningful in the national (unfocused) view — hidden while drilled into a
// region's provinces (toggleRegionLabels). Rebuilt whenever drawBoundaryLayer
// runs, since the active shape set (and so each region's geometry) can change
// at the 2024 NIR cutover.
function renderRegionLabels(fromLayer) {
    if (regionLabelsLayer) map.removeLayer(regionLabelsLayer);
    const markers = [];
    fromLayer.eachLayer(function (l) {
        const label = regionShortLabel(l.feature.properties.ADM1_EN);
        if (!label) return;
        // BARMM keeps its original bounding-box center — its islands (Basilan,
        // Sulu, Tawi-Tawi) plus mainland pieces are similar enough in size
        // that the "largest landmass" pick moved the label somewhere worse
        const center = l.feature.properties.ADM1_PCODE === '1900000000'
            ? l.getBounds().getCenter()
            : featureLandCentroid(l.feature.geometry);
        markers.push(L.marker(center, {
            pane: 'regionLabelPane',
            interactive: false,
            keyboard: false,
            icon: L.divIcon({
                className: 'region-label-icon',
                html: '<span class="region-label-text">' + esc(label) + '</span>',
                iconSize: [0, 0]
            })
        }));
    });
    regionLabelsLayer = L.layerGroup(markers);
    if (!focusedPcode) regionLabelsLayer.addTo(map);
}

function toggleRegionLabels(show) {
    if (!regionLabelsLayer) return;
    if (show) regionLabelsLayer.addTo(map);
    else map.removeLayer(regionLabelsLayer);
}

function updateBoundaryLayer() {
    if (!baseShapes || !baseShapesPre || !baseShapes2026) return;
    if (activeShapesRef !== getActiveShapes()) drawBoundaryLayer();
}

let provincialLayer = null, provincialShapes = null;
let provinceFeatureIndex = null; // ADM2_PCODE → feature, saves linear scans in hot paths
// Nothing waits on this any more. The catalogue used to, because aggregating
// provincial rows into regions needed provinceFeatureIndex — but the PSGC
// parent table now answers that in ~5 KB, so the catalogue gates on the table
// instead of on 42 MB of polygons. This layer is still needed for the drawn
// provincial boundaries and the province picker, both of which already handle
// its absence.
fetch('data/boundaries/Admin_Provincial_Boundary.json?v=' + BOUNDARY_VERSION)
    .then(r => r.json())
    .then(data => {
        provincialShapes = data;
        provinceFeatureIndex = {};
        data.features.forEach(f => { provinceFeatureIndex[f.properties.ADM2_PCODE] = f; });
        provincialLayer = L.geoJson(provincialShapes, {
            pane: 'provincialPane',
            style: { color: 'rgba(60,70,95,0.7)', weight: 1.5, fillOpacity: 0, opacity: 0 },
            interactive: false
        }).addTo(map);
        bootLoadDone();
    })
    .catch(err => {
        console.error('Provincial boundary load error:', err);
        showDataError(loadFailureHint('province boundaries'));
    });

// ── Helpers ──────────────────────────────────────────────────────────────────
function hideProvincialLayer() {
    if (provincialLayer) provincialLayer.eachLayer(l => l.setStyle({ opacity: 0, weight: 0 }));
}

function resetBoundaryStyle() {
    if (boundaryLayer) boundaryLayer.eachLayer(l => l.setStyle({ color: 'rgba(83,93,115,1.0)', weight: 0.4, opacity: 1 }));
}

function clearProvincialDataLayer() {
    if (provincialDataLayer) { map.removeLayer(provincialDataLayer); provincialDataLayer = null; }
    currentProvClsMap = {};
    focusedRegionName = null;
    selectedProvLayer = null;
}

function colorToRgba(hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
}

// Darkened shade of a class color, used for selection borders
function darkenColor(hex, factor) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * factor);
    const g = Math.round(((n >> 8) & 255) * factor);
    const b = Math.round((n & 255) * factor);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// Returns white or dark text depending on background luminance
function contrastText(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.55 ? darkenColor(hex, 0.38) : '#ffffff';
}

// Drop-shadow "lift" on the selected polygon for a pseudo-3D look
function elevate(layer, on) {
    const el = layer.getElement && layer.getElement();
    if (el) el.classList.toggle('path-elevated', on);
}

// ── 8. Classification ────────────────────────────────────────────────────────
// Shared inner logic — takes a stats object (keyed by pcode) and a list of pcodes to classify.
// useTopBottom: true (regions) → 5-tier: peak / high / average / low / noData
//               false (provinces) → 2-tier: medHigh (above avg) / medLow (below avg)
// Half-width of the "near average" band, as a fraction of the average.
const NEAR_AVERAGE_TOLERANCE = 0.10;

// Metrics that get no rank-based "Top-Producing" band, so every area is read
// purely against the average. Everything in "average mode" moves together —
// the Peak band is dropped, the ±10% near-average band applies, and the labels
// become average-relative (Above/Near/Below average) instead of Peak/High/
// Average/Low Production.
//
// SCOPE: the ADDITIVE COUNT metrics — Volume (MT), Area Harvested (HA) and
// Bearing Trees (trees). The RATIO metrics — Yield (MT/HA) and Yield per Tree
// (MT/tree) — keep the original Peak/High/Average/Low Production labels and
// the original banding.
//
// That split is the rule; do not re-derive it from the older "Volume only"
// note this comment replaced. Volume came first, for its own reason: its
// ranking is already stated twice over (the legend's Top 5 and the Top 10
// catalogue below the map), so a third rank-based band said nothing new.
// Area and Trees were added later on a different and simpler ground — the
// word "Production" is plainly wrong over hectares and tree counts, and
// jayve asked for Volume's treatment there verbatim, near-average band
// included ("no production but copy what you do in volume there is near
// aver"). Accepting that means accepting the lost Peak band; jayve confirmed
// the consequence ("yes no peak … just the peak color = above ave"), which is
// exactly what happens — a former peak area falls to 'high'/'medHigh' and
// takes palette[3] instead of the darkest palette[4].
//
// What must NOT happen again is the whole set moving at once: this was applied
// to every metric by mistake once, Yield and Yield/Tree included, and had to be
// scoped back. Ratio metrics are not in this list on purpose.
const AVERAGE_MODE_METRICS = ['volume', 'area', 'trees'];

function metricUsesAverageMode() {
    return AVERAGE_MODE_METRICS.indexOf(activeMetric) !== -1;
}

function metricUsesPeakBand() {
    return !metricUsesAverageMode();
}

function classifyEntries(statsByPcode, pcodes, useTopBottom, thresholdAvg) {
    const entries = [];
    pcodes.forEach(pcode => {
        const val = statsByPcode[pcode] ? (parseFloat(statsByPcode[pcode][currentYear]) || 0) : 0;
        if (val > 0) entries.push({ pcode, val });
    });
    // Nothing reported for this period. counts/rangeStrings must still carry
    // EVERY class rather than being bare {}: renderLegend() skips a band with
    // `counts[cls] === 0`, and `undefined === 0` is false, so an empty object
    // let three bands through with no range and no count behind them —
    // "Above average / above the national average" and not a number in sight.
    // Mango Bearing Trees at 2026 is the case that surfaced it.
    if (!entries.length) {
        const zero = {}, blank = {};
        ['peak', 'high', 'average', 'low', 'medHigh', 'medLow'].forEach(function (c) {
            zero[c] = 0;
            blank[c] = '';
        });
        return { clsMap: {}, avg: 0, total: 0, noDataCount: pcodes.length, rangeStrings: blank, counts: zero };
    }

    entries.sort((a, b) => a.val - b.val);
    const n = entries.length;
    const avg = entries.reduce((s, e) => s + e.val, 0) / n;

    const clsMap = {};
    if (useTopBottom) {
        // Regional 5-tier classification
        // Peak = top 3 by value (rank-based), unless this metric opts out
        const peakCount = metricUsesPeakBand() ? Math.min(3, n) : 0;
        const peakSet = new Set(
            [...entries].sort((a, b) => b.val - a.val).slice(0, peakCount).map(e => e.pcode)
        );
        // A band around the average, not exact equality. Equality fired in 1 of
        // 727 crop/metric/year combinations — and that one only because PSA
        // rounds Banana Cardava's yield/tree to 2 decimals — so palette[2], the
        // middle colour, was effectively dead. NEAR_AVERAGE_TOLERANCE brings it
        // back for values within 10% of the average. Production is heavily
        // right-skewed, so the band still stands empty about half the time; the
        // legend already skips a class with no members.
        // Outside average mode the original 1e-6 equality test stands, so the
        // other four metrics behave exactly as they did.
        const band = metricUsesAverageMode() ? avg * NEAR_AVERAGE_TOLERANCE : 1e-6;
        entries.forEach(e => {
            let cls;
            if (peakSet.has(e.pcode))                 cls = 'peak';
            else if (Math.abs(e.val - avg) <= band)   cls = 'average';
            else if (e.val > avg)                     cls = 'high';
            else                                      cls = 'low';
            clsMap[e.pcode] = { cls, val: e.val };
        });
    } else {
        // Provincial 3-tier: peak (top 1 within region) / above national avg / below national avg
        const split = thresholdAvg || avg;
        const peakCount = metricUsesPeakBand() ? Math.min(1, n) : 0;
        const peakSet = new Set(
            [...entries].sort((a, b) => b.val - a.val).slice(0, peakCount).map(e => e.pcode)
        );
        // The middle band is new here — the provincial view had none — so it
        // exists only in average mode. Elsewhere this stays a strict 2-way split.
        const band = metricUsesAverageMode() ? split * NEAR_AVERAGE_TOLERANCE : -1;
        entries.forEach(e => {
            let cls;
            if (peakSet.has(e.pcode))                   cls = 'peak';
            else if (Math.abs(e.val - split) <= band)   cls = 'average';
            else if (e.val >= split)                    cls = 'medHigh';
            else                                        cls = 'medLow';
            clsMap[e.pcode] = { cls, val: e.val };
        });
    }

    const buckets = { peak: [], high: [], average: [], low: [], medHigh: [], medLow: [] };
    Object.values(clsMap).forEach(({ cls, val }) => buckets[cls].push(val));

    const fmt = fmtMetricValue;
    const rangeStr = arr => {
        if (!arr.length) return '';
        const mn = Math.min(...arr), mx = Math.max(...arr);
        const u = getActiveUnit();
        return mn === mx ? fmt(mn) + ' ' + u : fmt(mn) + ' – ' + fmt(mx) + ' ' + u;
    };

    let noDataCount = 0;
    pcodes.forEach(pcode => {
        if ((statsByPcode[pcode] ? (parseFloat(statsByPcode[pcode][currentYear]) || 0) : 0) === 0) noDataCount++;
    });

    const total = entries.reduce((s, e) => s + e.val, 0);

    return {
        clsMap, avg, total, noDataCount,
        rangeStrings: {
            peak:    rangeStr(buckets.peak),
            high:    rangeStr(buckets.high),
            average: rangeStr(buckets.average),
            low:     rangeStr(buckets.low),
            medHigh: rangeStr(buckets.medHigh),
            medLow:  rangeStr(buckets.medLow)
        },
        counts: {
            peak:    buckets.peak.length,
            high:    buckets.high.length,
            average: buckets.average.length,
            low:     buckets.low.length,
            medHigh: buckets.medHigh.length,
            medLow:  buckets.medLow.length
        }
    };
}

function classifyRegions(cropStats) {
    // Use every region in the currently active boundary set, not just
    // Object.keys(cropStats) — a region absent from the crop's data
    // entirely (e.g. NCR with zero reported rows) would otherwise never get
    // a bucket in aggregateProvToRegional, silently dropping it from the
    // classification universe instead of counting it as "No Data".
    const shapes = getActiveShapes();
    const allPcodes = shapes
        ? [...new Set(shapes.features.map(f => f.properties.ADM1_PCODE))]
        : Object.keys(cropStats);
    return classifyEntries(cropStats, allPcodes, true);
}

function classifyProvincesInRegion(provStats, regionPcode, nationalAvg) {
    if (!provincialShapes) return { clsMap: {}, avg: 0, total: 0, noDataCount: 0, rangeStrings: {}, counts: {} };
    const pcodes = [...new Set(provincialShapes.features
        .filter(f => provinceParentRegion(f.properties) === regionPcode)
        .map(f => effectiveProvincePcode(f.properties.ADM2_PCODE)))];
    return classifyEntries(provStats, pcodes, false, nationalAvg);
}

// ── 9. Color from class ──────────────────────────────────────────────────────
function getColor(cropName, cls) {
    const palette = (cropConfig[cropName] || {}).palette || ['#fefae8', '#d0e8d0', '#80c080', '#309030', '#106010'];
    // Average mode assigns no 'peak', so palette[4] — the darkest tone — would
    // simply go unused and the top of the map would visibly lighten: the highest
    // areas would be drawn in palette[3], the shade that means "second tier"
    // everywhere else. The top band inherits the darkest colour instead, so the
    // strongest areas keep reading as the strongest whatever the band is called.
    // jayve: "just the peak color = above ave".
    //
    // This is why the swatch is picked here and not from the class-to-index map
    // below: every consumer — map polygons, popup badges, legend swatches — goes
    // through getColor(), so the legend cannot disagree with the map.
    if (metricUsesAverageMode() && (cls === 'high' || cls === 'medHigh')) return palette[4];
    return palette[{ noData: 0, low: 1, medLow: 1, average: 2, medHigh: 3, high: 3, peak: 4 }[cls] ?? 0];
}

// ── 10. Focus state ──────────────────────────────────────────────────────────
// Popups bound + opened immediately after flyToBounds/flyTo were being
// positioned against the CAMERA'S PRE-FLIGHT view — autoPan (or fixed
// padding) is a one-time calculation, but the map keeps animating for
// another ~1s afterward, so the popup could settle with its top cut off
// above the viewport once the flight actually finished. Deferring the open
// until the flight's 'moveend' fixes it; the pending-open guard means a
// second click (interrupting the first flight) discards the first popup
// instead of both firing off the second flight's single 'moveend'.
let pendingPopupOpen = null;
function openPopupAfterFly(openFn) {
    if (pendingPopupOpen) map.off('moveend', pendingPopupOpen);
    pendingPopupOpen = function () {
        pendingPopupOpen = null;
        openFn();
    };
    map.once('moveend', pendingPopupOpen);
}

function focusRegion(feature, layer) {
    const pcode = feature.properties.ADM1_PCODE;
    const regionName = feature.properties.ADM1_EN;
    if (focusedPcode === pcode) { resetFocus(); return; }

    // Clear any previous provincial data layer before setting new focus
    clearProvincialDataLayer();

    focusedPcode = pcode;
    focusedRegionName = regionName;
    toggleRegionLabels(false);
    // Cinematic swooping flight instead of a flat zoom
    map.flyToBounds(layer.getBounds(), {
        paddingTopLeft: isMobileView() ? [30, 30] : [60, 60],
        // extra bottom padding keeps the region clear of the mobile bottom sheet
        paddingBottomRight: isMobileView() ? [30, 180] : [60, 60],
        maxZoom: 9, duration: 1.2, easeLinearity: 0.2
    });

    applyRegionFocusStyles(pcode, regionName);
}

// Styles the focused region and renders its provincial choropleth without
// moving the camera — shared by focusRegion and the year-change focus restore.
function applyRegionFocusStyles(pcode, regionName) {
    const hasProvData = !!(currentProvStats && provConfig[currentCropName]);
    // Selection border takes a darkened shade of the region's class color
    const focusInfo = currentClsMap[pcode];
    const focusBorder = focusInfo
        ? darkenColor(getColor(currentCropName, focusInfo.cls), 0.55)
        : '#8a93a3';

    if (cropLayer) {
        cropLayer.eachLayer(function (l) {
            const fp = l.feature.properties.ADM1_PCODE;
            const info = currentClsMap[fp];
            const color = info ? getColor(currentCropName, info.cls) : getColor(currentCropName, 'noData');
            if (fp === pcode) {
                l.setStyle({
                    fillColor: color,
                    // Hide regional fill when provincial choropleth will replace it
                    fillOpacity: hasProvData ? 0 : 0.95,
                    weight: 3,
                    color: focusBorder,
                    opacity: 1
                });
                l.bringToFront();
                elevate(l, true);
            } else {
                l.setStyle({ fillColor: 'transparent', fillOpacity: 0, weight: 0 });
                elevate(l, false);
            }
        });
    }

    if (boundaryLayer) {
        boundaryLayer.eachLayer(function (l) {
            const fp = l.feature.properties.ADM1_PCODE;
            l.setStyle(fp === pcode
                ? { color: focusBorder, weight: 2.5, opacity: 1 }
                : { color: 'rgba(83,93,115,0.25)', weight: 0.4, opacity: 1 });
        });
    }

    if (provincialLayer) {
        provincialLayer.eachLayer(function (l) {
            const belongs = provinceParentRegion(l.feature.properties) === pcode;
            l.setStyle(belongs
                ? { opacity: 1, weight: 2, color: 'rgba(60,70,95,0.75)' }
                : { opacity: 0, weight: 0 });
        });
    }

    if (hasProvData) renderProvincialChoropleth(pcode, regionName);
    updateBreadcrumb();
    updateUrlHash();
}

// ── Breadcrumb (bottom-center) — shows drill-down level, click to zoom out ──
function updateBreadcrumb() {
    const bc = document.getElementById('breadcrumb');
    if (focusedPcode && focusedRegionName) {
        document.getElementById('breadcrumb-path').textContent =
            'Philippines › ' + focusedRegionName;
        bc.hidden = false;
    } else {
        bc.hidden = true;
    }
}

// Re-applies focus to the same region after the map re-renders on a year
// change. Bails silently if the region doesn't exist in the new year's
// boundaries (e.g. NIR before 2024).
function restoreFocus(pcode, regionName) {
    if (!cropLayer) return;
    let target = null;
    cropLayer.eachLayer(function (l) {
        if (l.feature.properties.ADM1_PCODE === pcode) target = l;
    });
    if (!target) return;
    focusedPcode = pcode;
    focusedRegionName = regionName;
    toggleRegionLabels(false);
    applyRegionFocusStyles(pcode, regionName);
}

function renderProvincialChoropleth(regionPcode, regionName) {
    if (!currentProvStats || !provincialShapes) return;

    const allProvVals = Object.values(currentProvStats)
        .map(row => parseFloat(row[currentYear]) || 0).filter(v => v > 0);
    const nationalProvAvg = allProvVals.length
        ? allProvVals.reduce((s, v) => s + v, 0) / allProvVals.length : 0;
    // The denominator of that average — every province in the country carrying
    // a value, not the handful belonging to the focused region. The legend
    // states this alongside the figure so the two agree.
    const nationalProvCount = allProvVals.length;

    const classification = classifyProvincesInRegion(currentProvStats, regionPcode, nationalProvAvg);
    currentProvClsMap = classification.clsMap;

    provincialDataLayer = L.geoJson(provincialShapes, {
        pane: 'provDataPane',
        // Only this region's provinces go in the layer. Non-members used to be
        // rendered invisible instead, but zero-opacity SVG fills still capture
        // clicks — they blanketed neighboring polygons in dead zones (e.g.
        // Basilan/Sulu over the BARMM islands).
        filter: function (feature) {
            return provinceParentRegion(feature.properties) === regionPcode;
        },
        style: function (feature) {
            const pcode = effectiveProvincePcode(feature.properties.ADM2_PCODE);
            const info = classification.clsMap[pcode];
            const color = info ? getColor(currentCropName, info.cls) : getColor(currentCropName, 'noData');
            return { fillColor: color, weight: 0, fillOpacity: info ? layerOpacity : 0.15 };
        },
        onEachFeature: function (feature, layer) {
            const pcode = effectiveProvincePcode(feature.properties.ADM2_PCODE);
            // "Reported under parent" note only applies to split provinces —
            // compare against the re-homing-normalized code so a renamed pcode
            // (Sulu) doesn't read as reporting under itself
            const normPcode = PROVINCE_PCODE_ALIASES[feature.properties.ADM2_PCODE] || feature.properties.ADM2_PCODE;
            const aliased = pcode !== normPcode;
            const info = classification.clsMap[pcode];
            const val = info ? info.val : null;

            layer.on('mouseover', function () {
                if (layer === selectedProvLayer) return; // keep selection border intact
                layer.setStyle({ weight: 1.5, color: '#ffffff', opacity: 0.8 });
            });
            layer.on('mouseout', function () {
                if (layer === selectedProvLayer) return;
                layer.setStyle({ weight: 0, opacity: 0 });
            });
            layer.on('popupclose', function () {
                if (selectedProvLayer === layer) {
                    layer.setStyle({ weight: 0, opacity: 0 });
                    elevate(layer, false);
                    selectedProvLayer = null;
                    // Restore other provinces to their full color
                    if (provincialDataLayer) {
                        provincialDataLayer.eachLayer(function (l) {
                            if (provinceParentRegion(l.feature.properties) !== regionPcode) return;
                            const lPcode = effectiveProvincePcode(l.feature.properties.ADM2_PCODE);
                            const lInfo = classification.clsMap[lPcode];
                            l.setStyle({ fillOpacity: lInfo ? layerOpacity : 0.15 });
                        });
                    }
                }
            });
            layer.on('click', function (e) {
                L.DomEvent.stopPropagation(e);
                if (selectedProvLayer && selectedProvLayer !== layer) {
                    elevate(selectedProvLayer, false);
                }
                selectedProvLayer = layer;
                const provBorder = info
                    ? darkenColor(getColor(currentCropName, info.cls), 0.55)
                    : '#8a93a3';
                layer.setStyle({ weight: 2.5, color: provBorder, opacity: 1 });
                layer.bringToFront();
                elevate(layer, true);
                // Make other provinces in the region transparent (fill only —
                // the province boundary lines from provincialLayer stay visible)
                if (provincialDataLayer) {
                    provincialDataLayer.eachLayer(function (l) {
                        if (l !== layer && provinceParentRegion(l.feature.properties) === regionPcode) {
                            l.setStyle({ fillOpacity: 0 });
                        }
                    });
                }
                map.flyToBounds(layer.getBounds(), {
                    paddingTopLeft: isMobileView() ? [40, 40] : [80, 80],
                    paddingBottomRight: isMobileView() ? [40, 190] : [80, 80],
                    maxZoom: 10, duration: 0.9
                });
                const parentName = aliased && currentProvStats[pcode]
                    ? currentProvStats[pcode].Province
                    : feature.properties.Province;
                const aliasNote = aliased
                    ? '<div class="info-alias">' + feature.properties.Province + ' reported under ' + parentName + ' in ' + periodLabel(currentYear) + '</div>'
                    : '';
                openPopupAfterFly(function () {
                    layer.bindPopup(
                        buildProvincePopupHTML(pcode, parentName, regionPcode, regionName, val, info, aliasNote),
                        { autoPan: true, autoPanPaddingTopLeft: [20, 20], autoPanPaddingBottomRight: [20, 20], maxWidth: popupMaxWidth() }
                    ).openPopup();
                });
            });
        }
    }).addTo(map);

    renderLegend(currentCropName, classification, regionName, nationalProvAvg, nationalProvCount);
}

function resetFocus() {
    focusedPcode = null;
    focusedRegionName = null;
    toggleRegionLabels(true);
    updateBreadcrumb();
    updateUrlHash();
    map.flyTo([12.8797, 121.7740], 6, { animate: true, duration: 0.8 });

    clearProvincialDataLayer();

    if (cropLayer && currentCropStats && currentCropName) {
        cropLayer.eachLayer(function (l) {
            const fp = l.feature.properties.ADM1_PCODE;
            const info = currentClsMap[fp];
            const color = info ? getColor(currentCropName, info.cls) : getColor(currentCropName, 'noData');
            l.setStyle({ fillColor: color, fillOpacity: info ? layerOpacity : 0, weight: 0, color: 'transparent', opacity: 0 });
            elevate(l, false);
        });
        // Restore regional legend
        const classification = classifyRegions(currentCropStats);
        renderLegend(currentCropName, classification);
    }

    resetBoundaryStyle();
    hideProvincialLayer();
}

map.on('click', function () { if (focusedPcode) resetFocus(); });

// ── 11. Render choropleth ────────────────────────────────────────────────────
function renderMap(cropStats, cropName, clsMap) {
    if (cropLayer) map.removeLayer(cropLayer);
    if (!getActiveShapes()) return;
    focusedPcode = null;
    toggleRegionLabels(true); // a fresh crop/metric render always starts at national view
    updateBreadcrumb();
    clearProvincialDataLayer();
    currentCropStats = cropStats;
    currentCropName = cropName;
    currentClsMap = clsMap;
    resetBoundaryStyle();
    hideProvincialLayer();

    cropLayer = L.geoJson(getActiveShapes(), {
        pane: 'cropPane',
        style: function (feature) {
            const fp = feature.properties.ADM1_PCODE;
            const info = clsMap[fp];
            const color = info ? getColor(cropName, info.cls) : getColor(cropName, 'noData');
            return { fillColor: color, weight: 0, fillOpacity: info ? layerOpacity : 0 };
        },
        onEachFeature: function (feature, layer) {
            const fp = feature.properties.ADM1_PCODE;
            const info = clsMap[fp];
            const val = info ? info.val : null;
            layer.on('mouseover', function () {
                if (focusedPcode) return; // keep the class-colored selection border intact
                layer.setStyle({ weight: 1.5, color: '#ffffff', opacity: 0.8 });
            });
            layer.on('mouseout', function () {
                if (focusedPcode) return;
                layer.setStyle({ weight: 0, opacity: 0 });
            });
            layer.on('click', function (e) {
                L.DomEvent.stopPropagation(e);
                focusRegion(feature, layer);
                if (focusedPcode === fp) {
                    openPopupAfterFly(function () {
                        layer.bindPopup(
                            buildRegionPopupHTML(fp, feature.properties.ADM1_EN, val, info),
                            isMobileView()
                                // panel sits at the bottom on phones — pad below, not to the right
                                ? { autoPan: true, autoPanPaddingTopLeft: [20, 20], autoPanPaddingBottomRight: [20, 170], maxWidth: popupMaxWidth() }
                                : { autoPan: true, autoPanPaddingTopLeft: [60, 60], autoPanPaddingBottomRight: [310, 60], maxWidth: 340 }
                        ).openPopup();
                    });
                }
            });
        }
    }).addTo(map);
}

// ── Display-name lookups (boundary shapes are the source of truth) ───────────
// Published PSGC parent codes, built from the 2026 boundary drop by
// tools/build_psgc_parents.py: { regions: {pcode: name}, parents: {province or
// city pcode: region pcode} }. Geometry stripped, so it is ~5 KB against the
// 42 MB provincial boundary — which is the point. Resolving a province's
// parent region used to require that 42 MB file, and when it had not arrived
// provinceRegionPcode() sliced the PSGC string instead: arithmetic on an
// identifier rather than a lookup. These are the codes PSA publishes
// (Region_PSGC_Code / Province_PSGC_Code / City_PSGC_Code), re-keyed by the
// generator to the vintage this project and every data CSV join on.
var psgcParents = null;   // pcode -> region pcode
var psgcRegionNames = null;   // region pcode -> name
var psgcParentsReady = fetch('data/boundaries/psgc_parents_2026.json?v=' + DATA_VERSION)
    .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
    })
    .then(function (d) { psgcParents = d.parents || {}; psgcRegionNames = d.regions || {}; })
    .catch(function (err) {
        // Not fatal: provinceRegionPcode() still has the boundary index and
        // the prefix fallback behind this. Worth a console line, not a banner.
        console.error('PSGC parent table load error:', err);
    });

function regionDisplayName(pcode) {
    const shapes = getActiveShapes();
    const f = shapes && shapes.features.find(f => f.properties.ADM1_PCODE === pcode);
    // The published Region_Name backs this up, so a region still reads as a
    // name while the ~103 MB of regional boundary GeoJSON is in flight.
    return f ? f.properties.ADM1_EN
             : ((psgcRegionNames && psgcRegionNames[pcode]) || pcode);
}

function provinceDisplayName(pcode) {
    const shapePcode = PROVINCE_PCODE_ALIASES_REV[pcode] || pcode;
    const f = provinceFeatureIndex && provinceFeatureIndex[shapePcode];
    if (f && f.properties.Province) return f.properties.Province;
    const row = currentProvStats && currentProvStats[pcode];
    return (row && row.Province) || pcode;
}

// ── Legend class highlighting ────────────────────────────────────────────────
// Hovering/tapping a legend row emphasizes that class's polygons and fades the
// rest. Works on the provincial layer when a region is focused, otherwise the
// regional layer. Inert in the focused-region-without-provincial-data state,
// where the other regions are already hidden.
// Picking "No data" used to leave the map looking uniformly empty — jayve:
// "when i click no data, its like all region has no data." The selection was
// right; it was invisible. The highlight rode entirely on fill opacity, and
// palette[0] — the No-data fill — is a near-white wash in all 83 palettes
// (#fefae8 in 41 crops, #f2f9d9 in 23, #f2f9e8 in 16). Raising those regions
// to full opacity painted them in a colour indistinguishable from the basemap
// while every other region faded to 0.08, so nothing stood out. Coloured
// classes never showed it, their fills being dark enough to carry it alone.
//
// So a matched no-data area is REPAINTED for the duration of the highlight.
// A desaturated slate, deliberately: it has to stay clear of every palette in
// use, and the warm greys collide with the brown ramps (Coconut runs #d7c6b6
// through #9e7956). Cool grey reads as "absent" and belongs to no crop.
//
// An earlier attempt outlined the picked class instead. It worked, and looked
// heavy — a 2.5px near-black ring over a pale basemap. Fill carries it with
// nothing drawn on top, so the choropleth stays strokeless as designed.
const NO_DATA_HIGHLIGHT_FILL = '#8d93a1';

// The style one polygon takes while `cls` is the highlighted class. Split out
// of highlightClass() so the decision is testable without a live Leaflet map.
// `info` is the area's classification entry, or undefined when it reported
// nothing, since classifyEntries() only records areas carrying a value.
// `restOpacity` is what a non-matching area fades to, which differs between the
// regional and provincial layers. `baseFill` is the area's normal colour, and
// is always returned when it is not being repainted — so releasing the
// highlight cannot strand a slate fill on a region that has data.
function highlightStyleFor(info, cls, opacity, restOpacity, baseFill) {
    const match = info ? info.cls === cls : cls === 'noData';
    return {
        fillOpacity: match ? opacity : restOpacity,
        fillColor: (match && !info) ? NO_DATA_HIGHLIGHT_FILL : baseFill
    };
}

function highlightClass(cls) {
    if (provincialDataLayer && focusedPcode) {
        provincialDataLayer.eachLayer(function (l) {
            if (provinceParentRegion(l.feature.properties) !== focusedPcode) return;
            const pcode = effectiveProvincePcode(l.feature.properties.ADM2_PCODE);
            const info = currentProvClsMap[pcode];
            const base = getColor(currentCropName, info ? info.cls : 'noData');
            l.setStyle(highlightStyleFor(info, cls, layerOpacity, 0.08, base));
        });
    } else if (cropLayer && !focusedPcode) {
        cropLayer.eachLayer(function (l) {
            const info = currentClsMap[l.feature.properties.ADM1_PCODE];
            const base = getColor(currentCropName, info ? info.cls : 'noData');
            l.setStyle(highlightStyleFor(info, cls, layerOpacity, info ? 0.08 : 0, base));
        });
    }
}

// Releasing the highlight must restore the fill COLOUR as well as the opacity.
// A no-data area repainted slate by highlightClass() would otherwise keep that
// slate over a map that is no longer filtered — invisible while its opacity is
// 0, but it would surface the moment anything raised it again.
function clearClassHighlight() {
    if (provincialDataLayer && focusedPcode) {
        provincialDataLayer.eachLayer(function (l) {
            if (provinceParentRegion(l.feature.properties) !== focusedPcode) return;
            const pcode = effectiveProvincePcode(l.feature.properties.ADM2_PCODE);
            const info = currentProvClsMap[pcode];
            l.setStyle({
                fillOpacity: info ? layerOpacity : 0.15,
                fillColor: getColor(currentCropName, info ? info.cls : 'noData')
            });
        });
    } else if (cropLayer && !focusedPcode) {
        cropLayer.eachLayer(function (l) {
            const info = currentClsMap[l.feature.properties.ADM1_PCODE];
            l.setStyle({
                fillOpacity: info ? layerOpacity : 0,
                fillColor: getColor(currentCropName, info ? info.cls : 'noData')
            });
        });
    }
}

// ── 12. Render legend ────────────────────────────────────────────────────────
// scope: undefined = national (regions), string = regional name (provinces)
// `overrideAvg` is the national province average used as the threshold while a
// region is focused; `overrideAvgAreas` is how many provinces it was computed
// over. The pair travels together — a threshold without its denominator is
// what produced "58,655.28 MT across 6 provinces" for a figure taken over 80.
function renderLegend(cropName, classification, scope, overrideAvg, overrideAvgAreas) {
    if (!cropConfig[cropName]) return;
    // A pinned legend class survives re-renders of the same view — that's what
    // keeps it locked while scrubbing or playing through years. It clears when
    // the crop, metric, or scope (national vs. a region's provinces) changes.
    const renderKey = cropName + '|' + activeMetric + '|' + (typeof scope === 'string' ? scope : '');
    if (stickyHighlightKey !== renderKey) stickyHighlightCls = null;
    stickyHighlightKey = renderKey;
    document.getElementById('legend-title').textContent = cropName.replace(/^Overall\s+/i, '');

    const scopeLabel = typeof scope === 'string' ? scope : null;
    const unitLabel = scopeLabel ? 'provinces' : 'regions';
    const unitSingular = scopeLabel ? 'province' : 'region';
    // The national figure is national whatever the map is zoomed into, so it is
    // computed from every province rather than from `classification`, which
    // holds only the entries currently on screen. overrideAvg is still honoured
    // for the focused provincial view's own threshold elsewhere; it no longer
    // decides this line.
    const figure = nationalFigureForActiveMetric(cropName);
    // The source line hard-codes 2021-2025, which stops being true the moment
    // a sub-annual view reaches into 2026. Take the span from whatever period
    // list is actually loaded.
    const srcEl = document.getElementById('legend-source');
    if (srcEl) {
        const a = String(YEARS[0]).slice(0, 4);
        const b = String(YEARS[YEARS.length - 1]).slice(0, 4);
        srcEl.textContent = 'Data: Philippine Statistics Authority (PSA) · '
            + (a === b ? a : a + '–' + b);
    }
    // Spell the threshold out. "Above average" is only meaningful if the reader
    // can see which number it is above, and for Volume the line above states a
    // national TOTAL — so without this the average is never shown at all.
    const thrEl = document.getElementById('legend-threshold');
    if (thrEl) {
        const useNational = overrideAvg != null && scopeLabel;
        const thr = useNational ? overrideAvg : classification.avg;
        // The count must be the one the AVERAGE DIVIDES BY, not the number of
        // areas on screen. Focus a region and those stop being the same thing:
        // the threshold becomes nationalProvAvg, taken over every reporting
        // province in the country, while the classification holds only the
        // provinces of that one region. Palay Q1 2025 focused on Bicol read
        // "national average 58,655.28 MT · across 6 provinces" — but the figure
        // is 4,692,422.31 ÷ 80, and 4,692,422.31 ÷ 6 is 782,070. The number and
        // its stated denominator described different populations.
        const areas = useNational
            ? (overrideAvgAreas != null ? overrideAvgAreas : 0)
            : (classification.counts ? Object.keys(classification.counts) : [])
                .reduce(function (sum, k) { return sum + (classification.counts[k] || 0); }, 0);
        thrEl.textContent = legendThresholdText(thr, areas, unitSingular, unitLabel);
    }

    const avgEl = document.getElementById('legend-avg');
    // null means a ratio whose denominator has not arrived (or is zero). Say
    // nothing rather than print NaN or a wrong number that looks authoritative.
    // classification.total is the sum of the areas actually classified. Focused
    // on a region that is the region's own total, deduped by the same path that
    // drew the map, so it agrees with the province rows listed below and with
    // the region popup's Production figure.
    const scopedTotal = scopeLabel && classification ? (classification.total || 0) : 0;
    avgEl.textContent = legendHeaderText(figure, scopeLabel, scopedTotal);
    // A ratio metric needs the volume and area/trees files to be weighted
    // properly. Fetch them once per crop, then refresh this one line.
    if (figure.pending) {
        ensureRatioTotals(cropName, activeMetric, function () {
            if (currentCropName !== cropName || activeMetric !== figure.metricId) return;
            avgEl.textContent = legendHeaderText(
                nationalFigureForActiveMetric(cropName), scopeLabel, scopedTotal);
        });
    }

    const fn = (cropConfig[cropName] || {}).footnote || '';
    const fnEl = document.getElementById('legend-footnote');
    fnEl.textContent = fn;
    fnEl.style.display = fn ? 'block' : 'none';
    document.getElementById('legend-unit-explanation').textContent = getActiveUnitExplanation();
    // Volume is stated relative to the average — no rank-based Peak band, and the
    // band boundaries named for what they are. Every other metric keeps the
    // original "... Production" wording. `note` carries the comparison basis,
    // which differs by scope: across provinces nationwide when a region is
    // focused, across regions otherwise.
    const near = 'within ' + Math.round(NEAR_AVERAGE_TOLERANCE * 100) + '%';
    let classes;
    if (metricUsesAverageMode()) {
        // "the national average" — because that is what the threshold is. It is
        // the national total divided by the number of areas reporting (Palay
        // 2025: 19,611,730.97 / 17 = 1,153,631.23 MT). An earlier wording,
        // "the average region", described the same number but read as though it
        // named some particular region.
        classes = scopeLabel ? [
            { cls: 'medHigh', label: 'Above average', note: 'above the national average' },
            { cls: 'average', label: 'Near average',  note: near + ' of the national average' },
            { cls: 'medLow',  label: 'Below average', note: 'below the national average' },
            { cls: 'noData',  label: 'No data',       note: 'not reported' }
        ] : [
            { cls: 'high',    label: 'Above average', note: 'above the national average' },
            { cls: 'average', label: 'Near average',  note: near + ' of the national average' },
            { cls: 'low',     label: 'Below average', note: 'below the national average' },
            { cls: 'noData',  label: 'No data',       note: 'not reported' }
        ];
    } else {
        classes = scopeLabel ? [
            { cls: 'peak',    label: 'Peak Production', note: 'Top-Producing' },
            { cls: 'medHigh', label: 'High Production', note: 'Above national average' },
            { cls: 'medLow',  label: 'Low Production',  note: 'Below national average' },
            { cls: 'noData',  label: 'No Data',         note: 'Not reported' }
        ] : [
            { cls: 'peak',    label: 'Peak Production',    note: 'Top-Producing' },
            { cls: 'high',    label: 'High Production',    note: 'Above average' },
            { cls: 'average', label: 'Average Production', note: 'National average' },
            { cls: 'low',     label: 'Low Production',     note: 'Below average' },
            { cls: 'noData',  label: 'No Data',            note: 'Not reported' }
        ];
    }

    const el = document.getElementById('legend-items');
    el.innerHTML = '';
    classes.forEach(function (item) {
        if (item.cls === 'noData' && classification.noDataCount === 0) return;
        if (item.cls !== 'noData' && classification.counts[item.cls] === 0) return;
        const color = getColor(cropName, item.cls);
        const count = item.cls === 'noData' ? classification.noDataCount : classification.counts[item.cls];
        const range = classification.rangeStrings[item.cls] || '';
        const row = document.createElement('div');
        row.className = 'legend-row';
        row.dataset.cls = item.cls;
        row.title = 'Click to highlight these areas on the map';
        row.tabIndex = 0;
        row.setAttribute('role', 'button');
        if (item.cls === stickyHighlightCls) row.classList.add('legend-row-active');
        row.innerHTML =
            '<div class="legend-swatch" style="background:' + color + '"></div>' +
            '<div class="legend-row-text">' +
            '<div class="legend-label">' + item.label + '</div>' +
            (range ? '<div class="legend-range">' + range + '</div>' : '') +
            '<div class="legend-count">' + item.note
              + (count !== undefined
                  ? ' \xB7 ' + count + ' ' + (count === 1 ? unitSingular : unitLabel)
                  : '') + '</div>' +
            '</div>';
        el.appendChild(row);
    });

    // Re-assert the pinned highlight on the freshly rendered layer, so the
    // year's new class members light up during temporal play
    if (stickyHighlightCls) highlightClass(stickyHighlightCls);

    // Ranked top producers for the current scope — quick comparison without
    // having to click every polygon
    const rankEl = document.getElementById('legend-ranking');
    rankEl.innerHTML = '';
    const ranked = Object.entries(classification.clsMap)
        .map(([pcode, info]) => ({ pcode, val: info.val }))
        .sort((a, b) => b.val - a.val)
        .slice(0, 5);
    if (ranked.length > 1) {
        const fmtRank = fmtMetricValue;
        let html = '<div id="legend-ranking-title">Top ' + ranked.length + ' ' + unitLabel + ' \u00b7 ' + esc(periodShort(currentYear)) + '</div>';
        ranked.forEach(function (r, i) {
            const name = scopeLabel ? provinceDisplayName(r.pcode) : regionDisplayName(r.pcode);
            html += '<div class="rank-row' + (scopeLabel ? '' : ' rank-clickable') + '" data-pcode="' + esc(r.pcode) + '"'
                + (scopeLabel ? '' : ' title="Click to zoom to this region" role="button" tabindex="0"')
                + '><span class="rank-num">' + (i + 1) + '</span>'
                + '<span class="rank-name">' + esc(name) + '</span>'
                + '<span class="rank-val">' + fmtRank(r.val) + '</span></div>';
        });
        rankEl.innerHTML = html;
    }

    document.getElementById('legend-panel').style.display = 'block';
}

// ── Data table modal ─────────────────────────────────────────────────────────
// Rows for the current view: provinces of the focused region, otherwise all
// regions. Values are the active crop + metric across all years, sorted by the
// current year, largest first.
function buildTableContext() {
    const metricDef = getActiveMetricDef();
    const cropLabel = currentCropName ? currentCropName.replace(/^Overall\s+/i, '') : '';
    const curIdx = YEARS.indexOf(currentYear);
    const prevYear = curIdx > 0 ? YEARS[curIdx - 1] : null;
    const natTotal = getNationalTotal();
    const clsLabels = metricUsesAverageMode() ? { peak: 'Top-Producing', high: 'Above average', average: 'Near average', low: 'Below average', medHigh: 'Above average', medLow: 'Below average' }
                            : { peak: 'Peak', high: 'High', average: 'Average', low: 'Low', medHigh: 'High', medLow: 'Low' };
    const isProv = !!(focusedPcode && currentProvStats && provincialShapes);
    let scope, title, entries, regionTotal = 0;

    if (isProv) {
        const pcodes = [...new Set(provincialShapes.features
            .filter(f => provinceParentRegion(f.properties) === focusedPcode)
            .map(f => effectiveProvincePcode(f.properties.ADM2_PCODE)))];
        scope = 'Province';
        title = cropLabel + ' — ' + (focusedRegionName || 'Region');
        const regionRow = currentCropStats && currentCropStats[focusedPcode];
        regionTotal = regionRow ? (parseFloat(regionRow[currentYear]) || 0) : 0;
        entries = pcodes.map(p => ({
            pcode: p,
            name: provinceDisplayName(p),
            vals: YEARS.map(y => currentProvStats[p] ? (parseFloat(currentProvStats[p][y]) || 0) : 0)
        }));
    } else {
        scope = 'Region';
        title = cropLabel + ' — All Regions';
        entries = Object.keys(currentCropStats || {}).map(p => ({
            pcode: p,
            name: regionDisplayName(p),
            vals: YEARS.map(y => parseFloat(currentCropStats[p][y]) || 0)
        }));
    }

    // Per-row analytics mirroring the popup: shares, variance/growth vs the
    // previous year, 5-year lowest/highest/average, and the classification
    const clsMap = isProv ? currentProvClsMap : currentClsMap;
    const rows = entries.map(e => {
        const cur = e.vals[curIdx];
        const prev = prevYear ? e.vals[curIdx - 1] : 0;
        const variance = (cur > 0 && prev > 0) ? cur - prev : null;
        const growth = variance !== null ? (variance / prev) * 100 : null;
        const sharePH = (natTotal > 0 && cur > 0) ? (cur / natTotal) * 100 : null;
        const shareRegion = (isProv && regionTotal > 0 && cur > 0) ? (cur / regionTotal) * 100 : null;
        const withData = e.vals.map((v, i) => ({ v, yr: YEARS[i] })).filter(x => x.v > 0);
        const lo = withData.length ? withData.reduce((a, b) => (b.v < a.v ? b : a)) : null;
        const hi = withData.length ? withData.reduce((a, b) => (b.v > a.v ? b : a)) : null;
        const avg = withData.length ? withData.reduce((s, x) => s + x.v, 0) / withData.length : null;
        const cls = clsMap[e.pcode] ? (clsLabels[clsMap[e.pcode].cls] || '') : '';
        return { name: e.name, vals: e.vals, sharePH, shareRegion, variance, growth, lo, hi, avg, cls };
    });
    rows.sort((a, b) => b.vals[curIdx] - a.vals[curIdx]);

    // Extra columns shown after the year columns (varies by scope/year)
    const extraCols = [{ key: 'sharePH', label: 'Share PH %' }];
    if (isProv) extraCols.push({ key: 'shareRegion', label: 'Share Region %' });
    if (prevYear) {
        extraCols.push({ key: 'variance', label: 'Vs ' + prevYear });
        extraCols.push({ key: 'growth', label: 'Growth %' });
    }
    extraCols.push(
        { key: 'lowest', label: 'Lowest' },
        { key: 'highest', label: 'Highest' },
        { key: 'average', label: 'Average' },
        { key: 'cls', label: 'Class' }
    );

    return { scope, title, rows, metricDef, extraCols, prevYear };
}

function openDataTable() {
    if (!currentCropStats || !currentCropName) return;
    const ctx = buildTableContext();
    document.getElementById('table-modal-title').textContent = ctx.title;
    document.getElementById('table-modal-sub').textContent =
        ctx.metricDef.title + ' (' + ctx.metricDef.unit + ') · ' + YEARS[0] + '–' + YEARS[YEARS.length - 1];

    const fmt = v => v > 0 ? fmtMetricValue(v) : '—';
    const fmtPct = v => v === null ? '—' : v.toFixed(2) + '%';
    // Column headers stay compact — 22 columns of '2025 Quarter 4' would be
    // unreadable — but they must not show the raw key either.
    const thLabel = y => (String(y).length === 4 ? String(y)
                          : childLabel(y) + ' ' + String(y).slice(0, 4));
    const yearTh = y => '<th' + (y === currentYear ? ' class="cur-year"' : '') + '>' + thLabel(y) + '</th>';
    const numTd = (v, i) => '<td class="num' + (YEARS[i] === currentYear ? ' cur-year' : '') + '">' + fmt(v) + '</td>';
    const extraTd = (r, key) => {
        switch (key) {
            case 'sharePH':     return '<td class="num">' + fmtPct(r.sharePH) + '</td>';
            case 'shareRegion': return '<td class="num">' + fmtPct(r.shareRegion) + '</td>';
            case 'variance': {
                if (r.variance === null) return '<td class="num">—</td>';
                const cls = r.variance >= 0 ? 'growth-pos' : 'growth-neg';
                const txt = (r.variance >= 0 ? '+' : '-') + fmtMetricValue(Math.abs(r.variance));
                return '<td class="num ' + cls + '">' + txt + '</td>';
            }
            case 'growth': {
                if (r.growth === null) return '<td class="num">—</td>';
                const cls = r.growth >= 0 ? 'growth-pos' : 'growth-neg';
                return '<td class="num ' + cls + '">' + (r.growth >= 0 ? '▲ +' : '▼ ') + r.growth.toFixed(2) + '%</td>';
            }
            case 'lowest':  return '<td class="num">' + (r.lo ? fmt(r.lo.v) + ' <span class="yr-note">(' + r.lo.yr + ')</span>' : '—') + '</td>';
            case 'highest': return '<td class="num">' + (r.hi ? fmt(r.hi.v) + ' <span class="yr-note">(' + r.hi.yr + ')</span>' : '—') + '</td>';
            case 'average': return '<td class="num">' + (r.avg !== null ? fmt(r.avg) : '—') + '</td>';
            case 'cls':     return '<td>' + (r.cls || '—') + '</td>';
            default:        return '<td>—</td>';
        }
    };

    let html = '<thead><tr><th>' + ctx.scope + '</th>' + YEARS.map(yearTh).join('')
        + ctx.extraCols.map(c => '<th>' + c.label + '</th>').join('') + '</tr></thead><tbody>';
    ctx.rows.forEach(r => {
        html += '<tr><td>' + esc(r.name) + '</td>' + r.vals.map(numTd).join('')
            + ctx.extraCols.map(c => extraTd(r, c.key)).join('') + '</tr>';
    });
    // Totals only make sense for additive metrics — not for yield ratios
    if (!ctx.metricDef.average && ctx.rows.length > 1) {
        const totals = YEARS.map((y, i) => ctx.rows.reduce((s, r) => s + r.vals[i], 0));
        html += '<tr class="total-row"><td>Total</td>' + totals.map(numTd).join('')
            + ctx.extraCols.map(() => '<td></td>').join('') + '</tr>';
    }
    html += '</tbody>';
    document.getElementById('data-table').innerHTML = html;
    document.getElementById('table-modal').hidden = false;
    document.getElementById('table-close-btn').focus();
}

function closeDataTable() {
    document.getElementById('table-modal').hidden = true;
}

function exportDataTableCSV() {
    if (!currentCropStats || !currentCropName) return;
    const ctx = buildTableContext();
    const q = s => '"' + String(s).replace(/"/g, '""') + '"';
    // Lowest/highest split into value + year columns so they stay numeric
    const extraHeaders = ['Share_PH_%'];
    if (ctx.rows.some(r => r.shareRegion !== null)) extraHeaders.push('Share_Region_%');
    if (ctx.prevYear) extraHeaders.push('Variance_vs_' + ctx.prevYear, 'Growth_%');
    extraHeaders.push('Lowest', 'Lowest_Year', 'Highest', 'Highest_Year', 'Average', 'Class');

    const lines = [
        q(ctx.title + ' — ' + ctx.metricDef.title + ' (' + ctx.metricDef.unit + ') · as of ' + periodLabel(currentYear)),
        [ctx.scope].concat(YEARS).concat(extraHeaders).map(q).join(',')
    ];
    // Raw unformatted numbers so the file opens cleanly in Excel/Sheets
    const n = v => (v === null || v === undefined) ? '' : v;
    ctx.rows.forEach(r => {
        const cells = [q(r.name)]
            .concat(r.vals.map(v => v > 0 ? v : ''))
            .concat([r.sharePH === null ? '' : r.sharePH.toFixed(4)]);
        if (extraHeaders.includes('Share_Region_%')) {
            cells.push(r.shareRegion === null ? '' : r.shareRegion.toFixed(4));
        }
        if (ctx.prevYear) {
            cells.push(n(r.variance), r.growth === null ? '' : r.growth.toFixed(4));
        }
        cells.push(
            r.lo ? r.lo.v : '', r.lo ? r.lo.yr : '',
            r.hi ? r.hi.v : '', r.hi ? r.hi.yr : '',
            r.avg === null ? '' : r.avg,
            q(r.cls || '')
        );
        lines.push(cells.join(','));
    });
    // UTF-8 BOM so Excel renders accented names (e.g. ñ) correctly
    const bom = String.fromCharCode(0xFEFF);
    const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (currentCropName + '_' + ctx.metricDef.id + '_'
        + (focusedRegionName || 'All_Regions')).replace(/[^\w-]+/g, '_') + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
}

// ── 13. Year controller ──────────────────────────────────────────────────────
// Reads a period key for display: '2024Q3' -> 'Q3 2024'. The bare year is
// already its own label.
// Spelled out, year first: '2025 Quarter 4', '2025 2nd Semester'. Used
// everywhere a period appears in a sentence — the legend, the data table, the
// popups — because '2025Q4' is a database key, not something to read.
function periodLabel(period) {
    const m = /^(\d{4})([QS])(\d)$/.exec(String(period));
    if (!m) return String(period);
    return m[1] + ' ' + (m[2] === 'Q'
        ? 'Quarter ' + m[3]
        : (m[3] === '1' ? '1st' : '2nd') + ' Semester');
}

// The dots and tick labels used to be hard-coded in index.html — five of them.
// A quarter view needs 24, and the list changes whenever the granularity or the
// loaded file does, so they are drawn from YEARS instead.
// The time axis is two levels, not one: the slider picks a YEAR, and the row
// beneath it picks the period inside that year. Cramming 22 quarters onto a
// single track made every dot 3px wide and the labels unreadable, and it also
// hid the structure that actually matters — a quarter belongs to a year.
//
// YEARS stays the full period list, because ~70 places walk it as the DATA
// axis (trend charts, aggregation, auto-play). Only the control is split.
function periodYear(period) { return String(period).slice(0, 4); }

function timelineYears() {
    const seen = [];
    YEARS.forEach(function (p) {
        const y = periodYear(p);
        if (seen.indexOf(y) === -1) seen.push(y);
    });
    return seen;
}

function periodsInYear(year) {
    return YEARS.filter(function (p) { return periodYear(p) === String(year); });
}

// 2024Q3 -> 'Q3'; 2024S1 -> '1st SEM'. Semesters get the spoken form because
// that is what the reports call them.
// Between the two: readable words, one line. For dense repeated contexts —
// popup rows, chart axis ends, tooltips — where the long form wraps and the
// raw key is unreadable.
function periodShort(period) {
    const m = /^(\d{4})([QS])(\d)$/.exec(String(period));
    if (!m) return String(period);
    return (m[2] === 'Q' ? 'Q' + m[3] : (m[3] === '1' ? '1st SEM' : '2nd SEM')) + ' ' + m[1];
}

// The short form, for the branch buttons only. Four 'Quarter 1' buttons do not
// fit a 294px panel, and they sit directly under the year anyway, so the year
// and the word are both redundant there.
function childLabel(period) {
    const m = /^\d{4}([QS])(\d)$/.exec(String(period));
    if (!m) return String(period);
    return m[1] === 'Q' ? 'Q' + m[2] : (m[2] === '1' ? '1st SEM' : '2nd SEM');
}

function renderTimeline() {
    const dots = document.getElementById('year-dots-row');
    const ticks = document.getElementById('year-ticks-row');
    const slider = document.getElementById('year-slider');
    if (!dots || !ticks || !slider) return;

    const years = timelineYears();
    dots.innerHTML = years.map(function (y) {
        return '<span class="yr-dot" data-yr="' + y + '" title="' + y + '"></span>';
    }).join('');
    ticks.innerHTML = years.map(function (y) {
        return '<span class="yr-tick-label" data-yr="' + y + '">' + y + '</span>';
    }).join('');

    slider.min = 0;
    slider.max = Math.max(0, years.length - 1);
    slider.step = 1;
    dots.classList.remove('is-dense');      // never more than a handful now
    renderPeriodChildren();
}

// The branch: the periods that belong to the selected year. Only the ones that
// actually exist are drawn — 2026 stops at Q2, and offering an empty Q4 would
// be inviting a click that shows nothing.
// The partial-year warning. Lives under the timeline rather than in a toast or
// the legend because that is where the year was just chosen — the reader needs
// it at the moment they change the year, not after they have read a number off
// the map. esc() because the text is inserted as HTML.
function updatePartialYearNote() {
    const el = document.getElementById('partial-year-note');
    if (!el) return;
    const note = partialYearNote(currentYear);
    el.hidden = !note;
    el.innerHTML = note ? '<b>' + esc(periodYear(currentYear)) + '</b> ' + esc(note) : '';
}

function renderPeriodChildren() {
    const row = document.getElementById('period-children');
    if (!row) return;
    if (activeGranularity === 'annual') {
        row.hidden = true;
        row.innerHTML = '';
        return;
    }
    const kids = periodsInYear(periodYear(currentYear));
    row.hidden = kids.length === 0;
    row.innerHTML = kids.map(function (k) {
        return '<button type="button" class="period-child' + (k === currentYear ? ' is-on' : '')
             + '" data-period="' + k + '" role="tab" aria-selected="' + (k === currentYear)
             + '">' + childLabel(k) + '</button>';
    }).join('');
}

function setYear(year) {
    year = String(year);
    // Guard against a period that does not exist in the active granularity —
    // switching from 2024Q3 to Annual has to land somewhere real.
    if (YEARS.indexOf(year) === -1) {
        const sameYear = YEARS.filter(function (y) { return y.slice(0, 4) === year.slice(0, 4); });
        year = sameYear.length ? sameYear[sameYear.length - 1] : YEARS[YEARS.length - 1];
    }
    currentYear = year;
    updateBoundaryLayer();
    // The slider tracks the YEAR; the child row tracks the period within it.
    const years = timelineYears();
    const yr = periodYear(year);
    const idx = Math.max(0, years.indexOf(yr));
    const pct = years.length > 1 ? (idx / (years.length - 1)) * 100 : 100;
    const slider = document.getElementById('year-slider');
    slider.value = idx;
    document.getElementById('year-track-fill').style.width = pct + '%';
    // Drop the branch connector under the selected year, so the periods below
    // visibly hang off it rather than off the middle of the panel.
    const kidsRow = document.getElementById('period-children');
    if (kidsRow) kidsRow.style.setProperty('--branch-x', pct.toFixed(2) + '%');
    document.querySelectorAll('.yr-dot').forEach(d => d.classList.toggle('active', d.dataset.yr === yr));
    document.querySelectorAll('.yr-tick-label').forEach(t => t.classList.toggle('active', t.dataset.yr === yr));
    renderPeriodChildren();
    updatePartialYearNote();
    const lbl = document.getElementById('year-label');
    lbl.classList.remove('flash');
    void lbl.offsetWidth;
    lbl.textContent = periodLabel(year);
    lbl.classList.add('flash');
    setTimeout(() => lbl.classList.remove('flash'), 300);
    document.getElementById('header-year').textContent = periodLabel(year);
    if (currentCropStats && currentCropName) {
        // renderMap clears the focused region — remember it so the user's
        // selection survives scrubbing or auto-playing through years
        const prevFocusPcode = focusedPcode;
        const prevFocusName = focusedRegionName;
        const prevSticky = stickyHighlightCls;
        const prevStickyKey = stickyHighlightKey;
        const classification = classifyRegions(currentCropStats);
        renderMap(currentCropStats, currentCropName, classification.clsMap);
        renderLegend(currentCropName, classification);
        // Scrubbing the timeline re-renders from cached stats rather than
        // reloading, so the gap notice has to be re-evaluated here too — both
        // to appear on an empty year and to clear itself on a populated one.
        reportEmptyPeriod(currentCropName);
        if (prevFocusPcode) {
            // The national legend render above clears a pin made in the
            // provincial view — put it back before the focus re-render so a
            // pinned class also survives year play while zoomed into a region
            stickyHighlightCls = prevSticky;
            stickyHighlightKey = prevStickyKey;
            restoreFocus(prevFocusPcode, prevFocusName);
        }
    }
    updateUrlHash();
    refreshCatalogueForYearChange();
}

function togglePlay() {
    const btn = document.getElementById('play-btn');
    if (playInterval) {
        clearInterval(playInterval);
        playInterval = null;
        btn.textContent = '▶';
        btn.classList.remove('playing');
    } else {
        btn.textContent = '⏸';
        btn.classList.add('playing');
        let idx = YEARS.indexOf(currentYear);
        playInterval = setInterval(function () {
            idx = (idx + 1) % YEARS.length;
            setYear(YEARS[idx]);
            if (YEARS[idx] === YEARS[YEARS.length - 1]) {
                clearInterval(playInterval);
                playInterval = null;
                btn.textContent = '▶';
                btn.classList.remove('playing');
            }
        }, 1200);
    }
}

function toggleYearController() {
    const body = document.getElementById('year-controller-body');
    const btn = document.getElementById('year-controller-toggle');
    const pill = document.getElementById('year-controller');
    const isOpen = !body.classList.contains('collapsed');
    body.classList.toggle('collapsed', isOpen);
    btn.classList.toggle('collapsed', isOpen);
    pill.classList.toggle('collapsed', isOpen);
    btn.title = isOpen ? 'Expand' : 'Collapse';
}

// ── 14. UI interactions ──────────────────────────────────────────────────────

// Loads regional + provincial CSV for the given crop and active metric, then re-renders.
// Called both by selectCrop and by switchMetric.
// Aggregates a provincial stats object (keyed by ADM2_PCODE) into regional
// totals (volume/area) or averages (yield) keyed by ADM1_PCODE.
// useAverage=true for yield (MT/HA), false/omitted for volume/area (sum provinces).
// The XLSX parser (~900 KB) is only fetched when a workbook is actually
// requested — CSV-only sessions never pay for it
var xlsxLoadPromise = null;
function ensureXLSX() {
    if (window.XLSX) return Promise.resolve();
    if (!xlsxLoadPromise) {
        xlsxLoadPromise = new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            s.onload = resolve;
            s.onerror = function () {
                xlsxLoadPromise = null; // allow a retry on the next request
                reject(new Error('Could not load the spreadsheet parser'));
            };
            document.head.appendChild(s);
        });
    }
    return xlsxLoadPromise;
}

function loadDataFile(file, complete, error) {
    // Sheet name may be encoded after '#': 'data/file.xlsx#SheetName'
    const hashIdx = file.indexOf('#');
    const sheetName = hashIdx !== -1 ? file.slice(hashIdx + 1) : null;
    const filePath  = hashIdx !== -1 ? file.slice(0, hashIdx) : file;

    const ext = filePath.split('.').pop().toLowerCase();
    if (ext === 'csv') {
        Papa.parse(filePath + '?v=' + DATA_VERSION, {
            download: true,
            header: true,
            complete: function(results) {
                results.data.forEach(function(row) {
                    if (row.ADM2_PCODE && /^\d{9}$/.test(row.ADM2_PCODE)) {
                        row.ADM2_PCODE = '0' + row.ADM2_PCODE;
                    }
                    if (PROVINCE_PCODE_ALIASES[row.ADM2_PCODE]) {
                        row.ADM2_PCODE = PROVINCE_PCODE_ALIASES[row.ADM2_PCODE];
                    }
                });
                complete(results);
            },
            error: error
        });
        return;
    }
    if (ext === 'xlsx' || ext === 'xls') {
        ensureXLSX()
            .then(() => fetch(filePath + '?v=' + DATA_VERSION))
            .then(r => {
                if (!r.ok) throw new Error('HTTP ' + r.status + ' loading ' + filePath);
                return r.arrayBuffer();
            })
            .then(data => {
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = (sheetName && workbook.Sheets[sheetName])
                    ? workbook.Sheets[sheetName]
                    : workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                if (!rows.length) return complete({ data: [] });
                const header = rows[0].map(h => {
                    const s = String(h).trim();
                    const m = s.match(/^Annual\s*\((\d{4})\)$/i);
                    return m ? m[1] : s;
                });
                const nirPH = { 'PH06045': '1804500000', 'PH07046': '1804600000', 'PH07061': '1806100000' };
                const dataRows = rows.slice(1).map(r => {
                    const obj = {};
                    header.forEach((key, idx) => {
                        let val = r[idx] == null ? '' : String(r[idx]).trim();
                        if (key === 'ADM2_PCODE') {
                            if (/^\d{9}$/.test(val)) {
                                val = '0' + val;                           // 9-digit → 10-digit
                            } else if (/^PH\d{5}$/.test(val)) {
                                val = nirPH[val] || (val.slice(2) + '00000'); // PH01028 → 0102800000
                            }
                            val = PROVINCE_PCODE_ALIASES[val] || val;
                        }
                        obj[key] = val;
                    });
                    return obj;
                });
                complete({ data: dataRows });
            })
            .catch(error);
        return;
    }
    error(new Error('Unsupported file type: ' + file));
}

function aggregateProvToRegional(provStats, useAverage) {
    const buckets = {};
    Object.values(provStats).forEach(row => {
        if (!row.ADM2_PCODE) return;
        YEARS.forEach(y => {
            const v = parseFloat(row[y]) || 0;
            if (v > 0) {
                // Region membership shifts over time (NIR from 2024, Sulu →
                // Region IX from 2026) — bucket each year's value under the
                // region the province belonged to in that year
                const rPcode = provinceRegionPcode(row.ADM2_PCODE, y);
                if (!buckets[rPcode]) buckets[rPcode] = { ADM1_PCODE: rPcode, _sum: {}, _cnt: {} };
                buckets[rPcode]._sum[y] = (buckets[rPcode]._sum[y] || 0) + v;
                buckets[rPcode]._cnt[y] = (buckets[rPcode]._cnt[y] || 0) + 1;
            }
        });
    });
    const result = {};
    Object.entries(buckets).forEach(([pcode, b]) => {
        result[pcode] = { ADM1_PCODE: pcode };
        YEARS.forEach(y => {
            result[pcode][y] = useAverage
                ? (b._cnt[y] ? b._sum[y] / b._cnt[y] : 0)  // yield → average
                : (b._sum[y] || 0);                          // volume/area → sum
        });
    });
    return result;
}

function loadCropData(cropName) {
    const metricDef = getActiveMetricDef();
    const config = cropConfig[cropName];
    if (!config) return;

    let file    = config[metricDef.fileKey];
    let provFile = provConfig[cropName] && provConfig[cropName][metricDef.provFileKey];

    // Sub-annual overrides both. There is no regional sub-annual file, so
    // `file` is cleared deliberately and the provincial branch below derives
    // regional totals — the same path an annual crop with no regional file
    // already takes.
    if (activeGranularity !== 'annual') {
        const sub = subAnnualFile(cropName, metricDef.id, activeGranularity);
        if (!sub) {
            if (cropLayer) { map.removeLayer(cropLayer); cropLayer = null; }
            clearProvincialDataLayer();
            document.getElementById('legend-panel').style.display = 'none';
            currentCropStats = null;
            currentCropName = cropName;
            currentClsMap = {};
            currentProvStats = null;
            const hint = document.getElementById('year-hint');
            hint.textContent = GRANULARITIES[activeGranularity].label
                + ' data is only published for Palay and Corn — showing nothing for '
                + cropName + '. Switch back to Annual to see it.';
            hint.style.display = 'block';
            updateGranularityAvailability();
            finishMetricLoad();
            return;
        }
        file = null;
        provFile = sub;
    }

    // No regional file but a provincial file exists — derive regional from provincial.
    if (!file && provFile) {
        document.getElementById('year-hint').style.display = 'none';
        currentCropName = cropName;
        currentProvStats = null;

        beginDataLoad();
        loadDataFile(provFile, function (results) {
            // A sub-annual file defines its own time axis — take the period
            // list from its header rather than assuming one, so adding a
            // quarter to the sheet needs no code change here.
            if (activeGranularity !== 'annual' && results.meta && results.meta.fields) {
                const cols = results.meta.fields.filter(function (f) {
                    return /^\d{4}([QS]\d)?$/.test(f);
                });
                if (cols.length) { YEARS = cols; renderTimeline(); setYear(currentYear); }
            }
            const provStats = {};
            results.data.forEach(row => {
                if (!row.ADM2_PCODE) return;
                const existing = provStats[row.ADM2_PCODE];
                if (!existing) { provStats[row.ADM2_PCODE] = row; return; }
                YEARS.forEach(y => {
                    if (!(parseFloat(existing[y]) > 0) && parseFloat(row[y]) > 0) existing[y] = row[y];
                });
            });
            currentProvStats = provStats;
            const regionalStats = aggregateProvToRegional(provStats, !!metricDef.average);
            currentCropStats = regionalStats;
            const classification = classifyRegions(regionalStats);
            renderMap(regionalStats, cropName, classification.clsMap);
            renderLegend(cropName, classification);
            // After the render, not before: the check needs the loaded stats to
            // know which periods this crop/metric actually carries.
            reportEmptyPeriod(cropName);
            consumePendingFocus();
            if (focusedPcode && focusedRegionName && !provincialDataLayer) {
                renderProvincialChoropleth(focusedPcode, focusedRegionName);
            }
            endDataLoad();
            finishMetricLoad();
        }, function (err) {
            console.error('Data load error:', err);
            endDataLoad();
            showDataError('Could not load data for this crop — check your connection and try again.');
            finishMetricLoad();
        });
        return;
    }

    if (!file) {
        if (cropLayer) { map.removeLayer(cropLayer); cropLayer = null; }
        clearProvincialDataLayer();
        document.getElementById('legend-panel').style.display = 'none';
        currentCropStats = null;
        currentCropName = cropName;
        currentClsMap = {};
        currentProvStats = null;
        const hint = document.getElementById('year-hint');
        hint.textContent = metricDef.label + ' data not yet available for this crop.';
        hint.style.display = 'block';
        finishMetricLoad();
        return;
    }

    document.getElementById('year-hint').style.display = 'none';
    currentCropName = cropName;
    currentProvStats = null;

    beginDataLoad();
    Papa.parse(file + '?v=' + DATA_VERSION, {
        download: true,
        header: true,
        complete: function (results) {
            const stats = {};
            results.data.forEach(row => { if (row.ADM1_PCODE) stats[row.ADM1_PCODE] = row; });
            currentCropStats = stats;
            const classification = classifyRegions(stats);
            renderMap(stats, cropName, classification.clsMap);
            renderLegend(cropName, classification);
            reportEmptyPeriod(cropName);
            consumePendingFocus();
            endDataLoad();
            finishMetricLoad();
        },
        error: function (err) {
            console.error('CSV load error:', err);
            endDataLoad();
            showDataError('Could not load data for this crop — check your connection and try again.');
            finishMetricLoad();
        }
    });

    if (provFile) {
        beginDataLoad();
        loadDataFile(provFile, function (results) {
            const stats = {};
            results.data.forEach(row => {
                if (!row.ADM2_PCODE) return;
                const existing = stats[row.ADM2_PCODE];
                if (!existing) { stats[row.ADM2_PCODE] = row; return; }
                // Same province listed under two regions (NIR split):
                // the eras don't overlap, so take the non-zero value per year
                YEARS.forEach(y => {
                    if (!(parseFloat(existing[y]) > 0) && parseFloat(row[y]) > 0) existing[y] = row[y];
                });
            });
            currentProvStats = stats;
            if (focusedPcode && focusedRegionName && !provincialDataLayer) {
                renderProvincialChoropleth(focusedPcode, focusedRegionName);
            }
            endDataLoad();
            finishMetricLoad();
        }, function (err) {
            console.error('Data load error:', err);
            endDataLoad();
            showDataError('Could not load provincial data for this crop.');
            finishMetricLoad();
        });
    }
}

function selectCrop(el, cropName) {
    if (activeItem === el) {
        el.classList.remove('active');
        el.setAttribute('aria-pressed', 'false');
        activeItem = null;
        try { localStorage.removeItem('lastCrop'); } catch (e) { /* private mode */ }
        if (cropLayer) { map.removeLayer(cropLayer); cropLayer = null; }
        clearProvincialDataLayer();
        document.getElementById('legend-panel').style.display = 'none';
        const hint = document.getElementById('year-hint');
        hint.textContent = 'Select a crop above to explore production by year';
        hint.style.display = 'block';
        currentCropStats = null;
        currentCropName = null;
        currentClsMap = {};
        currentProvStats = null;
        focusedPcode = null;
        hideProvincialLayer();
        updateMetricTabAvailability(null);
        updateBreadcrumb();
        updateUrlHash();
        return;
    }
    if (activeItem) {
        activeItem.classList.remove('active');
        activeItem.setAttribute('aria-pressed', 'false');
    }
    el.classList.add('active');
    el.setAttribute('aria-pressed', 'true');
    activeItem = el;
    try { localStorage.setItem('lastCrop', cropName); } catch (e) { /* private mode */ }
    autoSwitchMetricCounterpart(cropName);
    updateMetricTabAvailability(cropName);
    loadCropData(cropName);
    updateUrlHash();
    // On phones, drop the sheet so the map result is immediately visible
    collapseMobileSheet();
}

function switchMetric(metricId) {
    if (metricId === activeMetric) return;
    activeMetric = metricId;
    updateMetricUI();
    updateUrlHash();
    if (activeItem && currentCropName) loadCropData(currentCropName);
}

function lockOtherMetricTabs(selectedMetric) {
    document.querySelectorAll('.metric-tab').forEach(t => {
        if (t.dataset.metric !== selectedMetric) {
            t.classList.add('locked');
            t.setAttribute('aria-disabled', 'true');
        } else {
            t.classList.remove('locked');
            t.removeAttribute('aria-disabled');
        }
    });
}

function unlockAllMetricTabs() {
    document.querySelectorAll('.metric-tab.locked').forEach(t => {
        t.classList.remove('locked');
        t.removeAttribute('aria-disabled');
    });
}

function finishMetricLoad() {
    metricLoading = false;
    unlockAllMetricTabs();
}

function updateMetricUI() {
    const metricDef = getActiveMetricDef();
    document.querySelectorAll('.metric-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.metric === metricDef.id));
    document.getElementById('panel-title').textContent = '🌾 ' + metricDef.title + ' (' + metricDef.unit + ')';
    updateTreeVisibilityForMetric(metricDef.id);
}

function updateTreeVisibilityForMetric(metricId) {
    // Bearing-tree counts only exist for fruit crops; fisheries/livestock only
    // have volume data — hide the categories the active metric can't apply to
    document.querySelectorAll('.section-header').forEach(section => {
        const treeSection = section.closest('.tree-section');
        if (!treeSection) return;
        let hide;
        if (metricId === 'trees') {
            hide = !section.classList.contains('fruits');
        } else {
            hide = metricId !== 'volume' &&
                (section.classList.contains('fisheries') || section.classList.contains('livestock'));
        }
        // Class (not inline style) so the search filter's own display toggling
        // can't reveal a section the active metric has hidden
        treeSection.classList.toggle('metric-hidden', hide);
    });
}

// Whether a crop has a file for the given metric — shared by the tab-graying
// logic below and the Trees/Area auto-switch in selectCrop.
// ── The legend's national figure ─────────────────────────────────────────────
// What the legend states for the country as a whole. It used to be one thing
// for all five metrics — the mean of the reporting regions — which is the right
// threshold for colouring "above/below the typical region" but is NOT a
// national figure, and for the ratio metrics it was badly wrong.
//
// Yield is volume ÷ area. Averaging regional yields unweighted, when those were
// themselves unweighted means of provincial yields, is a mean of means: Benguet
// counts the same as a region with one hectare. Measured across the 56 crops
// carrying volume, area and yield, the median error was 26% and the worst
// 1109% (Squash 98.12 shown against a true 8.11). Carrots read 4.42 MT/HA when
// the country actually produced 13.33.
//
// So: additive metrics report the national TOTAL, ratio metrics report the
// properly weighted quotient. The unweighted mean stays as the classification
// threshold — classifyEntries() is untouched — because "is this region above
// the typical region" is a fair thing to colour by.
const RATIO_DENOMINATOR = { yield: 'areaFile', yieldtree: 'treesFile' };

function legendNationalFigure(metricId, stats, period, numerTotal, denomTotal) {
    const def = METRICS.find(function (m) { return m.id === metricId; });
    if (def && def.average) {
        const ok = numerTotal != null && denomTotal != null && denomTotal > 0;
        return { label: 'national average', value: ok ? numerTotal / denomTotal : null };
    }
    let total = 0;
    if (stats) {
        Object.keys(stats).forEach(function (k) {
            total += parseFloat(stats[k][period]) || 0;
        });
    }
    return { label: 'national total', value: total };
}

// Collapse duplicate rows for the same area the way loadCropData() does:
// period by period, the first POSITIVE value wins. Not first-row-wins.
//
// Era-disjoint files deliberately split one province across two rows, each zero
// where the other carries data — the NIR handover (Negros Occidental/Oriental,
// Siquijor), Sulu's two codes, undivided Maguindanao against del Norte/del Sur.
// Keeping only the first row silently drops a whole era. ensureRatioTotals()
// used to do exactly that, and its comment claimed it matched loadCropData();
// it did not. The effect was 97 crop/metric/year national averages reading
// wrong — Cassava Industrial yield +10.3%, Mango yield/tree -7.3%, Sugar -7.1%,
// White Corn +5.9% — because the denominator lost rows the numerator kept.
//
// Periods are read off the row itself rather than from YEARS, so this stays
// correct when a sub-annual file swaps the time axis under it.
function mergeRowsByArea(rows) {
    const out = {};
    const isPeriod = /^\d{4}([QS]\d)?$/;
    rows.forEach(function (row) {
        const k = (row.ADM2_PCODE || row.ADM1_PCODE || '').trim();
        if (!k) return;
        const existing = out[k];
        if (!existing) { out[k] = row; return; }
        Object.keys(row).forEach(function (period) {
            if (!isPeriod.test(period)) return;
            if (!(parseFloat(existing[period]) > 0) && parseFloat(row[period]) > 0) {
                existing[period] = row[period];
            }
        });
    });
    return out;
}

// Volume and the ratio's denominator, per crop, indexed by pcode. Cached: the
// legend re-renders on every year scrub and focus change, and these are the
// same two files each time.
var ratioTotalsCache = {};

function ratioCacheKey(cropName, metricId) { return cropName + '|' + metricId; }

function ensureRatioTotals(cropName, metricId, done) {
    const key = ratioCacheKey(cropName, metricId);
    if (ratioTotalsCache[key]) return done(ratioTotalsCache[key]);

    const denomKey = RATIO_DENOMINATOR[metricId];
    const cfg = provConfig[cropName] || {};
    const reg = cropConfig[cropName] || {};
    const numerFile = cfg.file || reg.file;
    const denomFile = cfg[denomKey] || reg[denomKey];
    if (!denomKey || !numerFile || !denomFile) {
        ratioTotalsCache[key] = { numer: null, denom: null };
        return done(ratioTotalsCache[key]);
    }

    const index = mergeRowsByArea;
    let numer = null, denom = null, level = null, left = 2;
    const settle = function () {
        if (--left) return;
        ratioTotalsCache[key] = { numer: numer, denom: denom, level: level };
        done(ratioTotalsCache[key]);
    };
    // A failure caches nulls rather than retrying on every scrub — the line
    // simply stays blank, which beats hammering a 404.
    loadDataFile(numerFile, function (r) {
        numer = index(r.data);
        // Label the count correctly: a crop with no provincial file is ranked on
        // ADM1 rows, so "3 provinces" would be a lie.
        level = r.data.some(function (row) { return row.ADM2_PCODE; }) ? 'province' : 'region';
        settle();
    }, settle);
    loadDataFile(denomFile, function (r) { denom = index(r.data); settle(); }, settle);
}

// How many areas stand behind a ratio's national average. Count the
// DENOMINATOR's areas, because that is what the arithmetic divides by:
// Σvolume ÷ Σarea spans every area carrying area, whether or not it reported
// output. Dalandan 2025 is the case that settled it — Occidental Mindoro
// produces 2.22 MT on 136 trees, and Biliran carries 96 bearing trees with no
// production, so the national figure is 2.22/232 = 0.0096, not Occidental
// Mindoro's own 0.0163. Counting only areas positive on BOTH sides would have
// printed "1 province" beside a number computed over two.
function ratioAreaCount(numer, denom, period) {
    if (!denom) return null;
    let n = 0;
    Object.keys(denom).forEach(function (k) {
        if (parseFloat(denom[k][period]) > 0) n++;
    });
    return n;
}

// At or below this, say so. Dalandan's 2025 Yield/Tree rests on ONE province
// (Occidental Mindoro, 2.22 MT over 136 trees), so the line read "national
// average: 0.02 MT/tree" for a number that is not an average of anything.
// Salago's Yield rests on 3 provinces that disagree threefold. Both are
// arithmetically right and both read as more authoritative than they are.
const THIN_AVERAGE_AREAS = 3;

// "national average 1,153,631.23 MT · across 17 regions" — the threshold the
// Above/Near/Below bands are measured against, spelled out so the reader can
// see which number they are above. Split out of renderLegend() so the pairing
// of VALUE and COUNT is testable: they must describe the same population, or
// the line invites a division that does not work. `areaWord` is already
// takes BOTH forms of the area word and agrees them here, rather than leaving
// each call site to remember — the app says "regions" or "provinces" depending
// on the view, and neither pluralises by adding an "s" reliably enough to guess.
function legendThresholdText(thr, areas, singular, plural) {
    if (!metricUsesAverageMode()) return '';
    if (thr == null || !(thr > 0) || !areas) return '';
    return 'national average ' + fmtMetricValue(thr) + ' ' + getActiveUnit()
         + ' · across ' + areas + ' ' + (areas === 1 ? singular : plural);
}

// renderLegend writes this line twice — once immediately, once when a ratio's
// files land — so build it in one place. Two copies of a formatting rule is how
// ensureRatioTotals drifted away from loadCropData in the first place.
function legendAvgText(figure) {
    if (!figure || figure.value == null) return '';
    let text = periodLabel(currentYear) + ' ' + figure.label + ': '
             + fmtMetricValue(figure.value) + ' ' + getActiveUnit();
    if (figure.areas != null && figure.areas <= THIN_AVERAGE_AREAS) {
        text += ' (' + figure.areas + ' ' + (figure.level || 'area')
              + (figure.areas === 1 ? '' : 's') + ')';
    }
    return text;
}

// The legend's headline number. Unfocused it is the national figure, plainly.
//
// Focused on a region it leads with THAT REGION'S OWN total and then places it
// in the national frame — "Mimaropa Region: 1,314,220.12 MT · 6.7% of the
// national 19,611,730.97 MT". Both numbers have to be there and neither alone
// will do: the region's total is the one that matches what is on screen (it is
// the sum of the province rows listed below), while the national total is what
// the Above/Below colouring is measured against, so dropping it would leave the
// threshold line underneath with nothing explaining where it came from. jayve
// picked this over showing only one of them.
//
// RATIO metrics keep the national figure untouched. Yield is volume ÷ area, so
// there is no such thing as a region "total" — adding provincial yields
// together produces a number that means nothing.
function legendHeaderText(figure, scopeLabel, regionTotal) {
    if (!figure || figure.value == null) return '';
    if (!scopeLabel || figure.label !== 'national total' || !(regionTotal > 0)) {
        return legendAvgText(figure);
    }
    const unit = getActiveUnit();
    let text = periodLabel(currentYear) + ' ' + scopeLabel + ': '
             + fmtMetricValue(regionTotal) + ' ' + unit;
    // A zero national total would make the share a division by zero. It cannot
    // normally happen when the region has a total, but say nothing rather than
    // print NaN% if it ever does.
    if (figure.value > 0) {
        text += ' · ' + ((regionTotal / figure.value) * 100).toFixed(1)
              + '% of the national ' + fmtMetricValue(figure.value) + ' ' + unit;
    }
    return text;
}

// -> { label, value, pending, metricId } for whatever metric is showing.
function nationalFigureForActiveMetric(cropName) {
    const def = getActiveMetricDef();
    if (!def.average) {
        const stats = currentProvStats || currentCropStats;
        const fig = legendNationalFigure(def.id, stats, currentYear);
        fig.pending = false;
        fig.metricId = def.id;
        return fig;
    }
    const cached = ratioTotalsCache[ratioCacheKey(cropName, def.id)];
    if (!cached) {
        return { label: 'national average', value: null, pending: true, metricId: def.id };
    }
    const fig = legendNationalFigure(def.id, null, currentYear,
                                     cached.numer ? sumPeriod(cached.numer, currentYear) : null,
                                     cached.denom ? sumPeriod(cached.denom, currentYear) : null);
    fig.pending = false;
    fig.metricId = def.id;
    fig.areas = ratioAreaCount(cached.numer, cached.denom, currentYear);
    fig.level = cached.level;
    return fig;
}

function sumPeriod(stats, period) {
    let total = 0;
    Object.keys(stats || {}).forEach(function (k) {
        total += parseFloat(stats[k][period]) || 0;
    });
    return total;
}

// ── Empty-period reporting ───────────────────────────────────────────────────
// metricAvailableForCrop() only knows whether a FILE is configured, not whether
// the selected year has anything in it. Durian carries a bearing-trees file, so
// the Trees tab is enabled for every year — but that file only holds 2025 and
// 2026, and the same is true of seven other tree crops on
// *_provincial_bearing_area.csv. Picking 2022 therefore painted an empty map
// with no explanation, which reads as a broken app rather than absent data.
//
// The hint reuses #year-hint, the element the sub-annual gap already speaks
// through, so there is one place a "nothing to show, and here is why" message
// appears rather than two competing ones.

function periodsWithData(stats) {
    if (!stats) return [];
    const codes = Object.keys(stats);
    return YEARS.filter(function (y) {
        return codes.some(function (k) { return parseFloat(stats[k][y]) > 0; });
    });
}

// -> a sentence when THIS period is empty but others are not, else null.
// Deliberately silent when the crop has no data in any period: that is a
// different situation (nothing published at all) and a different message.
function describeEmptyPeriod(stats, period, metricLabel, cropName) {
    const have = periodsWithData(stats);
    if (!have.length || have.indexOf(String(period)) !== -1) return null;

    const shown = cropName.replace(/^Overall\s+/i, '').replace(/\s+Production$/i, '');
    // Contiguous run to the end of the axis reads as "from 2025" rather than a
    // list; anything scattered has to be enumerated or the sentence lies.
    const first = YEARS.indexOf(have[0]);
    const contiguousToEnd = have.length === YEARS.length - first
        && have.every(function (y, i) { return YEARS[first + i] === y; });
    const when = contiguousToEnd
        ? 'is published from ' + periodLabel(have[0]) + ' onwards'
        : 'is published only for ' + have.map(periodLabel).join(', ');
    return metricLabel + ' for ' + shown + ' ' + when
        + ' — nothing to show for ' + periodLabel(period) + '.';
}

// Puts that sentence on screen, or clears it. Returns true when a gap was
// reported, so callers can skip drawing an empty legend over an empty map.
// `stats` is injectable so this is testable: currentProvStats/currentCropStats
// are module-scope `let`s, invisible to anything driving the page from outside.
function reportEmptyPeriod(cropName, stats, period) {
    const hint = document.getElementById('year-hint');
    stats = stats || currentProvStats || currentCropStats;
    const msg = describeEmptyPeriod(stats, period || currentYear,
                                    getActiveMetricDef().title, cropName || '');
    if (msg) {
        hint.textContent = msg;
        hint.style.display = 'block';
        // Tag it so scrubbing to a year WITH data clears this message and only
        // this one — #year-hint is shared with the sub-annual notice and the
        // "select a crop" prompt, and blanking those would be a regression.
        hint.dataset.emptyPeriod = '1';
        return true;
    }
    if (hint.dataset.emptyPeriod) {
        hint.style.display = 'none';
        delete hint.dataset.emptyPeriod;
    }
    return false;
}

function metricAvailableForCrop(cropName, metricId) {
    const metricDef = METRICS.find(m => m.id === metricId);
    const config = cropName ? cropConfig[cropName] : null;
    return !!(
        (config && config[metricDef.fileKey]) ||
        (cropName && provConfig[cropName] && provConfig[cropName][metricDef.provFileKey])
    );
}

// ── Data coverage ────────────────────────────────────────────────────────────
// Which commodities carry which of the five metrics, derived live from
// cropConfig/provConfig via metricAvailableForCrop(). Nothing is hardcoded, so
// adding a crop or wiring up a new file updates both views on its own.
//
// The groups exist because a missing metric is usually CORRECT, not missing.
// PSA publishes no area for 23 commodities, and not one of them has a yield
// file either — yield is volume/area, so it cannot be derived without area.
// Tree crops are measured in bearing trees rather than hectares and carry
// Trees + Yield/Tree instead; for livestock and fisheries hectares are
// meaningless. autoSwitchMetricCounterpart() already moves the user across
// those pairs rather than landing them on an empty view; this just says so.
var coverageShowAll = false;   // var: read by renderCoverageMatrix() before init

function metricCoverage() {
    const crops = Object.keys(CROP_META);
    const has = (c, m) => metricAvailableForCrop(c, m);
    const noArea = crops.filter(c => !has(c, 'area'));
    return {
        crops: crops,
        // has Bearing Trees standing in for hectares
        treesInsteadOfArea: noArea.filter(c => has(c, 'trees')),
        // neither — livestock, fisheries, and the crops PSA reports by volume alone
        volumeOnly: noArea.filter(c => !has(c, 'trees')),
        noArea: noArea
    };
}

function cropShortName(cropName) {
    return cropName.replace(/^Overall\s+/i, '').replace(/\s+Production$/i, '');
}

// One row per crop, a tick or a dash per metric. Defaults to only the crops
// with a gap — the whole point is the answer to "what is missing", and 78 rows
// of mostly-complete data buries it. The toggle shows everything.
function renderCoverageMatrix() {
    const table = document.getElementById('coverage-table');
    if (!table) return;
    const cov = metricCoverage();
    // A "gap" is a commodity with NO productivity measure at all, which is
    // narrower than "no Area" twice over:
    //   * "missing any metric" selects all 78 — Trees and Yield/Tree only ever
    //     apply to tree crops, so every crop lacks something.
    //   * "no Area" still pulls in the 8 tree crops, and those are not a gap:
    //     they carry Trees and Yield/Tree instead, which is the correct measure
    //     for an orchard. Listing them as missing implies something is absent
    //     when the substitute is right there in the same row.
    // What is left is the commodities with volume and nothing else.
    const rows = coverageShowAll ? cov.crops : cov.volumeOnly;

    let html = '<thead><tr><th>Commodity</th>'
        + METRICS.map(m => '<th>' + esc(m.label) + '</th>').join('')
        + '</tr></thead><tbody>';
    html += rows.map(function (c) {
        const meta = CROP_META[c] || { emoji: '🌱' };
        return '<tr><td>' + meta.emoji + ' ' + esc(cropShortName(c)) + '</td>'
            + METRICS.map(function (m) {
                const ok = metricAvailableForCrop(c, m.id);
                return '<td class="cov ' + (ok ? 'yes' : 'no') + '" title="'
                    + esc(m.title + (ok ? '' : ' — not published for this commodity'))
                    + '">' + (ok ? '✓' : '—') + '</td>';
            }).join('') + '</tr>';
    }).join('');
    html += '</tbody>';
    table.innerHTML = html;

    const sub = document.getElementById('coverage-sub');
    if (sub) {
        sub.textContent = coverageShowAll
            ? rows.length + ' commodities · all measurements'
            : rows.length + ' of ' + cov.crops.length + ' commodities have Volume only — no '
              + 'productivity measure at all (' + cov.treesInsteadOfArea.length
              + ' more use Trees and Yield/Tree instead of hectares)';
    }
    const btn = document.getElementById('coverage-toggle-btn');
    if (btn) btn.textContent = coverageShowAll ? 'Show only gaps' : 'Show all ' + cov.crops.length;
}

// Prose for the help modal — same source, sentence form.
function renderCoverageHelp() {
    const el = document.getElementById('help-coverage');
    if (!el) return;
    const cov = metricCoverage();
    const list = arr => arr.map(cropShortName).sort().map(esc).join(', ');
    el.innerHTML =
        '<p>A greyed-out tab means PSA does not publish that measurement for the '
        + 'crop — not that the map is missing it. <b>' + cov.noArea.length + ' of '
        + cov.crops.length + '</b> commodities have no Area, and none of them has a '
        + 'Yield either: yield is volume ÷ area, so without area there is nothing '
        + 'to divide.</p>'
        + '<p><b>Measured in bearing trees, not hectares (' + cov.treesInsteadOfArea.length
        + ').</b> These carry <b>Trees</b> and <b>Yield/Tree</b> instead — pick one while '
        + 'you are on Area or Yield and the map switches you across automatically.<br>'
        + '<span class="help-crops">' + list(cov.treesInsteadOfArea) + '</span></p>'
        + '<p><b>Volume only (' + cov.volumeOnly.length + ').</b> Livestock and fisheries, '
        + 'where hectares mean nothing, plus the crops PSA reports by volume alone.<br>'
        + '<span class="help-crops">' + list(cov.volumeOnly) + '</span></p>';
}

function openCoverage() {
    renderCoverageMatrix();
    document.getElementById('coverage-modal').hidden = false;
    document.getElementById('coverage-close-btn').focus();
}

function closeCoverage() {
    document.getElementById('coverage-modal').hidden = true;
}

function updateMetricTabAvailability(cropName) {
    document.querySelectorAll('.metric-tab').forEach(tab => {
        const metricDef = METRICS.find(m => m.id === tab.dataset.metric);
        const available = metricAvailableForCrop(cropName, metricDef.id);
        tab.classList.toggle('unavailable', !available);
        tab.title = available ? '' : metricDef.label + ' data not yet available for this crop';
    });
}

// Trees and Area are the two metrics with the most uneven crop coverage —
// if the currently active one has no data for the crop being selected but
// its counterpart does, switch there automatically rather than landing on
// an empty "not available" view the user would have to notice and fix by hand.
// Trees/Area: most fruit crops have Trees but not every crop with Trees also
// has Area, and vice versa. Yield/Yield-per-Tree: Yield/Tree only covers ~10
// tree crops while Yield covers dozens of non-tree ones (Abaca, Cotton,
// Tobacco, etc.) — picking a non-tree crop while on Yield/Tree, or a
// Yield/Tree-only crop like Cacao while on Yield, hits the exact same gap.
function autoSwitchMetricCounterpart(cropName) {
    const counterpart = { trees: 'area', area: 'trees', yield: 'yieldtree', yieldtree: 'yield' };
    const swapTo = counterpart[activeMetric];
    if (!swapTo) return;
    if (metricAvailableForCrop(cropName, activeMetric)) return;
    if (!metricAvailableForCrop(cropName, swapTo)) return;
    activeMetric = swapTo;
    updateMetricUI();
}

function toggleSection(el) {
    const children = el.nextElementSibling;
    const chevron = el.querySelector('.chevron');
    if (!children) return;
    const isOpen = children.classList.toggle('open');
    if (chevron) chevron.classList.toggle('open', isOpen);
    el.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

function toggleBorders() {
    const checked = document.getElementById('toggle-borders').checked;
    if (checked) boundaryLayer.addTo(map);
    else map.removeLayer(boundaryLayer);
}

function toggleLegend() {
    const body = document.getElementById('legend-body');
    const btn = document.getElementById('legend-toggle');
    const isOpen = !body.classList.contains('collapsed');
    body.classList.toggle('collapsed', isOpen);
    btn.classList.toggle('collapsed', isOpen);
    btn.title = isOpen ? 'Expand legend' : 'Collapse legend';
}

function setLayerOpacity(val) {
    layerOpacity = val / 100;
    document.getElementById('opacity-value').textContent = val + '%';
    if (cropLayer) {
        cropLayer.eachLayer(function (l) {
            if (currentClsMap[l.feature.properties.ADM1_PCODE]) l.setStyle({ fillOpacity: layerOpacity });
        });
    }
    if (provincialDataLayer) {
        provincialDataLayer.eachLayer(function (l) {
            const pcode = effectiveProvincePcode(l.feature.properties.ADM2_PCODE);
            if (currentProvClsMap[pcode]) l.setStyle({ fillOpacity: layerOpacity });
        });
    }
}

// ── 15. Custom Search ────────────────────────────────────────────────────────
var SearchControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
        var container = L.DomUtil.create('div', 'custom-search-control leaflet-bar');
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        var btn = L.DomUtil.create('button', 'custom-search-btn', container);
        btn.innerHTML = RAIL_ICONS.search;
        btn.title = 'Search location';
        btn.type = 'button';
        var input = L.DomUtil.create('input', 'custom-search-input', container);
        input.type = 'text';
        input.placeholder = 'Search location...';
        var results = L.DomUtil.create('div', 'custom-search-results', container);
        var searchTimeout = null;
        L.DomEvent.on(btn, 'click', function () {
            container.classList.toggle('open');
            if (container.classList.contains('open')) input.focus();
            else { input.value = ''; results.innerHTML = ''; results.classList.remove('visible'); }
        });
        L.DomEvent.on(input, 'input', function () {
            clearTimeout(searchTimeout);
            var q = input.value.trim();
            if (q.length < 2) { results.innerHTML = ''; results.classList.remove('visible'); return; }
            searchTimeout = setTimeout(function () {
                fetch('https://photon.komoot.io/api/?q=' + encodeURIComponent(q) + '&limit=5')
                    .then(r => r.json())
                    .then(function (data) {
                        results.innerHTML = '';
                        if (!data.features || !data.features.length) { results.classList.remove('visible'); return; }
                        data.features.forEach(function (f) {
                            var p = f.properties;
                            var name = p.name || '';
                            var sub = [p.city, p.state, p.country].filter(Boolean).join(', ');
                            var item = L.DomUtil.create('div', 'custom-search-result-item', results);
                            item.innerHTML =
                                '<div class="result-main">' + esc(name) + '</div>' +
                                (sub ? '<div class="result-sub">' + esc(sub) + '</div>' : '');
                            L.DomEvent.on(item, 'click', function () {
                                map.fitBounds(L.geoJSON(f).getBounds());
                                input.value = name;
                                results.innerHTML = '';
                                results.classList.remove('visible');
                                container.classList.remove('open');
                            });
                        });
                        results.classList.add('visible');
                    })
                    .catch(function () { results.classList.remove('visible'); });
            }, 300);
        });
        L.DomEvent.on(document, 'click', function (e) {
            if (!container.contains(e.target)) { results.innerHTML = ''; results.classList.remove('visible'); }
        });
        return container;
    }
});
new SearchControl().addTo(map);

// ── 16. Fullscreen ───────────────────────────────────────────────────────────
var FullscreenControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
        var btn = L.DomUtil.create('button', 'fullscreen-btn leaflet-bar');
        btn.title = 'Toggle fullscreen';
        btn.innerHTML = RAIL_ICONS.maximize;
        L.DomEvent.disableClickPropagation(btn);
        L.DomEvent.on(btn, 'click', function () {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
                btn.innerHTML = RAIL_ICONS.minimize;
                btn.dataset.tip = 'Exit fullscreen';
            } else {
                document.exitFullscreen();
                btn.innerHTML = RAIL_ICONS.maximize;
                btn.dataset.tip = 'Toggle fullscreen';
            }
        });
        document.addEventListener('fullscreenchange', function () {
            if (!document.fullscreenElement) { btn.innerHTML = RAIL_ICONS.maximize; btn.dataset.tip = 'Toggle fullscreen'; }
        });
        return btn;
    }
});
new FullscreenControl().addTo(map);

// ── Help button ──────────────────────────────────────────────────────────────
var HelpControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
        var btn = L.DomUtil.create('button', 'help-btn leaflet-bar');
        btn.title = 'Help — how to use this map';
        btn.setAttribute('aria-label', 'Help — how to use this map');
        btn.innerHTML = RAIL_ICONS.help;
        L.DomEvent.disableClickPropagation(btn);
        L.DomEvent.on(btn, 'click', openHelp);
        return btn;
    }
});
new HelpControl().addTo(map);

// Crop-panel toggle — lives in the nav rail and hides/shows the right-hand
// production panel, so the imagery can be viewed unobstructed
var PanelToggleControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
        var btn = L.DomUtil.create('button', 'panel-toggle-btn leaflet-bar');
        // Desktop starts with the panel tucked away for a clean map view;
        // the mobile bottom sheet stays, since it's the primary crop picker
        var startHidden = !isMobileView();
        if (startHidden) document.body.classList.add('panel-hidden');
        btn.title = startHidden ? 'Show crop panel' : 'Hide crop panel';
        btn.setAttribute('aria-label', 'Toggle crop panel');
        btn.setAttribute('aria-pressed', startHidden ? 'false' : 'true');
        btn.innerHTML = RAIL_ICONS.panel;
        btn.classList.toggle('active', !startHidden); // lit while its panel is open
        L.DomEvent.disableClickPropagation(btn);
        L.DomEvent.on(btn, 'click', function () {
            var hidden = document.body.classList.toggle('panel-hidden');
            btn.setAttribute('aria-pressed', hidden ? 'false' : 'true');
            btn.dataset.tip = hidden ? 'Show crop panel' : 'Hide crop panel';
            btn.classList.toggle('active', !hidden);
            // The layers flyout docks against the panel's edge — follow it
            positionLayersFlyout();
        });
        return btn;
    }
});
new PanelToggleControl().addTo(map);

// Layers flyout — basemap, hillshade, boundaries and opacity in one place
var LayersControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
        var btn = L.DomUtil.create('button', 'layers-btn leaflet-bar');
        btn.dataset.tip = 'Map layers & style';
        btn.setAttribute('aria-label', 'Map layers and style');
        btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = RAIL_ICONS.layers;
        L.DomEvent.disableClickPropagation(btn);
        L.DomEvent.on(btn, 'click', function (e) {
            // disableClickPropagation doesn't stop the native 'click' from
            // bubbling — without this the document-level outside-click closer
            // fires on the very click that opened the flyout
            L.DomEvent.stopPropagation(e);
            var fly = document.getElementById('layers-flyout');
            var open = fly.hidden;
            fly.hidden = !open;
            btn.classList.toggle('active', open);
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            if (open) positionLayersFlyout();
        });
        return btn;
    }
});
new LayersControl().addTo(map);

// Anchors the open flyout beside the layers button, clamped to the viewport;
// if the crop panel is open it sits to the panel's right so the two never
// overlap. Re-run whenever the panel toggles or the window resizes, so the
// flyout slides into the freed-up (or newly occupied) space.
function positionLayersFlyout() {
    var fly = document.getElementById('layers-flyout');
    var btn = document.querySelector('.layers-btn');
    if (fly.hidden || !btn) return;
    var panel = document.getElementById('control-panel');
    var panelVisible = panel && !isMobileView()
        && !document.body.classList.contains('panel-hidden');
    fly.style.left = isMobileView() ? '12px'
        : (panelVisible ? Math.round(panel.getBoundingClientRect().right + 10) + 'px' : '68px');
    fly.style.top = Math.max(12, Math.min(
        btn.getBoundingClientRect().top,
        window.innerHeight - fly.offsetHeight - 12)) + 'px';
}

window.addEventListener('resize', positionLayersFlyout);

function closeLayersFlyout() {
    var fly = document.getElementById('layers-flyout');
    if (fly.hidden) return;
    fly.hidden = true;
    var b = document.querySelector('.layers-btn');
    if (b) { b.classList.remove('active'); b.setAttribute('aria-expanded', 'false'); }
}

// Click anywhere outside the flyout closes it — except clicks on the nav rail
// itself (native clicks there still bubble despite disableClickPropagation),
// so using other tools (e.g. the crop-panel toggle) keeps the flyout open and
// lets it re-anchor instead of vanishing
document.addEventListener('click', function (e) {
    var fly = document.getElementById('layers-flyout');
    if (!fly.hidden && !fly.contains(e.target)
        && !e.target.closest('.leaflet-top.leaflet-left')) {
        closeLayersFlyout();
    }
});

// Nav-rail polish pass, after every control exists:
// 1) native title attributes become data-tip so the styled chips render
//    beside the rail (aria-label backfilled for screen readers);
// 2) the built-in zoom glyphs and plugin icons swap to the shared SVG set.
document.querySelectorAll('.leaflet-top.leaflet-left a[title], .leaflet-top.leaflet-left button[title]')
    .forEach(function (el) {
        el.dataset.tip = el.title;
        if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', el.title);
        el.removeAttribute('title');
    });
(function () {
    // (measure's ruler is a CSS background image — see app.css — because the
    // plugin's own content styling defeats an inline SVG)
    var swap = {
        '.leaflet-control-zoom-in': 'plus',
        '.leaflet-control-zoom-out': 'minus',
        '.leaflet-control-locate a': 'locate'
    };
    Object.keys(swap).forEach(function (sel) {
        var el = document.querySelector(sel);
        if (el) el.innerHTML = RAIL_ICONS[swap[sel]];
    });
    // Measure expands its own labeled panel on hover — a tooltip chip on top
    // of that is duplicate noise, so it keeps only the aria-label
    var measToggle = document.querySelector('.leaflet-control-measure .leaflet-control-measure-toggle');
    if (measToggle) delete measToggle.dataset.tip;
})();

function openHelp() {
    // Rendered on open, not baked into index.html: the sentence this replaced
    // ("Fisheries and livestock only have Volume") had drifted out of date as
    // crops were added, and a generated one cannot.
    renderCoverageHelp();
    document.getElementById('help-modal').hidden = false;
    document.getElementById('help-close-btn').focus();
}

function closeHelp() {
    document.getElementById('help-modal').hidden = true;
}

// ── 17. Fix Measure button ────────────────────────────────────────────────────
setTimeout(function () {
    var t = document.querySelector('.leaflet-control-measure .leaflet-control-measure-toggle');
    if (t) { t.innerHTML = '📏'; t.title = 'Measure distances and areas'; t.style.fontSize = '15px'; }
}, 400);

// ── 18. Wire up event listeners ──────────────────────────────────────────────
function toggleTreeList() {
    const panel = document.getElementById('control-panel');
    const btn = document.getElementById('tree-toggle');
    const collapsed = panel.classList.toggle('tree-collapsed');
    btn.classList.toggle('collapsed', collapsed);
    btn.title = collapsed ? 'Expand category list' : 'Collapse category list';
}

document.getElementById('tree-toggle').addEventListener('click', toggleTreeList);

function toggleMobileSheet() {
    const panel = document.getElementById('control-panel');
    const handle = document.getElementById('sheet-handle');
    const expanded = panel.classList.toggle('sheet-expanded');
    handle.title = expanded ? 'Collapse panel' : 'Expand panel';
}

let sheetSwiped = false;
document.getElementById('sheet-handle').addEventListener('click', function () {
    // a swipe already handled this gesture — swallow the synthetic click
    if (sheetSwiped) { sheetSwiped = false; return; }
    toggleMobileSheet();
});

// Swipe up/down on the handle also expands/collapses the sheet
(function () {
    const handle = document.getElementById('sheet-handle');
    const panel = document.getElementById('control-panel');
    let startY = null;
    handle.addEventListener('touchstart', function (e) {
        startY = e.touches[0].clientY;
    }, { passive: true });
    handle.addEventListener('touchend', function (e) {
        if (startY === null) return;
        const dy = e.changedTouches[0].clientY - startY;
        startY = null;
        if (Math.abs(dy) < 25) return; // just a tap — the click handler takes it
        sheetSwiped = true;
        const expand = dy < 0;
        panel.classList.toggle('sheet-expanded', expand);
        handle.title = expand ? 'Collapse panel' : 'Expand panel';
    }, { passive: true });
})();

document.getElementById('toggle-borders').addEventListener('change', toggleBorders);
document.getElementById('opacity-slider').addEventListener('input', function () { setLayerOpacity(this.value); });
document.getElementById('legend-toggle').addEventListener('click', toggleLegend);

// ── Draggable legend (desktop) ──────────────────────────────────────────────
// Grab the header to move the panel anywhere; the collapse button still works
// as a button. Mobile keeps its fixed top-right spot (drag fights scrolling).
(function () {
    const panel = document.getElementById('legend-panel');
    const handle = document.getElementById('legend-header');
    let dragging = false, offX = 0, offY = 0;
    handle.addEventListener('pointerdown', function (e) {
        if (isMobileView() || e.target.closest('#legend-toggle')) return;
        dragging = true;
        const r = panel.getBoundingClientRect();
        offX = e.clientX - r.left;
        offY = e.clientY - r.top;
        panel.classList.add('dragging');
        handle.setPointerCapture(e.pointerId);
        e.preventDefault();
    });
    handle.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        const x = Math.min(Math.max(e.clientX - offX, 4), window.innerWidth - panel.offsetWidth - 4);
        const y = Math.min(Math.max(e.clientY - offY, 4), window.innerHeight - 60);
        panel.style.left = x + 'px';
        panel.style.top = y + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
    });
    function endDrag() {
        dragging = false;
        panel.classList.remove('dragging');
    }
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
})();
document.getElementById('year-controller-toggle').addEventListener('click', toggleYearController);
document.getElementById('play-btn').addEventListener('click', togglePlay);
// The slider is an INDEX into YEARS now, not a year number — periods are not
// evenly spaced integers once quarters are in play.
// The slider indexes YEARS-the-list-of-years now. Moving it keeps the period
// you were on where that period exists in the new year (Q3 2023 -> Q3 2024),
// and falls back to that year's last period where it does not (2026 has no Q3
// yet), rather than silently jumping to Q1.
function periodInYear(targetYear, likePeriod) {
    const kids = periodsInYear(targetYear);
    if (!kids.length) return String(targetYear);
    const m = /[QS](\d)$/.exec(String(likePeriod));
    if (m) {
        const same = kids.filter(function (k) { return k.slice(-1) === m[1]; });
        if (same.length) return same[0];
    }
    return kids[kids.length - 1];
}

function goToYear(yr) {
    setYear(activeGranularity === 'annual' ? String(yr) : periodInYear(yr, currentYear));
}

document.getElementById('year-slider').addEventListener('input', function () {
    const years = timelineYears();
    goToYear(years[parseInt(this.value, 10)] || years[years.length - 1]);
});

document.getElementById('tree-scroll').addEventListener('click', function (e) {
    const header = e.target.closest('.section-header');
    if (header) {
        // Unpublished categories don't expand — there's nothing to show
        if (header.closest('.category-disabled')) return;
        toggleSection(header);
        return;
    }
    const subHeader = e.target.closest('.sub-group-header');
    if (subHeader) { toggleSection(subHeader); return; }
    const item = e.target.closest('.tree-item');
    if (item) {
        // Unpublished categories and placeholder crops keep their labels
        // visible but their data locked
        if (item.closest('.category-disabled') || item.classList.contains('item-disabled') || !item.dataset.crop) return;
        selectCrop(item, item.dataset.crop);
    }
});

// Explain the locked categories and placeholder crops on hover / to screen readers
document.querySelectorAll('.category-disabled .section-header, .tree-item.item-disabled').forEach(function (el) {
    el.title = 'Data not yet published';
    el.setAttribute('aria-disabled', 'true');
});

// Delegated: the ticks and dots are re-rendered whenever the granularity
// changes, so listeners bound to the old nodes would die with them.
document.getElementById('year-ticks-row').addEventListener('click', function (e) {
    const t = e.target.closest('.yr-tick-label');
    if (t && t.dataset.yr) goToYear(t.dataset.yr);
});
document.getElementById('year-dots-row').addEventListener('click', function (e) {
    const d = e.target.closest('.yr-dot');
    if (d && d.dataset.yr) goToYear(d.dataset.yr);
});
document.getElementById('period-children').addEventListener('click', function (e) {
    const b = e.target.closest('.period-child');
    if (b && b.dataset.period) setYear(b.dataset.period);
});

// ── Granularity switch ───────────────────────────────────────────────────────
// Annual is always available. Semester and Quarter light up only for the crops
// the Agristat sheet covers, and say why when they do not.
function setGranularity(gran) {
    if (!GRANULARITIES[gran] || gran === activeGranularity) return;
    activeGranularity = gran;
    document.querySelectorAll('.gran-btn').forEach(function (b) {
        const on = b.dataset.gran === gran;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-selected', String(on));
    });
    document.getElementById('year-badge').textContent = GRANULARITIES[gran].badge;
    if (gran === 'annual') {
        YEARS = ANNUAL_YEARS.slice();
        renderTimeline();
        setYear(currentYear);
    }
    // Non-annual period lists come from the file's own header, so the timeline
    // is rebuilt inside the load. Reloading the crop is what does it.
    if (currentCropName) loadCropData(currentCropName);
    else if (gran !== 'annual') { YEARS = ANNUAL_YEARS.slice(); renderTimeline(); setYear(currentYear); }
    updateGranularityAvailability();
}

// Grey out what this crop+metric has no data for, rather than letting someone
// pick it and get an empty map.
function updateGranularityAvailability() {
    const metricId = getActiveMetricDef().id;
    document.querySelectorAll('.gran-btn').forEach(function (b) {
        const g = b.dataset.gran;
        const ok = g === 'annual' || !currentCropName || hasSubAnnual(currentCropName, metricId, g);
        b.classList.toggle('is-unavailable', !ok);
        b.title = ok ? GRANULARITIES[g].label
                     : GRANULARITIES[g].label + ' data is only published for Palay and Corn';
    });
}

document.getElementById('granularity-row').addEventListener('click', function (e) {
    const b = e.target.closest('.gran-btn');
    if (b && b.dataset.gran) setGranularity(b.dataset.gran);
});

// ── Legend row highlight (hover previews, click pins) ────────────────────────
const legendItemsEl = document.getElementById('legend-items');

legendItemsEl.addEventListener('mouseover', function (e) {
    const row = e.target.closest('.legend-row');
    if (row && !stickyHighlightCls) highlightClass(row.dataset.cls);
});

legendItemsEl.addEventListener('mouseout', function (e) {
    const row = e.target.closest('.legend-row');
    if (row && !stickyHighlightCls) clearClassHighlight();
});

legendItemsEl.addEventListener('click', function (e) {
    const row = e.target.closest('.legend-row');
    if (!row) return;
    if (stickyHighlightCls === row.dataset.cls) {
        stickyHighlightCls = null;
        row.classList.remove('legend-row-active');
        clearClassHighlight();
    } else {
        stickyHighlightCls = row.dataset.cls;
        legendItemsEl.querySelectorAll('.legend-row-active').forEach(r => r.classList.remove('legend-row-active'));
        row.classList.add('legend-row-active');
        highlightClass(stickyHighlightCls);
    }
});

// Clicking a ranked region zooms to it
document.getElementById('legend-ranking').addEventListener('click', function (e) {
    const row = e.target.closest('.rank-row.rank-clickable');
    if (!row || !cropLayer) return;
    const pcode = row.dataset.pcode;
    cropLayer.eachLayer(function (l) {
        if (l.feature.properties.ADM1_PCODE === pcode && focusedPcode !== pcode) {
            focusRegion(l.feature, l);
        }
    });
});

// ── Data table modal ─────────────────────────────────────────────────────────
document.getElementById('view-table-btn').addEventListener('click', openDataTable);
document.getElementById('table-close-btn').addEventListener('click', closeDataTable);

// Expand/shrink the table modal between its normal size and near-fullscreen
(function () {
    var btn = document.getElementById('table-expand-btn');
    btn.innerHTML = RAIL_ICONS.maximize;
    btn.addEventListener('click', function () {
        var expanded = document.getElementById('table-modal-card').classList.toggle('expanded');
        btn.innerHTML = expanded ? RAIL_ICONS.minimize : RAIL_ICONS.maximize;
        btn.title = expanded ? 'Shrink table' : 'Expand table';
        btn.setAttribute('aria-label', btn.title);
    });
})();
document.getElementById('table-modal-backdrop').addEventListener('click', closeDataTable);
document.getElementById('table-export-btn').addEventListener('click', exportDataTableCSV);
document.getElementById('help-close-btn').addEventListener('click', closeHelp);
document.getElementById('coverage-btn').addEventListener('click', openCoverage);
document.getElementById('coverage-close-btn').addEventListener('click', closeCoverage);
document.getElementById('coverage-backdrop').addEventListener('click', closeCoverage);
document.getElementById('coverage-toggle-btn').addEventListener('click', function () {
    coverageShowAll = !coverageShowAll;
    renderCoverageMatrix();
});
document.getElementById('help-modal-backdrop').addEventListener('click', closeHelp);
document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!document.getElementById('table-modal').hidden) closeDataTable();
    else if (!document.getElementById('catalogue-table-modal').hidden) closeCatalogueRankingTable();
    else if (!document.getElementById('catalogue-compare-modal').hidden) closeCatalogueCompare();
    else if (!document.getElementById('coverage-modal').hidden) closeCoverage();
    else if (!document.getElementById('help-modal').hidden) closeHelp();
    else if (!document.getElementById('layers-flyout').hidden) closeLayersFlyout();
    else if (focusedPcode) resetFocus();
});

document.getElementById('breadcrumb').addEventListener('click', function () {
    if (focusedPcode) resetFocus();
});

// ── Crop search filter ───────────────────────────────────────────────────────
document.getElementById('crop-search').addEventListener('input', function () {
    filterCropTree(this.value.trim().toLowerCase());
});

function filterCropTree(q) {
    const searching = q.length > 0;
    let anyVisible = false;
    document.querySelectorAll('#tree-scroll .tree-item').forEach(function (item) {
        if (item.classList.contains('item-hidden')) return; // not part of the published list
        const match = !searching || item.textContent.toLowerCase().includes(q);
        item.style.display = match ? '' : 'none';
        if (searching && match && !item.closest('.metric-hidden, .category-disabled')) anyVisible = true;
    });
    // While searching, force-open groups that contain a match; on clear, the
    // user's own open/closed state (the .open classes) is untouched
    document.querySelectorAll('#tree-scroll .tree-children').forEach(function (group) {
        const hasMatch = !!group.querySelector('.tree-item:not([style*="none"]):not(.item-hidden)');
        group.classList.toggle('search-open', searching && hasMatch);
    });
    document.querySelectorAll('#tree-scroll .sub-group-header').forEach(function (h) {
        const kids = h.nextElementSibling;
        const hasMatch = kids && kids.querySelector('.tree-item:not([style*="none"]):not(.item-hidden)');
        h.style.display = searching && !hasMatch ? 'none' : '';
    });
    document.querySelectorAll('#tree-scroll .tree-section').forEach(function (sec) {
        // Unpublished categories never count as search matches — their crop
        // lists are hidden, so surfacing just the header would be confusing
        const hasMatch = !sec.classList.contains('category-disabled')
            && sec.querySelector('.tree-item:not([style*="none"]):not(.item-hidden)');
        sec.style.display = searching && !hasMatch ? 'none' : '';
    });
    document.getElementById('tree-no-results').hidden = !searching || anyVisible;
}

// ── Keyboard access for the crop tree ────────────────────────────────────────
document.querySelectorAll('.tree-item').forEach(function (item) {
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-pressed', 'false');
});

document.getElementById('tree-scroll').addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('tree-item')) {
        e.preventDefault();
        e.target.click();
    }
});

document.querySelectorAll('.section-header, .sub-group-header').forEach(function (h) {
    h.setAttribute('aria-expanded', 'false');
});

// ── Startup: restore the last-viewed crop (or default to Palay) so the first
// impression is a populated map instead of a blank one ───────────────────────
function revealCropItem(el) {
    let group = el.closest('.tree-children');
    while (group) {
        group.classList.add('open');
        const header = group.previousElementSibling;
        if (header) {
            const chev = header.querySelector('.chevron');
            if (chev) chev.classList.add('open');
            header.setAttribute('aria-expanded', 'true');
        }
        group = group.parentElement ? group.parentElement.closest('.tree-children') : null;
    }
}

// Called after the deep-linked crop has finished loading, when switching
// granularity is finally possible.
function applyHashGranularity() {
    if (!hashBootGranularity) return;
    const gran = hashBootGranularity, period = hashBootPeriod;
    hashBootGranularity = hashBootPeriod = null;   // once only

    // Wait for the crop's ANNUAL load to settle before switching. selectCrop()
    // has just started one; switching immediately starts a second, and
    // whichever response lands last wins currentCropStats — so a slow annual
    // reply could arrive after the quarterly one and leave annual figures
    // being read against a quarterly axis, which paints nothing at all.
    let waited = 0;
    (function whenCropSettled() {
        const ready = currentCropName && currentCropStats
                      && Object.keys(currentCropStats).length > 0;
        if (!ready) {
            if (++waited > 80) return;             // ~8s, then give up quietly
            setTimeout(whenCropSettled, 100);
            return;
        }
        if (!hasSubAnnual(currentCropName, getActiveMetricDef().id, gran)) return;
        setGranularity(gran);
        if (!period) return;
        // That kicked off its own load, and the period list only exists once
        // the file's header has been read.
        let tries = 0;
        (function whenAxisReady() {
            if (YEARS.indexOf(period) !== -1) { setYear(period); return; }
            if (++tries > 80) return;
            setTimeout(whenAxisReady, 100);
        })();
    })();
}

function autoSelectInitialCrop() {
    if (activeItem) return; // user beat us to it
    let crop = hashBootCrop; // deep link wins over the remembered crop
    if (!crop) {
        try { crop = localStorage.getItem('lastCrop'); } catch (e) { /* private mode */ }
    }
    if (!crop || !cropConfig[crop]) crop = 'Overall Palay Production';
    let el = document.querySelector('.tree-item[data-crop="' + crop + '"]');
    // Remembered/deep-linked crop may be unpublished or delisted — fall back
    if (el && (el.closest('.category-disabled') || el.classList.contains('item-hidden'))) {
        crop = 'Overall Palay Production';
        el = document.querySelector('.tree-item[data-crop="' + crop + '"]');
    }
    // A crop can be in cropConfig and still have no item in the tree — "Overall
    // Corn Production" is exactly that. Deep-linking to one used to leave the
    // map completely blank, because this returned without loading anything at
    // all. Fall back to the default rather than showing nothing.
    if (!el && crop !== 'Overall Palay Production') {
        crop = 'Overall Palay Production';
        el = document.querySelector('.tree-item[data-crop="' + crop + '"]');
    }
    if (!el) return;
    revealCropItem(el);
    selectCrop(el, crop);
    // The crop is loading now, so a shared semester/quarter view can finally
    // be restored — it needs the crop before it can switch granularity.
    applyHashGranularity();
}

// ── Shareable URL state ──────────────────────────────────────────────────────
// #crop=..&metric=..&year=..&region=..&basemap=..&catScope=..&catIsland=..&
// catRegion=..&catProvince=..&catCategory=.. — written with replaceState (no
// history spam), read once at boot. Region focus is applied after the crop's
// first render (consumePendingFocus in loadCropData); catalogue scope is
// applied by applyCatalogueHashState(), called once from initCatalogue().
function updateUrlHash() {
    const parts = [];
    if (currentCropName) parts.push('crop=' + encodeURIComponent(currentCropName));
    parts.push('metric=' + activeMetric);
    // Without this a link shared from a quarter or semester view came back as
    // annual: the period (2025Q2) is meaningless unless the reader also knows
    // which axis it belongs to. Omitted for annual so existing links are
    // untouched and the common case stays short.
    if (activeGranularity !== 'annual') parts.push('gran=' + activeGranularity);
    parts.push('year=' + currentYear);
    if (focusedPcode) parts.push('region=' + focusedPcode);
    if (currentBasemap !== 'carto') parts.push('basemap=' + currentBasemap);
    if (catalogueInitialized) {
        const level = document.getElementById('catalogue-level-select').value;
        if (level && level !== 'national') {
            parts.push('catScope=' + level);
            if (level === 'island') parts.push('catIsland=' + document.getElementById('catalogue-island-select').value);
            if (level === 'region' || level === 'province') parts.push('catRegion=' + document.getElementById('catalogue-region-select').value);
            if (level === 'province') parts.push('catProvince=' + document.getElementById('catalogue-province-select').value);
        }
        const category = document.getElementById('catalogue-category-select').value;
        if (category) parts.push('catCategory=' + encodeURIComponent(category));
    }
    history.replaceState(null, '', '#' + parts.join('&'));
}

function parseUrlHash() {
    const out = {};
    location.hash.replace(/^#/, '').split('&').forEach(function (kv) {
        const i = kv.indexOf('=');
        if (i > 0) out[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1));
    });
    return out;
}

var pendingFocusPcode = null;
var hashBootCrop = null;
// Set by bootFromHash() when the link was shared from a semester/quarter view,
// consumed by applyHashGranularity() once the crop's period file has loaded.
var hashBootGranularity = null;
var hashBootPeriod = null;
// Catalogue scope selects don't exist in a usable state until initCatalogue()
// runs (region/province options are populated on demand) — so boot just
// stashes the raw hash values here, and applyCatalogueHashState() (called at
// the end of initCatalogue()) does the actual restoring once selects/data
// are ready.
var hashBootCatalogue = null;
(function bootFromHash() {
    // READ THE HASH FIRST. setYear() calls updateUrlHash(), which does a
    // history.replaceState with the CURRENT state — so painting the timeline
    // before parsing overwrites the very link we are trying to restore, and
    // every deep link silently boots to the default crop and year.
    const h = parseUrlHash();

    // The dots and ticks live in JS now, so the timeline is empty markup until
    // this runs — before anything reads or sets the selected period.
    renderTimeline();
    setYear(currentYear);
    updateGranularityAvailability();
    if (h.metric && METRICS.some(m => m.id === h.metric)) {
        activeMetric = h.metric;
        updateMetricUI();
    }
    // A sub-annual period cannot be applied yet — YEARS still holds the annual
    // list, and the file that defines the real period axis is not fetched until
    // the crop loads. Stash both and let the crop load apply them.
    if (h.gran && GRANULARITIES[h.gran] && h.gran !== 'annual') {
        hashBootGranularity = h.gran;
        hashBootPeriod = h.year || null;
    } else if (h.year && YEARS.indexOf(h.year) !== -1) {
        setYear(h.year);
    }
    if (h.basemap) applyBasemap(h.basemap);
    if (h.crop && cropConfig[h.crop]) hashBootCrop = h.crop;
    if (h.region && /^\d{10}$/.test(h.region)) pendingFocusPcode = h.region;
    if (h.catScope || h.catCategory) {
        hashBootCatalogue = { level: h.catScope, island: h.catIsland, region: h.catRegion, province: h.catProvince, category: h.catCategory };
    }
})();

// Applies a deep-linked region focus once the crop layer exists
function consumePendingFocus() {
    if (!pendingFocusPcode || !cropLayer) return;
    const p = pendingFocusPcode;
    pendingFocusPcode = null;
    restoreFocus(p, regionDisplayName(p));
}

document.querySelectorAll('.metric-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
        if (this.classList.contains('unavailable') || this.classList.contains('locked') || metricLoading) return;
        const metric = this.dataset.metric;
        metricLoading = true;
        // lock immediately so user sees other tabs disabled while load happens
        lockOtherMetricTabs(metric);
        switchMetric(metric);
        // if loadCropData will not run (no active crop), finish immediately
        if (!(activeItem && currentCropName)) finishMetricLoad();
    });
});

// ══ Top 10 Commodities catalogue ════════════════════════════════════════════
// A second, normal-flow section below the map (reached by scrolling or the
// jump button) that ranks every published crop by Production Volume (MT) for
// whichever year is showing on the map's timeline, at four area levels:
// national, island group, region, province.
//
// Unlike the main map — which loads one crop's file at a time — ranking needs
// EVERY crop's value for one area, so the first time this section opens, all
// live crops' production files are fetched once and cached in `catalogueData`
// (crop name -> { byRegion, byProvince }). Area/year changes after that just
// re-rank the cached data; nothing is refetched.

const ISLAND_GROUPS = {
    luzon: {
        label: 'Luzon',
        regions: ['1300000000', '1400000000', '0100000000', '0200000000', '0300000000', '0400000000', '1700000000', '0500000000']
    },
    visayas: {
        label: 'Visayas',
        regions: ['0600000000', '0700000000', '0800000000', '1800000000']
    },
    mindanao: {
        label: 'Mindanao',
        regions: ['0900000000', '1000000000', '1100000000', '1200000000', '1600000000', '1900000000']
    }
};

// pcode -> island group key, built once from ISLAND_GROUPS for fast lookup
// when grouping the region <select> by island.
const REGION_TO_ISLAND = {};
Object.entries(ISLAND_GROUPS).forEach(([islandKey, group]) => {
    group.regions.forEach(pcode => { REGION_TO_ISLAND[pcode] = islandKey; });
});

// Sentinel value for the Category <select>'s curated "HVC Priority" option
// (High Value Crops Development Program) — a hand-picked list spanning
// several different Primary Categories, not a Primary Category value itself,
// so it needs its own matching branch wherever categoryFilter is checked.
const HVC_CATEGORY_VALUE = '__hvc__';

// Second curated cross-category list, same mechanism as HVC_CATEGORY_VALUE —
// a distinct hand-picked crop list (marked via meta.hvec), not a Primary
// Category value.
const HVEC_CATEGORY_VALUE = '__hvec__';

// Emoji icon + card details per published crop, keyed by the same crop name
// used in cropConfig/provConfig. blurb/sci/local/primary/sub come from
// data/Priority Commodities_working file - Commodity Dictionary.csv wherever
// it covers the crop (Definition & Botanical Description, Scientific Name,
// Local/Common Name (PH), Primary Category, Sub-Category columns). Fisheries
// and Livestock (8 crops) aren't in that dictionary and the four Palay/Corn
// variants have blank category/name cells there too — those keep sci/local/
// primary/sub empty rather than inventing values, and renderCatalogueGrid()
// simply omits a tag/name row when its value is empty. hvc:true marks the
// curated "HVC Priority" list (see HVC_CATEGORY_VALUE above).
const CROP_META = {
    'Overall Palay Production': { emoji: '🌾', blurb: "The harvested grain of the rice plant with its protective, inedible outer husk still intact — the raw agricultural commodity. Once milled to remove the husk it becomes bigas, and once cooked, kanin.", sci: 'Oryza sativa', local: 'Palay', primary: '', sub: '', aggregate: 'Irrigated + Rainfed Palay' },
    'Irrigated Palay Production': { emoji: '🌾', blurb: "Palay crops grown in fields that require standing water for normal growth, where water is supplied via artificial irrigation systems.", sci: '', local: '', primary: '', sub: '' },
    'Rainfed Palay Production': { emoji: '🌾', blurb: "Palay crops grown in fields that depend entirely on natural rainfall for their water supply, lacking any artificial irrigation setup.", sci: '', local: '', primary: '', sub: '' },
    // 'Overall Corn Production' is item-hidden in the crop tree, so it is
    // deliberately absent from CROP_META — same arrangement as Overall
    // Cassava, Cassava Industrial and Banana Cavendish. Its cropConfig/
    // provConfig entries and sub-annual files stay, so unhiding is removing
    // the class and restoring this entry.
    'Yellow Corn Production': { emoji: '🌽', blurb: "Corn varieties with yellow-pigmented kernels, rich in beta-carotene. The primary ingredient in formulated feed mixes for poultry, hogs, and aquaculture; also processed into corn oil and cornstarch.", sci: '', local: '', primary: '', sub: '' },
    'White Corn Production': { emoji: '🌽', blurb: "Corn varieties with white or cream-colored kernels, typically traditional 'flint' or glutinous cultivars. Milled into coarse grits (bugas mais) as a rice substitute, especially across the Visayas and Mindanao.", sci: '', local: '', primary: '', sub: '' },
    'Overall Avocado Production': { emoji: '🥑', blurb: "A unique pear-shaped fruit highly valued for its creamy texture and rich content of monounsaturated fats.", sci: 'Persea americana', local: 'Abocado', primary: 'Fruits', sub: 'Tropical Fruits', hvec: true },
    // 'Overall Banana Production' is item-hidden in the crop tree, so it is
    // deliberately absent from CROP_META — that object IS the catalogue's
    // universe (names = Object.keys(CROP_META)), and a crop the map will not
    // let you select should not rank in the Top 10 either. Same arrangement as
    // Banana Cavendish, Cassava and Celery. Its cropConfig/provConfig entries
    // stay in place, so unhiding is removing the class and restoring this line:
    //   'Overall Banana Production': { emoji: '🍌', …, aggregate: 'all banana varieties' }
    // Removing it does NOT move the share denominator: aggregates were already
    // excluded from it, so the total is unchanged and only the ranked COUNT drops
    // by one. Banana Cardava remains and keeps its own tonnage in the base.
    'Banana Cardava Production': { emoji: '🍌', blurb: "A highly versatile, starchy cooking banana native to the Philippines. Shorter, thicker, and more angular than dessert bananas like the Cavendish, with a thick peel and firm, white flesh.", sci: 'Musa acuminata × Musa balbisiana', local: 'Saging na Saba', primary: 'Fruits', sub: 'Tropical Fruits', hvec: true },
    'Overall Calamansi Production': { emoji: '🍋', blurb: "A small, intensely sour indigenous citrus fruit with a green-to-yellow peel, central to regional gastronomy.", sci: 'Citrus microcarpa', local: 'Kalamansi', primary: 'Fruits', sub: 'Citrus', hvec: true },
    'Overall Dalandan Production': { emoji: '🍊', blurb: "A local sweet orange hybrid with a glossy dark green rind and tart, deeply refreshing orange pulp.", sci: 'Citrus aurantium', local: 'Dalandan', primary: 'Fruits', sub: 'Citrus', hvec: true },
    'Overall Dragon Fruit Production': { emoji: '🐉', blurb: "A climbing cactus fruit showing vibrant pink skin with scaled bracts and speckled, refreshing flesh.", sci: 'Selenicereus undatus', local: 'Dragon Fruit', primary: 'Fruits', sub: 'Tropical Fruits', hvec: true },
    'Overall Durian Production': { emoji: '🌰', blurb: "A large, spike-covered fruit famous for its powerful aroma and rich, custard-like, highly decadent flesh.", sci: 'Durio zibethinus', local: 'Durian', primary: 'Fruits', sub: 'Tropical Fruits', hvec: true },
    'Overall Mango Production': { emoji: '🥭', blurb: "The national fruit of the Philippines, internationally acclaimed for its exceptionally sweet, non-fibrous golden flesh.", sci: 'Mangifera indica', local: 'Mangga', primary: 'Fruits', sub: 'Tropical Fruits', hvec: true },
    'Overall Melon Production': { emoji: '🍈', blurb: "A sweet, fragrant round fruit with dynamic orange or green flesh and a high juice content.", sci: 'Cucumis melo', local: 'Melon', primary: 'Fruits', sub: 'Tropical Fruits' },
    'Overall Pineapple Production': { emoji: '🍍', blurb: "A juicy, sweet tropical compound fruit renowned for its striking crown of leaves and high bromelain content.", sci: 'Ananas comosus', local: 'Pinya (Fruit)', primary: 'Fruits', sub: 'Tropical Fruits', hvec: true },
    'Overall Pomelo Production': { emoji: '🍊', blurb: "The largest wild citrus fruit species, exhibiting thick pith and crisp, sweet, mildly pink vesicles.", sci: 'Citrus maxima', local: 'Suha / Lukban', primary: 'Fruits', sub: 'Citrus', hvec: true },
    'Overall Rambutan Production': { emoji: '🔴', blurb: "A bright red tropical fruit covered in soft, hair-like spines, revealing translucent, sweet arils.", sci: 'Nephelium lappaceum', local: 'Rambutan', primary: 'Fruits', sub: 'Tropical Fruits', hvec: true },
    'Overall Cacao Production': { emoji: '🍫', blurb: "An understory tree crop yielding large pods containing beans processed into chocolate and cocoa solids.", sci: 'Theobroma cacao', local: 'Kakao', primary: 'Industrial & Stimulant Crops', sub: 'Beverage Crops', hvec: true },
    'Overall Coconut Production': { emoji: '🥥', blurb: "The 'Tree of Life' fruit crop, harvested for its edible meat, hydrating water, and highly valuable commercial oil.", sci: 'Cocos nucifera', local: 'Niyog', primary: 'Industrial & Stimulant Crops', sub: 'Oil Crops', hvec: true },
    'Overall Pili Production': { emoji: '🌰', blurb: "An endemic tree nut boasting a remarkably rich, buttery kernel enclosed in a hard, smooth shell.", sci: 'Canarium ovatum', local: 'Pili', primary: 'Fruits', sub: 'Nuts', hvec: true },
    'Overall Abaca Production': { emoji: '🌿', blurb: "A close relative of the banana endemic to the Philippines, prized globally for yielding the strongest natural leaf fibers.", sci: 'Musa textilis', local: 'Abaka', primary: 'Fiber Crops', sub: 'Plant Fibers' },
    'Overall Pinya Fiber Production': { emoji: '🍍', blurb: "An exquisite fiber extracted from the long leaves of specific pineapple cultivars (e.g., Red Spanish).", sci: 'Ananas comosus (Fiber)', local: 'Pinya (Fiber)', primary: 'Fiber Crops', sub: 'Plant Fibers' },
    'Overall Cotton Production': { emoji: '☁️', blurb: "A soft, fluffy seed-case fiber that grows in a protective boll around the seeds of the cotton plant.", sci: 'Gossypium hirsutum', local: 'Bulak', primary: 'Fiber Crops', sub: 'Plant Fibers' },
    'Overall Bariw Production': { emoji: '🌿', blurb: "A resilient, wild screwpine species with long thorny leaves harvested and prepared for heavy-duty weaving.", sci: 'Pandanus copelandii', local: 'Bariw', primary: 'Fiber Crops', sub: 'Palms/Screwpines' },
    'Overall Salago Production': { emoji: '🌿', blurb: "An indigenous shrub with incredibly tough bast bark fibers used for high-performance specialty papers.", sci: 'Wikstroemia ovata', local: 'Salago', primary: 'Fiber Crops', sub: 'Plant Fibers' },
    'Overall Coir Production': { emoji: '🥥', blurb: "The coarse, fibrous material extracted from the outer husk of the coconut fruit, highly resistant to rot.", sci: 'Cocos nucifera (Coir)', local: 'Bunot / Coir', primary: 'Fiber Crops', sub: 'Plant Fibers' },
    'Overall Tobacco Production': { emoji: '🍂', blurb: "The cured leaf of Nicotiana tabacum, grown as a major cash crop concentrated in Ilocos and Cagayan Valley.", sci: 'Nicotiana tabacum', local: 'Tabako', primary: 'Industrial & Stimulant Crops', sub: '' },
    'Tobacco Virginia Production': { emoji: '🍂', blurb: "A flue-cured tobacco variety characterized by high sugar content and bright golden leaves.", sci: 'Nicotiana tabacum', local: 'Tabako (Virginia)', primary: 'Industrial & Stimulant Crops', sub: 'Tobacco' },
    'Tobacco Native Production': { emoji: '🍂', blurb: "Sun-cured local heritage cultivars traditionally processed into strong local leaf formats.", sci: 'Nicotiana tabacum', local: 'Tabako (Native)', primary: 'Industrial & Stimulant Crops', sub: 'Tobacco' },
    'Overall Cabbage Production': { emoji: '🥬', blurb: "A round, leafy head vegetable with tightly overlapping leaves, thriving in elevated highland zones.", sci: 'Brassica oleracea var. capitata', local: 'Repolyo', primary: 'Vegetables', sub: 'Cruciferous', hvc: true },
    'Overall Carrots Production': { emoji: '🥕', blurb: "A crisp, sweet root vegetable with bright orange flesh exceptional in beta-carotene and structural crunch.", sci: 'Daucus carota', local: 'Karot', primary: 'Root Crops & Tubers', sub: 'Roots', hvc: true },
    'Overall Cauliflower Production': { emoji: '🥦', blurb: "A cool-season crop where dense, compact white flower clusters (curds) form the primary edible structure.", sci: 'Brassica oleracea var. botrytis', local: 'Koliprawer', primary: 'Vegetables', sub: 'Cruciferous' },
    'Overall Habitsuelas Production': { emoji: '🫘', blurb: "The tender, edible green pods of the common bush bean, crunchy and widely cultivated in cool highlands.", sci: 'Phaseolus vulgaris', local: 'Baguio Beans', primary: 'Vegetables', sub: 'Legumes', hvc: true },
    'Overall Chinese Cabbage Production': { emoji: '🥬', blurb: "A leafy vegetable forming a compact, elongated head with broad white ribs and light green leaves.", sci: 'Brassica rapa subsp. pekinensis', local: 'Pechay Baguio', primary: 'Vegetables', sub: 'Cruciferous', hvc: true },
    'Overall Asparagus Production': { emoji: '🌱', blurb: "A perennial crop harvested for its tender, crisp green spears before the foliage expands.", sci: 'Asparagus officinalis', local: 'Asparagus', primary: 'Vegetables', sub: 'Stem Vegetables', hvec: true },
    'Overall Lettuce Production': { emoji: '🥬', blurb: "An annual leafy crop cultivated primarily for salads, known for crisp leaves and high water content.", sci: 'Lactuca sativa', local: 'Litsugas', primary: 'Vegetables', sub: 'Leafy Greens' },
    'Overall Chili Pepper Production': { emoji: '🌶️', blurb: "A small, pungent, highly spicy native chili cultivar widely used to introduce heat to dishes.", sci: 'Capsicum frutescens', local: 'Siling Labuyo', primary: 'Herbs & Spices', sub: 'Condiments', hvc: true },
    'Overall Bell Pepper Production': { emoji: '🫑', blurb: "Large, blocky, sweet-fleshed non-pungent peppers available in vibrant red, yellow, and green varieties.", sci: 'Capsicum annuum', local: 'Siling Gansa', primary: 'Vegetables', sub: 'Fruit Vegetables' },
    'Overall Ampalaya Production': { emoji: '🥒', blurb: "A rugose, bitter-tasting green pod vegetable (Bitter Gourd) celebrated for its medicinal properties and blood sugar management.", sci: 'Momordica charantia', local: 'Ampalaya', primary: 'Vegetables', sub: 'Fruit Vegetables', hvc: true },
    'Overall Squash Production': { emoji: '🎃', blurb: "A sprawling vine (Kalabasa) that bears large, hard-skinned yellow/orange fruits rich in Vitamin A and carbohydrates.", sci: 'Cucurbita moschata', local: 'Kalabasa', primary: 'Vegetables', sub: 'Fruit Vegetables', hvc: true },
    'Overall Okra Production': { emoji: '🥒', blurb: "A mucilaginous flowering plant (Lady Finger) valued for its fibrous, seed-containing green pods.", sci: 'Abelmoschus esculentus', local: 'Okra', primary: 'Vegetables', sub: 'Fruit Vegetables', hvec: true },
    'Overall Eggplant Production': { emoji: '🍆', blurb: "A tropical perennial plant grown for its edible purple or green elongated fruits with a spongy texture.", sci: 'Solanum melongena', local: 'Talong', primary: 'Vegetables', sub: 'Fruit Vegetables', hvc: true },
    'Overall Stringbeans Production': { emoji: '🫛', blurb: "A climbing annual plant known for its remarkably long green pods, harvested as a vital legume source.", sci: 'Vigna unguiculata subsp. sesquipedalis', local: 'Sitaw', primary: 'Vegetables', sub: 'Legumes', hvc: true },
    'Overall Bottle Gourd Production': { emoji: '🥒', blurb: "A vine-grown herbaceous plant producing long, green-skinned fruits with white flesh, typically harvested immature.", sci: 'Lagenaria siceraria', local: 'Upo', primary: 'Vegetables', sub: 'Fruit Vegetables' },
    'Overall Sponge Gourd Production': { emoji: '🥒', blurb: "A cylindrical, ridged fruit vegetable harvested young for food or dried maturely for industrial loofah sponges.", sci: 'Luffa acutangula', local: 'Patola', primary: 'Vegetables', sub: 'Fruit Vegetables' },
    'Overall Tomato Production': { emoji: '🍅', blurb: "A savory, juicy red fruit vegetable rich in lycopene, acting as a foundational culinary base.", sci: 'Solanum lycopersicum', local: 'Kamatis', primary: 'Vegetables', sub: 'Fruit Vegetables', hvc: true },
    'Overall Cucumber Production': { emoji: '🥒', blurb: "A cylindrical, high-moisture green creeping vine fruit widely consumed fresh for cooling properties.", sci: 'Cucumis sativus', local: 'Pipino', primary: 'Vegetables', sub: 'Fruit Vegetables' },
    'Overall Mushroom Production': { emoji: '🍄', blurb: "An edible macroscopic fungus variety (e.g., Oyster, Straw) grown under controlled substrate conditions.", sci: 'Pleurotus ostreatus', local: 'Kabute', primary: 'Vegetables', sub: 'Fungi' },
    'Overall Pechay Production': { emoji: '🥬', blurb: "An erect, non-heading green leaf cabbage (Pok Choy) with smooth, spoon-shaped leaves and crisp white petioles.", sci: 'Brassica rapa subsp. chinensis', local: 'Pechay', primary: 'Vegetables', sub: 'Leafy Greens' },
    'Overall Spinach Production': { emoji: '🥬', blurb: "A temperate annual leafy herb rich in iron and vitamins, increasingly grown in highland areas.", sci: 'Spinacia oleracea', local: 'Espenaka', primary: 'Vegetables', sub: 'Leafy Greens' },
    'Overall Malabar Spinach Production': { emoji: '🥬', blurb: "A succulent, smooth-leaved mucilaginous vine (Alugbati) with red or green stems, highly resilient to tropical heat.", sci: 'Basella alba', local: 'Alugbati', primary: 'Vegetables', sub: 'Leafy Greens' },
    'Overall Moringa Production': { emoji: '🌿', blurb: "A 'superfood' tree crop (Malunggay) with small oval leaflets globally recognized for exceptional multi-vitamin profiles.", sci: 'Moringa oleifera', local: 'Malunggay', primary: 'Vegetables', sub: 'Leafy Greens' },
    'Overall Radish Production': { emoji: '🥕', blurb: "An elongated, crisp white root vegetable (Labanos) presenting a sharp, peppery bite due to sulfur compounds.", sci: 'Raphanus sativus', local: 'Labanos', primary: 'Vegetables', sub: 'Root Vegetables' },
    'Overall Sweet Potato Leaves Production': { emoji: '🌿', blurb: "The tender terminal vine tips of the sweet potato plant, consumed as an iron-rich leafy green.", sci: 'Ipomoea batatas (Leaves)', local: 'Talbos ng Kamote', primary: 'Vegetables', sub: 'Leafy Greens' },
    'Overall Jute Mallow Production': { emoji: '🌿', blurb: "A highly mucilaginous leafy green shrub (Saluyot) known for heat tolerance; also a source of industrial jute fiber.", sci: 'Corchorus olitorius', local: 'Saluyot', primary: 'Vegetables', sub: 'Leafy Greens' },
    'Overall Winged Beans Production': { emoji: '🫛', blurb: "A multi-sided legume (Sigarilyas) with prominent wavy frills along four edges, entirely edible from root to leaf.", sci: 'Psophocarpus tetragonolobus', local: 'Sigarilyas', primary: 'Vegetables', sub: 'Legumes' },
    'Overall Ube Production': { emoji: '🍠', blurb: "A brilliant purple yam cultivar displaying deep violet flesh, highly sought after for global dessert applications.", sci: 'Dioscorea alata', local: 'Ube', primary: 'Root Crops & Tubers', sub: 'Tubers', hvec: true },
    // 'Overall Cassava Production' and 'Cassava Industrial Production' are
    // item-hidden in the crop tree, so they are deliberately absent from
    // CROP_META — it is the catalogue's universe, and a crop the map will
    // not let you select should not rank in the Top 10 either. Same
    // arrangement as Banana Cavendish. Their cropConfig/provConfig entries
    // and sub-annual files stay in place, so unhiding is removing the class
    // and restoring these two lines.
    'Cassava Food Production': { emoji: '🍠', blurb: "Fresh cassava tubers grown for direct human consumption — a staple across BARMM, where Basilan, Sulu and Tawi-Tawi together grow more than half the national crop.", sci: 'Manihot esculenta', local: 'Kamoteng Kahoy (Pagkain)', primary: 'Root Crops & Tubers', sub: 'Tubers' },
    'Overall Sweet Potato Production': { emoji: '🍠', blurb: "A highly nutritious trailing root crop producing sweet, starchy tubers varying from white to deep orange.", sci: 'Ipomoea batatas', local: 'Kamote (Commercial)', primary: 'Root Crops & Tubers', sub: 'Roots' },
    'Overall White Potato Production': { emoji: '🥔', blurb: "A major starchy tuber crop fundamental to global food security and extensively utilized as a recipe thickener.", sci: 'Solanum tuberosum', local: 'Patatas', primary: 'Root Crops & Tubers', sub: 'Tubers', hvc: true },
    'Red Onion Production': { emoji: '🧅', blurb: "A cultivar of the common onion characterized by its crisp, mildly pungent, and slightly sweet flavor — recognizable by its papery, deep purplish-red outer skin.", sci: 'Allium cepa', local: 'Sibuyas na Pula', primary: 'Root Crops & Tubers', sub: 'Bulbs', hvc: true },
    'White Onion Production': { emoji: '🧅', blurb: "A large, mild, sweet layered onion bulb variety with golden-white skin, favored for raw use.", sci: 'Allium cepa', local: 'Sibuyas na Puti', primary: 'Root Crops & Tubers', sub: 'Bulbs', hvc: true },
    'Red Shallot Production': { emoji: '🧅', blurb: "Small clustered bulb species (Sibuyas Tagalog) producing intense, sharp, refined savory profiles widely used in native sauces.", sci: 'Allium cepa', local: 'Sibuyas Tagalog', primary: 'Root Crops & Tubers', sub: 'Bulbs', hvc: true },
    'Overall Garlic Production': { emoji: '🧄', blurb: "A strongly pungent bulb crop rich in allicin, serving as the definitive foundational aromatic for sautéing.", sci: 'Allium sativum', local: 'Bawang', primary: 'Herbs & Spices', sub: 'Bulbs', hvc: true },
    'Overall Ginger Production': { emoji: '🫚', blurb: "A pungent underground rhizome featuring zesty, warming essential oils used extensively in cooking and traditional healing.", sci: 'Zingiber officinale', local: 'Luya', primary: 'Herbs & Spices', sub: 'Roots/Rhizomes' },
    'Overall Lemongrass Production': { emoji: '🌾', blurb: "A coarse, aromatic perennial grass emitting a strong citrus aroma from its essential oils.", sci: 'Cymbopogon citratus', local: 'Tanglad', primary: 'Herbs & Spices', sub: 'Herbs' },
    'Overall Spring Onion Production': { emoji: '🧅', blurb: "A perennial bunching onion harvested for its long, hollow green leaves and mild bulb base.", sci: 'Allium fistulosum', local: 'Sibuyas-dahon', primary: 'Herbs & Spices', sub: 'Condiments' },
    'Overall Peanut Production': { emoji: '🥜', blurb: "An annual subterranean legume cultivated for its high-protein, oil-rich seeds enclosed in a fibrous pod.", sci: 'Arachis hypogaea', local: 'Mani', primary: 'Vegetables', sub: 'Legumes' },
    'Overall Milkfish Production': { emoji: '🐟', blurb: "Bangus, the Philippines' national fish, farmed extensively in fishponds and cages.", sci: '', local: '', primary: '', sub: '' },
    'Overall Tilapia Production': { emoji: '🐟', blurb: "A widely farmed freshwater fish, a major aquaculture product nationwide.", sci: '', local: '', primary: '', sub: '' },
    'Overall Chicken Production': { emoji: '🐔', blurb: "The country's largest poultry commodity, raised for meat production nationwide.", sci: '', local: '', primary: '', sub: '' },
    'Overall Cattle Production': { emoji: '🐄', blurb: "Raised for beef production across pasture and ranching areas.", sci: '', local: '', primary: '', sub: '' },
    'Overall Hog Production': { emoji: '🐖', blurb: "Raised for pork production, one of the largest livestock industries in the country.", sci: '', local: '', primary: '', sub: '' },
    'Overall Dairy Production': { emoji: '🥛', blurb: "Milk production from dairy cattle and buffalo raised across the country." },
    'Overall Egg Production': { emoji: '🥚', blurb: "Table eggs from layer hens, a staple protein source nationwide." }
};

// ── Catalogue data loading ───────────────────────────────────────────────────
// var, not let/const: setYear() → refreshCatalogueForYearChange() can be
// called by bootFromHash() (a URL with &year=... in it, i.e. every reload
// after the first visit) BEFORE this point in the file is reached. A let/
// const reference before its own declaration line throws a ReferenceError
// (temporal dead zone) that — uncaught at the top level — silently aborts
// all remaining script execution, which is exactly what was breaking every
// catalogue interaction. var is hoisted with an initial `undefined`, so an
// early call just sees "not ready yet" and safely no-ops instead of crashing.
var catalogueData = null;         // cropName -> { byRegion: {pcode:row}, byProvince: {pcode:row}|null }
var catalogueLoadPromise = null;
var catalogueInitialized = false; // becomes true once the UI has been wired up
var catalogueYieldData = {};      // cropName -> same shape as catalogueData's entries, loaded lazily per-card on expand

function loadDataFilePromise(file) {
    return new Promise(function (resolve, reject) {
        loadDataFile(file, function (results) { resolve(results.data); }, reject);
    });
}

// Loads one crop's Volume data for the catalogue: prefers the dedicated
// regional file when the crop has one (matches what the main map shows as
// that crop's regional totals), and separately loads the provincial file
// for province-level ranking and — when there's no regional file — to derive
// regional/national totals via the same aggregation the main map uses.
function loadCropForCatalogue(cropName) {
    const config = cropConfig[cropName] || {};
    const pconfig = provConfig[cropName] || {};
    const regFile = config.file;
    const provFile = pconfig.file;
    const entry = { byRegion: {}, byProvince: null };

    const regPromise = regFile ? loadDataFilePromise(regFile).then(function (rows) {
        rows.forEach(function (row) { if (row.ADM1_PCODE) entry.byRegion[row.ADM1_PCODE] = row; });
    }) : Promise.resolve();

    const provPromise = provFile ? loadDataFilePromise(provFile).then(function (rows) {
        const provStats = {};
        rows.forEach(function (row) {
            if (!row.ADM2_PCODE) return;
            const existing = provStats[row.ADM2_PCODE];
            if (!existing) { provStats[row.ADM2_PCODE] = row; return; }
            YEARS.forEach(function (y) {
                if (!(parseFloat(existing[y]) > 0) && parseFloat(row[y]) > 0) existing[y] = row[y];
            });
        });
        entry.byProvince = provStats;
        if (!regFile) entry.byRegion = aggregateProvToRegional(provStats, false); // Volume is additive — sum, not average
    }) : Promise.resolve();

    return Promise.all([regPromise, provPromise]).then(function () { return entry; });
}

// Loads one crop with a hard time limit — a single hung fetch (dead request,
// a lazy-loaded script whose load/error event never fires) must not leave
// the whole catalogue stuck on "Loading…" forever, since Promise.all below
// only settles once every entry does. Promise.resolve().then(...) also
// converts any SYNCHRONOUS throw inside loadCropForCatalogue into a
// rejection instead of letting it escape .map() and abort the entire batch.
function loadCropForCatalogueSafe(cropName) {
    const attempt = Promise.resolve().then(function () { return loadCropForCatalogue(cropName); });
    const timeout = new Promise(function (resolve) {
        setTimeout(function () { resolve(null); }, 20000);
    });
    return Promise.race([attempt, timeout]).catch(function (err) {
        console.error('Catalogue: failed to load', cropName, err);
        return null;
    });
}

// Loads one crop's Yield data, same shape/logic as loadCropForCatalogue()
// but from yieldFile instead of file — fetched lazily per-crop the first
// time its card is expanded (loadCardYield(), below), not upfront for all
// ~75 crops: roughly half don't even have a yield source, and doubling the
// initial batch load for a stat that's only visible once expanded isn't
// worth it.
function loadYieldForCrop(cropName) {
    if (catalogueYieldData[cropName]) return Promise.resolve(catalogueYieldData[cropName]);
    const config = cropConfig[cropName] || {};
    const pconfig = provConfig[cropName] || {};
    const regFile = config.yieldFile;
    const provFile = pconfig.yieldFile;
    if (!regFile && !provFile) return Promise.resolve(null);
    const entry = { byRegion: {}, byProvince: null };

    const regPromise = regFile ? loadDataFilePromise(regFile).then(function (rows) {
        rows.forEach(function (row) { if (row.ADM1_PCODE) entry.byRegion[row.ADM1_PCODE] = row; });
    }) : Promise.resolve();

    const provPromise = provFile ? loadDataFilePromise(provFile).then(function (rows) {
        const provStats = {};
        rows.forEach(function (row) {
            if (!row.ADM2_PCODE) return;
            const existing = provStats[row.ADM2_PCODE];
            if (!existing) { provStats[row.ADM2_PCODE] = row; return; }
            YEARS.forEach(function (y) {
                if (!(parseFloat(existing[y]) > 0) && parseFloat(row[y]) > 0) existing[y] = row[y];
            });
        });
        entry.byProvince = provStats;
        if (!regFile) entry.byRegion = aggregateProvToRegional(provStats, true); // Yield is a ratio metric — average, not sum
    }) : Promise.resolve();

    return Promise.all([regPromise, provPromise]).then(function () {
        catalogueYieldData[cropName] = entry;
        return entry;
    });
}

function loadYieldForCropSafe(cropName) {
    const attempt = Promise.resolve().then(function () { return loadYieldForCrop(cropName); });
    const timeout = new Promise(function (resolve) {
        setTimeout(function () { resolve(null); }, 20000);
    });
    return Promise.race([attempt, timeout]).catch(function (err) {
        console.error('Catalogue: failed to load yield for', cropName, err);
        return null;
    });
}

// Fetches every published crop's data once and caches it; safe to call
// repeatedly — later calls just return the same in-flight/resolved promise.
function ensureCatalogueData() {
    if (catalogueData) return Promise.resolve(catalogueData);
    if (catalogueLoadPromise) return catalogueLoadPromise;

    const statusEl = document.getElementById('catalogue-status');
    statusEl.textContent = 'Loading commodity data…';
    statusEl.classList.remove('error');
    statusEl.hidden = false;

    const names = Object.keys(CROP_META);
    // Aggregation keys byRegion by provinceRegionPcode(), so the parent table
    // has to be in hand before it runs — catalogueData caches the result for
    // the whole session, and a wrong key there silently zeroes every
    // province-sourced commodity at region and island scope. Waiting on the
    // ~5 KB table rather than the 42 MB boundary is what makes this cheap
    // enough to gate on. Its .catch() resolves, so a failed table degrades to
    // the boundary index and prefix fallback instead of hanging the catalogue
    // on "Loading…" forever.
    catalogueLoadPromise = Promise.resolve(psgcParentsReady).then(function () {
        return Promise.all(names.map(function (name) {
            return loadCropForCatalogueSafe(name).then(function (entry) { return [name, entry]; });
        }));
    }).then(function (pairs) {
        catalogueData = {};
        pairs.forEach(function (pair) { if (pair[1]) catalogueData[pair[0]] = pair[1]; });
        statusEl.hidden = true;
        if (!Object.keys(catalogueData).length) {
            statusEl.textContent = 'Could not load any commodity data — check your connection and try again.';
            statusEl.classList.add('error');
            statusEl.hidden = false;
            catalogueLoadPromise = null; // allow retry
        }
        return catalogueData;
    }).catch(function (err) {
        console.error('Catalogue: load failed', err);
        statusEl.textContent = 'Could not load commodity data — check your connection and try again.';
        statusEl.classList.add('error');
        catalogueLoadPromise = null; // allow retry
        throw err;
    });
    return catalogueLoadPromise;
}

// ── Ranking ──────────────────────────────────────────────────────────────────
// scope: 'national' | 'island' | 'region' | 'province'; scopeValue is the
// island key / region pcode / province pcode (ignored for 'national'). Returns
// null when the scope isn't applicable to this entry at all (a crop with no
// province-level source, at province scope) — distinct from a real zero.
function valueForScopeEntry(entry, scope, scopeValue, year) {
    if (scope === 'province') {
        if (!entry.byProvince) return null;
        const row = entry.byProvince[scopeValue];
        return row ? (parseFloat(row[year]) || 0) : 0;
    }
    if (scope === 'region') {
        const row = entry.byRegion[scopeValue];
        return row ? (parseFloat(row[year]) || 0) : 0;
    }
    if (scope === 'island') {
        // Unknown key -> no value, rather than a TypeError off .regions. The
        // select only ever offers luzon/visayas/mindanao, but the keys are
        // lowercase and an 'Luzon' from anywhere else used to take the whole
        // catalogue down with it.
        const group = ISLAND_GROUPS[scopeValue];
        if (!group) return null;
        const regionPcodes = group.regions;
        return regionPcodes.reduce(function (s, pcode) {
            const row = entry.byRegion[pcode];
            return s + (row ? (parseFloat(row[year]) || 0) : 0);
        }, 0);
    }
    return Object.keys(entry.byRegion).reduce(function (s, pcode) {
        return s + (parseFloat(entry.byRegion[pcode][year]) || 0);
    }, 0);
}

// Every crop with a reported (>0) value for this scope/year, sorted
// descending — the full ranking, not just a top slice. Used both for the
// catalogue grid (top 10) and for computing a given crop's rank/total in a
// different year (year-over-year, rank movement). categoryFilter, when set,
// restricts to crops whose CROP_META.primary matches exactly (Fisheries/
// Livestock/Palay/Corn — which have no CROP_META category — are excluded by
// any active category filter, same as they're excluded from every category).
function getAllCommodityValues(scope, scopeValue, year, categoryFilter) {
    const results = [];
    Object.keys(catalogueData).forEach(function (cropName) {
        if (categoryFilter) {
            const meta = CROP_META[cropName];
            if (!meta) return;
            // "HVC Priority"/"HVEC" are curated cross-category lists
            // (meta.hvc/meta.hvec), not Primary Category values — everything
            // else matches meta.primary.
            const matches = categoryFilter === HVC_CATEGORY_VALUE ? !!meta.hvc
                : categoryFilter === HVEC_CATEGORY_VALUE ? !!meta.hvec
                : meta.primary === categoryFilter;
            if (!matches) return;
        }
        const val = valueForScopeEntry(catalogueData[cropName], scope, scopeValue, year);
        if (val !== null && val > 0) results.push({ cropName: cropName, val: val });
    });
    results.sort(function (a, b) { return b.val - a.val; });
    return results;
}

function getTopCommodities(scope, scopeValue, year, limit, categoryFilter) {
    return getAllCommodityValues(scope, scopeValue, year, categoryFilter).slice(0, limit || 10);
}

// Full value series for one crop/scope, in YEARS order — every period the
// files carry, partial one included. Missing/zero years come back as 0.
//
// This is the DATA series, and the CSV export is its caller: that header is
// built as .concat(YEARS), so the two must stay the same length or the export
// writes values under the wrong year headings. A partial column is still a
// published figure and belongs in a download of the figures.
function getCommodityYearSeries(cropName, scope, scopeValue) {
    const entry = catalogueData[cropName];
    return YEARS.map(function (y) { return valueForScopeEntry(entry, scope, scopeValue, y) || 0; });
}

// The same series restricted to complete periods — what the card and ranking
// sparklines draw. A partial annual column is a fraction of a year, so on a
// shape-only trend line it reads as a collapse the crop never had; see
// buildSparklineHTML() for the full account. Deliberately NOT used by the CSV
// export, which owes the reader every published column.
function getCommodityTrendSeries(cropName, scope, scopeValue) {
    const entry = catalogueData[cropName];
    return trendPeriods().map(function (y) { return valueForScopeEntry(entry, scope, scopeValue, y) || 0; });
}

// Where a single crop is grown the most, nationwide — the reverse of the
// card grid's "which crops rank top in this area" (this is "which areas
// rank top for this crop"), always national regardless of whatever area is
// currently selected in the scope bar. Level 'province' returns [] for
// crops with no provincial source (byProvince is null) rather than crashing.
function getTopAreasForCommodity(cropName, year, level, limit) {
    const entry = catalogueData[cropName];
    if (!entry) return [];
    const bucket = level === 'province' ? entry.byProvince : entry.byRegion;
    if (!bucket) return [];
    return Object.keys(bucket).map(function (pcode) {
        const row = bucket[pcode];
        const val = parseFloat(row[year]) || 0;
        // The row itself usually carries a display name column straight from
        // the source CSV (Province, or ADM1_EN for regional files) —
        // preferred over deriving one from the pcode, which needs alias/
        // split lookups that don't always agree with the CSV's own value.
        const name = level === 'province'
            ? (row.Province || provinceDisplayName(pcode))
            : (row.ADM1_EN || regionDisplayName(pcode));
        return { pcode: pcode, name: name, val: val };
    }).filter(function (r) { return r.val > 0; })
        .sort(function (a, b) { return b.val - a.val; })
        .slice(0, limit || 5);
}

// ── Area selector UI ─────────────────────────────────────────────────────────
function populateCatalogueIslandSelect() {
    const sel = document.getElementById('catalogue-island-select');
    sel.innerHTML = Object.keys(ISLAND_GROUPS).map(function (key) {
        return '<option value="' + key + '">' + esc(ISLAND_GROUPS[key].label) + '</option>';
    }).join('');
}

// Unique Primary Category values from CROP_META, sorted — Fisheries/
// Livestock/Palay/Corn have no category in the source dictionary and are
// simply excluded from every category filter (never shown under a category
// they don't have), same as they're excluded from the tags on their cards.
function populateCatalogueCategorySelect() {
    const sel = document.getElementById('catalogue-category-select');
    const categories = [...new Set(Object.values(CROP_META).map(function (m) { return m.primary; }).filter(Boolean))]
        .sort(function (a, b) { return a.localeCompare(b); });
    sel.innerHTML = '<option value="">All Categories</option>'
        + '<option value="' + esc(HVC_CATEGORY_VALUE) + '">HVC Priority</option>'
        + '<option value="' + esc(HVEC_CATEGORY_VALUE) + '">HVEC</option>'
        + categories.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('');
}

function populateCatalogueRegionSelect() {
    const shapes = getActiveShapes();
    if (!shapes) return;
    const sel = document.getElementById('catalogue-region-select');
    const byIsland = { luzon: [], visayas: [], mindanao: [] };
    shapes.features.forEach(function (f) {
        const pcode = f.properties.ADM1_PCODE;
        const islandKey = REGION_TO_ISLAND[pcode];
        if (islandKey) byIsland[islandKey].push({ pcode: pcode, name: f.properties.ADM1_EN });
    });
    let html = '';
    Object.keys(ISLAND_GROUPS).forEach(function (islandKey) {
        const regions = byIsland[islandKey].sort(function (a, b) { return a.name.localeCompare(b.name); });
        if (!regions.length) return;
        html += '<optgroup label="' + esc(ISLAND_GROUPS[islandKey].label) + '">';
        html += regions.map(function (r) {
            return '<option value="' + r.pcode + '">' + esc(r.name) + '</option>';
        }).join('');
        html += '</optgroup>';
    });
    sel.innerHTML = html;
}

// BARMM's "Special Geographic Area" (North Cotabato municipalities that
// voted into BARMM despite not being geographically contiguous with it,
// PSGC 1909900000) isn't a real province for ranking purposes — excluded
// from the catalogue's province picker.
const CATALOGUE_EXCLUDED_PROVINCES = ['1909900000'];

// Repopulates the province <select> for whichever region is currently chosen
// in the region <select> — used both when switching to province-level and
// when the user changes the region while already at province-level.
function populateCatalogueProvinceSelect() {
    const regionPcode = document.getElementById('catalogue-region-select').value;
    const sel = document.getElementById('catalogue-province-select');
    if (!provincialShapes || !regionPcode) { sel.innerHTML = ''; return; }
    const pcodes = [...new Set(provincialShapes.features
        .filter(function (f) { return provinceParentRegion(f.properties) === regionPcode; })
        .map(function (f) { return effectiveProvincePcode(f.properties.ADM2_PCODE); }))]
        .filter(function (pcode) { return CATALOGUE_EXCLUDED_PROVINCES.indexOf(pcode) === -1; });
    const provinces = pcodes.map(function (pcode) {
        return { pcode: pcode, name: provinceDisplayName(pcode) };
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    sel.innerHTML = provinces.map(function (p) {
        return '<option value="' + p.pcode + '">' + esc(p.name) + '</option>';
    }).join('');
}

function currentCatalogueScope() {
    const level = document.getElementById('catalogue-level-select').value;
    if (level === 'national') return { scope: 'national', value: null };
    if (level === 'island') return { scope: 'island', value: document.getElementById('catalogue-island-select').value };
    if (level === 'region') return { scope: 'region', value: document.getElementById('catalogue-region-select').value };
    return { scope: 'province', value: document.getElementById('catalogue-province-select').value };
}

function updateCatalogueFieldVisibility() {
    const level = document.getElementById('catalogue-level-select').value;
    document.getElementById('catalogue-island-field').hidden = level !== 'island';
    document.getElementById('catalogue-region-field').hidden = !(level === 'region' || level === 'province');
    document.getElementById('catalogue-province-field').hidden = level !== 'province';
}

// ── Illustration highlight map ──────────────────────────────────────────────
// A plain SVG rendering of the same boundary data the main map uses — no
// basemap tiles, no interaction. Redrawn on every scope change: highlights
// the selected island/region/province and refits the viewBox to its bounds,
// so picking a new area visually "zooms in" there. Coordinates are used
// directly as SVG units (lng → x, -lat → y, a plain equirectangular
// projection) — accurate enough for a small illustrative context map, not
// meant for measurement.
// Top-10 emoji markers are implemented but hidden for now — set true to
// re-enable (see renderCatalogueMap()'s icon-scattering block below).
const SHOW_CATALOGUE_TOP10_ICONS = false;
function ringToPathD(ring) {
    let d = '';
    for (let i = 0; i < ring.length; i++) {
        const x = ring[i][0], y = -ring[i][1];
        d += (i === 0 ? 'M' : 'L') + x.toFixed(4) + ',' + y.toFixed(4) + ' ';
    }
    return d + 'Z ';
}

// fill-rule="evenodd" (applied where this is used) makes hole rendering
// correct regardless of the source data's ring winding order.
function geometryToPathD(geometry) {
    const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
    let d = '';
    polygons.forEach(function (rings) {
        rings.forEach(function (ring) { d += ringToPathD(ring); });
    });
    return d;
}

function expandBoundsForFeature(bounds, geometry) {
    const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
    polygons.forEach(function (rings) {
        rings[0].forEach(function (pt) { // outer ring only — plenty for a bounding box
            if (pt[0] < bounds.minLng) bounds.minLng = pt[0];
            if (pt[0] > bounds.maxLng) bounds.maxLng = pt[0];
            if (pt[1] < bounds.minLat) bounds.minLat = pt[1];
            if (pt[1] > bounds.maxLat) bounds.maxLat = pt[1];
        });
    });
}

// Standard ray-casting point-in-ring test (works regardless of the ring's
// winding direction, unlike the fill-rule="evenodd" the rendered <path>
// relies on for holes).
function pointInRing(lng, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];
        const crosses = ((yi > lat) !== (yj > lat)) &&
            (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
        if (crosses) inside = !inside;
    }
    return inside;
}

// A point is inside a Polygon/MultiPolygon if it's inside some ring[0]
// (outer boundary) and not inside any of that same ring set's holes.
function pointInGeometry(lng, lat, geometry) {
    const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
    return polygons.some(function (rings) {
        if (!pointInRing(lng, lat, rings[0])) return false;
        for (let k = 1; k < rings.length; k++) {
            if (pointInRing(lng, lat, rings[k])) return false; // inside a hole
        }
        return true;
    });
}

// Finds up to `count` points that actually sit inside one of `features`'
// geometries (rather than just inside their shared bounding box), spread
// out roughly evenly — used to keep top-10 icon markers on land, inside the
// selected province/region/island shape, instead of floating over the sea
// or a neighboring area whenever the shape is irregular or non-convex.
function sampleInteriorPoints(features, bounds, count) {
    const gridN = 12;
    const bw = (bounds.maxLng - bounds.minLng) || 1;
    const bh = (bounds.maxLat - bounds.minLat) || 1;
    const candidates = [];
    for (let gy = 0; gy < gridN; gy++) {
        for (let gx = 0; gx < gridN; gx++) {
            const lng = bounds.minLng + bw * (gx + 0.5) / gridN;
            const lat = bounds.minLat + bh * (gy + 0.5) / gridN;
            if (features.some(function (f) { return pointInGeometry(lng, lat, f.geometry); })) {
                candidates.push({ lng: lng, lat: lat });
            }
        }
    }
    if (candidates.length <= count) return candidates;
    const picked = [];
    const step = candidates.length / count;
    for (let i = 0; i < count; i++) picked.push(candidates[Math.floor(i * step)]);
    return picked;
}

function renderCatalogueMap() {
    const svg = document.getElementById('catalogue-map-svg');
    const label = document.getElementById('catalogue-map-label');
    const shapes = getActiveShapes();
    if (!svg || !shapes) return;

    const scope = currentCatalogueScope();
    let features, highlightPcodes, labelText;

    if (scope.scope === 'province') {
        const regionPcode = document.getElementById('catalogue-region-select').value;
        if (!provincialShapes || !regionPcode) { svg.innerHTML = ''; return; }
        features = provincialShapes.features.filter(function (f) {
            return provinceParentRegion(f.properties) === regionPcode;
        });
        // scope.value is already an effective pcode — it comes from the same
        // select populateCatalogueProvinceSelect fills using effective codes
        highlightPcodes = scope.value ? [scope.value] : [];
        labelText = scope.value ? provinceDisplayName(scope.value) : '';
    } else {
        features = shapes.features;
        if (scope.scope === 'national') {
            // No highlight at national level — the whole country shows in
            // the plain green base color; blue is reserved for a specific
            // island/region/province selection. (Previously highlighted
            // every region, which painted the entire map blue instead.)
            highlightPcodes = [];
            labelText = 'Philippines';
        } else if (scope.scope === 'island') {
            highlightPcodes = scope.value ? ISLAND_GROUPS[scope.value].regions : [];
            labelText = scope.value ? ISLAND_GROUPS[scope.value].label : '';
        } else { // region
            highlightPcodes = scope.value ? [scope.value] : [];
            labelText = scope.value ? regionDisplayName(scope.value) : '';
        }
    }

    // viewBox fits the shown feature set (region/province levels only render
    // the relevant subset already — see above); zooming is "for free" as a
    // side effect of that, not a separate crop step.
    const bounds = { minLng: Infinity, maxLng: -Infinity, minLat: Infinity, maxLat: -Infinity };
    features.forEach(function (f) { expandBoundsForFeature(bounds, f.geometry); });
    if (!isFinite(bounds.minLng)) { svg.innerHTML = ''; return; }

    // National scope only needs the wider crop margin while the top-10 icon
    // ring (which sits just outside the coastline) is actually being drawn —
    // it's currently hidden (SHOW_CATALOGUE_TOP10_ICONS), so the ordinary 6%
    // margin applies and the country fills the panel instead of floating in
    // a lot of empty space.
    const padFrac = (scope.scope === 'national' && SHOW_CATALOGUE_TOP10_ICONS) ? 0.24 : 0.06;
    const w = (bounds.maxLng - bounds.minLng) || 1;
    const h = (bounds.maxLat - bounds.minLat) || 1;
    const padX = w * padFrac, padY = h * padFrac;
    const vbX = bounds.minLng - padX;
    const vbY = -bounds.maxLat - padY;
    const vbW = w + padX * 2;
    const vbH = h + padY * 2;
    svg.setAttribute('viewBox', vbX.toFixed(4) + ' ' + vbY.toFixed(4) + ' ' + vbW.toFixed(4) + ' ' + vbH.toFixed(4));
    // Match the panel's aspect ratio to what's actually being shown (clamped
    // so a very elongated province, e.g. Palawan, can't stretch the panel
    // absurdly tall/wide) — a fixed 1:1 box left large empty margins for
    // any area whose true shape isn't roughly square.
    // Lower bound raised from 0.6 to 0.85 — the Philippines' national bounds
    // are naturally tall/narrow (~0.6-0.7), which made the map panel taller
    // than the 10-card grid beside it and left empty space under the shorter
    // column. 0.85 trades a bit of geographic accuracy (illustrative only,
    // not for measurement) for a height that better matches the card grid.
    svg.style.aspectRatio = Math.max(0.85, Math.min(1.8, vbW / vbH)).toFixed(3);

    const highlightSet = new Set(highlightPcodes);

    // Bounding box + the actual feature geometries of just the highlighted
    // subset — this is where the current top-10 icons get scattered below.
    // At national level nothing is individually highlighted, so both fall
    // back to every feature (the whole country is effectively "selected").
    const iconBounds = { minLng: Infinity, maxLng: -Infinity, minLat: Infinity, maxLat: -Infinity };
    const highlightedFeatures = [];
    features.forEach(function (f) {
        const pcode = scope.scope === 'province'
            ? effectiveProvincePcode(f.properties.ADM2_PCODE)
            : f.properties.ADM1_PCODE;
        if (scope.scope === 'national' || highlightSet.has(pcode)) {
            expandBoundsForFeature(iconBounds, f.geometry);
            highlightedFeatures.push(f);
        }
    });

    svg.innerHTML = features.map(function (f) {
        const pcode = scope.scope === 'province'
            ? effectiveProvincePcode(f.properties.ADM2_PCODE)
            : f.properties.ADM1_PCODE;
        const isHighlighted = highlightSet.has(pcode);
        const d = geometryToPathD(f.geometry);
        return '<path class="cmap-shape' + (isHighlighted ? ' cmap-highlight' : '') + '" d="' + d + '" fill-rule="evenodd"></path>';
    }).join('');

    // Scatter an emoji marker per current top-10 commodity across the
    // highlighted area. renderCatalogueMap() also runs before
    // ensureCatalogueData() resolves (nothing to rank yet, catalogueData is
    // null) — it's called again once data lands, which draws these in.
    // Hidden for now (SHOW_CATALOGUE_TOP10_ICONS) — flip back on once ready.
    if (SHOW_CATALOGUE_TOP10_ICONS && catalogueData && isFinite(iconBounds.minLng)) {
        const top = getTopCommodities(scope.scope, scope.value, currentYear, 10);
        if (top.length) {
            const bw = (iconBounds.maxLng - iconBounds.minLng) || 1;
            const bh = (iconBounds.maxLat - iconBounds.minLat) || 1;
            let points, iconRadius;

            if (scope.scope === 'national') {
                // No single shape to sit "inside" at country scale — instead
                // ring the markers just outside the coastline, out in the
                // sea, evenly spaced around the country's silhouette.
                const ccx = (iconBounds.minLng + iconBounds.maxLng) / 2;
                const ccy = (iconBounds.minLat + iconBounds.maxLat) / 2;
                const rx = bw / 2 * 1.16;
                const ry = bh / 2 * 1.16;
                points = top.map(function (_, i) {
                    const angle = (i / top.length) * Math.PI * 2 - Math.PI / 2;
                    return { lng: ccx + rx * Math.cos(angle), lat: ccy + ry * Math.sin(angle) };
                });
                iconRadius = Math.min(rx, ry) * 0.075;
            } else {
                // Only sample points that actually fall inside the selected
                // province/region/island shape(s) — a plain bounding-box grid
                // could land an icon out in the sea or over a neighboring
                // area for any non-convex or irregular boundary.
                points = sampleInteriorPoints(highlightedFeatures, iconBounds, top.length);
                iconRadius = Math.min(bw, bh) / 12 * 0.42;
            }

            svg.innerHTML += top.map(function (row, i) {
                if (!points[i]) return '';
                const meta = CROP_META[row.cropName] || { emoji: '🌱' };
                const cx = points[i].lng, cy = -points[i].lat;
                const fontSize = iconRadius * 1.7;
                const name = row.cropName.replace(/^Overall\s+/i, '').replace(/\s+Production$/i, '');
                return '<g class="cmap-icon-group">'
                    + '<title>' + esc(name) + ' — rank ' + (i + 1) + '</title>'
                    + '<circle class="cmap-icon-bg" cx="' + cx.toFixed(4) + '" cy="' + cy.toFixed(4) + '" r="' + iconRadius.toFixed(4) + '"></circle>'
                    + '<text class="cmap-icon" x="' + cx.toFixed(4) + '" y="' + cy.toFixed(4) + '" font-size="' + fontSize.toFixed(4) + '" text-anchor="middle" dominant-baseline="central">' + meta.emoji + '</text>'
                    + '</g>';
            }).join('');
        }
    }

    if (label) label.textContent = labelText || '';
}

// ── Rendering ────────────────────────────────────────────────────────────────
// Tiny inline 5-year trend line — normalized to its own min/max (the point
// is the shape of this one crop's trend, not a cross-crop comparison).
function buildSparklineSvg(values) {
    const w = 60, h = 20, pad = 2;
    const min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    const range = (max - min) || 1;
    const stepX = (w - pad * 2) / (values.length - 1);
    const points = values.map(function (v, i) {
        const x = pad + stepX * i;
        const y = h - pad - ((v - min) / range) * (h - pad * 2);
        return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    return '<svg class="catalogue-spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">'
        + '<polyline points="' + points + '"></polyline></svg>';
}

// Full ranking + the previous year's ranking for the same scope, computed
// once and shared by both the card grid (top 10 slice) and the full ranking
// table (every crop) — both need the same year-over-year/rank-movement
// lookups, just over a different slice length.
function computeCatalogueRankings(scope, scopeValue, year, categoryFilter) {
    const all = getAllCommodityValues(scope, scopeValue, year, categoryFilter);
    // Combined commodities (CROP_META.aggregate — Overall Palay/Corn/Banana)
    // rank alongside the sub-types they contain, which is deliberate: the
    // ranking excludes nothing. But they must stay OUT of the share
    // denominator, or every "% of area total" on the page is computed against
    // a figure that counts the same tonnage twice and reads far too low for
    // every commodity, aggregates included.
    const totalVal = all.reduce(function (s, r) {
        return (CROP_META[r.cropName] || {}).aggregate ? s : s + r.val;
    }, 0);
    // Was String(parseInt(year, 10) - 1), which is only ever right on the annual
    // axis. On a sub-annual one '2025Q4' became '2024' — not a period in YEARS —
    // so prevMap stayed empty and both the YoY column and the rank-movement
    // delta disappeared without saying so. NOTE for whoever gives the catalogue
    // sub-annual data: this then compares against the PREVIOUS QUARTER, so the
    // "YoY" column heading would need renaming to match.
    const prevYear = previousPeriod(year);
    const prevMap = {};
    if (prevYear) {
        getAllCommodityValues(scope, scopeValue, prevYear, categoryFilter).forEach(function (r, i) {
            prevMap[r.cropName] = { rank: i, val: r.val };
        });
    }
    return { all: all, totalVal: totalVal, prevMap: prevMap };
}

// Reads the (always-visible) Category filter <select> — '' means "All
// Categories," matching getAllCommodityValues()'s categoryFilter contract.
function currentCatalogueCategory() {
    const sel = document.getElementById('catalogue-category-select');
    return sel ? sel.value : '';
}

// categoryFilter's raw value is either a real Primary Category string (fine
// to show as-is) or the HVC_CATEGORY_VALUE sentinel (not something to leak
// into user-facing text) — use this wherever the active category is displayed.
function categoryDisplayLabel(category) {
    if (category === HVC_CATEGORY_VALUE) return 'HVC Priority';
    if (category === HVEC_CATEGORY_VALUE) return 'HVEC';
    return category;
}

// A CSS `scroll-behavior: auto !important` does NOT override a behavior passed
// to scrollIntoView() in script — the argument wins. So the reduced-motion
// media block cannot reach these two jumps between the map and the catalogue,
// which are the longest travel in the page; they have to ask here.
// Queried live rather than cached: the OS setting can change mid-session.
function prefersReducedMotion() {
    return window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function scrollToEl(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

// How many commodities the current Category filter admits at all, before any
// area/year value is looked at — the denominator the coverage note compares
// the ranked count against.
function catalogueCategoryPoolSize(category) {
    return Object.keys(catalogueData).filter(function (cropName) {
        if (!category) return true;
        const meta = CROP_META[cropName];
        if (!meta) return false;
        return category === HVC_CATEGORY_VALUE ? !!meta.hvc
            : category === HVEC_CATEGORY_VALUE ? !!meta.hvec
            : meta.primary === category;
    }).length;
}

// The grid shows 10 cards at most, and getAllCommodityValues() drops every
// commodity with no reported figure — so "not in the grid" covered two very
// different situations (ranked 11th or lower vs. no data at all here) and the
// grid looked identical either way. Both now get said out loud, along with the
// partial-year warning, which PARTIAL_ANNUAL_YEARS/partialYearNote() described
// but nothing ever rendered: at 2026 the fourteen regional Agristat files stop
// at 2025, so Mango, Coconut, Lettuce and all seven Fisheries/Livestock
// commodities drop out of the ranking with no explanation on screen.
// The catalogue is built from the ANNUAL files — loadCropForCatalogueSafe()
// reads cropConfig.file / provConfig.file, whose columns are years. Switch the
// timeline to Quarter or Semester and every lookup for '2025Q4' misses, so all
// 75 commodities drop out at once and the grid empties.
//
// That is NOT a coverage gap in the area being viewed, which is what the old
// wording said — "no reported figure for this area", which at national scope
// accuses the whole country of growing nothing. Name the real reason instead.
function catalogueAnnualOnlyNote() {
    if (activeGranularity === 'annual') return '';
    return 'The commodity catalogue is published annually — switch the timeline to '
         + 'Annual to see it. Quarter and Semester figures exist only for Palay and '
         + 'Corn, on the map above.';
}

function renderCatalogueCoverageNote(rankedCount, scope, category) {
    const el = document.getElementById('catalogue-coverage');
    if (!el) return;
    // Nothing ranked because the axis is sub-annual: say so, and say nothing
    // else. The unranked count below would just be "all 75 of them", which
    // tells the reader nothing they can act on.
    const annualOnly = catalogueAnnualOnlyNote();
    if (annualOnly && !rankedCount) {
        el.textContent = annualOnly;
        el.classList.remove('warn');
        el.hidden = false;
        return;
    }
    // At zero the grid already says "no production reported" in full — a
    // "top 0 of 0" line above it would only restate that badly.
    const parts = rankedCount
        ? ['Showing the top ' + Math.min(10, rankedCount) + ' of ' + rankedCount + ' ranked']
        : [];
    const unranked = catalogueCategoryPoolSize(category) - rankedCount;
    if (unranked > 0) {
        parts.push(unranked + (unranked === 1 ? ' commodity has' : ' commodities have')
            + ' no reported figure for this area in ' + periodLabel(currentYear)
            + (scope.scope === 'province' ? ' (several are published only at regional level)' : ''));
    }
    const partial = partialYearNote(currentYear);
    if (partial) parts.push(partial);
    el.textContent = parts.join(' · ');
    el.classList.toggle('warn', !!partial);
    el.hidden = false;
}

function hideCatalogueCoverageNote() {
    const el = document.getElementById('catalogue-coverage');
    if (el) el.hidden = true;
}

function renderCatalogueGrid() {
    document.getElementById('catalogue-year').textContent = currentYear;
    if (!catalogueData) { hideCatalogueCoverageNote(); return; }
    const grid = document.getElementById('catalogue-grid');
    const scope = currentCatalogueScope();
    if (scope.value === null && scope.scope !== 'national') { grid.innerHTML = ''; hideCatalogueCoverageNote(); return; }
    const category = currentCatalogueCategory();
    const rankings = computeCatalogueRankings(scope.scope, scope.value, currentYear, category);
    const top = rankings.all.slice(0, 10);
    renderCatalogueCoverageNote(rankings.all.length, scope, category);
    if (!top.length) {
        // Same distinction as the coverage note: an empty grid on a sub-annual
        // axis is the catalogue having no such data, not the area having none.
        const annualOnly = catalogueAnnualOnlyNote();
        grid.innerHTML = '<p class="catalogue-empty-msg">' + (annualOnly
            ? esc(annualOnly)
            : 'No' + (category ? ' ' + esc(categoryDisplayLabel(category)) : '')
              + ' production reported for this area in ' + esc(periodLabel(currentYear)) + '.')
            + '</p>';
        return;
    }
    const totalVal = rankings.totalVal;
    const prevMap = rankings.prevMap;

    const fmt = function (v) { return v.toLocaleString('en-PH', { maximumFractionDigits: 0 }); };
    grid.innerHTML = top.map(function (r, i) {
        const meta = CROP_META[r.cropName] || { emoji: '🌱', blurb: '', sci: '', local: '', primary: '', sub: '' };
        const rank = i + 1;
        const name = r.cropName.replace(/^Overall\s+/i, '').replace(/\s+Production$/i, '');
        // A combined commodity ranks beside the sub-types it contains, so its
        // tonnage is counted twice in the list on purpose — say so on the card
        // rather than letting it read as a duplicate row.
        const tags = (meta.aggregate ? '<span class="catalogue-tag catalogue-tag-agg" title="Combined figure — includes '
                + esc(meta.aggregate) + ', which rank separately below. Excluded from the % of area total so shares are not double-counted.">Combined total</span>' : '')
            + (meta.primary ? '<span class="catalogue-tag">' + esc(meta.primary) + '</span>' : '')
            + (meta.sub ? '<span class="catalogue-tag catalogue-tag-sub">' + esc(meta.sub) + '</span>' : '');
        const names = (meta.sci ? '<span class="catalogue-sci">' + esc(meta.sci) + '</span>' : '')
            + (meta.local ? '<span class="catalogue-local">' + esc(meta.local) + '</span>' : '');

        // Rank movement (collapsed-view glance, next to the value) — omitted
        // entirely once there's no earlier year in the dataset to compare.
        const prev = prevMap.hasOwnProperty(r.cropName) ? prevMap[r.cropName] : null;
        let rankDeltaHtml = '';
        if (Object.keys(prevMap).length) {
            if (!prev) rankDeltaHtml = '<span class="catalogue-rank-delta new">NEW</span>';
            else if (prev.rank === i) rankDeltaHtml = '<span class="catalogue-rank-delta same">–</span>';
            else {
                const delta = prev.rank - i; // positive = moved up (lower rank number)
                rankDeltaHtml = '<span class="catalogue-rank-delta ' + (delta > 0 ? 'up' : 'down') + '">'
                    + (delta > 0 ? '▲' : '▼') + Math.abs(delta) + '</span>';
            }
        }

        // Year-over-year % change, from the same prior-year lookup.
        let yoyHtml = '';
        if (Object.keys(prevMap).length) {
            if (!prev || !(prev.val > 0)) yoyHtml = '<span class="catalogue-stat catalogue-stat-yoy new">New this year</span>';
            else {
                const pct = ((r.val - prev.val) / prev.val) * 100;
                const cls = pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat';
                const arrow = pct > 0.5 ? '▲' : pct < -0.5 ? '▼' : '▬';
                yoyHtml = '<span class="catalogue-stat catalogue-stat-yoy ' + cls + '">' + arrow + ' ' + Math.abs(pct).toFixed(1) + '% YoY</span>';
            }
        }

        // Share of this area's combined top-10-and-up production this year.
        const sharePct = totalVal > 0 ? (r.val / totalVal) * 100 : 0;
        const shareHtml = '<span class="catalogue-stat">' + sharePct.toFixed(1) + '% of area total</span>';

        // Yield is fetched lazily (only on first expand — see loadCardYield())
        // rather than upfront for all ~75 crops, since roughly half don't
        // even have a yield source and it'd double an already-heavy load.
        const hasYield = !!((cropConfig[r.cropName] || {}).yieldFile || (provConfig[r.cropName] || {}).yieldFile);
        const yieldHtml = hasYield
            ? '<span class="catalogue-stat catalogue-stat-yield" data-yield-for="' + esc(r.cropName) + '">Yield: —</span>'
            : '';

        const series = getCommodityTrendSeries(r.cropName, scope.scope, scope.value);
        const sparkHtml = series.some(function (v) { return v > 0; }) ? buildSparklineSvg(series) : '';

        // "Where is this grown the most" — always nationwide, independent of
        // whatever area is currently selected in the scope bar, since that's
        // the whole point (e.g. viewing Benguet's Top 10 and still wanting to
        // see Cabbage's top regions/provinces countrywide).
        function topAreaListHtml(level, heading) {
            const areas = getTopAreasForCommodity(r.cropName, currentYear, level, 5);
            if (!areas.length) return '';
            // Just rank + name, no volume figure — showing this crop's raw
            // MT total per region/province read as noise/out of place here,
            // since it's a different number from the area-scoped Volume the
            // rest of the card is about.
            return '<div class="cta-col"><div class="cta-heading">' + heading + '</div>'
                + areas.map(function (a, ai) {
                    return '<div class="cta-row"><span class="cta-rank">' + (ai + 1) + '</span>'
                        + '<span class="cta-name" title="' + esc(a.name) + '">' + esc(a.name) + '</span></div>';
                }).join('') + '</div>';
        }
        const topAreasHtml = topAreaListHtml('region', 'Top Regions') + topAreaListHtml('province', 'Top Provinces');

        // Collapsed by default (aria-expanded="false") — clicking/pressing
        // Enter-Space on the card (delegated listener below) reveals the
        // description by flipping this attribute; CSS does the rest.
        // Share as a proportional bar, in the ALWAYS-VISIBLE part of the card.
        // The "% of area total" text lives in .catalogue-card-details, which is
        // collapsed by default — so the one number that lets you compare rank 1
        // against rank 4 was hidden exactly while you were scanning the grid.
        // Reading ten figures to rank them is work a length does for free.
        // Clamped because a share can exceed 100 when the area total is itself
        // a partial figure, and a bar wider than its track breaks the row.
        const shareW = Math.max(0, Math.min(100, sharePct));
        // The bar is ALWAYS labelled. A bare coloured bar on a card reads as a
        // progress meter or a score — the reader has no way to know it means
        // "share of this area's output", and the sentence that would have said
        // so lives in the collapsed details where it cannot help. A length
        // without a referent is decoration, so the number rides alongside it.
        // aria-hidden on the whole row: the same share is already in the card's
        // aria-label, and announcing it twice is worse than not drawing it.
        const shareBarHtml = totalVal > 0
            ? '<div class="catalogue-share-row" aria-hidden="true">'
            + '<div class="catalogue-share">'
            + '<div class="catalogue-share-fill" style="width:' + shareW.toFixed(1) + '%"></div>'
            + '</div>'
            + '<span class="catalogue-share-label">' + sharePct.toFixed(1) + '% of area</span>'
            + '</div>'
            : '';

        return '<div class="catalogue-card rank-' + rank + '" tabindex="0" role="button" '
            // The catalogue name, not the displayed label: the card shows
            // "Coconut" but the map's crop is "Overall Coconut Production",
            // and cropShortName() strips exactly that difference away.
            + 'data-crop="' + esc(r.cropName) + '" '
            + 'aria-expanded="false" aria-label="' + esc(name) + ', rank ' + rank
            + (totalVal > 0 ? ', ' + sharePct.toFixed(1) + '% of area total' : '')
            + ', click for details">'
            + '<div class="catalogue-card-banner"><span class="catalogue-rank">' + rank + '</span></div>'
            + '<div class="catalogue-card-header">'
            + '<div class="catalogue-photo">' + meta.emoji + '</div>'
            + '<div class="catalogue-card-titles">'
            + '<div class="catalogue-name">' + esc(name) + '</div>'
            + '<div class="catalogue-value">' + fmt(r.val) + '<span class="catalogue-value-unit"> MT</span>' + rankDeltaHtml + '</div>'
            + '</div>'
            + '<span class="catalogue-expand-chevron" aria-hidden="true">▾</span>'
            + '</div>'
            + shareBarHtml
            + '<div class="catalogue-card-details">'
            + (tags ? '<div class="catalogue-tags">' + tags + '</div>' : '')
            + (names ? '<div class="catalogue-names">' + names + '</div>' : '')
            + '<div class="catalogue-stats-row"><div class="catalogue-stats">' + yoyHtml + shareHtml + yieldHtml + '</div>' + sparkHtml + '</div>'
            + '<p class="catalogue-blurb">' + esc(meta.blurb) + '</p>'
            + (topAreasHtml ? '<div class="catalogue-top-areas">' + topAreasHtml + '</div>' : '')
            + '</div>'
            + '</div>';
    }).join('');
}

// ── Full ranking table modal ─────────────────────────────────────────────────
// Every commodity ranked for the current scope/year (respecting the same
// Category filter as the cards), not just the top 10 shown as cards. Reuses
// the same rank-delta/YoY/share math as the cards (computeCatalogueRankings())
// so the numbers always agree with the grid.
var catalogueTableSortBy = 'volume'; // 'volume' | 'yield'
var catalogueTableSearch = '';

function catalogueCropMatchesSearch(cropName, query) {
    if (!query) return true;
    const meta = CROP_META[cropName] || {};
    const name = cropName.replace(/^Overall\s+/i, '').replace(/\s+Production$/i, '');
    const haystack = (name + ' ' + (meta.sci || '') + ' ' + (meta.local || '') + ' ' + (meta.primary || '') + ' ' + (meta.sub || '')).toLowerCase();
    return haystack.indexOf(query) !== -1;
}

function renderCatalogueRankingTable() {
    if (!catalogueData) return;
    const scope = currentCatalogueScope();
    if (scope.value === null && scope.scope !== 'national') {
        document.getElementById('catalogue-ranking-table').innerHTML = '';
        return;
    }
    const category = currentCatalogueCategory();
    const rankings = computeCatalogueRankings(scope.scope, scope.value, currentYear, category);
    const totalVal = rankings.totalVal;
    const prevMap = rankings.prevMap;
    const hasPrevYear = !!Object.keys(prevMap).length;
    const query = catalogueTableSearch.trim().toLowerCase();
    const rows = rankings.all.filter(function (r) { return catalogueCropMatchesSearch(r.cropName, query); });

    const areaLabel = document.getElementById('catalogue-map-label').textContent || 'Philippines';
    const filterNote = (category ? categoryDisplayLabel(category) + ' · ' : '') + (query ? 'matching "' + catalogueTableSearch.trim() + '" · ' : '');
    const partial = partialYearNote(currentYear);
    document.getElementById('catalogue-table-sub').textContent =
        areaLabel + ' · ' + periodLabel(currentYear) + ' · ' + filterNote
        + rows.length + ' of ' + rankings.all.length + ' commodities'
        + (partial ? ' · ' + partial : '');

    const fmt = function (v) { return v.toLocaleString('en-PH', { maximumFractionDigits: 0 }); };
    const table = document.getElementById('catalogue-ranking-table');

    if (catalogueTableSortBy === 'yield') {
        const withYield = [], withoutYield = [];
        rows.forEach(function (r) {
            const yv = getYieldValueForCrop(r.cropName, scope.scope, scope.value, currentYear);
            (yv !== null ? withYield : withoutYield).push({ cropName: r.cropName, val: r.val, yieldVal: yv });
        });
        withYield.sort(function (a, b) { return b.yieldVal - a.yieldVal; });
        const yieldRows = withYield.concat(withoutYield);

        let html = '<thead><tr><th>#</th><th>Commodity</th><th>Category</th>'
            + '<th>Yield (MT/HA)</th><th>Volume (MT)</th></tr></thead><tbody>';
        html += yieldRows.map(function (r, i) {
            const meta = CROP_META[r.cropName] || { emoji: '🌱', primary: '', sub: '' };
            const name = r.cropName.replace(/^Overall\s+/i, '').replace(/\s+Production$/i, '');
            const cat = [meta.aggregate ? 'Combined total' : '', meta.primary, meta.sub].filter(Boolean).join(' / ');
            return '<tr><td class="num">' + (i + 1) + '</td>'
                + '<td>' + meta.emoji + ' ' + esc(name) + '</td>'
                + '<td class="rt-tags">' + esc(cat) + '</td>'
                + '<td class="num">' + (r.yieldVal !== null ? fmtMetricValue(r.yieldVal) : '—') + '</td>'
                + '<td class="num">' + fmt(r.val) + '</td>'
                + '</tr>';
        }).join('');
        html += '</tbody>';
        table.innerHTML = html;
        return;
    }

    let html = '<thead><tr><th>#</th><th>Δ</th><th>Commodity</th><th>Category</th>'
        + '<th>Volume (MT)</th><th>Share</th><th>YoY</th><th>5-yr trend</th></tr></thead><tbody>';
    html += rows.map(function (r) {
        const i = rankings.all.indexOf(r); // true rank stays stable under search filtering
        const meta = CROP_META[r.cropName] || { emoji: '🌱', primary: '', sub: '' };
        const name = r.cropName.replace(/^Overall\s+/i, '').replace(/\s+Production$/i, '');
        const prev = prevMap.hasOwnProperty(r.cropName) ? prevMap[r.cropName] : null;

        let deltaCell = '—';
        if (hasPrevYear) {
            if (!prev) deltaCell = '<span class="catalogue-rank-delta new">NEW</span>';
            else if (prev.rank === i) deltaCell = '<span class="catalogue-rank-delta same">–</span>';
            else {
                const delta = prev.rank - i;
                deltaCell = '<span class="catalogue-rank-delta ' + (delta > 0 ? 'up' : 'down') + '">'
                    + (delta > 0 ? '▲' : '▼') + Math.abs(delta) + '</span>';
            }
        }

        let yoyCell = '—', yoyCls = '';
        if (hasPrevYear) {
            if (!prev || !(prev.val > 0)) yoyCell = 'New';
            else {
                const pct = ((r.val - prev.val) / prev.val) * 100;
                yoyCls = pct > 0.5 ? 'yoy-up' : pct < -0.5 ? 'yoy-down' : '';
                yoyCell = (pct > 0.5 ? '▲' : pct < -0.5 ? '▼' : '▬') + ' ' + Math.abs(pct).toFixed(1) + '%';
            }
        }

        const sharePct = totalVal > 0 ? (r.val / totalVal) * 100 : 0;
        const cat = [meta.aggregate ? 'Combined total' : '', meta.primary, meta.sub].filter(Boolean).join(' / ');
        const series = getCommodityTrendSeries(r.cropName, scope.scope, scope.value);
        const sparkSvg = buildSparklineSvg(series).replace('class="catalogue-spark"', 'class="rt-spark"');

        return '<tr><td class="num">' + (i + 1) + '</td>'
            + '<td class="num">' + deltaCell + '</td>'
            + '<td>' + meta.emoji + ' ' + esc(name) + '</td>'
            + '<td class="rt-tags">' + esc(cat) + '</td>'
            + '<td class="num">' + fmt(r.val) + '</td>'
            + '<td class="num">' + sharePct.toFixed(1) + '%</td>'
            + '<td class="num ' + yoyCls + '">' + yoyCell + '</td>'
            + '<td class="num">' + sparkSvg + '</td>'
            + '</tr>';
    }).join('');
    html += '</tbody>';
    table.innerHTML = html;
}

// Yield sort mode needs yield loaded for every crop currently in the table —
// fetched only when the user actually switches to that tab (not upfront),
// same lazy-loading principle as the per-card yield stat.
function getYieldValueForCrop(cropName, scope, scopeValue, year) {
    const entry = catalogueYieldData[cropName];
    if (!entry) return null;
    const v = valueForScopeEntry(entry, scope, scopeValue, year);
    return (v !== null && v > 0) ? v : null;
}

function loadYieldsForCrops(cropNames) {
    const toLoad = cropNames.filter(function (name) {
        const hasYield = !!((cropConfig[name] || {}).yieldFile || (provConfig[name] || {}).yieldFile);
        return hasYield && !catalogueYieldData[name];
    });
    if (!toLoad.length) return Promise.resolve();
    return Promise.all(toLoad.map(function (name) { return loadYieldForCropSafe(name); })).then(function () {});
}

// Rebuilds the table, first fetching yield for whatever is currently in view
// whenever the table is in Yield mode. Yield is deliberately lazy (never
// fetched for all ~73 crops upfront), and catalogueTableSortBy PERSISTS across
// modal opens — so every path that rebuilds the table has to come through
// here. Going straight to renderCatalogueRankingTable() meant reopening the
// modal in Yield mode after changing the Category showed "—" for every
// commodity the previous view had not already loaded, which read as the
// filter's commodities failing to load at all. Worst under HVEC, where only
// 6 of the 16 crops have a yield source to begin with.
function refreshCatalogueRankingTable() {
    if (!catalogueData) return;
    if (catalogueTableSortBy !== 'yield') { renderCatalogueRankingTable(); return; }
    const scope = currentCatalogueScope();
    if (scope.value === null && scope.scope !== 'national') { renderCatalogueRankingTable(); return; }
    const cropNames = getAllCommodityValues(scope.scope, scope.value, currentYear, currentCatalogueCategory())
        .map(function (r) { return r.cropName; });
    document.getElementById('catalogue-table-sub').textContent = 'Loading yield data…';
    loadYieldsForCrops(cropNames).then(renderCatalogueRankingTable);
}

function switchCatalogueTableSort(mode) {
    if (catalogueTableSortBy === mode) return;
    catalogueTableSortBy = mode;
    document.getElementById('catalogue-sort-volume-btn').setAttribute('aria-pressed', mode === 'volume' ? 'true' : 'false');
    document.getElementById('catalogue-sort-yield-btn').setAttribute('aria-pressed', mode === 'yield' ? 'true' : 'false');
    refreshCatalogueRankingTable();
}

function openCatalogueRankingTable() {
    const modal = document.getElementById('catalogue-table-modal');
    modal.hidden = false;
    document.getElementById('catalogue-table-close-btn').focus();
    // The button sits in the scope bar, which is live well before the ~73-file
    // catalogue load settles. This used to `return` on !catalogueData, so an
    // early click did nothing whatsoever — no modal, no message, no error.
    // Open on a loading line instead and fill in when the data lands.
    if (!catalogueData) {
        document.getElementById('catalogue-ranking-table').innerHTML = '';
        document.getElementById('catalogue-table-sub').textContent = 'Loading commodity data…';
        ensureCatalogueData().then(function () {
            if (!modal.hidden) refreshCatalogueRankingTable();
        }).catch(function () {
            if (!modal.hidden) document.getElementById('catalogue-table-sub').textContent =
                'Could not load commodity data — close this and try again.';
        });
        return;
    }
    refreshCatalogueRankingTable();
}

function closeCatalogueRankingTable() {
    document.getElementById('catalogue-table-modal').hidden = true;
}

function exportCatalogueRankingCSV() {
    if (!catalogueData) return;
    const scope = currentCatalogueScope();
    if (scope.value === null && scope.scope !== 'national') return;
    const category = currentCatalogueCategory();
    const rankings = computeCatalogueRankings(scope.scope, scope.value, currentYear, category);
    const q = function (s) { return '"' + String(s).replace(/"/g, '""') + '"'; };
    // "Combined Total" is not decoration: the export carries Overall Palay/
    // Corn/Banana alongside the sub-types they contain, so totalling the
    // Volume column without reading this one overstates output by ~63%
    // nationally. The Share column is already computed against a denominator
    // that leaves the combined rows out.
    const header = ['Rank', 'Commodity', 'Primary Category', 'Sub-Category', 'Combined Total']
        .concat(YEARS).concat(['Share of Total %', 'YoY %']);
    const lines = [header.map(q).join(',')];
    rankings.all.forEach(function (r, i) {
        const meta = CROP_META[r.cropName] || { primary: '', sub: '' };
        const name = r.cropName.replace(/^Overall\s+/i, '').replace(/\s+Production$/i, '');
        const series = getCommodityYearSeries(r.cropName, scope.scope, scope.value);
        const sharePct = rankings.totalVal > 0 ? (r.val / rankings.totalVal) * 100 : 0;
        const prev = rankings.prevMap.hasOwnProperty(r.cropName) ? rankings.prevMap[r.cropName] : null;
        const yoy = (prev && prev.val > 0) ? (((r.val - prev.val) / prev.val) * 100).toFixed(2) : '';
        const row = [i + 1, name, meta.primary || '', meta.sub || '',
                     meta.aggregate ? 'includes ' + meta.aggregate : '']
            .concat(series.map(function (v) { return v || ''; }))
            .concat([sharePct.toFixed(2), yoy]);
        lines.push(row.map(q).join(','));
    });
    // UTF-8 BOM so Excel renders accented province/commodity names correctly
    const bom = String.fromCharCode(0xFEFF);
    const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    const areaLabel = (document.getElementById('catalogue-map-label').textContent || 'Philippines').replace(/[^\w-]+/g, '_');
    a.href = URL.createObjectURL(blob);
    a.download = ('commodity-ranking_' + areaLabel + '_' + currentYear).replace(/[^\w-]+/g, '_') + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
}

// ── Compare areas modal ──────────────────────────────────────────────────────
// Builds one shared <option>/<optgroup> list — Philippines, each island
// group, then every region with its provinces nested under it — reused by
// both of the compare modal's selects. Option values are "scope:value"
// (e.g. "province:0128000000", "national:" with an empty value half).
function compareAreaOptionsHtml() {
    let html = '<option value="national:">🇵🇭 Philippines (National)</option>';
    html += '<optgroup label="Island Groups">' + Object.keys(ISLAND_GROUPS).map(function (key) {
        return '<option value="island:' + key + '">' + esc(ISLAND_GROUPS[key].label) + '</option>';
    }).join('') + '</optgroup>';

    const shapes = getActiveShapes();
    if (shapes) {
        const regions = shapes.features.map(function (f) {
            return { pcode: f.properties.ADM1_PCODE, name: f.properties.ADM1_EN };
        }).sort(function (a, b) { return a.name.localeCompare(b.name); });
        regions.forEach(function (r) {
            html += '<optgroup label="' + esc(r.name) + '">';
            html += '<option value="region:' + r.pcode + '">' + esc(r.name) + ' (All)</option>';
            if (provincialShapes) {
                const pcodes = [...new Set(provincialShapes.features
                    .filter(function (f) { return provinceParentRegion(f.properties) === r.pcode; })
                    .map(function (f) { return effectiveProvincePcode(f.properties.ADM2_PCODE); }))]
                    .filter(function (pcode) { return CATALOGUE_EXCLUDED_PROVINCES.indexOf(pcode) === -1; });
                const provinces = pcodes.map(function (pcode) {
                    return { pcode: pcode, name: provinceDisplayName(pcode) };
                }).sort(function (a, b) { return a.name.localeCompare(b.name); });
                html += provinces.map(function (p) {
                    return '<option value="province:' + p.pcode + '">' + esc(p.name) + '</option>';
                }).join('');
            }
            html += '</optgroup>';
        });
    }
    return html;
}

function closeCatalogueCompare() {
    document.getElementById('catalogue-compare-modal').hidden = true;
}

function refreshCatalogueForYearChange() {
    if (!catalogueInitialized) return;
    document.getElementById('catalogue-year').textContent = currentYear;
    // The province <select>'s option VALUES are year-dependent: they come from
    // effectiveProvincePcode(), which folds a highly-urbanised city into its
    // parent province for every year before that city's PROVINCE_SPLITS
    // `since`. The picker was only rebuilt on a level/region change, so
    // scrubbing the timeline across a split boundary left it holding a pcode
    // that resolves to nothing for the newly selected year — an empty Top 10
    // while the map beside it rendered the same area correctly.
    // Guarded on provincialShapes: setYear() can fire during boot (any URL
    // carrying &year=) before the provincial GeoJSON has landed, and
    // populateCatalogueProvinceSelect() blanks the <select> when it has no
    // shapes to build from — rebuilding unguarded would wipe a restored
    // deep-linked province instead of preserving it.
    if (provincialShapes && document.getElementById('catalogue-level-select').value === 'province') {
        const sel = document.getElementById('catalogue-province-select');
        const prev = sel.value;
        populateCatalogueProvinceSelect();
        const has = function (v) { return [].some.call(sel.options, function (o) { return o.value === v; }); };
        if (has(prev)) sel.value = prev;
        else if (PROVINCE_SPLITS[prev] && has(PROVINCE_SPLITS[prev].parent)) {
            sel.value = PROVINCE_SPLITS[prev].parent; // city folded back into its parent for this year
        }
        updateUrlHash();
    }
    if (catalogueData) renderCatalogueGrid();
    renderCatalogueMap(); // region shapes can change across the 2024 NIR cutover
}

// ── Wiring (runs once at load; the section itself loads data lazily) ────────
(function initCatalogue() {
    populateCatalogueIslandSelect();
    populateCatalogueCategorySelect();

    // Accordion: only one card's description is open at a time, so expanding
    // a card can never leave a stretched grid row with a stranded, oddly-tall
    // gap under a still-collapsed neighbor.
    // Load the card's crop onto the map above. The card itself is untouched —
    // it still expands on the same click; this just also switches what the map
    // is showing, so scrolling back up lands on the crop you were reading about.
    //
    // selectCrop() DESELECTS when handed the element that is already active, so
    // clicking a card for the crop already on the map would blank it. Guarded.
    function showCropOnMap(cropName) {
        if (!cropName || currentCropName === cropName) return;
        const item = document.querySelector('.tree-item[data-crop="' + cropName + '"]');
        if (!item) return;   // hidden or unpublished crop: nothing to select
        // Open the tree section holding it, or the crop loads but the panel
        // shows no highlight — the same reveal filterCropTree() does.
        let node = item.parentElement;
        while (node && node !== document.body) {
            if (node.classList && node.classList.contains('tree-children')) {
                node.classList.add('open');
                const header = node.previousElementSibling;
                if (header && /section-header|sub-group-header/.test(header.className || '')) {
                    header.classList.add('open');
                }
            }
            node = node.parentElement;
        }
        selectCrop(item, cropName);
    }

    function toggleCatalogueCard(card) {
        const expanded = card.getAttribute('aria-expanded') === 'true';
        card.parentElement.querySelectorAll('.catalogue-card[aria-expanded="true"]').forEach(function (other) {
            if (other !== card) other.setAttribute('aria-expanded', 'false');
        });
        card.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        if (!expanded) loadCardYield(card);
    }

    // Fetches yield for this card's crop the first time it's opened, then
    // fills in its placeholder span in place (no full grid re-render, so it
    // can't disturb whichever card is currently expanded). If the scope/year
    // changes before the fetch resolves, the grid has already been rebuilt
    // and this element is a detached, harmless no-op target.
    function loadCardYield(card) {
        const el = card.querySelector('.catalogue-stat-yield');
        if (!el || el.dataset.loading) return;
        el.dataset.loading = '1';
        const cropName = el.dataset.yieldFor;
        const scope = currentCatalogueScope();
        const year = currentYear;
        el.textContent = 'Yield: loading…';
        loadYieldForCropSafe(cropName).then(function (entry) {
            if (!entry) { el.textContent = 'Yield: n/a'; return; }
            const val = valueForScopeEntry(entry, scope.scope, scope.value, year);
            if (val === null || !(val > 0)) { el.textContent = 'Yield: n/a'; return; }
            el.textContent = 'Yield: ' + fmtMetricValue(val) + ' MT/HA';
        });
    }

    // Cards are re-rendered (innerHTML replaced) on every area/year change, so
    // this is delegated on the grid container rather than bound per-card.
    document.getElementById('catalogue-grid').addEventListener('click', function (e) {
        const card = e.target.closest('.catalogue-card');
        if (!card) return;
        toggleCatalogueCard(card);
        showCropOnMap(card.dataset.crop);
    });
    document.getElementById('catalogue-grid').addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const card = e.target.closest('.catalogue-card');
        if (!card) return;
        e.preventDefault(); // stop Space from also scrolling the page
        toggleCatalogueCard(card);
        showCropOnMap(card.dataset.crop);
    });

    document.getElementById('catalogue-level-select').addEventListener('change', function () {
        updateCatalogueFieldVisibility();
        const level = this.value;
        if (level === 'region' || level === 'province') {
            if (!document.getElementById('catalogue-region-select').options.length) populateCatalogueRegionSelect();
        }
        if (level === 'province') populateCatalogueProvinceSelect();
        renderCatalogueGrid();
        renderCatalogueMap();
        updateUrlHash();
    });
    document.getElementById('catalogue-island-select').addEventListener('change', function () {
        renderCatalogueGrid();
        renderCatalogueMap();
        updateUrlHash();
    });
    document.getElementById('catalogue-region-select').addEventListener('change', function () {
        populateCatalogueProvinceSelect();
        renderCatalogueGrid();
        renderCatalogueMap();
        updateUrlHash();
    });
    document.getElementById('catalogue-province-select').addEventListener('change', function () {
        renderCatalogueGrid();
        renderCatalogueMap();
        updateUrlHash();
    });
    document.getElementById('catalogue-category-select').addEventListener('change', function () {
        renderCatalogueGrid();
        renderCatalogueMap();
        updateUrlHash();
    });

    function openCatalogue() {
        scrollToEl('catalogue-section');
        renderCatalogueMap(); // draws the shapes immediately, without icons (no crop data yet)
        ensureCatalogueData().then(function () {
            renderCatalogueGrid();
            renderCatalogueMap(); // re-run now that data's in, to add the top-10 icon markers
        }).catch(function () { /* status text already shows the error */ });
    }
    document.getElementById('catalogue-jump-btn').addEventListener('click', openCatalogue);
    document.getElementById('catalogue-back-btn').addEventListener('click', function () {
        scrollToEl('map-view');
    });

    document.getElementById('catalogue-view-ranking-btn').addEventListener('click', openCatalogueRankingTable);
    document.getElementById('catalogue-table-close-btn').addEventListener('click', closeCatalogueRankingTable);
    document.getElementById('catalogue-table-backdrop').addEventListener('click', closeCatalogueRankingTable);
    document.getElementById('catalogue-table-export-btn').addEventListener('click', exportCatalogueRankingCSV);
    document.getElementById('catalogue-sort-volume-btn').addEventListener('click', function () { switchCatalogueTableSort('volume'); });
    document.getElementById('catalogue-sort-yield-btn').addEventListener('click', function () { switchCatalogueTableSort('yield'); });
    document.getElementById('catalogue-table-search').addEventListener('input', function () {
        catalogueTableSearch = this.value;
        renderCatalogueRankingTable();
    });

    // ── Compare areas ────────────────────────────────────────────────────────
    (function initCompare() {
        // Rebuilt fresh every time the modal opens, rather than once here at
        // page load — at page-load time getActiveShapes()/provincialShapes
        // (both fetched async) are very likely still null, which silently
        // produced a region/province-less options list (just Philippines +
        // 3 islands) that never got a second chance to fill in. By the time
        // a user actually opens this modal, boundary data has long since
        // loaded. Preserves each select's current choice across a rebuild.
        function populateCompareSelects() {
            const optionsHtml = compareAreaOptionsHtml();
            const selA = document.getElementById('compare-area-a');
            const selB = document.getElementById('compare-area-b');
            const prevA = selA.value, prevB = selB.value;
            selA.innerHTML = optionsHtml;
            selB.innerHTML = optionsHtml;
            selA.value = (prevA && selA.querySelector('option[value="' + prevA + '"]')) ? prevA : 'national:';
            selB.value = (prevB && selB.querySelector('option[value="' + prevB + '"]')) ? prevB : 'island:luzon';
        }

        function renderCompareList(selectId, listId) {
            const list = document.getElementById(listId);
            const raw = document.getElementById(selectId).value;
            const sep = raw.indexOf(':');
            const scope = raw.slice(0, sep), value = raw.slice(sep + 1) || null;
            if (!catalogueData) { list.innerHTML = '<p class="catalogue-empty-msg">Loading…</p>'; return; }
            const top = getTopCommodities(scope, value, currentYear, 10, currentCatalogueCategory());
            if (!top.length) { list.innerHTML = '<p class="catalogue-empty-msg">No production reported.</p>'; return; }
            const totalVal = getAllCommodityValues(scope, value, currentYear, currentCatalogueCategory())
                .reduce(function (s, r) { return s + r.val; }, 0);
            const fmt = function (v) { return v.toLocaleString('en-PH', { maximumFractionDigits: 0 }); };
            list.innerHTML = top.map(function (r, i) {
                const meta = CROP_META[r.cropName] || { emoji: '🌱' };
                const name = r.cropName.replace(/^Overall\s+/i, '').replace(/\s+Production$/i, '');
                const sharePct = totalVal > 0 ? (r.val / totalVal) * 100 : 0;
                return '<div class="compare-row"><span class="compare-rank">' + (i + 1) + '</span>'
                    + '<span class="compare-emoji">' + meta.emoji + '</span>'
                    + '<span class="compare-name">' + esc(name) + '</span>'
                    + '<span class="compare-val">' + fmt(r.val) + ' MT <span class="compare-share">(' + sharePct.toFixed(1) + '%)</span></span></div>';
            }).join('');
        }

        function renderBothCompareLists() {
            renderCompareList('compare-area-a', 'compare-list-a');
            renderCompareList('compare-area-b', 'compare-list-b');
        }

        document.getElementById('compare-area-a').addEventListener('change', function () { renderCompareList('compare-area-a', 'compare-list-a'); });
        document.getElementById('compare-area-b').addEventListener('change', function () { renderCompareList('compare-area-b', 'compare-list-b'); });

        document.getElementById('catalogue-compare-btn').addEventListener('click', function () {
            document.getElementById('catalogue-compare-modal').hidden = false;
            document.getElementById('catalogue-compare-close-btn').focus();
            // Rebuild every open, not just the first — boundary data could
            // still have been mid-fetch on an earlier open, and a cheap
            // rebuild here guarantees regions/provinces are actually present.
            populateCompareSelects();
            if (catalogueData) { renderBothCompareLists(); return; }
            document.getElementById('compare-list-a').innerHTML = '<p class="catalogue-empty-msg">Loading commodity data…</p>';
            document.getElementById('compare-list-b').innerHTML = '<p class="catalogue-empty-msg">Loading commodity data…</p>';
            ensureCatalogueData().then(renderBothCompareLists).catch(function () {});
        });
        document.getElementById('catalogue-compare-close-btn').addEventListener('click', closeCatalogueCompare);
        document.getElementById('catalogue-compare-backdrop').addEventListener('click', closeCatalogueCompare);
    })();

    // Scrolling straight into the section (not via the jump button) also
    // triggers the load, once, the first time it comes into view.
    if ('IntersectionObserver' in window) {
        const obs = new IntersectionObserver(function (entries) {
            if (entries[0].isIntersecting) {
                renderCatalogueMap();
                ensureCatalogueData().then(function () {
                    renderCatalogueGrid();
                    renderCatalogueMap();
                }).catch(function () {});
            }
        }, { threshold: 0.15 });
        obs.observe(document.getElementById('catalogue-section'));
    }

    // Restores catScope/catIsland/catRegion/catProvince/catCategory from the
    // URL hash (stashed by bootFromHash() into hashBootCatalogue, since these
    // selects weren't ready yet at that point in boot). Best-effort: region/
    // province options come from getActiveShapes()/provincialShapes, which
    // are fetched asynchronously — if a deep link lands before those resolve,
    // the level/category still restore but the region/province dropdown may
    // come up empty. Doesn't auto-scroll to the catalogue section; it just
    // makes sure the scope is right whenever the user does get there.
    if (hashBootCatalogue) {
        const h = hashBootCatalogue;
        if (h.level && ['island', 'region', 'province'].indexOf(h.level) !== -1) {
            document.getElementById('catalogue-level-select').value = h.level;
        }
        updateCatalogueFieldVisibility();
        const level = document.getElementById('catalogue-level-select').value;
        if (level === 'island' && h.island && ISLAND_GROUPS[h.island]) {
            document.getElementById('catalogue-island-select').value = h.island;
        }
        if (level === 'region' || level === 'province') {
            populateCatalogueRegionSelect();
            if (h.region) document.getElementById('catalogue-region-select').value = h.region;
        }
        if (level === 'province') {
            populateCatalogueProvinceSelect();
            if (h.province) document.getElementById('catalogue-province-select').value = h.province;
        }
        if (h.category) {
            const catSel = document.getElementById('catalogue-category-select');
            if ([].some.call(catSel.options, function (o) { return o.value === h.category; })) catSel.value = h.category;
        }
        renderCatalogueGrid();
        renderCatalogueMap();
    }

    catalogueInitialized = true;
})();
