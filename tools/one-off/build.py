import re,html,json,os,collections
D='/private/tmp/claude-501/comortais/fx'
idx=json.load(open('/private/tmp/claude-501/comortais/index.json'))
board={'1006':'DMBB','1015':'DLBB'}
rowre=re.compile(r'<tr class="ui-state-default">(.*?)</tr>',re.S)
cells=lambda r:re.findall(r'<td[^>]*>(.*?)</td>',r,re.S)
clean=lambda x:re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>','',x))).strip()
isE=lambda n:bool(re.match(r'^[EÉ]anna\b',n,re.I))
def label(b,kind,comp):
    c=comp
    if b=='DMBB':
        m=re.match(r'Division (\d)',c)
        if m: return f"Men's D{m.group(1)}"
        if c.startswith('Over 40'): return "Men's Over 40s"
        m=re.match(r'Under (\d+)\s*(.*)',c)
        if m: return f"U{m.group(1)} Boys {m.group(2)}".strip()
        if kind=='Cup': return "Men's "+c
    else:
        m=re.match(r'Division (\d) Women',c)
        if m: return f"Women's D{m.group(1)}"
        m=re.match(r'U(\d+) Girls (.*)',c)
        if m: return f"U{m.group(1)} Girls {m.group(2)}"
        m=re.match(r'U(\d+)\s*(.*)',c)
        if m: return f"U{m.group(1)} Girls {m.group(2)}".strip()
        if kind=='Cup': return "Women's "+c
    return c
def iso(d):
    m=re.match(r'(\d\d)/(\d\d)/(\d\d)\s+(\d+):(\d\d)\s*(am|pm)',d)
    if not m: return None,None
    dd,mm,yy,h,mi,ap=m.groups();h=int(h)%12+(12 if ap=='pm' else 0)
    return f"20{yy}-{mm}-{dd}",f"{h:02d}:{mi}"
games=[];tables={}
for oid,v in idx.items():
  for tab,comps in v['tabs'].items():
    kind={'tabs-1':'League','tabs-2':'Cup'}.get(tab)
    if not kind: continue
    for _,cid,name in comps:
      fp=f'{D}/{oid}-{cid}.html'
      if not os.path.exists(fp): print('missing',cid); continue
      s=open(fp,errors='ignore').read(); name=html.unescape(name)
      st=collections.defaultdict(lambda:[0,0,0,0])  # w l pf pa
      for r in rowre.findall(s):
        c=cells(r)
        if len(c)<9: continue
        home,away=clean(c[3]),clean(c[6]); hs,as_=clean(c[4]),clean(c[5])
        d,t=iso(clean(c[2])); mid=re.search(r'match\.aspx\?id=(\d+)',r)
        played=hs.isdigit() and as_.isdigit()
        if kind=='League' and played:
          h,a=int(hs),int(as_)
          for tm,f,ag in ((home,h,a),(away,a,h)):
            st[tm][2]+=f;st[tm][3]+=ag;st[tm][0 if f>ag else 1]+=1
        if isE(home) or isE(away):
          eh=isE(home); us,them=(home,away) if eh else (away,home)
          g=dict(b=board[oid],k=kind,c=name,cid=cid,t=label(board[oid],kind,name),en=us,o=them,h=1 if eh else 0,d=d,tm=t,v=clean(c[8]),id=mid.group(1) if mid else '')
          if played:
            g['us']=int(hs) if eh else int(as_); g['th']=int(as_) if eh else int(hs)
          games.append(g)
      if kind=='League' and st:
        rows=sorted(st.items(),key=lambda x:(-x[1][0],x[1][1],-(x[1][2]-x[1][3])))
        tables[cid]=[[n]+v for n,v in rows]
# team key: label + eanna name suffix when several Eanna teams in a comp
cnt=collections.defaultdict(set)
for g in games: cnt[g['cid']].add(g['en'])
teams={}
for g in games:
  key=g['t']
  if len(cnt[g['cid']])>1:
    suf=re.sub(r'^[EÉ]anna( BC)?\s*','',g['en']).strip() or 'A'
    key=f"{g['t']} · Team {suf}"
  g['team']=key
  if g['k']=='League':
    T=teams.setdefault(key,dict(name=key,b=g['b'],comp=g['c'],cid=g['cid'],en=g['en'],w=0,l=0,pf=0,pa=0,n=0))
    if 'us' in g:
      T['n']+=1;T['pf']+=g['us'];T['pa']+=g['th'];T['w' if g['us']>g['th'] else 'l']+=1
for T in teams.values():
  tb=tables.get(T['cid'],[])
  names=[r[0] for r in tb]
  T['pos']=names.index(T['en'])+1 if T['en'] in names else None
  T['of']=len(names)
games.sort(key=lambda g:(g['d'] or '9999',g['tm'] or ''))
json.dump(dict(games=games,teams=list(teams.values()),tables={k:v for k,v in tables.items() if any(t['cid']==k for t in teams.values())}),open('/private/tmp/claude-501/comortais/data.json','w'),ensure_ascii=False)
print(len(games),'games',len(teams),'league teams')
for T in sorted(teams.values(),key=lambda x:x['name']): print(f"{T['name']:<34} {T['w']}-{T['l']}  pos {T['pos']}/{T['of']}")
