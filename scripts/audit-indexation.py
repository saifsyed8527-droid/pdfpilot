"""Read-only HTTP/GSC baseline and repeatable local comparison. No indexing submissions."""
import csv, json, hashlib, time, sys, re, urllib.request, urllib.error, urllib.parse, concurrent.futures, collections, gzip
from pathlib import Path
from html.parser import HTMLParser
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'docs/pseo/indexation/2026-09-29'
BASE=sys.argv[1] if len(sys.argv)>1 else 'https://pdfpilot.net'
LABEL=sys.argv[2] if len(sys.argv)>2 else 'live-before'
class Page(HTMLParser):
 def __init__(self):
  super().__init__();self.title=[];self.h1=[];self.meta={};self.canonical=[];self.hreflang={};self.links=set();self.text=[];self.jsonld=[];self.stack=[];self.script=None
 def handle_starttag(self,tag,attrs):
  a=dict(attrs);self.stack.append(tag) if tag in ['h1','title','script','style'] else None
  if tag=='html':self.lang=a.get('lang')
  if tag=='meta':self.meta[a.get('name',a.get('property',''))]=a.get('content','')
  if tag=='link' and a.get('rel')=='canonical':self.canonical.append(a.get('href'))
  if tag=='link' and a.get('hreflang'):self.hreflang[a['hreflang']]=a.get('href')
  if tag=='a' and a.get('href'):self.links.add(a['href'])
  if tag=='script' and a.get('type')=='application/ld+json':self.script=''
 def handle_endtag(self,tag):
  if tag=='script' and self.script is not None:
   try:self.jsonld.append(json.loads(self.script))
   except ValueError:self.jsonld.append({'INVALID_JSON':True})
   self.script=None
  if tag in self.stack:self.stack.remove(tag)
 def handle_data(self,s):
  if self.script is not None:self.script+=s
  if 'title' in self.stack:self.title.append(s)
  if 'h1' in self.stack:self.h1.append(s)
  if not any(x in self.stack for x in ['script','style','title']):self.text.append(s)
class CaptureRedirect(urllib.request.HTTPRedirectHandler):
 def __init__(self): self.history=[]
 def redirect_request(self,req,fp,code,msg,headers,newurl):
  self.history.append({"from":req.full_url,"status":code,"to":newurl});return super().redirect_request(req,fp,code,msg,headers,newurl)
def get(path):
 url=BASE+path;redirect=CaptureRedirect();opener=urllib.request.build_opener(redirect)
 try:
  r=opener.open(urllib.request.Request(url,headers={'User-Agent':'PDFPilot-SEO-Audit/1.0 (owner-requested)','Accept-Encoding':'identity'}),timeout=30)
 except urllib.error.HTTPError as e:r=e
 body=r.read();headers=dict(r.headers);text=body.decode('utf-8',errors='replace')
 headers["Audit-Redirect-Chain"]=json.dumps(redirect.history);headers["Audit-Final-Status"]=r.status
 return redirect.history[0]["status"] if redirect.history else r.status,r.url,headers,text
repo=json.loads((OUT/'baseline/repository.json').read_text())
gsc=list(csv.DictReader((OUT/'baseline/gsc/Table.csv').open()))
chart=list(csv.DictReader((OUT/'baseline/gsc/Chart.csv').open()))
source={f.name:{'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'bytes':f.stat().st_size} for f in (OUT/'baseline/gsc').glob('*.csv')}
paths=set(repo['paths'])|{urllib.parse.urlparse(x['URL']).path for x in gsc}
for locale,localized in repo['corePaths'].items():
 if locale=='en':continue
 for key,slug in repo['corePaths']['en'].items():
  if slug and localized[key]!=slug:paths.add('/'+locale.lower()+'/'+slug)
sitemaps={};members=collections.defaultdict(list)
def sitemap(path):
 status,url,headers,body=get(path);sitemaps[path]={'status':status,'headers':headers,'body':body}
 if status!=200:return
 tree=ET.fromstring(body)
 for el in tree:
  loc=next((x.text for x in el if x.tag.endswith('}loc')),None)
  if not loc:continue
  p=urllib.parse.urlparse(loc).path
  if tree.tag.endswith('sitemapindex'):sitemap(p)
  else:paths.add(p);members[p].append(path)
for p in ['/sitemap.xml','/sitemaps/pseo.xml']:sitemap(p)
robots=get('/robots.txt')
folder=OUT/LABEL;folder.mkdir(parents=True,exist_ok=True)
(folder/'sitemaps.json').write_text(json.dumps(sitemaps,indent=2))
(folder/'robots.json').write_text(json.dumps({'status':robots[0],'headers':robots[2],'body':robots[3]},indent=2))
def crawl(path):
 for attempt in range(2):
  try:
   status,url,headers,body=get(path);p=Page();p.feed(body)
   text=' '.join(' '.join(p.text).split())
   return {'route':path,'status':status,'finalUrl':url,'redirectChain':json.loads(headers.get('Audit-Redirect-Chain','[]')),'finalStatus':headers.get('Audit-Final-Status'),'contentType':headers.get('Content-Type',headers.get('content-type')),'title':''.join(p.title),'description':p.meta.get('description'),'h1':p.h1,'canonical':p.canonical,'robots':p.meta.get('robots','index, follow (default)'),'xRobotsTag':headers.get('X-Robots-Tag'),'hreflang':p.hreflang,'lang':getattr(p,'lang',None),'links':sorted(p.links),'sitemaps':members[path],'jsonld':p.jsonld,'bodyText':text,'bodyTextSha256':hashlib.sha256(text.encode()).hexdigest(),'htmlBytes':len(body.encode()),'vercelId':headers.get('X-Vercel-Id'),'error':None}
  except Exception as e:
   if attempt: return {'route':path,'status':None,'error':str(e),'sitemaps':members[path]}
rows=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 for row in pool.map(crawl,sorted(paths)):
  rows.append(row)
  if len(rows)%100==0:print(f'{LABEL}: {len(rows)}/{len(paths)}',flush=True)
counts=collections.Counter()
for r in rows:
 for link in set(r.get('links',[])):
  parsed=urllib.parse.urlparse(urllib.parse.urljoin(BASE+r['route'],link))
  if parsed.netloc in [urllib.parse.urlparse(BASE).netloc,'pdfpilot.net']:counts[parsed.path]+=1
for r in rows:r['internalLinkSourceCount']=counts[r['route']]
(folder/'crawl.json.gz').write_bytes(gzip.compress(json.dumps(rows,ensure_ascii=False).encode(),mtime=0))
(folder/'summary.json').write_text(json.dumps({'date':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'base':BASE,'routes':len(rows),'statuses':dict(collections.Counter(str(x['status']) for x in rows)),'sitemapUrls':sum(bool(m) for m in members.values()),'gscSources':source,'gscSample':len(gsc),'chart':chart},indent=2))
print((folder/'summary.json').read_text())
