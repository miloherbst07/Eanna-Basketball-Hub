import re,html,json,collections
os_bi='/private/tmp/claude-501/bi'
DATA='/Users/milosfolder/Library/Application Support/Claude/scratch-workspaces/a6a597c2-1981-4ddb-8b10-bc1140e7bf48/fe49277b-2d94-4fe6-8beb-6f335a8c50c0/scratch-2026-11-06-fa9b04/data/eanna-fixtures.json'
D=json.load(open(DATA))
D['games']=[g for g in D['games'] if g.get('b')!='BI']; D['teams']=[t for t in D['teams'] if t.get('b')!='BI']
bi=json.load(open(os_bi+'/bi_eanna.json'))
label={"Men's Super League":"Men's Super League","Men's Super League National Cup":"Men's Super League","NICC Men's National Cup":"Men's NICC National Cup","U20 Men's National Cup":"U20 Men · National Cup","U20 Women's National Cup":"U20 Women · National Cup"}
for g in bi:
    if g['d'] and g['d'].startswith('1970'): g['d']=None;g['tm']=None
    if not g['o']: g['o']='To be decided'
    t=label.get(g['c'],g['c'])
    D['games'].append(dict(b='BI',k=g['k'],c=g['c'],t=t,team=t,sex=g['sex'],o=g['o'],h=g['h'],d=g['d'],tm=g['tm'],v=g['v'],id=g['id'],page=g['page'],**({'us':g['us'],'th':g['th']} if 'us' in g else {})))
# Super League table from every result on the page
cl=lambda x:re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>','',x))).strip()
s=open(os_bi+'/MensSuperLeagueFixtures.html',errors='ignore').read()
st=collections.defaultdict(lambda:[0,0,0,0]);seen=set()
for b in re.findall(r'(<ul class="column-seven table-body[^>]*>.*?</ul>)',s,re.S):
    f=lambda c:(re.search(r'<li class="smallview-hide '+c+r'[^"]*"[^>]*>(.*?)</li>',b,re.S) or [None,''])[1]
    t1,t2=cl(f('lteam1')),cl(f('lteam2'));sc=re.findall(r'<span class="data[^"]*">\s*(\d+)\s*</span>',f('rscore'))
    k=(cl(f('ldate'))[:10],t1,t2)
    if len(sc)<2 or k in seen or not t1: continue
    seen.add(k);a,c=int(sc[0]),int(sc[1])
    for tm,x,y in((t1,a,c),(t2,c,a)):
        st[tm][2]+=x;st[tm][3]+=y;st[tm][0 if x>y else 1]+=1
rows=sorted(st.items(),key=lambda x:(-x[1][0],x[1][1],-(x[1][2]-x[1][3])))
D['tables']['BI-MSL']=[[n]+v for n,v in rows]
sl=[g for g in D['games'] if g['team']=="Men's Super League" and g['k']=='League' and 'us' in g]
names=[r[0] for r in rows]
D['teams'].append(dict(name="Men's Super League",b='BI',sex='m',comp="Domino's Men's Super League",cid='BI-MSL',w=sum(g['us']>g['th'] for g in sl),l=sum(g['us']<g['th'] for g in sl),pf=sum(g['us'] for g in sl),pa=sum(g['th'] for g in sl),n=len(sl),pos=names.index('Griffith College Éanna')+1 if 'Griffith College Éanna' in names else None,of=len(names)))
D['games'].sort(key=lambda g:(g['d'] or '9999',g['tm'] or ''))
D['national']=[
 dict(c="Domino's Men's Super League",s='Éanna in it · 22 games',on=1,page='MensSuperLeagueFixtures'),
 dict(c="Men's Super League National Cup",s='Éanna in it · draw to come',on=1,page='MSLNationalCup'),
 dict(c="NICC Men's National Cup",s='Éanna in it',on=1,page='NICCMensNationalCup'),
 dict(c="U20 Men's National Cup",s='Éanna in it',on=1,page='U20MensNationalCup'),
 dict(c="U20 Women's National Cup",s='Éanna in it',on=1,page='U20WomensNationalCup'),
 dict(c="Domino's Women's Super League",s='No Éanna team · follow to watch',on=0,page='WomensSuperLeagueFixtures'),
 dict(c="Domino's Women's Division One",s='No Éanna team · follow to watch',on=0,page='WomensDivisionOneFixtures'),
 dict(c="Women's BIDL",s='Fixtures not published yet',on=0,page='WomensBIDLFixtures'),
 dict(c="Domino's Men's Division One",s='No Éanna team · follow to watch',on=0,page='MensDivisionOneFixtures'),
 dict(c="Men's U20 National League",s='Check: Éanna listed once',on=0,page='mensu20nationalleaguefixtures')]
json.dump(D,open(DATA,'w'),ensure_ascii=False,separators=(',',':'))
t=D['teams'][-1];print('SL',t['w'],'-',t['l'],'pos',t['pos'],'/',t['of'],'| total games',len(D['games']))
for r in rows: print(r)
