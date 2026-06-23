// ── SECURITY ─────────────────────────────────────────────────────────────────
function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── CONSTANTS ────────────────────────────────────────────────────────────────
const YEARS = ['2021', '2022', '2023', '2024', '2025'];
const MIN_YEAR = parseInt(YEARS[0]);
const MAX_YEAR = parseInt(YEARS[YEARS.length - 1]);

const METRICS = [
    { id: 'volume', label: 'Volume', unit: 'MT',    fileKey: 'file',      provFileKey: 'file',      title: 'Production Volume' },
    { id: 'yield',  label: 'Yield',  unit: 'MT/HA', fileKey: 'yieldFile', provFileKey: 'yieldFile', title: 'Average Yield' },
    { id: 'area',   label: 'Area',   unit: 'HA',    fileKey: 'areaFile',  provFileKey: 'areaFile',  title: 'Area Harvested' }
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

// ── 1. Map init ──────────────────────────────────────────────────────────────
var phBounds = L.latLngBounds(L.latLng(2.5, 114.0), L.latLng(23.0, 129.5));
var map = L.map('map', {
    zoomControl: false,
    minZoom: 5,
    maxZoom: 18,
    maxBounds: phBounds,
    maxBoundsViscosity: 1.0
}).setView([12.8797, 121.7740], 6);

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
var cartoVoyager = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png',
    { subdomains: 'abcd', maxZoom: 19, attribution: '© Carto' }
).addTo(map);
var stadiaSmooth = L.tileLayer(
    'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png',
    { maxZoom: 19, attribution: '© Stadia Maps' }
);
var esriSatellite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: '© Esri' }
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

// Provincial boundary lines — above fills, below regional outlines
map.createPane('provincialPane');
map.getPane('provincialPane').style.zIndex = 248;
map.getPane('provincialPane').style.pointerEvents = 'none';

// ── 4. Hillshade ─────────────────────────────────────────────────────────────
var hillshadeOverlay = L.imageOverlay(
    'data/Hillshade_18.png',
    [[4.500000668000002, 116.8], [21.2, 126.699999604]],
    { pane: 'hillshadePane', opacity: 0.85 }
).addTo(map);

// ── 5. Bottom-left controls ──────────────────────────────────────────────────
var HillshadeControl = L.Control.extend({
    options: { position: 'bottomleft' },
    onAdd: function () {
        var div = L.DomUtil.create('div', 'hillshade-toggle');
        L.DomEvent.disableClickPropagation(div);
        div.innerHTML = '<label><input type="checkbox" id="hillshade-cb" checked><span>🏔 Hillshade</span></label>';
        div.querySelector('#hillshade-cb').addEventListener('change', function () {
            if (this.checked) hillshadeOverlay.addTo(map);
            else map.removeLayer(hillshadeOverlay);
        });
        return div;
    }
});
new HillshadeControl().addTo(map);

var BasemapControl = L.Control.extend({
    options: { position: 'bottomleft' },
    onAdd: function () {
        var div = L.DomUtil.create('div', 'basemap-control');
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);
        div.innerHTML =
            '<div class="basemap-label">🗺️ Basemap</div>' +
            '<select id="basemap-select">' +
            '<option value="carto">Carto Voyager</option>' +
            '<option value="stadia">Stadia Smooth</option>' +
            '<option value="esri">Esri Satellite</option>' +
            '</select>';
        div.querySelector('#basemap-select').addEventListener('change', function () {
            [cartoVoyager, stadiaSmooth, esriSatellite].forEach(l => { if (map.hasLayer(l)) map.removeLayer(l); });
            ({ carto: cartoVoyager, stadia: stadiaSmooth, esri: esriSatellite })[this.value].addTo(map);
        });
        return div;
    }
});
new BasemapControl().addTo(map);

