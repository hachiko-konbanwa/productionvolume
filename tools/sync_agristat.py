#!/usr/bin/env python3
"""Build sub-annual (quarter and semester) crop files from the Agristat sheet.

The Atlas reads WIDE csv: one row per province, one column per period, joined
on ADM2_PCODE. The published sheet is LONG: one row per
year x period x crop x province, with no PSGC codes at all. This script does
the four steps between those two shapes:

    1. filter to one period_type          (quarter / semester)
    2. drop the empty half of re-homed provinces (see DUPLICATES below)
    3. join province NAME -> ADM2_PCODE   (the sheet carries no codes)
    4. pivot long -> wide, one file per crop x metric x granularity

Annual data is deliberately NOT touched. The existing yearly files are hand
curated and cover ~80 crops; this sheet only carries Palay and Corn, so
overwriting them from here would be a downgrade.

DUPLICATES
    Provinces that changed region appear TWICE per period - once under the old
    region, once under the new - and exactly one of the two rows carries a
    value. Verified across all 592 annual collisions: never both. So "keep the
    non-blank row" is safe, and it also handles the handover automatically:
    Negros flipped to NIR in 2024, Sulu flips to Region IX in 2026, and neither
    needs a special case here.

    The sheet's `region` column is then thrown away. The Atlas derives region
    from the PSGC code via provinceParentRegion(), and two sources of truth for
    the same fact is one too many.

Usage:  python tools/sync_agristat.py [--offline path/to/sheet.csv]
"""

import argparse
import csv
import io
import os
import re
import sys
import urllib.request
from collections import defaultdict

SHEET_ID = '1SFbzrLPyK63sA8g-OQvuBNKZy9Ts9k1VNUGhpA0gLKs'
GID = '64865956'
SHEET_URL = ('https://docs.google.com/spreadsheets/d/%s/export?format=csv&gid=%s'
             % (SHEET_ID, GID))

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DATA = os.path.join(REPO, 'data')
OUT = os.path.join(DATA, 'subannual')

YEAR_MIN, YEAR_MAX = 2021, 2026

# Sheet spelling -> the spelling the Atlas's own provincial files use. Only
# these five differ; the other 82 match exactly.
PROVINCE_ALIASES = {
    'Cotabato': 'Cotabato (North Cotabato)',
    'Davao City': 'City of Davao',
    'Davao de Oro': 'Davao de Oro (Compostela Valley)',
    'Puerto Princesa': 'Puerto Princesa City',
    'Tawi-Tawi': 'Tawi-tawi',
}

# Highly-urbanised cities PSA reports as their own row (Davao City from 2025;
# Bacolod, Butuan and Puerto Princesa from 2026).
#
# Codes are pinned here, NOT harvested from data/: several files in there give
# these cities codes belonging to real provinces - 1804600000 is Negros
# ORIENTAL, 1600200000 is Agusan del Norte - so harvesting would post city
# output onto the wrong province and the total would still look right.
#
# These four used to be folded into their parent province, because the boundary
# layer had no polygon for them and a row the map cannot draw is a row the map
# silently drops. As of 2026-09-03 they have their own carved polygons in
# Admin_Provincial_Boundary.json, so they keep their own PSGC code and their own
# row, and PROVINCE_SPLITS in js/app.js folds them onto the parent for the years
# before PSA began reporting them separately (Davao City 2025, the rest 2026).
#
# Folding them here as well would double-fold: the value would land on the
# parent AND the parent would be the effective pcode, so the city polygon would
# render as no-data while its tonnage inflated the province.
HUC_OWN_PCODE = {
    'Bacolod City':     '1830200000',
    'Butuan City':      '1630400000',
    'Puerto Princesa':  '1731500000',
    'Davao City':       '1130700000',
}

# Still folded: cities with no separate polygon and no separate PSA series.
HUC_PARENT_PCODE = {}

# Two different source names must never resolve to the same polygon: that
# silently merges one province into another, and the total still looks right so
# nothing downstream notices. Davao City did exactly this - a file in data/
# gives 'City of Davao' the code 1108600000, which is DAVAO OCCIDENTAL, so the
# city's ~9,900 MT was landing on Davao Occidental's ~2,000 MT polygon and
# sextupling it. Loudly fatal rather than a warning.
def assert_no_collisions(mapping):
    seen = {}
    clashes = []
    for name, code in mapping:
        if code in seen and seen[code] != name:
            clashes.append((seen[code], name, code))
        seen.setdefault(code, name)
    if clashes:
        for a, b, c in clashes:
            log('  FATAL: %r and %r both map to %s' % (a, b, c))
        raise SystemExit('province name -> PSGC collision; refusing to write '
                         'files that would merge two provinces')

