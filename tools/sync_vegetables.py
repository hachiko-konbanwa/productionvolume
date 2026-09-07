#!/usr/bin/env python3
"""Build annual and sub-annual vegetable files from data/vegetables_long.csv.

Third of the family, after sync_agristat.py (palay/corn) and sync_fruits.py.
Province resolution, HUC pinning and the collision guard are IMPORTED from
sync_agristat.py; the Maguindanao rule and the era guard from sync_fruits.py.

THE PARENT-ROW TRAP - the reason this script cannot be sync_fruits.py with a
different SERIES map:

    vegetables_long carries undivided 'Maguindanao' AND both successors in 2025
    and 2026, for all 128 crop groups, and the undivided row is EXACTLY the sum
    of the other two:

        2025   Maguindanao 54,772.4  ==  del Norte 33,918.2 + del Sur 20,854.2
        2026   Maguindanao 22,126.0  ==  del Norte  9,354.3 + del Sur 12,771.8

    It is a rolled-up PARENT sitting beside its own children. fruits_long has no
    such overlap - it hands over cleanly. The `is_aggregate` column that should
    flag this reads 0 on every row of all three sources, so it cannot be used;
    drop_maguindanao_parents() detects the overlap from the data instead.

    Without that, Maguindanao would be counted twice for every vegetable.

WHY THE ANNUAL FILES ARE REWRITTEN HERE (unlike fruits)
    sync_fruits.py leaves annual files alone because they already agreed with
    the source. The vegetable ones do not, and not by rounding:

      * Cassava is +82%. vegetables_long splits it into 'for food' (1,051,275 MT)
        and 'for industrial use' (1,278,905); the file in data/ carries roughly
        one of them. Whole provinces are missing too - Basilan 254,924 MT,
        Sulu 181,255, Tawi-Tawi 100,879 all read ZERO in the app today.
      * Pechay is +39%, missing the 'Pechay, native' subtype (36,321 MT).
      * Stringbeans, Malabar Spinach, Sweet Potato Leaves, Ampalaya and Ube run
        5-10% short from missing provinces and codeless cities.

    'Overall X' is read as ALL subtypes of X - EXCEPT where the existing file
    proves the Atlas deliberately tracks one subtype. Checked by matching each
    original file against every candidate:

        Cassava  -> 'Cassava for industrial use, fresh tubers'   0.0% off
        Pechay   -> 'Pechay' (i.e. excluding 'Pechay, native')   0.1% off

    Those two are pinned to their subtype. Reading them as "all subtypes" would
    have inflated Cassava by 82% and Pechay by 36% and silently redefined what
    the commodity means. The provinces that look "missing" from Cassava are not:
    Basilan, Sulu and Tawi-Tawi grow food cassava and essentially NO industrial
    cassava, so zero is the correct figure for the series being shown.

    The remaining crops have a single subtype each, and their old files ran
    5-9% short from missing provinces and codeless cities - a real gap, which
    this does close.

VOLUME ONLY, same as fruits: vegetables_long fills area_ha on 5.7% of rows.

Usage:  python tools/sync_vegetables.py [--apply] [--annual]
        (default is a dry run; --annual also rewrites data/<crop>_*.csv)
"""

import argparse
import csv
import re
import os
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DATA = os.path.join(REPO, 'data')
OUT = os.path.join(DATA, 'subannual')
sys.path.insert(0, HERE)

import sync_agristat as S
import sync_fruits as F

SRC = os.path.join(DATA, 'vegetables_long.csv')
YEAR_MIN, YEAR_MAX = S.YEAR_MIN, S.YEAR_MAX

