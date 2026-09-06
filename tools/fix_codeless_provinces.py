#!/usr/bin/env python3
"""Give the highly-urbanised cities their PSGC code in data/*.csv.

THE BUG
    js/app.js drops any row without a code:

        if (!row.ADM2_PCODE) return;

    Most provincial files in data/ carry the five HUCs with an EMPTY
    ADM2_PCODE, so their production is read by nothing: not the choropleth,
    not the regional rollup, not the Top 10 catalogue, not the CSV export.
    It is not flagged anywhere - the totals simply come out short.

    Measured before this script ran, 2025 volume only, files app.js reads:

        durian          39,830 MT dropped of 71,250   -> 55.9% invisible
        cacao            2,741 MT of 11,868           -> 23.1%
        alugbati         3,163 MT of 26,230           -> 12.1%
        pomelo           2,253 MT of 24,264           ->  9.3%
        ... 48 volume files, 358,062 MT total, ~2% of national production

    Cross-checked against data/sources/fruits_long.csv, which carries the same cities
    as ordinary rows: for all eight fruits present in both,
    (what the map shows) + (what it drops) == fruits_long, to the tonne.

WHY THE CODES ARE PINNED HERE
    Same reason sync_agristat.py pins them: several files in data/ already give
    these cities a code belonging to a REAL province - 1804600000 is Negros
    ORIENTAL, 1600200000 is Agusan del Norte, 1108600000 is Davao Occidental.
    Harvesting a code by name would post city output onto another province's
    polygon, and the national total would still look right, so nothing
    downstream would notice. These four match HUC_OWN_PCODE in
    sync_agristat.py exactly; Zamboanga City is the fifth, which that script
    does not need because its sheet does not break Zamboanga out.

UNDIVIDED MAGUINDANAO
    Also codeless, and folded into Maguindanao del Sur - but only where a
    per-file guard proves that cannot double-count. See MAGUINDANAO below for
    why del Sur is PSA's own convention rather than a guess, and why the guard
    is needed at all (vegetable-style files carry the undivided row as a
    rolled-up PARENT of del Norte + del Sur).

    Rows whose code is already filled are never rewritten. Only blanks.

Usage:  python tools/fix_codeless_provinces.py [--apply]
        (default is a dry run; --apply writes the files)
"""

import argparse
import csv
import json
import glob
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DATA = os.path.join(REPO, 'data')

# Name -> PSGC comes from data/boundaries/psgc_parents_2026.json, which
# tools/build_psgc_parents.py derives from the published boundary file
# admin_boundary_2026/Admin_Boundary_Provincial_NCR_HUC_2026.geojson.
#
# It used to be a hand-written table here, which is why this problem kept
# coming back: every new spelling ('City of Davao', 'Davao City',
# '..City of Davao'), and every city PSA newly reports on its own, needed a
# human to notice and add a line. The boundary file already carries all 122
# entities - 88 provinces and 34 cities, the twelve other HUCs and every NCR
# city included - with authoritative names and codes, so a new one now resolves
# on its own. normalise() in the generator folds the spelling variants, and the
# generator re-keys the seven entities whose 2026 PSGC differs from the vintage
# this project joins on.
PSGC = os.path.join(DATA, 'psgc_parents_2026.json')


def load_names():
    with open(PSGC, encoding='utf-8') as fh:
        names = json.load(fh).get('names') or {}
    if not names:
        raise SystemExit('%s has no "names" map - run tools/build_psgc_parents.py'
                         % os.path.relpath(PSGC, REPO))
    return names


# Sulu is the one province with two live codes: 1906600000 under BARMM and
# 0906600000 under Region IX. js/app.js aliases between them, and the data files
# legitimately use either, so they must not be treated as a disagreement.
CODE_ALIASES = [{'1906600000', '0906600000'}]


# js/app.js converts the legacy PH##### form at load time:
#   PH14001 -> 1400100000   (slice off 'PH', append '00000')
# with three NIR provinces overridden because they kept their pre-NIR R6/R7
# prefix. Several .xlsx sheets are still in that form, so a PH code and its PSGC
# equivalent are the same province, not a disagreement.
PH_NIR_OVERRIDE = {'PH06045': '1804500000', 'PH07046': '1804600000',
                   'PH07061': '1806100000'}


def canonical_code(c):
    """PH#####, 9-digit and 10-digit forms of one province -> one string."""
    c = (c or '').strip()
    if re.match(r'^PH\d{5}$', c):
        return PH_NIR_OVERRIDE.get(c, c[2:] + '00000')
    if len(c) == 9 and c.isdigit():
        return '0' + c
    return c