# (crop_group, crop_subtype) -> the catalogue name in js/app.js.
SERIES = {
    ('Palay', 'Irrigated'): 'Irrigated Palay Production',
    ('Palay', 'Rainfed'):   'Rainfed Palay Production',
    ('Corn',  'Yellow'):    'Yellow Corn Production',
    ('Corn',  'White'):     'White Corn Production',
}

# Overall = the sum of its parts. The sheet has no Overall rows (is_aggregate
# is 0 on every one of its 94,276 rows), so these are derived.
DERIVED = {
    'Overall Palay Production': ['Irrigated Palay Production', 'Rainfed Palay Production'],
    'Overall Corn Production':  ['Yellow Corn Production', 'White Corn Production'],
}

# Catalogue name -> the filename stem the Atlas already uses for that crop.
STEM = {
    'Irrigated Palay Production': 'IrrigatedPalay',
    'Rainfed Palay Production':   'RainfedPalay',
    'Overall Palay Production':   'Palay',
    'Yellow Corn Production':     'YellowCorn',
    'White Corn Production':      'WhiteCorn',
    'Overall Corn Production':    'Corn',
}

GRANULARITIES = {
    # period_type in the sheet -> (label, how to name the column)
    'quarter':  ('quarter',  lambda y, n: '%dQ%d' % (y, n)),
    'semester': ('semester', lambda y, n: '%dS%d' % (y, n)),
}

# ── Annual provincial files ──────────────────────────────────────────────────
# Catalogue name -> the annual filename the Atlas already reads from data/.
# Only the crops this sheet covers; every other crop's annual file comes from
# elsewhere and is not touched.
ANNUAL_FILE = {
    'Yellow Corn Production':     'YellowCorn_ProductionVolume_Provincial.csv',
    'White Corn Production':      'WhiteCorn_ProductionVolume_Provincial.csv',
    'Irrigated Palay Production': 'IrrigatedPalay2024onwards.csv',
    'Rainfed Palay Production':   'RainfedPalay_ProductionVolume_Provincial.csv',
    'Overall Palay Production':   'Palay_ProductionVolume_Provincial.csv',
    # New file: Overall Corn had a regional source but no provincial one, so
    # the map could not drill into it and its regional total had nothing to be
    # checked against. Derived here from Yellow + White, same as Overall Palay.
    'Overall Corn Production':    'Corn_ProductionVolume_Provincial.csv',
}

# Overall Palay is derived (Irrigated + Rainfed) rather than read: the sheet has
# no Overall rows at all. See DERIVED.
ANNUAL_DERIVED = ['Overall Palay Production', 'Overall Corn Production']

# What goes in the 2026 column.
#
# PSA publishes an annual figure only after Q4 closes, so the sheet's 2026
# annual rows are empty - every one of them. The existing annual files in data/
# nevertheless carry a 2026 column, and for Palay it holds Q1 exactly (checked
# province by province: Davao de Oro 28,082.00 = Q1 28,082, against a Q1+Q2 of
# 61,299). Two-thirds of the provincial volume files in data/ sit at roughly a
# quarter of their own 2025, so Q1 is the house convention.
#
# Matching it is deliberate even though S1 would be more data. The Top 10
# catalogue ranks crops AGAINST EACH OTHER for one year, so if corn carried a
# half-year and palay a quarter, corn would outrank it on period coverage
# rather than production. Same convention beats more data here.
#
# Set to 'S1' to use Q1+Q2 instead, or None to leave 2026 blank.
PARTIAL_2026_FROM = 'Q1'


def log(msg):
    sys.stdout.write(msg + '\n')
    sys.stdout.flush()


def fetch(offline):
    if offline:
        log('reading %s' % offline)
        with open(offline, encoding='utf-8') as fh:
            return list(csv.DictReader(fh))
    log('downloading the sheet ...')
    with urllib.request.urlopen(SHEET_URL, timeout=120) as resp:
        raw = resp.read().decode('utf-8')
    log('  %.1f MB' % (len(raw) / 1048576.0))
    return list(csv.DictReader(io.StringIO(raw)))


