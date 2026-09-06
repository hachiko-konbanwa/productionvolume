#!/usr/bin/env python3
"""Build sub-annual (quarter and semester) fruit files from data/fruits_long.csv.

Companion to sync_agristat.py, which does the same job for Palay and Corn.
Province resolution, HUC handling and the collision guard are IMPORTED from
that script rather than copied - two province->PSGC maps that can drift apart
is exactly the failure mode this project keeps getting bitten by.

WHY A SEPARATE SCRIPT
    The two sources do not share a schema. palay_corn_long.csv carries
    `period`/`period_type` and publishes annual, semester and quarter as their
    own rows. fruits_long.csv carries `quarter` and `semester` as columns and
    publishes QUARTERS ONLY - there is no annual row and no semester row in it
    at all. So semester here is summed (Q1+Q2, Q3+Q4), not read.

    That difference matters beyond plumbing. DOCUMENTATION.md notes PSA rounds
    each published period independently, so a summed annual will not always
    equal the published one. Checked against palay_corn_long, which has both:
    99.3% of rows identical, 46 differ, max 0.01 MT. Small, but it is why this
    script does NOT write annual files - the hand-curated annual fruit files in
    data/ stay authoritative, exactly as sync_agristat.py leaves them alone.

VOLUME ONLY
    fruits_long has an area_ha column, but only 3.8% of its rows carry a value
    (18,547 of 481,712) against 34.2% for volume. Too sparse to publish, and
    yield is volume/area so it cannot be derived either. Palay and corn get all
    three metrics because palay_corn_long carries area on 89.9% of rows.

Usage:  python tools/sync_fruits.py [--apply] [--src data/fruits_long.csv]
        (default is a dry run)
"""

import argparse
import csv
import os
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DATA = os.path.join(REPO, 'data')
OUT = os.path.join(DATA, 'subannual')
sys.path.insert(0, HERE)

import sync_agristat as S   # province_codes, boundary_names, HUC_OWN_PCODE, ...

SRC_DEFAULT = os.path.join(DATA, 'fruits_long.csv')

# Match sync_agristat's window so every crop shares one timeline. fruits_long
# reaches back to 2010; widen this if the app should offer that.
YEAR_MIN, YEAR_MAX = S.YEAR_MIN, S.YEAR_MAX

# Undivided Maguindanao shares Maguindanao del Sur's polygon: PSA's own
# palay/corn series books every pre-split year under del Sur, with del Norte at
# zero until 2024. Guarded by assert_eras_disjoint() rather than assumed.
MAGUINDANAO = 'Maguindanao'
MAGUINDANAO_DEL_SUR = '1908800000'

# (crop_group, crop_subtype or None) -> catalogue name in js/app.js.
# None means "every subtype of this group, summed".
SERIES = {
    ('Banana', None):        'Overall Banana Production',
    ('Banana', 'Saba'):      'Banana Cardava Production',
    ('Banana', 'Cavendish'): 'Banana Cavendish Production',
    ('Avocado', None):       'Overall Avocado Production',
    ('Calamansi', None):     'Overall Calamansi Production',
    ('Dalandan', None):      'Overall Dalandan Production',
    ('Dragon fruit', None):  'Overall Dragon Fruit Production',
    ('Durian', None):        'Overall Durian Production',
    ('Mango', None):         'Overall Mango Production',
    ('Melon', None):         'Overall Melon Production',
    ('Pineapple', None):     'Overall Pineapple Production',
    ('Pomelo', None):        'Overall Pomelo Production',
    ('Rambutan', None):      'Overall Rambutan Production',
}

# Catalogue name -> filename stem. Must match SUBANNUAL_STEMS in js/app.js.
STEM = {
    'Overall Banana Production':    'Banana',
    'Banana Cardava Production':    'BananaCardava',
    'Banana Cavendish Production':  'BananaCavendish',
    'Overall Avocado Production':   'Avocado',
    'Overall Calamansi Production': 'Calamansi',
    'Overall Dalandan Production':  'Dalandan',
    'Overall Dragon Fruit Production': 'DragonFruit',
    'Overall Durian Production':    'Durian',
    'Overall Mango Production':     'Mango',
    'Overall Melon Production':     'Melon',
    'Overall Pineapple Production': 'Pineapple',
    'Overall Pomelo Production':    'Pomelo',
    'Overall Rambutan Production':  'Rambutan',
}


def log(msg):
    print(msg)


def periods_for(gran, year, quarter):
    """-> column name, or None when the row does not belong to this granularity."""
    if gran == 'quarter':
        return '%dQ%d' % (year, quarter)
    return '%dS%d' % (year, 1 if quarter in (1, 2) else 2)