// ── 6. Crop config ───────────────────────────────────────────────────────────
const cropConfig = {
    'Overall Palay Production': {
        file: 'data/crop_dataOverall_Palay_Production_2025.csv',
        palette: ['#fefae8', '#b7e4a8', '#52c45e', '#1a7a3a', '#003d10']
    },
    'Irrigated Palay Production': {
        file: 'data/crop_dataIrrigated_Palay_Production_2025.csv',
        palette: ['#fefae8', '#82dfc8', '#1a9e52', '#005a22', '#003010']
    },
    'Rainfed Palay Production': {
        file: 'data/crop_dataRainfed_Palay_Production_2025.csv',
        palette: ['#fefae8', '#c8ee88', '#5ab858', '#1a7a3a', '#003d18']
    },
    'Overall Corn Production': {
        file: 'data/crop_dataAgristat_Database — Overall_Corn_Production_2025.csv',
        palette: ['#fefae8', '#f2d194', '#f2be22', '#f2a922', '#f28705']
    },
    'Yellow Corn Production': {
        file: 'data/crop_dataAgristat_Database — Yellow_Corn_Production_2025.csv',
        palette: ['#fefae8', '#fff6cb', '#fff69b', '#fff63b', '#fae500']
    },
    'White Corn Production': {
        file: 'data/crop_dataAgristat_Database — White_Corn_Production_2025.csv',
        palette: ['#fefae8', '#fff8c3', '#ffee8c', '#e6d67a', '#ccc160']
    },
    'Overall Mango Production': {
        file: 'data/crop_dataAgristat_Database — Overall_Mango_Production_2025.csv',
        palette: ['#fefae8', '#ffc97c', '#ffae3b', '#db7420', '#ae5209']
    },
    'Overall Banana Production': {
        file: 'data/crop_dataAgristat_Database — Overall_Banana_Production_2025.csv',
        palette: ['#fefae8', '#ffc97c', '#ffae3b', '#db7420', '#ae5209']
    },
    'Overall Coconut Production': {
        file: 'data/crop_dataAgristat_Database — Overall_Coconut_Production_2025.csv',
        palette: ['#fefae8', '#d7c6b6', '#c5ac95', '#b39274', '#9e7956']
    },
    'Overall Sugar Production': {
        file: 'data/crop_dataAgristat_Database — Overall_Sugar_Production_2025.csv',
        palette: ['#fefae8', '#d7c6b6', '#c5ac95', '#b39274', '#9e7956']
    },
    'Overall Milkfish Production': {
        file: 'data/crop_dataAgristat_Database — Bangus_Production_2025.csv',
        palette: ['#fefae8', '#99c7f5', '#66b8ea', '#3385ec', '#0059bd']
    },
    'Overall Tilapia Production': {
        file: 'data/crop_dataAgristat_Database — Tilapia_Production_2025.csv',
        palette: ['#fefae8', '#a6bbd9', '#7b9ac5', '#5279b1', '#28589c']
    },
    'Overall Chicken Production': {
        file: 'data/crop_dataAgristat_Database — Overall_Chicken_Production_2025.csv',
        palette: ['#fefae8', '#ffd1e2', '#ffa8c8', '#ff71a5', '#ff3e85']
    },
    'Overall Cattle Production': {
        file: 'data/crop_dataAgristat_Database — Overall_Cattle_Production_2025.csv',
        palette: ['#fefae8', '#ffd1e2', '#ffa8c8', '#ff71a5', '#ff3e85']
    },
    'Overall Hog Production': {
        file: 'data/crop_dataAgristat_Database — Overall_Hog_Production_2025.csv',
        palette: ['#fefae8', '#ffd1e2', '#ffa8c8', '#ff71a5', '#ff3e85']
    },
    'Overall Dairy Production': {
        file: 'data/crop_dataAgristat_Database — Overall_Dairy_Production_2025.csv',
        palette: ['#fefae8', '#ffd1e2', '#ffa8c8', '#ff71a5', '#ff3e85']
    },
    'Overall Egg Production': {
        file: 'data/crop_dataAgristat_Database — Overall_Eggs_Production_2025.csv',
        palette: ['#fefae8', '#ffd1e2', '#ffa8c8', '#ff71a5', '#ff3e85'],
        footnote: '* Total of Chicken and Duck Egg Production Volume'
    }
};