def province_codes():
    """Province name -> ADM2_PCODE, harvested from the files already in data/.

    Read from the repo rather than hard-coded: these are the exact codes the
    boundary layer joins against, so taking them from anywhere else would let
    the two drift.
    """
    codes = {}
    for name in os.listdir(DATA):
        if not name.lower().endswith('.csv'):
            continue
        path = os.path.join(DATA, name)
        try:
            with open(path, encoding='utf-8-sig') as fh:
                for row in csv.DictReader(fh):
                    p = (row.get('Province') or '').strip()
                    c = (row.get('ADM2_PCODE') or '').strip()
                    if p and c and len(c) == 10 and c.isdigit():
                        codes.setdefault(p, c)
        except (OSError, UnicodeDecodeError, csv.Error):
            continue
    return codes


def num(s):
    s = (s or '').strip()
    if s == '':
        return None
    try:
        return float(s)
    except ValueError:
        return None


def build(rows, gran, codes):
    """-> {crop: {pcode: {period: {'v': volume, 'a': area}}}}, plus the period list."""
    label, colname = GRANULARITIES[gran]
    out = defaultdict(lambda: defaultdict(dict))
    periods = set()
    unmatched = set()
    folded = defaultdict(int)
    resolved = []
    dropped_blank = 0

    for r in rows:
        if r['period_type'] != label:
            continue
        year = int(r['year'])
        if not (YEAR_MIN <= year <= YEAR_MAX):
            continue
        crop = SERIES.get((r['crop_group'].strip(), r['crop_subtype'].strip()))
        if crop is None:
            continue

        v, a = num(r['volume_mt']), num(r['area_ha'])
        if v is None and a is None:
            dropped_blank += 1          # the empty twin of a re-homed province
            continue

        name = r['province'].strip()
        pcode = HUC_OWN_PCODE.get(name) or HUC_PARENT_PCODE.get(name)
        if name in HUC_PARENT_PCODE:
            folded[name] += 1
        elif not pcode:
            pcode = codes.get(PROVINCE_ALIASES.get(name, name)) or codes.get(name)
        if not pcode:
            unmatched.add(name)
            continue

        resolved.append((name, pcode))
        col = colname(year, int(r['period_number']))
        periods.add((year, int(r['period_number']), col))
        cell = out[crop][pcode].setdefault(col, {'v': 0.0, 'a': 0.0})
        cell['v'] += v or 0.0
        cell['a'] += a or 0.0

    if unmatched:
        log('  !! %d province names had no PSGC match: %s'
            % (len(unmatched), ', '.join(sorted(unmatched))))
    for city, n in sorted(folded.items()):
        log('  folded %s into its parent province (%d rows)' % (city, n))
    # Folded cities intentionally share their parent's code, so they are exempt.
    assert_no_collisions([(n, c) for n, c in set(resolved) if n not in HUC_PARENT_PCODE])
    log('  %s: %d crops, %d blank rows skipped'
        % (label, len(out), dropped_blank))
    return out, [c for _, _, c in sorted(periods)]


def derive_overall(data):
    for target, parts in DERIVED.items():
        have = [p for p in parts if p in data]
        if len(have) != len(parts):
            log('  skipping %s - missing %s'
                % (target, ', '.join(p for p in parts if p not in data)))
            continue
        merged = defaultdict(dict)
        for part in parts:
            for pcode, cells in data[part].items():
                for col, cell in cells.items():
                    t = merged[pcode].setdefault(col, {'v': 0.0, 'a': 0.0})
                    t['v'] += cell['v']
                    t['a'] += cell['a']
        data[target] = merged
        log('  derived %s from %s' % (target, ' + '.join(parts)))


def boundary_names():
    """ADM2_PCODE -> ADM2_EN, read from the polygon layer the map actually draws.

    NOT reversed out of the name->code map: that one is harvested from data/,
    where several files pair a city name with a province's code, so reversing it
    labelled Davao Occidental's polygon "City of Davao". The boundary file is
    the only place where a code and its name are guaranteed to agree.
    """
    path = os.path.join(DATA, 'Admin_Provincial_Boundary.json')
    if not os.path.exists(path):
        return {}
    with open(path, encoding='utf-8') as fh:
        txt = fh.read()
    names, out = [], {}
    pat = re.compile(r'"ADM2_EN"\s*:\s*"([^"]*)"|"ADM2_PCODE"\s*:\s*"([^"]*)"')
    pairs = []
    for m in pat.finditer(txt):
        pairs.append(('n', m.group(1)) if m.group(1) is not None else ('c', m.group(2)))
    pending = None
    for kind, val in pairs:
        if kind == 'n':
            pending = val
        elif pending is not None:
            out.setdefault(val, pending)
            pending = None
    return out


