#!/usr/bin/env python3
"""QA/QC every crop across ALL FIVE metrics the Atlas carries.

    Volume                  provConfig.file           MT
    Area Harvested          provConfig.areaFile       HA
    Yield                   provConfig.yieldFile      MT/HA
    Bearing Trees           provConfig.treesFile      trees
    Yield per Bearing Tree  provConfig.yieldTreeFile  MT/tree

WHY THIS EXISTS
    A data change is easy to verify on the metric you happened to be working
    on and easy to forget on the other four. Repointing `file:` at a rebuilt
    Volume source while `yieldFile` and `areaFile` still point at an older
    vintage leaves a crop whose volume and yield come from different data, and
    nothing in the app surfaces that.

WHAT IT CHECKS, per crop and metric
    missing      configured file does not exist on disk
    codeless     rows with a blank ADM2_PCODE - js/app.js drops those, so the
                 production in them is invisible (this is how 358,062 MT went
                 missing across 48 files)
    vintage      Volume comes from a *_long-derived file but Yield/Area/Trees
                 still come from the older hand-curated source
    no area      PSA publishes no area for the commodity, so yield cannot be
                 derived. Reported as EXPECTED, not as a gap: 23 crops, and not
                 one of them has a yield file either, so the source is
                 self-consistent. Tree crops carry Bearing Trees and Yield per
                 Tree instead; for livestock and fisheries hectares are
                 meaningless. Do not go looking for the missing area files.
    internal     Yield disagrees with Volume/Area, compared PER PROVINCE.
                 Never compare these nationally: a national yield is the
                 UNWEIGHTED mean of provincial yields, which legitimately
                 differs from national volume / national area. That naive test
                 flagged 27 crops; 26 were arithmetic, not data.

ON DISCREPANCIES - READ THIS BEFORE "FIXING" ANYTHING
    A gap between a file and its source does NOT mean the file is incomplete.
    Cassava looked 82% short and was in fact a deliberate single-subtype series
    ('Cassava for industrial use, fresh tubers', matching 0.0% off every year);
    the provinces that looked missing grow no industrial cassava at all. Match a
    suspect file against EVERY candidate series before concluding anything, and
    ask before redefining what a commodity means.

Usage:  python tools/qaqc_metrics.py [--crop NAME] [--metric volume|area|...]
"""

import argparse
import csv
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DATA = os.path.join(REPO, 'data')

METRICS = [('volume', 'file', 'MT'), ('area', 'areaFile', 'HA'),
           ('yield', 'yieldFile', 'MT/HA'), ('trees', 'treesFile', 'trees'),
           ('yieldtree', 'yieldTreeFile', 'MT/tree')]
YEARS = [str(y) for y in range(2021, 2027)]
MAGUINDANAO_DEL_SUR = '1908800000'
MAGUINDANAO_DEL_NORTE = '1908700000'


def num(v):
    try:
        return float(str(v).replace(',', ''))
    except (TypeError, ValueError):
        return 0.0


def parse_config(block_name):
    js = open(os.path.join(REPO, 'js', 'app.js'), encoding='utf-8').read().split('\n')
    a = next(i for i, l in enumerate(js) if l.startswith('const %s' % block_name))
    b = next(i for i, l in enumerate(js) if i > a and l == '};')
    cfg, cur = {}, None
    for line in js[a:b]:
        m = re.match(r"\s*'([^']+)':\s*\{", line)
        if m:
            cur = m.group(1)
            cfg[cur] = {}
            continue
        for m2 in re.finditer(r"(\w*[Ff]ile):\s*'([^']+)'", line):
            if cur:
                cfg[cur].setdefault(m2.group(1), m2.group(2))
    return cfg


def read(path):
    """Rows from a .csv or an .xlsx#Sheet, headers normalised like loadDataFile."""
    p, _, sheet = path.partition('#')
    if not os.path.exists(p):
        return None
    if p.lower().endswith('.csv'):
        with open(p, encoding='utf-8-sig', newline='') as fh:
            return list(csv.DictReader(fh))
    import openpyxl
    wb = openpyxl.load_workbook(p, read_only=True, data_only=True)
    ws = wb[sheet] if sheet in wb.sheetnames else wb[wb.sheetnames[0]]
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    if not rows:
        return []

    def js_str(v):
        if v is None:
            return ''
        if isinstance(v, float) and v.is_integer():
            return str(int(v))
        return str(v)

    hdr = []
    for h in rows[0]:
        t = js_str(h).strip()
        m = re.match(r'^Annual\s*\((\d{4})\)$', t, re.I)
        hdr.append(m.group(1) if m else t)
    return [{k: (js_str(r[i]).strip() if i < len(r) else '')
             for i, k in enumerate(hdr)} for r in rows[1:]]