// Provincial CSV registry — add more crops here as files become available
const provConfig = {
    'Irrigated Palay Production': { file: 'data/IrrigatedPalay2024onwards.csv', yieldFile: 'data/IrrigatedPalay_Yield_Provincial.csv' },
    'Overall Palay Production': { file: 'data/Palay_ProductionVolume_Provincial.csv' },
    'Rainfed Palay Production': { file: 'data/RainfedPalay_ProductionVolume_Provincial.csv' },
    'Yellow Corn Production': { file: 'data/YellowCorn_ProductionVolume_Provincial.csv' },
    'White Corn Production': { file: 'data/WhiteCorn_ProductionVolume_Provincial.csv' }


};

// The provincial GeoJSON uses the 2024+ region pcode scheme (NIR=PH18,
// Mimaropa=PH16, BARMM=PH17, Caraga=PH15), but the pre-2024 regional
// boundaries use the older scheme (no NIR, Mimaropa=PH17, BARMM=PH19,
// Caraga=PH16). Translate so province-to-region matching works in any year.
const GEO_TO_PRE2024 = { PH15: 'PH16', PH16: 'PH17', PH17: 'PH19' };

// Returns the province's parent region pcode in the scheme of the
// currently displayed regional boundaries (depends on currentYear).
function provinceParentRegion(props) {
    if (parseInt(currentYear) >= 2024) return props.ADM1_PCODE;
    // NIR didn't exist before 2024 — its provinces revert to R6/R7,
    // which is encoded in the first 4 chars of their ADM2_PCODE
    if (props.ADM1_PCODE === 'PH18') return props.ADM2_PCODE.substring(0, 4);
    return GEO_TO_PRE2024[props.ADM1_PCODE] || props.ADM1_PCODE;
}

// Areas only reported separately starting in a given year. Before that year
// their polygon displays as part of the parent province (same color/data),
// like the NIR provinces reverting to R6/R7.
const PROVINCE_SPLITS = {
    PH09074: { parent: 'PH09073', since: 2025 } // Zamboanga City ← Zamboanga del Sur
};

function effectiveProvincePcode(adm2Pcode) {
    const split = PROVINCE_SPLITS[adm2Pcode];
    return (split && parseInt(currentYear) < split.since) ? split.parent : adm2Pcode;
}

function getActiveMetricDef() { return METRICS.find(m => m.id === activeMetric); }
function getActiveUnit() { return getActiveMetricDef().unit; }

function getNationalTotal() {
    if (!currentCropStats) return 0;
    return Object.values(currentCropStats).reduce((s, row) => s + (parseFloat(row[currentYear]) || 0), 0);
}

function getPrevYear() {
    const idx = YEARS.indexOf(currentYear);
    return idx > 0 ? YEARS[idx - 1] : null;
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
    const fmt = v => v.toLocaleString('en-PH', { maximumFractionDigits: 2 });
    const unit = getActiveUnit();
    return '<div class="info-row"><span class="info-label">Variance in previous year</span>'
        + '<span class="info-val ' + cls + '">' + sign + fmt(diff) + ' ' + unit + '</span></div>'
        + '<div class="info-row"><span class="info-label">Annual Growth Rate</span>'
        + '<span class="info-val ' + cls + '">' + arrow + ' ' + sign + rate.toFixed(2) + '%</span></div>';
}

function buildRegionPopupHTML(regionPcode, regionName, val, info) {
    const fmt = v => v.toLocaleString('en-PH', { maximumFractionDigits: 2 });
    const unit = getActiveUnit();
    const natTotal = getNationalTotal();
    const prevYear = getPrevYear();
    const regionRow = currentCropStats && currentCropStats[regionPcode];
    const sharePhil = natTotal > 0 && val ? ((val / natTotal) * 100).toFixed(2) : null;
    const growthHTML = buildGrowthHTML(val, regionRow, prevYear);
    const clsLabels = { peak: 'Peak Production', high: 'High Production', average: 'Average Production', low: 'Low Production', medHigh: 'Above Average', medLow: 'Below Average' };
    const badgeCls = info ? info.cls : null;
    const badgeColor = badgeCls ? getColor(currentCropName, badgeCls) : null;
    const badgeStyle = badgeColor
        ? 'background:' + colorToRgba(badgeColor, 0.18) + ';color:' + darkenColor(badgeColor, 0.45) + ';border:1.5px solid ' + colorToRgba(badgeColor, 0.4)
        : '';

    return '<div class="info-popup">'
        + '<div class="info-popup-title">' + esc(regionName) + '</div>'
        + '<div class="info-popup-rows">'
        + (val
            ? '<div class="info-row"><span class="info-label">Production (' + esc(currentYear) + ')</span><span class="info-val">' + fmt(val) + ' ' + esc(unit) + '</span></div>'
            : '<div class="info-row"><i style="color:#aaa">No data for ' + esc(currentYear) + '</i></div>')
        + (sharePhil !== null
            ? '<div class="info-row"><span class="info-label">Share to Philippines</span><span class="info-val">' + sharePhil + '%</span></div>'
            : '')
        + growthHTML
        + (badgeCls ? '<div class="info-badge" style="' + badgeStyle + '">' + esc(clsLabels[badgeCls]) + '</div>' : '')
        + '</div></div>';
}

