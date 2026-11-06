#!/usr/bin/env python3
"""Refresh data/eanna-fixtures.json from the public fixture pages.

Sources (public "Matches"/fixtures pages only, one request per second):
  - DMBB  https://bi.comortais.com/competitionstabs.aspx?oid=1006
  - DLBB  https://bi.comortais.com/competitionstabs.aspx?oid=1015
  - Basketball Ireland national league and cup pages on https://ireland.basketball

Run:  python3 tools/update_fixtures.py
It only reads public pages. It never uses the sites' private data feeds.
"""
import re, html, json, time, os, sys, collections, urllib.request, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get('HUB_OUT') or os.path.join(ROOT, 'data', 'eanna-fixtures.json')
UA = {'User-Agent': 'Mozilla/5.0 (EannaHub fixtures updater; contact: Éanna Basketball club)'}
BOARDS = {'1006': 'DMBB', '1015': 'DLBB'}
DELAY = 1.0

def get(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            return urllib.request.urlopen(req, timeout=40).read().decode('utf-8', 'ignore')
        except Exception as e:
            print('  retry', url, e, file=sys.stderr); time.sleep(3 * (i + 1))
    raise RuntimeError('could not fetch ' + url)

clean = lambda x: re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', x))).strip()
isE = lambda n: bool(re.match(r'^[EÉ]anna\b', n, re.I))

def label(b, kind, c):
    if b == 'DMBB':
        m = re.match(r'Division (\d)', c)
        if m: return f"Men's D{m.group(1)}"
        if c.startswith('Over 40'): return "Men's Over 40s"
        m = re.match(r'Under (\d+)\s*(.*)', c)
        if m: return f"U{m.group(1)} Boys {m.group(2)}".strip()
        return "Men's " + c if kind == 'Cup' else c
    m = re.match(r'Division (\d) Women', c)
    if m: return f"Women's D{m.group(1)}"
    m = re.match(r'U(\d+) Girls (.*)', c)
    if m: return f"U{m.group(1)} Girls {m.group(2)}"
    m = re.match(r'U(\d+)\s*(.*)', c)
    if m: return f"U{m.group(1)} Girls {m.group(2)}".strip()
    return "Women's " + c if kind == 'Cup' else c

def iso(d):
    m = re.match(r'(\d\d)/(\d\d)/(\d\d)\s+(\d+):(\d\d)\s*(am|pm)', d)
    if not m: return None, None
    dd, mm, yy, h, mi, ap = m.groups(); h = int(h) % 12 + (12 if ap == 'pm' else 0)
    return f"20{yy}-{mm}-{dd}", f"{h:02d}:{mi}"

def dublin():
    games, tables = [], {}
    for oid, board in BOARDS.items():
        idx = get(f'https://bi.comortais.com/competitionstabs.aspx?oid={oid}'); time.sleep(DELAY)
        for tab, kind in (('tabs-1', 'League'), ('tabs-2', 'Cup')):
            m = re.search(rf'<div id="{tab}"(.*?)(?=<div id="tabs-\d"|$)', idx, re.S)
            comps = re.findall(r"competition\.aspx\?oid=(\d+)&id=(\d+)'>([^<]+)</a>", m.group(1) if m else '')
            for _, cid, name in comps:
                name = html.unescape(name)
                s = get(f'https://bi.comortais.com/Fixtures.aspx?oid={oid}&compid={cid}'); time.sleep(DELAY)
                st = collections.defaultdict(lambda: [0, 0, 0, 0])
                for r in re.findall(r'<tr class="ui-state-default">(.*?)</tr>', s, re.S):
                    c = re.findall(r'<td[^>]*>(.*?)</td>', r, re.S)
                    if len(c) < 9: continue
                    home, away, hs, as_ = clean(c[3]), clean(c[6]), clean(c[4]), clean(c[5])
                    d, t = iso(clean(c[2])); mid = re.search(r'match\.aspx\?id=(\d+)', r)
                    done = hs.isdigit() and as_.isdigit()
                    if kind == 'League' and done:
                        h_, a_ = int(hs), int(as_)
                        for tm, f, ag in ((home, h_, a_), (away, a_, h_)):
                            st[tm][2] += f; st[tm][3] += ag; st[tm][0 if f > ag else 1] += 1
                    if isE(home) or isE(away):
                        eh = isE(home)
                        g = dict(b=board, k=kind, c=name, cid=cid, t=label(board, kind, name), en=home if eh else away, o=away if eh else home,
                                 h=1 if eh else 0, d=d, tm=t, v=clean(c[8]), id=mid.group(1) if mid else '')
                        if done: g['us'], g['th'] = (int(hs), int(as_)) if eh else (int(as_), int(hs))
                        games.append(g)
                if kind == 'League' and st:
                    tables[cid] = [[n] + v for n, v in sorted(st.items(), key=lambda x: (-x[1][0], x[1][1], -(x[1][2] - x[1][3])))]
                print(f'  {board} {kind} {name}: ok')
    return games, tables

NATIONAL = {
    'MensSuperLeagueFixtures': ("Men's Super League", 'League', 'm'),
    'MSLNationalCup': ("Men's Super League National Cup", 'Cup', 'm'),
    'NICCMensNationalCup': ("NICC Men's National Cup", 'Cup', 'm'),
    'U20MensNationalCup': ("U20 Men's National Cup", 'Cup', 'm'),
    'U20WomensNationalCup': ("U20 Women's National Cup", 'Cup', 'w'),
    'WomensSuperLeagueFixtures': ("Women's Super League", 'League', 'w'),
    'WomensDivisionOneFixtures': ("Women's Division One", 'League', 'w'),
    'WomensBIDLFixtures': ("Women's BIDL", 'League', 'w'),
    'MensDivisionOneFixtures': ("Men's Division One", 'League', 'm'),
    'MensBIDLFixtures': ("Men's BIDL", 'League', 'm'),
    'mensu20nationalleaguefixtures': ("Men's U20 National League", 'League', 'm'),
    'WSLNationalCup': ("Women's Super League National Cup", 'Cup', 'w'),
    'MD1NationalCup2': ("Men's D1 National Cup", 'Cup', 'm'),
    'WD1NationalCup2': ("Women's D1 National Cup", 'Cup', 'w'),
    'NICCWomensNationalCup': ("NICC Women's National Cup", 'Cup', 'w'),
}
TEAM_LABEL = {"Men's Super League": "Men's Super League", "Men's Super League National Cup": "Men's Super League",
              "NICC Men's National Cup": "Men's NICC National Cup", "U20 Men's National Cup": "U20 Men · National Cup",
              "U20 Women's National Cup": "U20 Women · National Cup"}

def national():
    games, tables, present = [], {}, set()
    for page, (comp, kind, sex) in NATIONAL.items():
        s = get('https://ireland.basketball/' + page); time.sleep(DELAY)
        seen = set(); st = collections.defaultdict(lambda: [0, 0, 0, 0])
        for b in re.findall(r'(<ul class="column-seven table-body[^>]*>.*?</ul>)', s, re.S):
            f = lambda cls: (re.search(r'<li class="smallview-hide ' + cls + r'[^"]*"[^>]*>(.*?)</li>', b, re.S) or [None, ''])[1]
            t1, t2 = clean(f('lteam1')), clean(f('lteam2'))
            sc = re.findall(r'<span class="data[^"]*">\s*(\d+)\s*</span>', f('rscore'))   # home score first, then away
            date = clean(f('ldate'))[:10]; tm = clean(f('ltime'))
            m = re.match(r'(\d\d)/(\d\d)/(\d{4})', date); d = f'{m.group(3)}-{m.group(2)}-{m.group(1)}' if m else None
            if d and d.startswith('1970'): d = None
            key = (d, t1, t2)
            if key in seen: continue
            seen.add(key)
            if len(sc) >= 2 and t1 and t2:
                a, c = int(sc[0]), int(sc[1])
                for tmn, x, y in ((t1, a, c), (t2, c, a)):
                    st[tmn][2] += x; st[tmn][3] += y; st[tmn][0 if x > y else 1] += 1
            if not re.search(r'[EÉ]anna', t1 + t2): continue
            present.add(page)
            eh = bool(re.search(r'[EÉ]anna', t1)); team = TEAM_LABEL.get(comp, comp)
            fid = re.search(r'data-fixtureId="([^"]+)"', b)
            g = dict(b='BI', k=kind, c=comp, t=team, team=team, sex=sex, o=(t2 if eh else t1) or 'To be decided', en=t1 if eh else t2,
                     h=1 if eh else 0, d=d, tm=tm if re.match(r'\d\d:\d\d', tm) else None, v=clean(f('lvenue')), id=fid.group(1) if fid else '', page=page)
            if len(sc) >= 2:
                a, c = int(sc[0]), int(sc[1]); g['us'], g['th'] = (a, c) if eh else (c, a)
            games.append(g)
        if kind == 'League' and page in present and st:
            tables['BI-' + page] = [[n] + v for n, v in sorted(st.items(), key=lambda x: (-x[1][0], x[1][1], -(x[1][2] - x[1][3])))]
        print(f'  BI {comp}: {"Éanna in it" if page in present else "no Éanna team"}')
    nat = [dict(c=c, s='Éanna in it' if p in present else 'No Éanna team · follow to watch', on=1 if p in present else 0, page=p) for p, (c, _, _) in NATIONAL.items()]
    return games, tables, nat

def main():
    print('Dublin boards…'); dg, dt = dublin()
    print('Basketball Ireland…'); ng, nt, nat = national()
    # team keys
    names_in_comp = collections.defaultdict(set)
    for g in dg: names_in_comp[g['cid']].add(g['en'])
    teams = {}
    for g in dg:
        key = g['t']
        if len(names_in_comp[g['cid']]) > 1:
            suffix = re.sub(r'^[EÉ]anna( BC)?\s*', '', g['en']).strip() or 'A'
            key = g['t'] + ' · Team ' + suffix
        g['team'] = key
        if g['k'] == 'League':
            T = teams.setdefault(key, dict(name=key, b=g['b'], comp=g['c'], cid=g['cid'], en=g['en'], w=0, l=0, pf=0, pa=0, n=0))
            if 'us' in g: T['n'] += 1; T['pf'] += g['us']; T['pa'] += g['th']; T['w' if g['us'] > g['th'] else 'l'] += 1
    for g in ng:
        if g['k'] == 'League':
            cid = 'BI-' + g['page']
            T = teams.setdefault(g['team'], dict(name=g['team'], b='BI', sex=g['sex'], comp="Domino's " + g['c'] if 'Super League' in g['c'] else g['c'], cid=cid, en=g['en'], w=0, l=0, pf=0, pa=0, n=0))
            if 'us' in g: T['n'] += 1; T['pf'] += g['us']; T['pa'] += g['th']; T['w' if g['us'] > g['th'] else 'l'] += 1
    tables = {**dt, **nt}
    for T in teams.values():
        names = [r[0] for r in tables.get(T['cid'], [])]
        T['pos'] = names.index(T['en']) + 1 if T['en'] in names else None
        T['of'] = len(names)
    games = dg + ng
    for g in games: g.pop('en', None); g.pop('cid', None) if g['b'] != 'BI' else None
    games.sort(key=lambda g: (g['d'] or '9999', g['tm'] or ''))
    used = {T['cid'] for T in teams.values()}
    out = dict(games=games, teams=[{k: v for k, v in T.items() if k != 'en'} for T in teams.values()],
               tables={k: v for k, v in tables.items() if k in used}, national=nat,
               fetched=datetime.date.today().isoformat(),
               source={'DMBB': 'https://bi.comortais.com/competitionstabs.aspx?oid=1006', 'DLBB': 'https://bi.comortais.com/competitionstabs.aspx?oid=1015', 'BI': 'https://ireland.basketball/NationalLeagueFixtures'})
    if len(games) < 100:
        sys.exit(f'Only {len(games)} games found, not saving. A site may have changed.')
    with open(OUT, 'w') as f: json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print(f'Saved {len(games)} games for {len(teams)} teams to {OUT}')

if __name__ == '__main__':
    main()