# (crop_group, crop_subtype or None) -> catalogue name. None = all subtypes.
SERIES = {
    ('Cabbage', None):                            'Overall Cabbage Production',
    ('Carrot', None):                             'Overall Carrots Production',
    ('Cauliflower', None):                        'Overall Cauliflower Production',
    ('Habitchuelas', None):                       'Overall Habitsuelas Production',
    ('Chinese cabbage (Wongbok', None):           'Overall Chinese Cabbage Production',
    ('Asparagus', None):                          'Overall Asparagus Production',
    ('Lettuce', None):                            'Overall Lettuce Production',
    ('Chili pepper fruit (Siling labuyo)', None): 'Overall Chili Pepper Production',
    ('Pepper', 'Pepper, bell'):                   'Overall Bell Pepper Production',
    ('Ampalaya fruit', None):                     'Overall Ampalaya Production',
    ('Squash fruit', None):                       'Overall Squash Production',
    ('Okra', None):                               'Overall Okra Production',
    ('Eggplant', None):                           'Overall Eggplant Production',
    ('Sitao', None):                              'Overall Stringbeans Production',
    ('Upo', None):                                'Overall Bottle Gourd Production',
    ('Patola', None):                             'Overall Sponge Gourd Production',
    ('Tomato', None):                             'Overall Tomato Production',
    ('Cucumber', None):                           'Overall Cucumber Production',
    ('Mushroom', None):                           'Overall Mushroom Production',
    ('Pechay', 'Pechay'):                         'Overall Pechay Production',
    ('Spinach', None):                            'Overall Spinach Production',
    ('Alugbati', None):                           'Overall Malabar Spinach Production',
    ('Malunggay leaves', None):                   'Overall Moringa Production',
    ('Radish', None):                             'Overall Radish Production',
    ('Camote tops', None):                        'Overall Sweet Potato Leaves Production',
    ('Saluyot', None):                            'Overall Jute Mallow Production',
    ('Sigarilyas', None):                         'Overall Winged Beans Production',
    ('Ubi', None):                                'Overall Ube Production',
    # Cassava is published as two distinct commodities with different
    # geographies: industrial-use is a Luzon/Visayas crop, food cassava is a
    # BARMM staple (Basilan, Sulu, Tawi-Tawi, Lanao del Sur). The Atlas showed
    # only industrial for years, which hid the food series entirely. All three
    # are now carried, the same way Banana carries an overall plus varieties.
    ('Cassava', None):                            'Overall Cassava Production',
    ('Cassava', 'Cassava for food, fresh tubers'):       'Cassava Food Production',
    ('Cassava', 'Cassava for industrial use, fresh tubers'): 'Cassava Industrial Production',
    ('Camote', None):                             'Overall Sweet Potato Production',
    ('Potato', None):                             'Overall White Potato Production',
    ('Onion', 'Onion, red creole (Bermuda red)'):        'Red Onion Production',
    ('Onion', 'Onion, yellow granex (Bermuda white)'):   'White Onion Production',
    ('Onion', 'Onion, red shallot (Sibuyas Tagalog)'):   'Red Shallot Production',
    ('Garlic', None):                             'Overall Garlic Production',
    ('Ginger', None):                             'Overall Ginger Production',
    ('Tanglad', None):                            'Overall Lemongrass Production',
    ('Spring onion', None):                       'Overall Spring Onion Production',
    ('Peanut', None):                             'Overall Peanut Production',
}

# Catalogue name -> filename stem, for data/subannual/<Stem>_volume_<gran>.csv.
# Must match SUBANNUAL_STEMS in js/app.js.
STEM = {name: name.replace('Overall ', '').replace(' Production', '')
                  .replace(' ', '').replace('(', '').replace(')', '')
        for name in SERIES.values()}

# Catalogue name -> the annual provincial file to rewrite with --annual.
ANNUAL_FILE = {name: 'veg_%s_productionvolume_provincial.csv' % STEM[name].lower()
               for name in SERIES.values()}


def log(msg):
    print(msg)


def drop_maguindanao_parents(rows):
    """Remove undivided-Maguindanao rows for any year its successors report.

    See the module docstring: in vegetables_long those rows are a rolled-up
    parent of del Norte + del Sur, not a pre-split era, so keeping them would
    double-count the province. Detected from the data because `is_aggregate`
    is never set.
    """
    split_years = {r['year'] for r in rows
                   if (r.get('province') or '').strip() in
                      ('Maguindanao del Norte', 'Maguindanao del Sur')
                   and S.num(r.get('volume_mt'))}
    kept = [r for r in rows
            if not ((r.get('province') or '').strip() == F.MAGUINDANAO
                    and r['year'] in split_years)]
    return kept, len(rows) - len(kept), sorted(split_years)