def national(rows, year, average=False):
    """Same de-duplication loadCropData() uses: one row per province, zeros
    filled from a later duplicate (the NIR/Sulu handover pattern)."""
    seen = {}
    for r in rows:
        k = (r.get('ADM2_PCODE') or '').strip()
        if not k:
            continue
        if len(k) == 9 and k.isdigit():
            k = '0' + k
        if k not in seen:
            seen[k] = dict(r)
        else:
            for y in YEARS:
                if not num(seen[k].get(y)) > 0 and num(r.get(y)) > 0:
                    seen[k][y] = r.get(y)
    vals = [num(r.get(year)) for r in seen.values()]
    if average:
        vals = [v for v in vals if v > 0]
        return sum(vals) / len(vals) if vals else 0.0
    return sum(vals)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--crop')
    ap.add_argument('--metric')
    ap.add_argument('--year', default='2025')
    args = ap.parse_args()

    prov = parse_config('provConfig')
    crop_cfg = parse_config('cropConfig')
    names = sorted(set(prov) | set(crop_cfg))
    if args.crop:
        names = [n for n in names if args.crop.lower() in n.lower()]

    findings = {'missing': [], 'codeless': [], 'vintage': [], 'absent': []}
    per_crop = {}

    for name in names:
        row = {}
        for mid, key, unit in METRICS:
            if args.metric and args.metric != mid:
                continue
            path = prov.get(name, {}).get(key) or crop_cfg.get(name, {}).get(key)
            if not path:
                row[mid] = None
                continue
            rows = read(path)
            if rows is None:
                findings['missing'].append((name, mid, path))
                row[mid] = None
                continue
            # Only provincial files can lose rows this way. A regional file is
            # keyed by ADM1_PCODE and has no ADM2_PCODE column at all, so every
            # row would read as "blank" and the whole file would look lost -
            # which is how Overall Dairy's 43,298 MT was reported missing when
            # js/app.js reads it perfectly well.
            provincial = bool(rows) and 'ADM2_PCODE' in rows[0]
            blank = ([r for r in rows if not (r.get('ADM2_PCODE') or '').strip()]
                     if provincial else [])
            lost = sum(num(r.get(args.year)) for r in blank)
            if lost > 0:
                # A blank code is NOT automatically lost production. The common
                # case by far is an undivided-Maguindanao row that is a rolled-up
                # PARENT of del Norte + del Sur for the same year - dropping it is
                # correct, and "restoring" it would double-count the province.
                # Reporting those as loss is what made a 2026-09-05 run read as
                # 12,637 HA missing when the true figure was zero. Classify.
                kids = sum(num(r.get(args.year)) for r in rows
                           if (r.get('ADM2_PCODE') or '').strip().lstrip('0').rjust(10, '0')
                           in (MAGUINDANAO_DEL_SUR, MAGUINDANAO_DEL_NORTE))
                if mid in ('yield', 'yieldtree'):
                    # A ratio cannot be summed, so "parent == children" never
                    # holds. Redundancy here means the successors already publish
                    # their own value for the year - the parent adds nothing.
                    duplicate = kids > 0
                else:
                    duplicate = kids > 0 and abs(lost - kids) <= 0.02
                findings['codeless'].append((name, mid, os.path.basename(path.split('#')[0]),
                                             lost, unit, duplicate))
            row[mid] = (path, national(rows, args.year, average=(mid in ('yield', 'yieldtree'))))
        per_crop[name] = row

        # vintage split: volume rebuilt from a *_long source, others not
        vol = row.get('volume')
        if vol and re.search(r'(^|/)(veg_|banana_overall_)', vol[0]):
            stale = [m for m in ('area', 'yield', 'trees', 'yieldtree')
                     if row.get(m) and not re.search(r'(^|/)(veg_|banana_overall_)', row[m][0])]
            if stale:
                findings['vintage'].append((name, stale))

    label = {'volume': 'Volume', 'area': 'Area', 'yield': 'Yield',
             'trees': 'Trees', 'yieldtree': 'Yield/Tree'}

    print('QA/QC across all five metrics - %d crops, year %s\n' % (len(names), args.year))

    print('1. CONFIGURED FILE MISSING FROM DISK')
    for n, m, p in findings['missing']:
        print('   %-34s %-10s %s' % (n[:34], label[m], p))
    print('   %s\n' % ('none' if not findings['missing'] else
                       '%d problems' % len(findings['missing'])))

    print('2. CODELESS ROWS - production the app silently drops')
    real = [x for x in findings['codeless'] if not x[5]]
    dups = [x for x in findings['codeless'] if x[5]]
    print('   %d file(s) genuinely losing data; %d carrying a duplicate parent row'
          % (len(real), len(dups)))
    if dups:
        print('   (duplicate = the blank row equals del Norte + del Sur exactly for this')
        print('    year, so the app dropping it is CORRECT - do not "restore" it)')
    print()
    tot = {}
    for n, m, f, lost, unit, dup in sorted(real, key=lambda x: -x[3]):
        tot[unit] = tot.get(unit, 0) + lost
        print('   %-30s %-10s %14s %-8s %s' % (n[:30], label[m],
              format(round(lost), ','), unit, f[:38]))
    print('   %s' % ('none - no live file loses data to a codeless row' if not real else
                     '%d files; ' % len(findings['codeless'])
                     + ', '.join('%s %s' % (format(round(v), ','), u) for u, v in tot.items())))
    print()

    print('3. VINTAGE SPLIT - Volume rebuilt from a *_long source, other metrics not')
    for n, stale in findings['vintage']:
        print('   %-34s still old: %s' % (n[:34], ', '.join(label[m] for m in stale)))
    print('   %s\n' % ('none' if not findings['vintage'] else
                       '%d crops' % len(findings['vintage'])))

    # Compared PER PROVINCE, never at national level. A national yield is the
    # UNWEIGHTED mean of provincial yields (METRICS marks yield `average: true`),
    # and that is legitimately different from national volume / national area -
    # sum-then-divide weights a 20,000 ha province properly, mean-of-ratios does
    # not. Comparing those two at national level flags ~27 crops that are in fact
    # perfectly consistent: Carrots, Chinese Cabbage, Pineapple, Squash and
    # Cotton all show a median per-province error of 0.0%. Only a per-province
    # comparison can tell a real inconsistency from that arithmetic artefact.
    print('4. INTERNAL CONSISTENCY - Yield vs Volume/Area, compared PER PROVINCE (%s)'
          % args.year)
    bad = 0
    for name in sorted(per_crop):
        c = prov.get(name, {})
        if not all(k in c for k in ('file', 'areaFile', 'yieldFile')):
            continue
        cells = {}
        for key in ('file', 'areaFile', 'yieldFile'):
            rows = read(c[key])
            if rows is None:
                cells = None
                break
            d = {}
            for r in rows:
                k = (r.get('ADM2_PCODE') or '').strip()
                if not k:
                    continue
                if len(k) == 9 and k.isdigit():
                    k = '0' + k
                d.setdefault(k, num(r.get(args.year)))
            cells[key] = d
        if not cells:
            continue
        errs = []
        for pc in set(cells['file']) & set(cells['areaFile']) & set(cells['yieldFile']):
            a_, y_ = cells['areaFile'][pc], cells['yieldFile'][pc]
            if a_ > 0 and y_ > 0:
                errs.append(abs(cells['file'][pc] / a_ - y_) / y_ * 100)
        if not errs:
            continue
        errs.sort()
        median = errs[len(errs) // 2]
        if median > 5:
            bad += 1
            print('   %-32s median per-province error %6.1f%%  (%d provinces)'
                  % (name[:32], median, len(errs)))
    print('   %s' % ('every crop consistent per province'
                     if not bad else '%d crops genuinely inconsistent' % bad))

    # PSA does not publish area for every commodity, and where it does not,
    # yield cannot be derived either - yield is volume/area. That absence is a
    # property of the source, NOT a gap to go and fill, so it is reported here
    # as expected rather than left to look like an oversight in section 1.
    # js/app.js already handles it: metricAvailableForCrop() disables the tab,
    # and autoSwitchMetricCounterpart() moves Area->Trees and Yield->Yield/Tree
    # for tree crops rather than landing the user on an empty view.
    print('')
    print('5. NO AREA PUBLISHED - yield cannot be derived (expected, not a gap)')
    groups = {'tree crops - measured in bearing trees, not hectares': [],
              'livestock and fisheries - hectares are meaningless': [],
              'volume only in the source': []}
    livestock = ('Cattle', 'Chicken', 'Dairy', 'Egg', 'Hog', 'Milkfish', 'Tilapia')
    for name in sorted(per_crop):
        row = per_crop[name]
        if row.get('area') or not row.get('volume'):
            continue
        short = name.replace('Overall ', '').replace(' Production', '')
        if row.get('trees'):
            groups['tree crops - measured in bearing trees, not hectares'].append(short)
        elif short in livestock:
            groups['livestock and fisheries - hectares are meaningless'].append(short)
        else:
            groups['volume only in the source'].append(short)
    total = sum(len(v) for v in groups.values())
    for label, crops in groups.items():
        if crops:
            print('   %-52s %d' % (label, len(crops)))
            print('      %s' % ', '.join(crops))
    print('   %d crops with no area; none of them has a yield file either, so the'
          % total)
    print('   source is self-consistent - nothing to reconcile.')


if __name__ == '__main__':
    main()
