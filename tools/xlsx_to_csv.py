#!/usr/bin/env python3
"""Convert every .xlsx sheet js/app.js reads into a plain .csv, filling the
codeless ADM2_PCODE cells on the way.

WHY CONVERT RATHER THAN REWRITE THE .xlsx IN PLACE
    * tools/fix_codeless_provinces.py opens files with Python's csv module, so
      it cannot touch .xlsx at all. That is the whole reason the bigger half of
      the codeless-row loss was still outstanding: 51 crop/metric combos and
      568,430 MT / 446,243 HA sit in .xlsx, against 43 combos and 45,379 MT in
      .csv. One data format means one repair path instead of two.
    * The Atlas fetches the WHOLE workbook to read ONE sheet, and lazy-loads
      SheetJS to parse it (ensureXLSX()). Highland_Yield_Provincial.xlsx is
      pulled down in full to answer a question about carrots. A per-crop csv is
      a few KB and Papa.parse streams it.
    * .csv diffs in git. An .xlsx is a binary blob, so a data change is
      invisible in review - which is how a shifted code column survived in
      cabbage and Ube unnoticed.
    * Rewriting .xlsx with openpyxl re-serialises the workbook and can silently
      drop charts, pivot tables, conditional formatting and macros. These files
      may still be opened by people in Excel; converting leaves the originals
      untouched.

WHAT IT DOES NOT DO
    It never rewrites a code that is already filled. Cabbage and the two Ube
    files turned out to have their whole code column shifted down one row, and
    which side was misaligned could only be established by checking values
    against another source. This script REPORTS such rows and leaves them;
    fix that with `fix_codeless_provinces.py --fix-wrong-codes` after verifying.

The .xlsx originals are left in place. Only js/app.js is repointed.

RUN fix_codeless_provinces.py AFTER THIS, NOT BEFORE
    This script fills a blank ADM2_PCODE only when the Province name is in the
    boundary-derived `names` map. Undivided "Maguindanao" is NOT in it - the 2026
    boundary carries only del Norte and del Sur - so that row comes through the
    conversion still blank, and loadCropData() drops every row without a code.
    fix_codeless_provinces.py knows the case (MAGUINDANAO -> del Sur, era-guarded)
    but it cannot fix files that did not exist when it ran.

    On 2026-09-05 that ordering cost 3,105,804 MT: coconut lost its whole
    2021-2024 Maguindanao series (3.05M MT) and mango 51,412 MT, silently, and
    the pre-conversion .csv files had the code filled correctly all along. The
    conversion was the regression. Convert first, repair second, then QA/QC.

Usage:  python tools/xlsx_to_csv.py [--apply]
"""

import argparse
import csv
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DATA = os.path.join(REPO, 'data')
sys.path.insert(0, HERE)

from qaqc_metrics import parse_config, read, num, METRICS   # noqa: E402
from fix_codeless_provinces import normalise, same_code, canonical_code  # noqa: E402

OUT_PREFIX = 'conv_'   # keeps converted files clearly separate from hand-curated ones


def log(msg):
    print(msg)


def load_names():
    with open(os.path.join(DATA, 'psgc_parents_2026.json'), encoding='utf-8') as fh:
        return json.load(fh)['names']


def out_name(crop, metric):
    stem = (crop.replace('Overall ', '').replace(' Production', '')
                .replace('(', '').replace(')', '').replace(' ', ''))
    return '%s%s_%s_provincial.csv' % (OUT_PREFIX, stem.lower(), metric)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true', help='write the files and repoint js/app.js')
    args = ap.parse_args()

    names = load_names()
    prov = parse_config('provConfig')
    crop_cfg = parse_config('cropConfig')

    jobs = []
    for name in sorted(set(prov) | set(crop_cfg)):
        for mid, key, _unit in METRICS:
            path = prov.get(name, {}).get(key) or crop_cfg.get(name, {}).get(key)
            if path and '.xlsx' in path.lower():
                jobs.append((name, mid, key, path))

    log('%d crop/metric combos read from .xlsx\n' % len(jobs))
    filled_total, shifted_total, written = 0, [], []

    for crop, metric, key, path in jobs:
        rows = read(path)
        if rows is None:
            log('  MISSING  %s' % path)
            continue
        # Union of every row's keys, not just the first row's: some sheets have
        # a ragged first row, and writing ADM2_PCODE into a row whose fieldnames
        # were taken from it then fails.
        fields = []
        for r in rows:
            for k in r:
                if k not in fields:
                    fields.append(k)
        if 'ADM2_PCODE' not in fields:
            fields.append('ADM2_PCODE')
        filled, shifted = 0, []
        for r in rows:
            have = (r.get('ADM2_PCODE') or '').strip()
            want = names.get(normalise((r.get('Province') or '').strip()))
            if not have and want:
                r['ADM2_PCODE'] = want
                filled += 1
            elif have and want and not same_code(have, want):
                shifted.append((r.get('Province'), have, want))
            elif have:
                # Write the canonical PSGC rather than the legacy PH##### or a
                # 9-digit code. loadDataFile() would convert it anyway; doing it
                # here means the csv says what it means and every data file in
                # data/ ends up keyed the same way.
                r['ADM2_PCODE'] = canonical_code(have)
        filled_total += filled
        if shifted:
            shifted_total.append((crop, metric, os.path.basename(path.split('#')[0]), shifted))

        dest = os.path.join(DATA, out_name(crop, metric))
        written.append((crop, metric, key, path, dest, filled, len(rows)))
        if args.apply:
            with open(dest, 'w', newline='', encoding='utf-8') as fh:
                w = csv.DictWriter(fh, fieldnames=fields)
                w.writeheader()
                w.writerows(rows)

    log('%-34s %-10s %5s %6s  %s' % ('crop', 'metric', 'rows', 'filled', 'destination'))
    for crop, metric, _k, _src, dest, filled, n in written:
        log('  %-32s %-10s %5d %6d  %s'
            % (crop.replace('Overall ', '').replace(' Production', '')[:32],
               metric, n, filled, os.path.basename(dest)))

    log('\n%d codeless cells filled across %d files' % (filled_total, len(written)))

    if shifted_total:
        log('\nNOT touched - code already filled but contradicts its own Province name.')
        log('Verify which side is misaligned, then use '
            'fix_codeless_provinces.py --fix-wrong-codes:')
        for crop, metric, fn, rows_ in shifted_total:
            log('  %s (%s, %s): %d rows' % (fn, crop, metric, len(rows_)))
            for prov_name, have, want in rows_[:4]:
                log('      %-26s has %-12s should be %s' % (str(prov_name)[:26], have, want))

    if not args.apply:
        log('\nDRY RUN - nothing written. Re-run with --apply.')
        return

    # repoint js/app.js at the converted files
    app = os.path.join(REPO, 'js', 'app.js')
    with open(app, encoding='utf-8') as fh:
        src = fh.read()
    repointed = 0
    for crop, metric, key, old_path, dest, _f, _n in written:
        needle = "%s: '%s'" % (key, old_path)
        if needle in src:
            src = src.replace(needle, "%s: 'data/%s'" % (key, os.path.basename(dest)))
            repointed += 1
    with open(app, 'w', encoding='utf-8') as fh:
        fh.write(src)
    log('\njs/app.js: %d file references repointed to the converted csv' % repointed)
    log('The .xlsx originals are untouched. Remember to bump DATA_VERSION.')


if __name__ == '__main__':
    main()