def collect(rows, codes, period_of):
    """-> ({crop: {pcode: {period: mt}}}, sorted periods, unresolved names)."""
    data = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
    periods, unresolved, resolved = set(), set(), []
    for r in rows:
        try:
            year, quarter = int(r['year']), int(r['quarter'])
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
        pcode = (F.MAGUINDANAO_DEL_SUR if name == F.MAGUINDANAO
                 else S.HUC_OWN_PCODE.get(name) or codes.get(name))
        if not pcode:
            unresolved.add(name)
            continue
        resolved.append((name, pcode))
        mt = S.num(r.get('volume_mt'))
        if mt is None:
            continue
        col = period_of(year, quarter)
        periods.add(col)
        for crop in targets:
            data[crop][pcode][col] += mt
    S.assert_no_collisions({(n, c) for n, c in resolved if n != F.MAGUINDANAO})

    # Drop periods that are empty everywhere. vegetables_long writes a ZERO for
    # a quarter that has not been reported yet, where fruits_long leaves it
    # blank - so 2026 arrives with all four quarters present and Q2, Q3 and Q4
    # summing to 0.0 nationally. Publishing those would draw "no production"
    # across the whole country for quarters that have not happened. A period
    # survives only if some crop somewhere actually reports in it.
    live = {p for crops in data.values() for cells in crops.values()
            for p, v in cells.items() if v}
    for crops in data.values():
        for cells in crops.values():
            for p in [p for p in cells if p not in live]:
                del cells[p]
    return data, sorted(periods & live), unresolved


def write(data, periods, paths, label, apply_changes):
    names = S.boundary_names()
    written = []
    for crop, provinces in sorted(data.items()):
        path = paths(crop)
        written.append(path)
        if not apply_changes:
            continue
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w', newline='', encoding='utf-8') as fh:
            w = csv.writer(fh)
            w.writerow(['Commodity Type', 'ADM2_PCODE', 'Province'] + periods)
            for pcode in sorted(provinces):
                cells = provinces[pcode]
                w.writerow([crop, pcode, names.get(pcode, '')]
                           + [round(cells[p], 2) if cells.get(p) else '' for p in periods])
    log('%s: %d crops, %d periods (%s .. %s), %d files'
        % (label, len(data), len(periods), periods[0], periods[-1], len(written)))
    return written


# A semester is Q1+Q2 or Q3+Q4. If only one of its quarters has been published,
# summing gives a HALF semester that still looks like a whole one — 2026S1 for
# 54 crops was exactly 2026Q1, and reading it against 2025S1 showed drops of up
# to 94% that were pure arithmetic. A semester is emitted only when both of its
# quarters are present.
def complete_semesters(sem_periods, quarter_periods):
    q = set(quarter_periods)
    out = []
    for p in sem_periods:
        m = re.match(r'^(\d{4})S(\d)$', p)
        if not m:
            out.append(p)
            continue
        year, half = m.group(1), int(m.group(2))
        need = ('%sQ1' % year, '%sQ2' % year) if half == 1 else ('%sQ3' % year, '%sQ4' % year)
        if all(n in q for n in need):
            out.append(p)
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true', help='write the files')
    ap.add_argument('--annual', action='store_true',
                    help='also write annual provincial files (see docstring)')
    args = ap.parse_args()

    with open(SRC, encoding='utf-8-sig', newline='') as fh:
        rows = list(csv.DictReader(fh))
    log('%s: %d rows' % (os.path.relpath(SRC, REPO), len(rows)))

    rows, dropped, split_years = drop_maguindanao_parents(rows)
    log('dropped %d undivided-Maguindanao PARENT rows for years %s'
        % (dropped, ', '.join(split_years)))

    codes = S.province_codes()
    log('%d province -> PSGC codes harvested from data/' % len(codes))

    quarter_periods = []
    for gran, fmt in (('quarter', lambda y, q: '%dQ%d' % (y, q)),
                      ('semester', lambda y, q: '%dS%d' % (y, 1 if q in (1, 2) else 2))):
        data, periods, unresolved = collect(rows, codes, fmt)
        if gran == 'quarter':
            quarter_periods = periods
        else:
            kept = complete_semesters(periods, quarter_periods)
            dropped = [p for p in periods if p not in kept]
            if dropped:
                log('  dropped %d half-filled semester(s): %s'
                    % (len(dropped), ', '.join(dropped)))
            periods = kept
        if not periods:
            continue
        write(data, periods,
              lambda c: os.path.join(OUT, '%s_volume_%s.csv' % (STEM[c], gran)),
              gran, args.apply)
        if unresolved:
            log('  UNRESOLVED (rows dropped): %s' % ', '.join(sorted(unresolved)))

    if args.annual:
        years = [str(y) for y in range(YEAR_MIN, YEAR_MAX + 1)]
        data, _, _ = collect(rows, codes, lambda y, q: str(y))
        write(data, years, lambda c: os.path.join(DATA, ANNUAL_FILE[c]),
              'annual', args.apply)

    if args.apply:
        log('\nAdd these crops to SUBANNUAL_STEMS in js/app.js, and bump DATA_VERSION.')


if __name__ == '__main__':
    main()