def write(data, periods, gran, codes):
    """One file per crop x metric. Yield is volume/area, never an average of
    yields - averaging ratios weights a 20 ha province like a 20,000 ha one."""
    os.makedirs(OUT, exist_ok=True)
    by_code = boundary_names()
    # Anything the boundary file does not name falls back to the harvested map.
    for name, code in codes.items():
        by_code.setdefault(code, name)
    written = []

    for crop, provinces in sorted(data.items()):
        for metric in ('volume', 'area', 'yield'):
            path = os.path.join(OUT, '%s_%s_%s.csv' % (STEM[crop], metric, gran))
            with open(path, 'w', newline='', encoding='utf-8') as fh:
                w = csv.writer(fh)
                w.writerow(['Commodity Type', 'ADM2_PCODE', 'Province'] + periods)
                for pcode in sorted(provinces):
                    cells = provinces[pcode]
                    row = [crop, pcode, by_code.get(pcode, '')]
                    for col in periods:
                        cell = cells.get(col)
                        if cell is None:
                            row.append('')
                        elif metric == 'volume':
                            row.append(round(cell['v'], 2))
                        elif metric == 'area':
                            row.append(round(cell['a'], 2))
                        else:
                            row.append(round(cell['v'] / cell['a'], 4)
                                       if cell['a'] > 0 else '')
                    w.writerow(row)
            written.append(path)
    return written


def region_labels():
    """ADM2_PCODE -> the Region string the existing annual files already use.

    Harvested rather than taken from the sheet: the sheet says 'CAR', the annual
    files say 'CORDILLERA ADMINISTRATIVE REGION (CAR)'. The column is not read
    by the app (it joins on ADM2_PCODE), but a file that suddenly spells its
    regions differently from its siblings is a trap for the next person
    diffing them.

    Keep the LONGEST label seen per pcode, not the first. Files in data/ carry
    both a short form ('Region III', 'CAR') and the descriptive one used by the
    annual provincial files ('REGION III (CENTRAL LUZON)'), and with setdefault
    the winner was decided by os.listdir order - the first run produced short
    labels purely because of directory order. Longest is deterministic and
    picks the descriptive form the annual files use.
    """
    labels = {}
    for name in os.listdir(DATA):
        if not name.lower().endswith('.csv'):
            continue
        try:
            with open(os.path.join(DATA, name), encoding='utf-8-sig') as fh:
                for row in csv.DictReader(fh):
                    c = (row.get('ADM2_PCODE') or '').strip()
                    r = (row.get('Region') or '').strip()
                    if c and r and len(c) == 10 and c.isdigit():
                        if len(r) > len(labels.get(c, '')):
                            labels[c] = r
        except (OSError, UnicodeDecodeError, csv.Error):
            continue
    return labels


def build_annual(rows, codes):
    """-> {crop: {pcode: {year: volume}}}

    Same province resolution as build(): same aliases, same HUC folding, same
    collision assertion. Volume only - the annual area and yield files are
    xlsx from a different source and are not this script's business.
    """
    out = defaultdict(lambda: defaultdict(dict))
    part = defaultdict(lambda: defaultdict(float))   # 2026 partial, by pcode
    unmatched, resolved = set(), []
    folded = defaultdict(int)

    want_q = {'Q1': (1,), 'S1': (1, 2)}.get(PARTIAL_2026_FROM, ())

    for r in rows:
        year = int(r['year'])
        if not (YEAR_MIN <= year <= YEAR_MAX):
            continue
        crop = SERIES.get((r['crop_group'].strip(), r['crop_subtype'].strip()))
        if crop is None:
            continue
        is_annual = r['period_type'] == 'annual'
        is_part26 = (year == YEAR_MAX and r['period_type'] == 'quarter'
                     and int(r['period_number']) in want_q)
        if not (is_annual or is_part26):
            continue

        v = num(r['volume_mt'])
        if v is None:
            continue

        name = r['province'].strip()
        pcode = HUC_OWN_PCODE.get(name) or HUC_PARENT_PCODE.get(name)
        if name in HUC_PARENT_PCODE:
            folded[name] += 1
        elif not pcode:
            pcode = codes.get(PROVINCE_ALIASES.get(name, name)) or codes.get(name)
        if not pcode:
            unmatched.add(name)
            continue
        resolved.append((name, pcode))

        if is_part26:
            part[crop][pcode] += v
        else:
            out[crop][pcode][year] = out[crop][pcode].get(year, 0.0) + v

    for crop, cells in part.items():
        for pcode, v in cells.items():
            out[crop][pcode][YEAR_MAX] = v

    if unmatched:
        log('  !! %d province names had no PSGC match: %s'
            % (len(unmatched), ', '.join(sorted(unmatched))))
    for city, n in sorted(folded.items()):
        log('  folded %s into its parent province (%d rows)' % (city, n))
    assert_no_collisions([(n, c) for n, c in set(resolved) if n not in HUC_PARENT_PCODE])
    return out


