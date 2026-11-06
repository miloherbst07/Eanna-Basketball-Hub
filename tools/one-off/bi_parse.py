import re,html,json,glob,os
os.chdir('/private/tmp/claude-501/bi')
NAMES={'MensSuperLeagueFixtures':("Men's Super League",'League','m'),'MensDivisionOneFixtures':("Men's Division One",'League','m'),'MensBIDLFixtures':("Men's BIDL",'League','m'),'WomensSuperLeagueFixtures':("Women's Super League",'League','w'),'WomensDivisionOneFixtures':("Women's Division One",'League','w'),'WomensBIDLFixtures':("Women's BIDL",'League','w'),'mensu20nationalleaguefixtures':("Men's U20 National League",'League','m'),'-men-s-division-two':("Men's Division Two",'League','m'),'MSLNationalCup':("Men's Super League National Cup",'Cup','m'),'WSLNationalCup':("Women's Super League National Cup",'Cup','w'),'MD1NationalCup2':("Men's D1 National Cup",'Cup','m'),'WD1NationalCup2':("Women's D1 National Cup",'Cup','w'),'NICCMensNationalCup':("NICC Men's National Cup",'Cup','m'),'NICCWomensNationalCup':("NICC Women's National Cup",'Cup','w'),'U20MensNationalCup':("U20 Men's National Cup",'Cup','m'),'U20WomensNationalCup':("U20 Women's National Cup",'Cup','w')}
cl=lambda x:re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>','',x))).strip()
out=[];seen=set()
for page,(comp,kind,sex) in NAMES.items():
    s=open(page+'.html',errors='ignore').read()
    blocks=re.findall(r'(<ul class="column-seven table-body[^>]*>.*?</ul>)',s,re.S)
    for b in blocks:
        def f(cls):
            m=re.search(r'<li class="smallview-hide '+cls+r'[^"]*"[^>]*>(.*?)</li>',b,re.S); return m.group(1) if m else ''
        t1,t2=cl(f('lteam1')),cl(f('lteam2'))
        if not re.search(r'[EÉ]anna',t1+t2): continue
        sc=re.findall(r'<span class="data[^"]*">\s*(\d+)\s*</span>',f('rscore'))
        dd=re.search(r'data-date="([^"]+)"',b); fid=re.search(r'data-fixtureId="([^"]+)"',b)
        date=cl(f('ldate'))[:10]; tm=cl(f('ltime'))
        m=re.match(r'(\d\d)/(\d\d)/(\d{4})',date); iso=f'{m.group(3)}-{m.group(2)}-{m.group(1)}' if m else None
        key=(comp,iso,t1,t2)
        if key in seen: continue
        seen.add(key)
        eh=bool(re.search(r'[EÉ]anna',t1))
        g=dict(b='BI',k=kind,c=comp,sex=sex,d=iso,tm=tm if re.match(r'\d\d:\d\d',tm) else None,home=t1,away=t2,h=1 if eh else 0,o=t2 if eh else t1,en=t1 if eh else t2,v=cl(f('lvenue')),id=fid.group(1) if fid else '',page=page)
        if len(sc)>=2:
            a,c=int(sc[0]),int(sc[1]); g['us'],g['th']=(a,c) if eh else (c,a)
        out.append(g)
json.dump(out,open('bi_eanna.json','w'),ensure_ascii=False,indent=0)
import collections
print(len(out)); print(collections.Counter((g['c'],g['en']) for g in out))
for g in out:
  if g['k']=='Cup' or 'U20' in g['c'] or 'Division' in g['c']: print(g['c'],g['d'],g['tm'],g['home'],g.get('us'),g.get('th'),g['away'],'|',g['v'])