def build(rows, gran, codes):
    """-> ({crop: {pcode: {period: mt}}}, sorted periods, unresolved names)."""
    data = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
    seen_periods, unresolved, resolved = set(), set(), []

    for r in rows:
        try:
            year = int(r['year'])
            quarter = int(r['quarter'])
        except (TypeError, ValueError):
            continue
        if not (YEAR_MIN <= year <= YEAR_MAX):
            continue

        group = (r.get('crop_group') or '').strip()
        subtype = (r.get('crop_subtype') or '').strip()
        targets = [SERIES[k] for k in ((group, subtype), (group, None)) if k in SERIES]
        if not targets:
            continue

        name = (r.get('province') or '').strip()
        name = S.PROVINCE_ALIASES.get(name, name)
        pcode = MAGUINDANAO_DEL_SUR if name == MAGUINDANAO else (
            S.HUC_OWN_PCODE.get(name) or codes.get(name))
        if not pcode:
            unresolved.add(name)
            continue
        resolved.append((name, pcode))

        mt = S.num(r.get('volume_mt'))
        if mt is None:
            continue
        col = periods_for(gran, year, quarter)
        seen_periods.add(col)
        for crop in targets:
            data[crop][pcode][col] += mt

    # Two source names landing on one polygon silently merges two provinces and
    # the national total still balances, so this is fatal rather than a warning.
    # The undivided province and del Sur are exempt because they are the same
    # polygon in two different eras, not two provinces - assert_eras_disjoint()
    # above has already proved they never both report in one period.
    S.assert_no_collisions({(n, c) for n, c in resolved if n != MAGUINDANAO})
    return data, sorted(seen_periods), unresolved


def assert_eras_disjoint(rows):
    """Undivided Maguindanao and del Sur must never both report in one period.

    They share a pcode here (PSA's own convention - see MAGUINDANAO below), so
    if both carried a value for the same crop and period their tonnage would be
    summed onto one polygon and the province would read double. fruits_long is
    a clean handover: 2024 is the undivided row only, 2025 is del Norte and del
    Sur only. vegetables_long is NOT - there the undivided row is a rolled-up
    parent of the other two - which is why this is asserted rather than assumed.
    """
    both = {}
    for r in rows:
        name = (r.get('province') or '').strip()
        if name not in (MAGUINDANAO, 'Maguindanao del Sur'):
            continue
        if S.num(r.get('volume_mt')) in (None, 0):
            continue
        key = (r.get('year'), r.get('quarter'), (r.get('crop_group') or '').strip(),
               (r.get('crop_subtype') or '').strip())
        both.setdefault(key, set()).add(name)
    clashes = [k for k, v in both.items() if len(v) > 1]
    if clashes:
        for k in clashes[:8]:
            log('  FATAL: %s reports under BOTH Maguindanao and del Sur' % (k,))
        raise SystemExit('%d period(s) would double-count Maguindanao del Sur; '
                         'refusing to write' % len(clashes))


def write(data, periods, gran, apply_changes):
    names = S.boundary_names()
    written = []
    for crop, provinces in sorted(data.items()):
        path = os.path.join(OUT, '%s_volume_%s.csv' % (STEM[crop], gran))
        written.append(path)
        if not apply_changes:
            continue
        os.makedirs(OUT, exist_ok=True)
        with open(path, 'w', newline='', encoding='utf-8') as fh:
            w = csv.writer(fh)
            w.writerow(['Commodity Type', 'ADM2_PCODE', 'Province'] + periods)
            for pcode in sorted(provinces):
                cells = provinces[pcode]
                row = [crop, pcode, names.get(pcode, '')]
                for col in periods:
                    v = cells.get(col)
                    row.append('' if v is None else round(v, 2))
                w.writerow(row)
    return written


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=SRC_DEFAULT)
    ap.add_argument('--apply', action='store_true',
                    help='write the files (default is a dry run)')
    args = ap.parse_args()

    with open(args.src, encoding='utf-8-sig', newline='') as fh:
        rows = list(csv.DictReader(fh))
    log('%s: %d rows' % (os.path.relpath(args.src, REPO), len(rows)))

    codes = S.province_codes()
    log('%d province -> PSGC codes harvested from data/' % len(codes))
    assert_eras_disjoint(rows)
    log('Maguindanao / del Sur eras are disjoint - safe to share a polygon')

    total = 0
    for gran in ('quarter', 'semester'):
        data, periods, unresolved = build(rows, gran, codes)
        if not periods:
            log('%s: nothing in %d-%d, skipped' % (gran, YEAR_MIN, YEAR_MAX))
            continue
        files = write(data, periods, gran, args.apply)
        total += len(files)
        log('\n%s: %d crops, %d periods (%s .. %s), %d files'
            % (gran, len(data), len(periods), periods[0], periods[-1], len(files)))
        if unresolved:
            log('  UNRESOLVED province names (their rows were dropped):')
            for n in sorted(unresolved):
                log('    %r' % n)

    log('\n%s %d files in %s'
        % ('wrote' if args.apply else 'would write', total, os.path.relpath(OUT, REPO)))
    if args.apply:
        log('Add these crops to SUBANNUAL_STEMS in js/app.js, and bump DATA_VERSION.')


if __name__ == '__main__':
    main()