def same_code(a, b):
    """True when two codes name the same province.

    Two things that are NOT disagreements, and both had to be excluded before
    --fix-wrong-codes was safe to run at all. A first pass without this claimed
    746 rows needed rewriting; 745 of them were these:

      * a 9-digit code, e.g. 102800000 for Ilocos Norte. loadDataFile() pads the
        leading zero at runtime, so the file is fine as written.
      * the legacy PH##### form still used by several .xlsx sheets, which
        loadDataFile() also converts at runtime (see canonical_code).
      * Sulu's two live codes (see CODE_ALIASES).

    Only 1 row was a genuine mis-code, and it was already known.
    """
    a, b = canonical_code(a), canonical_code(b)
    if a == b:
        return True
    return any({a, b} <= alias for alias in CODE_ALIASES)


def normalise(name):
    """Must stay identical to normalise() in tools/build_psgc_parents.py."""
    s = (name or '').strip()
    s = re.sub(r'\s+[a-z]/$', '', s)
    s = re.sub(r'^\.+', '', s)
    s = re.sub(r'\s*\([^)]*\)', '', s)
    s = s.strip()
    m = re.match(r'^City of (.+)$', s, re.I)
    if m:
        s = m.group(1) + ' City'
    return re.sub(r'[^a-z]', '', s.lower())


# Undivided Maguindanao -> Maguindanao del Sur.
#
# NOT a guess. palay_corn_long.csv, PSA's own series with published annual rows
# back to 1990, carries no undivided 'Maguindanao' row at all: every pre-split
# year is already booked under 'Maguindanao del Sur', with del Norte at zero
# until 2024. This applies that same convention to the files that still carry
# the undivided name.
#
# GUARDED PER FILE, because the sources do not agree on the handover:
#   fruits_long      2024 is Maguindanao only, 2025 is del Norte + del Sur only
#   vegetables_long  2025 and 2026 carry ALL THREE names, and the parent is
#                    exactly del Norte + del Sur (54,772.4 == 33,918.2+20,854.2)
# So in a vegetable file the undivided row is a rolled-up PARENT, and folding it
# into del Sur would double-count that province outright. The `is_aggregate`
# column that should flag this reads 0 on every row of all three sources, so it
# cannot be relied on - the overlap has to be detected from the values.
#
# maguindanao_is_safe() below refuses any file where the undivided row and del
# Sur both carry a value in the same year.
MAGUINDANAO = 'Maguindanao'
MAGUINDANAO_DEL_SUR = '1908800000'
MAGUINDANAO_DEL_NORTE = '1908700000'

# Names left codeless when a file fails the overlap guard.
SKIP = set()


def maguindanao_is_safe(rows, years):
    """True when folding the undivided row into del Sur cannot double-count.

    The eras must not overlap: for every year, at most one of {undivided,
    del Sur} may carry a value. That is the same non-overlap the NIR and Sulu
    handovers rely on, and the same one sync_agristat.py asserts.
    """
    undivided = [r for r in rows
                 if province_of(r) == MAGUINDANAO and not (r.get('ADM2_PCODE') or '').strip()]
    if not undivided:
        return True
    # Both successors, not just del Sur. A file can hold del Norte data in a year
    # where del Sur is still zero; checking del Sur alone would call that safe and
    # fold a parent row onto a year its own children already cover. The failing
    # shape is the aggregate row - parent == del Norte + del Sur, same years - and
    # 2026-09-05 found ~62 files carrying exactly that.
    successors = [r for r in rows
                  if (r.get('ADM2_PCODE') or '').strip()
                  in (MAGUINDANAO_DEL_SUR, MAGUINDANAO_DEL_NORTE)]
    for y in years:
        a = sum(_num(r.get(y)) for r in undivided)
        b = sum(_num(r.get(y)) for r in successors)
        if a > 0 and b > 0:
            return False
    return True


def _num(v):
    try:
        return float(str(v).replace(',', ''))
    except (TypeError, ValueError):
        return 0.0


def log(msg):
    print(msg)


def province_of(row):
    return (row.get('Province') or '').strip()


