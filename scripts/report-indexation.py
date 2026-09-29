"""Compare saved public baseline with the tested local build; never infer Google indexing."""
import csv, json, gzip, collections, hashlib
from pathlib import Path
from urllib.parse import urlparse
R=Path(__file__).resolve().parent.parent
D=R/'docs/pseo/indexation/2026-09-29'
B=R/'docs/pseo/batches/2026-09-br'
def read(p): return json.loads((R/p).read_text())
def write(p,v): p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def table(p,rows):
 if not rows:return
 with p.open('w') as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader()
  for row in rows:w.writerow({k:json.dumps(v,ensure_ascii=False) if isinstance(v,(dict,list)) else v for k,v in row.items()})
def crawl(label):return json.loads(gzip.decompress((D/label/'crawl.json.gz').read_bytes()))
before=crawl('live-before');after=crawl('local-after');by={r['route']:r for r in after}
repo=read(D/'baseline/repository.json');core={t['path']:t for t in repo['tools']};all_tools={t['path']:t for t in repo['allTools']}
pages=read('src/lib/content/pseo-pages.json');pseo={urlparse(p['canonicalUrl']).path:p for p in pages}
entities={e['path']:e for e in read(D/'baseline/content-entities.json')}
holds=read('src/lib/content/search-holds.json');pt=read('src/lib/content/pt-br-tool-help.json')
def parts(route):
 seg=route.split('/')[1];locale=next((l for l in repo['corePaths'] if l.lower()==seg.lower()),'en')
 if locale=='en':return locale,route
 slug='/'.join(route.split('/')[2:]);key=next((k for k,v in repo['corePaths'][locale].items() if v==slug),None)
 return locale,'/'+(repo['corePaths']['en'][key] if key else slug)
def family(route):
 if route in pseo:return 'pseo-'+pseo[route]['language']
 locale,base=parts(route)
 if locale!='en':return 'pt-br' if locale=='pt-BR' else 'other-locales'
 if route in core or route in ['/','/about','/privacy','/terms']:return 'core'
 if route.startswith(('/templates','/pdf-workflows')):return 'workflows-templates'
 return 'resources'
def indexable(r):return r['status']==200 and urlparse(r.get('finalUrl',r['route'])).path.rstrip('/')==r['route'].rstrip('/') and 'noindex' not in (r.get('robots','')+' '+str(r.get('xRobotsTag',''))).lower()
def metric(rows):
 wanted=[r for r in rows if r.get('sitemaps')];idx=[r for r in rows if indexable(r)]
 broken=[r['route'] for r in wanted if r['status']!=200 or len(r.get('canonical',[]))!=1 or urlparse(r['canonical'][0]).path.rstrip('/')!=r['route'].rstrip('/') or not indexable(r)]
 hreflang=[];mapped={r['route']:r for r in rows}
 for r in wanted:
  for lang,u in r.get('hreflang',{}).items():
   target=mapped.get(urlparse(u).path or '/')
   if not target or not indexable(target):hreflang.append({'source':r['route'],'target':u,'issue':'missing_or_nonindexable'})
   elif not any(urlparse(x).path.rstrip('/')==r['route'].rstrip('/') for x in target.get('hreflang',{}).values()):hreflang.append({'source':r['route'],'target':u,'issue':'not_reciprocal'})
 return {'auditedRoutes':len(rows),'httpStatus':dict(collections.Counter(str(r['status']) for r in rows)),'sitemapUrls':len(wanted),'httpIndexable':len(idx),'indexableOutsideSitemap':[r['route'] for r in idx if not r.get('sitemaps')],'localeIndexable':sum(parts(r['route'])[0]!='en' for r in idx),'sitemapCanonicalOrRobotsErrors':broken,'hreflangErrors':hreflang,'sitemapUrlsWithoutObservedInlinks':[r['route'] for r in wanted if not r.get('internalLinkSourceCount')],'metadataCoverageCore':sum(bool(r.get('title') and r.get('description') and r.get('h1')) for r in rows if r['route'] in core),'sitemapFamilies':dict(collections.Counter(family(r['route']) for r in wanted))}