function buildProvincePopupHTML(provPcode, provinceName, regionPcode, regionName, val, info, aliasNote) {
    const fmt = v => v.toLocaleString('en-PH', { maximumFractionDigits: 2 });
    const unit = getActiveUnit();
    const natTotal = getNationalTotal();
    const prevYear = getPrevYear();
    const regionRow = currentCropStats && currentCropStats[regionPcode];
    const regionTotal = regionRow ? (parseFloat(regionRow[currentYear]) || 0) : 0;
    const shareRegion = regionTotal > 0 && val ? ((val / regionTotal) * 100).toFixed(2) : null;
    const sharePhil   = natTotal   > 0 && val ? ((val / natTotal)   * 100).toFixed(2) : null;
    const provRow = currentProvStats && currentProvStats[provPcode];
    const growthHTML = buildGrowthHTML(val, provRow, prevYear);
    const clsLabels = { peak: 'Peak Production', medHigh: 'Above Average', medLow: 'Below Average' };
    const badgeCls = info ? info.cls : null;
    const badgeColor = badgeCls ? getColor(currentCropName, badgeCls) : null;
    const badgeStyle = badgeColor
        ? 'background:' + colorToRgba(badgeColor, 0.18) + ';color:' + darkenColor(badgeColor, 0.45) + ';border:1.5px solid ' + colorToRgba(badgeColor, 0.4)
        : '';

    return '<div class="info-popup">'
        + '<div class="info-popup-title">' + esc(provinceName) + '</div>'
        + '<div class="info-popup-subtitle">' + esc(regionName) + '</div>'
        + '<div class="info-popup-rows">'
        + (val
            ? '<div class="info-row"><span class="info-label">Production (' + esc(currentYear) + ')</span><span class="info-val">' + fmt(val) + ' ' + esc(unit) + '</span></div>'
            : '<div class="info-row"><i style="color:#aaa">No data for ' + esc(currentYear) + '</i></div>')
        + (regionTotal > 0
            ? '<div class="info-row"><span class="info-label">Regional Total (' + esc(currentYear) + ')</span><span class="info-val">' + fmt(regionTotal) + ' ' + esc(unit) + '</span></div>'
            : '')
        + (shareRegion !== null
            ? '<div class="info-row"><span class="info-label">Share to Region</span><span class="info-val">' + shareRegion + '%</span></div>'
            : '')
        + (sharePhil !== null
            ? '<div class="info-row"><span class="info-label">Share to Philippines</span><span class="info-val">' + sharePhil + '%</span></div>'
            : '')
        + growthHTML
        + (badgeCls ? '<div class="info-badge" style="' + badgeStyle + '">' + esc(clsLabels[badgeCls]) + '</div>' : '')
        + (aliasNote || '')
        + '</div></div>';
}

// ── 7. Boundary layers ───────────────────────────────────────────────────────
let boundaryLayer, cropLayer;
let baseShapes = null;
let baseShapesPre = null;
let activeShapesRef = null;

const regionalStyle = { color: 'rgba(83,93,115,1.0)', weight: 1, fillOpacity: 0 };

Promise.all([
    fetch('data/Admin_Boundary_Regional.json').then(r => r.json()),
    fetch('data/Admin_Boundary_Regional_pre2024.json').then(r => r.json())
]).then(function (results) {
    baseShapes = results[0];
    baseShapesPre = results[1];
    drawBoundaryLayer();
});