def derive_annual_overall(data):
    """Overall = its parts, on the flat {pcode: {year: volume}} annual shape.

    Separate from derive_overall() rather than shared: that one walks
    {'v','a'} cells and would raise a TypeError on these floats. Two small
    functions beat one that has to ask which shape it was handed.
    """
    for target in ANNUAL_DERIVED:
        parts = DERIVED.get(target, [])
        have = [p for p in parts if p in data]
        if len(have) != len(parts):
            log('  skipping %s - missing %s'
                % (target, ', '.join(p for p in parts if p not in data)))
            continue
        merged = defaultdict(dict)
        for part in parts:
            for pcode, years in data[part].items():
                for y, v in years.items():
                    merged[pcode][y] = merged[pcode].get(y, 0.0) + v
        data[target] = merged
        log('  derived %s from %s' % (target, ' + '.join(parts)))


def write_annual(data, codes):
    """One file per crop, in the exact shape the existing annual files use."""
    by_code = boundary_names()
    for name, code in codes.items():
        by_code.setdefault(code, name)
    regions = region_labels()
    years = [str(y) for y in range(YEAR_MIN, YEAR_MAX + 1)]
    written = []

    for crop, provinces in sorted(data.items()):
        fname = ANNUAL_FILE.get(crop)
        if not fname:
            continue
        path = os.path.join(DATA, fname)
        # utf-8-sig: every existing annual file carries a BOM, and Excel opens
        # them by double-click. Dropping it would mojibake the ñ in Peñablanca.
        with open(path, 'w', newline='', encoding='utf-8-sig') as fh:
            w = csv.writer(fh)
            w.writerow(['Commodity Type', 'Region', 'ADM2_PCODE', 'Province'] + years)
            label = crop.replace(' Production', '')
            for pcode in sorted(provinces):
                cells = provinces[pcode]
                row = [label, regions.get(pcode, ''), pcode, by_code.get(pcode, '')]
                for y in years:
                    v = cells.get(int(y))
                    row.append('' if v is None else round(v, 2))
                w.writerow(row)
        written.append(path)
    return written


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--offline', help='use a already-downloaded csv instead of fetching')
    ap.add_argument('--annual', action='store_true',
                    help='also rewrite the annual provincial files in ANNUAL_FILE')
    args = ap.parse_args()

    rows = fetch(args.offline)
    log('%d rows in the sheet' % len(rows))

    codes = province_codes()
    log('%d province -> PSGC codes harvested from data/' % len(codes))

    total = 0
    for gran in GRANULARITIES:
        log('\n%s:' % gran)
        data, periods = build(rows, gran, codes)
        if not periods:
            log('  nothing in %d-%d, skipped' % (YEAR_MIN, YEAR_MAX))
            continue
        derive_overall(data)
        files = write(data, periods, gran, codes)
        total += len(files)
        log('  %d periods: %s .. %s' % (len(periods), periods[0], periods[-1]))
        log('  wrote %d files' % len(files))

    log('\n%d files in %s' % (total, os.path.relpath(OUT, REPO)))

    if args.annual:
        log('\nannual:')
        adata = build_annual(rows, codes)
        derive_annual_overall(adata)
        afiles = write_annual(adata, codes)
        for p in afiles:
            log('  wrote %s' % os.path.relpath(p, REPO))
        log('  2026 column: %s' % (PARTIAL_2026_FROM or 'left blank'))

    log('Remember to bump DATA_VERSION in js/app.js.')


if __name__ == '__main__':
    main()