def repair(path, apply_changes, names, fix_wrong=False):
    """-> (filled, skipped, collisions) for one file."""
    with open(path, encoding='utf-8-sig', newline='') as fh:
        reader = csv.DictReader(fh)
        fields = reader.fieldnames or []
        rows = list(reader)
    if not rows or 'ADM2_PCODE' not in fields or 'Province' not in fields:
        return 0, 0, [], 0

    # Codes already used by a row that is NOT the city itself. Assigning one of
    # these would merge two provinces onto one polygon, and the national total
    # would still balance, so it has to be refused rather than warned about.
    # Keyed by NORMALISED name: 'Negros Occidental' and 'Negros Occidental a/'
    # are one province with a footnote marker, not two, and the same goes for
    # 'Sulu c/' and 'City of Davao' vs 'Davao City'. Comparing raw spellings
    # made the guard refuse the very rows it exists to let through, while
    # genuine merges (Sulu carrying Maguindanao del Sur's code in the Ube
    # files) normalise differently and are still caught.
    taken = {}
    for r in rows:
        code = (r.get('ADM2_PCODE') or '').strip()
        if code:
            taken.setdefault(code, normalise(province_of(r)))

    # Rows whose code contradicts their own name. OFF by default: rewriting a
    # code that is already filled is a much bigger claim than filling a blank,
    # and it is only safe once you know which side is misaligned. In the Ube
    # files the whole code column is shifted down one row - each province
    # carries the code of the row above it - and the values were checked
    # against vegetables_long to establish that the NAME/value pairing is the
    # correct one (8 of 9 matched by name, the 9th was 0.0 either way). Do that
    # check before ever passing --fix-wrong-codes on a new file.
    rewritten = 0
    if fix_wrong:
        for r in rows:
            have = (r.get('ADM2_PCODE') or '').strip()
            want = names.get(normalise(province_of(r)))
            if have and want and not same_code(have, want):
                r['ADM2_PCODE'] = want
                rewritten += 1

    years = [f for f in fields if f.isdigit() and len(f) == 4]
    mag_ok = maguindanao_is_safe(rows, years)

    filled, skipped, collisions = 0, 0, []
    for r in rows:
        if (r.get('ADM2_PCODE') or '').strip():
            continue
        name = province_of(r)
        if name == MAGUINDANAO:
            if not mag_ok:
                skipped += 1        # parent row in a vegetable-style file
                continue
            code = MAGUINDANAO_DEL_SUR
        else:
            code = names.get(normalise(name))
            if name in SKIP or not code:
                skipped += 1
                continue
        # The undivided province and del Sur are the SAME polygon in different
        # eras, so sharing a code is the intent, not a merge - maguindanao_is_safe()
        # has already proved the eras do not overlap, which is the real guard.
        # Any OTHER holder of that code is a genuine mis-code and still refused:
        # Ube_ProductionVolume_Provincial.csv gives Sulu 1908800000, which is
        # Maguindanao del Sur's.
        deliberate_era_merge = (name == MAGUINDANAO
                                and taken.get(code) == normalise('Maguindanao del Sur'))
        if code in taken and taken[code] != normalise(name) and not deliberate_era_merge:
            collisions.append((name, taken[code], code))
            continue
        r['ADM2_PCODE'] = code
        taken.setdefault(code, normalise(name))
        filled += 1

    if (filled or rewritten) and apply_changes:
        shutil.copyfile(path, path + '.bak')
        with open(path, 'w', encoding='utf-8', newline='') as fh:
            w = csv.DictWriter(fh, fieldnames=fields)
            w.writeheader()
            w.writerows(rows)
    return filled, skipped, collisions, rewritten


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true',
                    help='write the files (default is a dry run)')
    ap.add_argument('--fix-wrong-codes', action='store_true',
                    help='also rewrite codes that contradict their own Province '
                         'name (verify which side is misaligned first)')
    args = ap.parse_args()

    names = load_names()
    log('%d place names loaded from %s' % (len(names), os.path.relpath(PSGC, REPO)))
    files = sorted(set(glob.glob(os.path.join(DATA, '*.csv'))))
    total_filled = total_skipped = total_rewritten = 0
    touched, all_collisions, rewrote = [], [], []

    for path in files:
        filled, skipped, collisions, rewritten = repair(path, args.apply, names, args.fix_wrong_codes)
        total_filled += filled
        total_skipped += skipped
        total_rewritten += rewritten
        if rewritten:
            rewrote.append((os.path.basename(path), rewritten))
        all_collisions += [(os.path.basename(path),) + c for c in collisions]
        if filled:
            touched.append((os.path.basename(path), filled))

    log('%s' % ('APPLIED' if args.apply else 'DRY RUN - nothing written'))
    log('%d files scanned' % len(files))
    log('%d rows given a PSGC code, across %d files' % (total_filled, len(touched)))
    log('%d codeless rows left alone (overlap-guarded Maguindanao, unknown names)'
        % total_skipped)

    if rewrote:
        log('')
        log('%d rows had a code contradicting their own name, rewritten:'
            % total_rewritten)
        for fn, n in rewrote:
            log('  %-56s %d rows' % (fn[:56], n))

    if all_collisions:
        log('\nREFUSED - assigning these would merge two provinces:')
        for fn, name, holder, code in all_collisions:
            log('  %s: %r wants %s, already held by %r' % (fn, name, code, holder))

    if touched:
        log('\nfiles changed:')
        for fn, n in touched[:12]:
            log('  %-56s %d rows' % (fn[:56], n))
        if len(touched) > 12:
            log('  ... and %d more' % (len(touched) - 12))

    if args.apply:
        log('\n.bak written beside each changed file.')
        log('Remember to bump DATA_VERSION in js/app.js.')


if __name__ == '__main__':
    main()