inventory=[]
for r in after:
 route=r['route'];locale,base=parts(route);wanted=bool(r.get('sitemaps')) and indexable(r);p=pseo.get(route);e=entities.get(route)
 if base in all_tools and base not in core:purpose='Hidden registry tool; existing launch policy returns 404';works='Not public; not asserted working';useful='Review capability, impressions and backlinks before any future removal';action='EXISTING_404'
 elif r['status'] in [301,302,307,308]:purpose='Alias redirected to its existing equivalent';works='One-hop HTTP redirect';useful='One canonical destination';action='REDIRECT'
 elif r['status']!=200:purpose='Legacy or unavailable route';works='No public functionality at this URL';useful='Not an indexable destination';action='EXISTING_404'
 elif p:purpose='Reviewed distinct task: '+p['h1'];works='Parsed upload/process/download browser evidence';useful='Distinct task guidance and real tool; editorial gate passed';action='KEEP'
 elif base in core:purpose='Public PDF tool';works='26 English upload checks; representative parsed conversions; Portuguese upload checks where approved';useful='Reviewed SSR help and accurate capability limits' if wanted else 'Incomplete language coverage or Portuguese demand/capability not validated';action='KEEP' if wanted else 'NOINDEX'
 elif route in holds:purpose=e['title'] if e else 'Resource';works='Main advertised task depends on hidden tools';useful='Hold from search pending task restoration/review';action='NOINDEX'
 else:purpose=e['title'] if e else 'Public hub, resource or utility';works='HTTP and link checks; not every instructional claim or template manually executed';useful='Keep subject to per-route content review; no ranking guarantee';action='KEEP' if wanted else 'REVIEW'
 inventory.append({'route':route,'status':r['status'],'contentType':r.get('contentType'),'redirectChain':r.get('redirectChain',[]),'publicPurpose':purpose,'canonical':r.get('canonical',[]),'robots':r.get('robots'),'xRobotsTag':r.get('xRobotsTag'),'sitemapMembership':sorted(set(r.get('sitemaps',[]))),'locale':locale,'baseTool':base if base in all_tools else p['baseToolSlug'] if p else None,'internalLinkSourceCount':r.get('internalLinkSourceCount',0),'pseoOwner':p['canonicalUrl'] if p else None,'resourceOwner':route if e else None,'functionalityEvidence':works,'contentAssessment':useful,'indexWanted':wanted,'action':action,'family':family(route)})
write(D/'wanted-index-inventory.json',inventory);table(D/'wanted-index-inventory.csv',inventory)
gsc=[]
for old in read(D/'baseline/gsc-classification.json'):
 r=by[old['route']];inv=next(i for i in inventory if i['route']==r['route'])
 if inv['baseTool'] in all_tools and inv['baseTool'] not in core:c='E. Non-public / hidden tool'
 elif inv['locale']!='en':c='D. Valid localized page' if inv['indexWanted'] else 'G. Thin or duplicate locale page'
 elif r['route'] in core:c='A. Current approved core tool'
 elif r['route'] in pseo:c='B. Approved pSEO page'
 elif r['route'].startswith('/compare'):c='I. Comparison/resource page'
 elif r['route'] in entities:c='C. Valid resource/content page' if inv['indexWanted'] else 'I. Comparison/resource page'
 elif r['status']!=200:c='F. Legacy route'
 else:c='J. Unknown'
 gsc.append({**old,'baselineClassification':old['classification'],'classification':c,'afterStatus':r['status'],'afterRobots':r.get('robots'),'afterCanonical':r.get('canonical'),'afterSitemaps':sorted(set(r.get('sitemaps',[]))),'indexWanted':inv['indexWanted'],'afterInternalLinkSourceCount':r.get('internalLinkSourceCount',0),'action':inv['action']})
