"""Build data/boundaries/psgc_parents_2026.json — a geometry-free province/city -> region
parent table, taken from the published PSGC codes in the 2026 boundary drop.

Why this file exists
--------------------
js/app.js used to resolve a province's parent region two ways, both bad:

  * provinceParentRegion() read ADM1_PCODE off the 42 MB provincial boundary
    GeoJSON, so nothing could resolve a region until that file landed; and
  * when it had not, provinceRegionPcode() fell back to slicing the PSGC
    string, which is arithmetic on an identifier, not a lookup.

Admin_Boundary_Provincial_NCR_HUC_2026.geojson already carries the answer as
published data - Region_PSGC_Code / Region_Name / Province_PSGC_Code /
City_PSGC_Code - so this script strips the geometry and keeps the codes. The
result is ~5 KB instead of 42 MB and needs no polygons at all.

Two deliberate adjustments, both about *vintage*
------------------------------------------------
1. TO_APP re-keys the seven entities whose 2026 PSGC code differs from the one
   the app and every data CSV join on (Sulu, Zamboanga City, the four Metro
   Manila districts, the Special Geographic Area). Without this the table would
   key on codes nothing else in the project uses.

2. PRE_REHOME_REGION stores Sulu under BARMM, not the Region IX the 2026 file
   states. The table is the *base* region; js/app.js layers its year-aware
   rules (PROVINCE_REHOMES, NIR_PROV_TO_PRE2024) on top exactly as it did when
   the base came from the boundary file. Sulu only counts under Region IX from
   2026 - PSA still books its 2025 output under BARMM - so recording the 2026
   answer as the base would move real tonnage out of BARMM for earlier years.

Run: python tools/build_psgc_parents.py
"""
import json
import os
import re

SRC = 'data/admin_boundary_2026/Admin_Boundary_Provincial_NCR_HUC_2026.geojson'
OUT = 'data/boundaries/psgc_parents_2026.json'

# 2026 PSGC code -> the code this project (and every data CSV) actually uses.
TO_APP = {
    '0906600000': '1906600000',  # Sulu
    '0931700000': '0907400000',  # Zamboanga City
    '1339000000': '1303900000',  # Metro Manila 1st District
    '1374000000': '1307400000',  # Metro Manila 2nd District
    '1375000000': '1307500000',  # Metro Manila 3rd District
    '1376000000': '1307600000',  # Metro Manila 4th District
    '1999900000': '1909900000',  # Special Geographic Area
}

# Base region for provinces the app re-homes year-aware (see docstring #2).
PRE_REHOME_REGION = {'1906600000': '1900000000'}  # Sulu stays BARMM as the base


def normalise(name):
    """Fold every spelling of a place seen in data/ onto one key.

    The published sheets are not consistent, and each variant used to need its
    own hand-written entry somewhere:

        'City of Davao'  '..City of Davao'  'Davao City'      -> davaocity
        'Bacolod City (Capital)'            'City of Bacolod' -> bacolodcity
        'Sulu c/'  'Siquijor b/'                              -> sulu, siquijor
        'Cotabato (North Cotabato)'                           -> cotabato

    Handles: footnote markers (a/ b/ c/), the leading dots the sheet sometimes
    emits, parenthetical suffixes, and "City of X" vs "X City".
    """
    s = (name or '').strip()
    s = re.sub(r'\s+[a-z]/$', '', s)        # footnote marker
    s = re.sub(r'^\.+', '', s)              # leading dots
    s = re.sub(r'\s*\([^)]*\)', '', s)      # (Capital), (Opon), (North Cotabato)
    s = s.strip()
    m = re.match(r'^City of (.+)$', s, re.I)
    if m:
        s = m.group(1) + ' City'
    return re.sub(r'[^a-z]', '', s.lower())


def main():
    with open(SRC, encoding='utf-8-sig') as fh:
        data = json.load(fh)

    parents, regions = {}, {}
    for feat in data['features']:
        p = feat['properties']
        code = p.get('City_PSGC_Code') or p.get('Province_PSGC_Code')
        if not code:
            continue
        code = TO_APP.get(code, code)
        region = TO_APP.get(p.get('Region_PSGC_Code'), p.get('Region_PSGC_Code'))
        if not region:
            continue
        parents[code] = PRE_REHOME_REGION.get(code, region)
        regions.setdefault(region, p.get('Region_Name'))

    # Every province the app can be asked about must be in here, or
    # provinceRegionPcode() drops to its prefix fallback again.
    with open('data/boundaries/Admin_Provincial_Boundary.json', encoding='utf-8-sig') as fh:
        live = {f['properties']['ADM2_PCODE'] for f in json.load(fh)['features']}
    missing = sorted(live - set(parents))
    assert not missing, 'live boundary codes missing from the parent table: %s' % missing

    # name -> pcode, so nothing downstream needs a hand-written city table.
    # This is what makes the codeless-row repair self-maintaining: a city PSA
    # starts reporting separately is already in the boundary file, so it
    # resolves without anyone adding a code by hand.
    names = {}
    for feat in data['features']:
        p = feat['properties']
        code = p.get('City_PSGC_Code') or p.get('Province_PSGC_Code')
        label = p.get('City_Name') or p.get('Province_Name')
        if not code or not label:
            continue
        key = normalise(label)
        code = TO_APP.get(code, code)
        if key in names and names[key] != code:
            raise SystemExit('normalise() collision: %r and an earlier name both '
                             'fold to %r but have different codes' % (label, key))
        names[key] = code
    # Verified against every spelling that actually appears in data/: all five
    # highly-urbanised cities resolve from here, in all twelve spellings.
    assert names.get('davaocity') == '1130700000'
    assert names.get('zamboangacity') == '0907400000'
    assert names.get('bacolodcity') == '1830200000'

    payload = {'regions': dict(sorted(regions.items())),
               'parents': dict(sorted(parents.items())),
               'names': dict(sorted(names.items()))}
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=1)
    print('%s: %d parents, %d regions, %d names, %.1f KB'
          % (OUT, len(parents), len(regions), len(names), os.path.getsize(OUT) / 1024))


if __name__ == '__main__':
    main()