function getActiveShapes() {
    return parseInt(currentYear) >= 2024 ? baseShapes : baseShapesPre;
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
}

function updateBoundaryLayer() {
    if (!baseShapes || !baseShapesPre) return;
    if (activeShapesRef !== getActiveShapes()) drawBoundaryLayer();
}

let provincialLayer = null, provincialShapes = null;
fetch('data/Admin_Provincial_Boundary.json')
    .then(r => r.json())
    .then(data => {
        provincialShapes = data;
        provincialLayer = L.geoJson(provincialShapes, {
            pane: 'provincialPane',
            style: { color: 'rgba(60,70,95,0.7)', weight: 1.5, fillOpacity: 0, opacity: 0 },
            interactive: false
        }).addTo(map);
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

// Drop-shadow "lift" on the selected polygon for a pseudo-3D look
function elevate(layer, on) {
    const el = layer.getElement && layer.getElement();
    if (el) el.classList.toggle('path-elevated', on);
}

// ── 8. Classification ────────────────────────────────────────────────────────
// Shared inner logic — takes a stats object (keyed by pcode) and a list of pcodes to classify.
// useTopBottom: true (regions) → 5-tier: peak / high / average / low / noData
//               false (provinces) → 2-tier: medHigh (above avg) / medLow (below avg)
function classifyEntries(statsByPcode, pcodes, useTopBottom, thresholdAvg) {
    const entries = [];
    pcodes.forEach(pcode => {
        const val = statsByPcode[pcode] ? (parseFloat(statsByPcode[pcode][currentYear]) || 0) : 0;
        if (val > 0) entries.push({ pcode, val });
    });
    if (!entries.length) return { clsMap: {}, avg: 0, total: 0, noDataCount: pcodes.length, rangeStrings: {}, counts: {} };

    entries.sort((a, b) => a.val - b.val);
    const n = entries.length;
    const avg = entries.reduce((s, e) => s + e.val, 0) / n;

    const clsMap = {};
    if (useTopBottom) {
        // Regional 5-tier classification
        // Peak = top 3 by value (rank-based)
        const peakCount = Math.min(3, n);
        const peakSet = new Set(
            [...entries].sort((a, b) => b.val - a.val).slice(0, peakCount).map(e => e.pcode)
        );
        // Average band: ±10% of national average
        const bandLo = avg * 0.90;
        const bandHi = avg * 1.10;
        entries.forEach(e => {
            let cls;
            if (peakSet.has(e.pcode))        cls = 'peak';
            else if (e.val >= bandHi)         cls = 'high';
            else if (e.val >= bandLo)         cls = 'average';
            else                              cls = 'low';
            clsMap[e.pcode] = { cls, val: e.val };
        });
    } else {
        // Provincial 3-tier: peak (top 1 within region) / above national avg / below national avg
        const split = thresholdAvg || avg;
        const peakCount = Math.min(1, n);
        const peakSet = new Set(
            [...entries].sort((a, b) => b.val - a.val).slice(0, peakCount).map(e => e.pcode)
        );
        entries.forEach(e => {
            let cls;
            if (peakSet.has(e.pcode))  cls = 'peak';
            else if (e.val >= split)   cls = 'medHigh';
            else                       cls = 'medLow';
            clsMap[e.pcode] = { cls, val: e.val };
        });
    }

    const buckets = { peak: [], high: [], average: [], low: [], medHigh: [], medLow: [] };
    Object.values(clsMap).forEach(({ cls, val }) => buckets[cls].push(val));

    const fmt = v => v.toLocaleString('en-PH', { maximumFractionDigits: 2 });
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
    return classifyEntries(cropStats, Object.keys(cropStats), true);
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
    return palette[{ noData: 0, low: 1, medLow: 1, average: 2, medHigh: 3, high: 3, peak: 4 }[cls] ?? 0];
}

// ── 10. Focus state ──────────────────────────────────────────────────────────
function focusRegion(feature, layer) {
    const pcode = feature.properties.ADM1_PCODE;
    const regionName = feature.properties.ADM1_EN;
    if (focusedPcode === pcode) { resetFocus(); return; }

    // Clear any previous provincial data layer before setting new focus
    clearProvincialDataLayer();

    focusedPcode = pcode;
    focusedRegionName = regionName;
    // Cinematic swooping flight instead of a flat zoom
    map.flyToBounds(layer.getBounds(), { padding: [60, 60], maxZoom: 9, duration: 1.2, easeLinearity: 0.2 });

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
}

function renderProvincialChoropleth(regionPcode, regionName) {
    if (!currentProvStats || !provincialShapes) return;

    const allProvVals = Object.values(currentProvStats)
        .map(row => parseFloat(row[currentYear]) || 0).filter(v => v > 0);
    const nationalProvAvg = allProvVals.length
        ? allProvVals.reduce((s, v) => s + v, 0) / allProvVals.length : 0;

    const classification = classifyProvincesInRegion(currentProvStats, regionPcode, nationalProvAvg);
    currentProvClsMap = classification.clsMap;

    provincialDataLayer = L.geoJson(provincialShapes, {
        pane: 'provDataPane',
        style: function (feature) {
            if (provinceParentRegion(feature.properties) !== regionPcode) {
                return { fillOpacity: 0, weight: 1, opacity: 0 };
            }
            const pcode = effectiveProvincePcode(feature.properties.ADM2_PCODE);
            const info = classification.clsMap[pcode];
            const color = info ? getColor(currentCropName, info.cls) : getColor(currentCropName, 'noData');
            return { fillColor: color, weight: 0, fillOpacity: info ? layerOpacity : 0.15 };
        },
        onEachFeature: function (feature, layer) {
            if (provinceParentRegion(feature.properties) !== regionPcode) return;
            const pcode = effectiveProvincePcode(feature.properties.ADM2_PCODE);
            const aliased = pcode !== feature.properties.ADM2_PCODE;
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
                map.flyToBounds(layer.getBounds(), { padding: [80, 80], maxZoom: 10, duration: 0.9 });
                const parentName = aliased && currentProvStats[pcode]
                    ? currentProvStats[pcode].Province
                    : feature.properties.Province;
                const aliasNote = aliased
                    ? '<div class="info-alias">' + feature.properties.Province + ' reported under ' + parentName + ' in ' + currentYear + '</div>'
                    : '';
                layer.bindPopup(
                    buildProvincePopupHTML(pcode, parentName, regionPcode, regionName, val, info, aliasNote),
                    // autoPan off — flyToBounds above handles centering the province
                    { autoPan: false, maxWidth: 340 }
                ).openPopup();
            });
        }
    }).addTo(map);

    renderLegend(currentCropName, classification, regionName, nationalProvAvg);
}