write(D/'gsc-classification.json',gsc);table(D/'gsc-classification.csv',gsc)
registry=[]
for route,t in all_tools.items():
 seen=[r for r in inventory if r['baseTool']==route]
 registry.append({'route':route,'name':t['name'],'publicLaunch':route in core,'englishStatus':by.get(route,{}).get('status'),'indexWanted':route in core,'observedLocalizedUrls':sum(r['locale']!='en' for r in seen),'observedSitemapEntries':sum(r['indexWanted'] for r in seen),'action':'KEEP_PUBLIC' if route in core else 'REVIEW_BEFORE_RESTORE_OR_REMOVE','evidence':'Current 26-tool launch and HTTP checks' if route in core else 'Existing September 25 middleware 404; backlinks/impressions unavailable; underlying code retained'})
table(D/'registry-99.csv',registry)
prune=[]
for r in before:
 route=r['route']
 if not r.get('sitemaps') or parts(route)[0]!='en' or route in core or route in pseo or route in ['/','/about','/privacy','/terms']:continue
 e=entities.get(route,{});hidden=[x['id'][5:] for x in e.get('related',[]) if x['type']=='tool' and '/'+x['id'][5:] not in core]
 if route in holds:action='NOINDEX';why=holds[route];target=None
 elif route=='/compare/merge-pdf-vs-combine-pdf':action='MERGE';why='Merge and combine are one core task. Fold synonym explanation into core help after checking URL-level clicks and referring links.';target='/merge-pdf'
 elif hidden and e.get('type') not in ['learning-resource']:action='REVIEW';why='Mixed public/hidden tool references; verify useful independent explanation and replace unsupported instructions.';target=None
 elif e.get('type') in ['guide','help','use-case','industry','category']:action='IMPROVE';why='Preserve URL; add exact output examples and contextual links; verify independent informational intent against GSC queries.';target=None
 else:action='KEEP';why='Distinct format explanation, working template/workflow or useful navigation; monitor indexing and qualified usage.';target=None
 prune.append({'route':route,'family':e.get('type',family(route)),'proposedAction':action,'implemented':'noindex,follow; removed from sitemap' if route in holds else 'URL retained','reason':why,'mergeTarget':target,'hiddenReferences':hidden,'beforeStatus':r['status'],'beforeInlinks':r.get('internalLinkSourceCount'),'afterIndexWanted':bool(by.get(route,{}).get('sitemaps')),'linkEquityEvidence':'No URL-level backlink or GSC performance export supplied'})
table(D/'content-pruning.csv',prune)
metrics={'before':metric(before),'after':metric(after),'gsc':{'affectedTotal':1219,'exported':1000,'unseen':219,'wantedInSample':sum(r['indexWanted'] for r in gsc),'classificationCounts':dict(collections.Counter(r['classification'] for r in gsc)),'sampleActions':dict(collections.Counter(r['action'] for r in gsc))},'contentActions':{x:sum(r['proposedAction']==x for r in prune) for x in ['KEEP','IMPROVE','MERGE','NOINDEX','REMOVE','REDIRECT','REVIEW']},'googleRecrawled':None,'googleIndexedAfter':None}
write(D/'comparison.json',metrics)
protected=read(B/'protected-source-before.json');changed=[p for p,sha in protected.items() if hashlib.sha256((R/p).read_bytes()).hexdigest()!=sha]
write(B/'evidence/protected-source-check.json',{'filesChecked':len(protected),'changedFiles':changed,'processingFlowsChanged':bool(changed)})
assert not changed,changed
assert not metrics['after']['sitemapCanonicalOrRobotsErrors'],metrics['after']['sitemapCanonicalOrRobotsErrors']
assert not metrics['after']['hreflangErrors'],metrics['after']['hreflangErrors']
assert metrics['after']['metadataCoverageCore']==26
print(json.dumps(metrics,ensure_ascii=False,indent=2))

assert not metrics['after']['indexableOutsideSitemap'],metrics['after']['indexableOutsideSitemap']
for route in holds:assert 'noindex' in by[route]['robots'],route
for r in after:
 if r.get('redirectChain'):assert len(r['redirectChain'])==1,r['route']

for r in after:
 if r.get('sitemaps'):
  assert len(r.get('h1',[]))==1,r['route']
  assert not any(isinstance(j,dict) and 'INVALID_JSON' in j for j in r.get('jsonld',[])),r['route']
assert not metrics['after']['sitemapUrlsWithoutObservedInlinks']
