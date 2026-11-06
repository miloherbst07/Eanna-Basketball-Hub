import re,html,time,urllib.request,os,json,sys
UA={'User-Agent':'Mozilla/5.0'}
def get(u):
    req=urllib.request.Request(u,headers=UA)
    return urllib.request.urlopen(req,timeout=30).read().decode('utf-8','ignore')
out={}
for f,oid in [('men.html','1006'),('ladies.html','1015')]:
    s=open(f,errors='ignore').read()
    # split by tabs
    tabs={}
    for m in re.finditer(r'<div id="(tabs-\d)"(.*?)(?=<div id="tabs-\d"|$)',s,re.S):
        tabs[m.group(1)]=re.findall(r"competition\.aspx\?oid=(\d+)&id=(\d+)'>([^<]+)</a>",m.group(2))
    names=re.findall(r'<li><a href="#(tabs-\d)">([^<]+)</a>',s)
    out[oid]={'tabnames':names,'tabs':{k:v for k,v in tabs.items()}}
    print(oid,names,{k:len(v) for k,v in tabs.items()})
json.dump(out,open('index.json','w'))