function resetFocus() {
    focusedPcode = null;
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
                if (focusedPcode) {
                    layer.bindPopup(
                        buildRegionPopupHTML(fp, feature.properties.ADM1_EN, val, info),
                        { autoPan: true, autoPanPaddingTopLeft: [60, 60], autoPanPaddingBottomRight: [310, 60], maxWidth: 340 }
                    ).openPopup();
                }
            });
        }
    }).addTo(map);
}

// ── 12. Render legend ────────────────────────────────────────────────────────
// scope: undefined = national (regions), string = regional name (provinces)
function renderLegend(cropName, classification, scope, overrideAvg) {
    if (!cropConfig[cropName]) return;
    document.getElementById('legend-title').textContent = cropName.replace(/^Overall\s+/i, '');

    const scopeLabel = typeof scope === 'string' ? scope : null;
    const unitLabel = scopeLabel ? 'provinces' : 'regions';
    const avgValue = (overrideAvg != null ? overrideAvg : classification.avg) || 0;
    const avgPrefix = currentYear + ' national average: ';
    document.getElementById('legend-avg').textContent =
        avgPrefix + avgValue.toLocaleString('en-PH', { maximumFractionDigits: 2 }) + ' ' + getActiveUnit();

    const fn = (cropConfig[cropName] || {}).footnote || '';
    const fnEl = document.getElementById('legend-footnote');
    fnEl.textContent = fn;
    fnEl.style.display = fn ? 'block' : 'none';
    const classes = scopeLabel ? [
        { cls: 'peak',    label: 'Peak Production',          note: 'Top-Producing' },
        { cls: 'medHigh', label: 'Above Average Production', note: 'Above national average' },
        { cls: 'medLow',  label: 'Below Average Production', note: 'Below national average' },
        { cls: 'noData',  label: 'No Data',                  note: 'Not reported' }
    ] : [
        { cls: 'peak',    label: 'Peak Production',    note: 'Top-Producing' },
        { cls: 'high',    label: 'High Production',    note: 'Above average' },
        { cls: 'average', label: 'Average Production', note: 'Near national average' },
        { cls: 'low',     label: 'Low Production',     note: 'Below average' },
        { cls: 'noData',  label: 'No Data',            note: 'Not reported' }
    ];

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
        row.innerHTML =
            '<div class="legend-swatch" style="background:' + color + '"></div>' +
            '<div>' +
            '<div class="legend-label">' + item.label + '</div>' +
            // (range ? '<div class="legend-range">' + range + '</div>' : '') +
            '<div class="legend-count">' + item.note + (count !== undefined ? ' \xB7 ' + count + ' ' + unitLabel : '') + '</div>' +
            '</div>';
        el.appendChild(row);
    });
    document.getElementById('legend-panel').style.display = 'block';
}

