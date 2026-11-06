import re,html,time,urllib.request,json,os
UA={'User-Agent':'Mozilla/5.0 (Macintosh) EannaHubResearch'}
D='/private/tmp/claude-501/comortais/fx'; os.makedirs(D,exist_ok=True)
idx=json.load(open('/private/tmp/claude-501/comortais/index.json'))
board={'1006':'DMBB','1015':'DLBB'}
rowre=re.compile(r'<tr class="ui-state-default">(.*?)</tr>',re.S)
def cells(r): return re.findall(r'<td[^>]*>(.*?)</td>',r,re.S)
def clean(x): return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>','',x))).strip()
res=[]
for oid,v in idx.items():
    for tab,comps in v['tabs'].items():
        kind={'tabs-1':'League','tabs-2':'Cup'}.get(tab)
        if not kind: continue
        for _,cid,name in comps:
            fp=f'{D}/{oid}-{cid}.html'
            if not os.path.exists(fp):
                u=f'https://bi.comortais.com/Fixtures.aspx?oid={oid}&compid={cid}'
                try:
                    s=urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=40).read().decode('utf-8','ignore')
                except Exception as e:
                    print('ERR',cid,e); continue
                open(fp,'w').write(s); time.sleep(1.0)
            s=open(fp,errors='ignore').read()
            for r in rowre.findall(s):
                c=cells(r)
                if len(c)<9: continue
                title=re.search(r'title="([^"]+)" class="date"',r)
                mid=re.search(r'match\.aspx\?id=(\d+)',r)
                rec=dict(board=board[oid],kind=kind,comp=html.unescape(name),cid=cid,date=clean(c[2]),full=title.group(1) if title else '',home=clean(c[3]),hs=clean(c[4]),as_=clean(c[5]),away=clean(c[6]),venue=clean(c[8]),mid=mid.group(1) if mid else '')
                if re.search(r'[EÉ]anna',rec['home']+rec['away'],re.I): res.append(rec)
json.dump(res,open('/private/tmp/claude-501/comortais/eanna.json','w'),ensure_ascii=False,indent=0)
print(len(res),'Éanna games')