// ── 13. Year controller ──────────────────────────────────────────────────────
function setYear(year) {
    year = String(year);
    currentYear = year;
    updateBoundaryLayer();
    const pct = ((parseInt(year) - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * 100;
    const slider = document.getElementById('year-slider');
    slider.style.setProperty('--fill-pct', pct + '%');
    slider.value = year;
    document.querySelectorAll('.yr-tick-label').forEach(t => t.classList.toggle('active', t.dataset.yr === year));
    const lbl = document.getElementById('year-label');
    lbl.classList.remove('flash');
    void lbl.offsetWidth;
    lbl.textContent = year;
    lbl.classList.add('flash');
    setTimeout(() => lbl.classList.remove('flash'), 300);
    document.getElementById('header-year').textContent = year;
    if (currentCropStats && currentCropName) {
        const classification = classifyRegions(currentCropStats);
        renderMap(currentCropStats, currentCropName, classification.clsMap);
        renderLegend(currentCropName, classification);
    }
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
function aggregateProvToRegional(provStats, useAverage) {
    const buckets = {};
    Object.values(provStats).forEach(row => {
        if (!row.ADM2_PCODE) return;
        const rPcode = row.ADM2_PCODE.substring(0, 4);
        if (!buckets[rPcode]) buckets[rPcode] = { ADM1_PCODE: rPcode, _sum: {}, _cnt: {} };
        YEARS.forEach(y => {
            const v = parseFloat(row[y]) || 0;
            if (v > 0) {
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

    const file    = config[metricDef.fileKey];
    const provFile = provConfig[cropName] && provConfig[cropName][metricDef.provFileKey];

    // No regional file but a provincial file exists — derive regional from provincial.
    if (!file && provFile) {
        document.getElementById('year-hint').style.display = 'none';
        currentCropName = cropName;
        currentProvStats = null;

        Papa.parse(provFile + '?v=' + Date.now(), {
            download: true,
            header: true,
            complete: function (results) {
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
                const regionalStats = aggregateProvToRegional(provStats, metricDef.id === 'yield');
                currentCropStats = regionalStats;
                const classification = classifyRegions(regionalStats);
                renderMap(regionalStats, cropName, classification.clsMap);
                renderLegend(cropName, classification);
                if (focusedPcode && focusedRegionName && !provincialDataLayer) {
                    renderProvincialChoropleth(focusedPcode, focusedRegionName);
                }
            },
            error: function (err) { console.error('CSV load error:', err); }
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
        return;
    }

    document.getElementById('year-hint').style.display = 'none';
    currentCropName = cropName;
    currentProvStats = null;

    Papa.parse(file + '?v=' + Date.now(), {
        download: true,
        header: true,
        complete: function (results) {
            const stats = {};
            results.data.forEach(row => { if (row.ADM1_PCODE) stats[row.ADM1_PCODE] = row; });
            currentCropStats = stats;
            const classification = classifyRegions(stats);
            renderMap(stats, cropName, classification.clsMap);
            renderLegend(cropName, classification);
        },
        error: function (err) { console.error('CSV load error:', err); }
    });

    if (provFile) {
        Papa.parse(provFile + '?v=' + Date.now(), {
            download: true,
            header: true,
            complete: function (results) {
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
            },
            error: function (err) { console.error('Provincial CSV load error:', err); }
        });
    }
}

function selectCrop(el, cropName) {
    if (activeItem === el) {
        el.classList.remove('active');
        activeItem = null;
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
        return;
    }
    if (activeItem) activeItem.classList.remove('active');
    el.classList.add('active');
    activeItem = el;
    updateMetricTabAvailability(cropName);
    loadCropData(cropName);
}

function switchMetric(metricId) {
    if (metricId === activeMetric) return;
    activeMetric = metricId;
    updateMetricUI();
    if (activeItem && currentCropName) loadCropData(currentCropName);
}

function updateMetricUI() {
    const metricDef = getActiveMetricDef();
    document.querySelectorAll('.metric-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.metric === metricDef.id));
    document.getElementById('panel-title').textContent = '🌾 ' + metricDef.title + ' (' + metricDef.unit + ')';
}

function updateMetricTabAvailability(cropName) {
    const config = cropName ? cropConfig[cropName] : null;
    document.querySelectorAll('.metric-tab').forEach(tab => {
        const metricDef = METRICS.find(m => m.id === tab.dataset.metric);
        const available = !!(config && config[metricDef.fileKey]);
        tab.classList.toggle('unavailable', !available);
        tab.title = available ? '' : metricDef.label + ' data not yet available for this crop';
    });
}

function toggleSection(el) {
    const children = el.nextElementSibling;
    const chevron = el.querySelector('.chevron');
    if (!children) return;
    const isOpen = children.classList.toggle('open');
    if (chevron) chevron.classList.toggle('open', isOpen);
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
        btn.innerHTML = '🔍';
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
        btn.innerHTML = '⛶';
        L.DomEvent.disableClickPropagation(btn);
        L.DomEvent.on(btn, 'click', function () {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
                btn.innerHTML = '✕';
                btn.title = 'Exit fullscreen';
            } else {
                document.exitFullscreen();
                btn.innerHTML = '⛶';
                btn.title = 'Toggle fullscreen';
            }
        });
        document.addEventListener('fullscreenchange', function () {
            if (!document.fullscreenElement) { btn.innerHTML = '⛶'; btn.title = 'Toggle fullscreen'; }
        });
        return btn;
    }
});
new FullscreenControl().addTo(map);

// ── 17. Fix Measure button ────────────────────────────────────────────────────
setTimeout(function () {
    var t = document.querySelector('.leaflet-control-measure .leaflet-control-measure-toggle');
    if (t) { t.innerHTML = '📏'; t.title = 'Measure distances and areas'; t.style.fontSize = '15px'; }
}, 400);

// ── 18. Wire up event listeners ──────────────────────────────────────────────
document.getElementById('toggle-borders').addEventListener('change', toggleBorders);
document.getElementById('opacity-slider').addEventListener('input', function () { setLayerOpacity(this.value); });
document.getElementById('legend-toggle').addEventListener('click', toggleLegend);
document.getElementById('year-controller-toggle').addEventListener('click', toggleYearController);
document.getElementById('play-btn').addEventListener('click', togglePlay);
document.getElementById('year-slider').addEventListener('input', function () { setYear(this.value); });

document.getElementById('tree-scroll').addEventListener('click', function (e) {
    const header = e.target.closest('.section-header');
    if (header) { toggleSection(header); return; }
    const item = e.target.closest('.tree-item');
    if (item) selectCrop(item, item.dataset.crop);
});

document.querySelectorAll('.yr-tick-label').forEach(function (tick) {
    tick.addEventListener('click', function () { setYear(this.dataset.yr); });
});

document.querySelectorAll('.metric-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
        if (!this.classList.contains('unavailable')) switchMetric(this.dataset.metric);
    });
});

document.getElementById('year-slider').style.setProperty('--fill-pct', '100%');
