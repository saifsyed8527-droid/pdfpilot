"""Derived operating tables; existing importer, ledger and reviews remain authoritative."""
import json,csv,gzip,collections,unicodedata
from pathlib import Path
from urllib.parse import urlparse
R=Path(__file__).resolve().parent.parent;B=R/'docs/pseo/batches/2026-09-br';D=R/'docs/pseo/indexation/2026-09-29'
def read(p):return json.loads((R/p).read_text())
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def table(p,rows):
 with p.open('w') as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader()
  for r in rows:w.writerow({k:json.dumps(v,ensure_ascii=False) if isinstance(v,(list,dict)) else v for k,v in r.items()})
rows=[json.loads(x) for x in (R/'data/pseo/reports/keyword-to-page.jsonl').read_text().splitlines()]
caps=read('src/lib/pseo/capabilities.json');candidates=read('data/pseo/manifests/candidates.json');approved=[p for p in candidates if p['indexable']]
repo=read(D/'baseline/repository.json');pt=read('src/lib/content/pt-br-tool-help.json');copy=read('src/lib/content/core-search-copy.json')
after={p['route']:p for p in json.loads(gzip.decompress((D/'local-after/crawl.json.gz').read_bytes()))}
def evidence(group):
 queries=collections.defaultdict(list)
 for r in group:queries[r['normalizedKeyword']].append(r)
 out=[]
 for q,obs in queries.items():
  out.append({'query':q,'language':sorted(set(r['language'] for r in obs)),'volumeValues':sorted(set(r['searchVolume'] for r in obs if r['searchVolume'] is not None)),'kdValues':sorted(set(r['keywordDifficulty'] for r in obs if r['keywordDifficulty'] is not None)),'cpcValues':sorted(set(r['cpc'] for r in obs if r['cpc'] is not None)),'competitorPositions':sorted(set(str(r['raw'].get('Position')) for r in obs)),'rankingTrafficValues':sorted(set(str(r['raw'].get('Traffic')) for r in obs)),'rankingUrls':sorted(set(r['raw'].get('URL','') for r in obs)),'sourceObservationIds':[r['id'] for r in obs]})
 out.sort(key=lambda x:max(x['volumeValues'],default=-1),reverse=True)
 return {'observations':len(group),'uniqueQueries':len(queries),'largestSingleKeywordVolume':max([r['searchVolume'] for r in group if r['searchVolume'] is not None],default=None),'topQueries':out[:10]}
def ptpath(slug):
 key=next((k for k,v in repo['corePaths']['en'].items() if v==slug),None)
 return '/pt-br/'+(repo['corePaths']['pt-BR'][key] if key else slug)
core=[]
for cap in caps:
 tool=cap['toolId'];rs=[r for r in rows if r['intent'].get('toolId')==tool];p=after['/'+cap['canonicalSlug']]
 markets={m:evidence([r for r in rs if r['sourceMarket']==m and r['status'] in ['core_page','localized_core_page']]) for m in ['US','IN','BR']}
 supported_pt=[r for r in rs if r['sourceMarket']=='BR' and r['language']=='pt-BR' and r['intent']['family']=='core']
 children=[x for x in candidates if x['baseToolId']==tool]
 core.append({'tool':tool,'route':'/'+cap['canonicalSlug'],'priority':'P1 flagship' if tool in ['jpg-to-pdf','pdf-to-word','merge-pdf','compress-pdf','pdf-to-jpg','edit-pdf'] else 'P1 core','markets':markets,'queryFamilies':sorted(set(r['intent']['family'] for r in rs)),'currentTitle':p['title'],'currentDescription':p['description'],'canonical':p['canonical'],'status':p['status'],'robots':p['robots'],'indexWanted':bool(p['sitemaps']),'internalLinkSources':p['internalLinkSourceCount'],'portugueseRoute':ptpath(cap['canonicalSlug']),'portugueseState':'indexable reviewed main copy; partial English advanced controls' if tool in pt else 'noindex,follow; demand, capability or localization review required','portugueseDemand':evidence(supported_pt),'approvedChildren':[x['canonicalUrl'] for x in children if x['indexable']],'heldChildren':[{'url':x['canonicalUrl'],'reasons':x['rejectionReason']} for x in children if not x['indexable']],'productGaps':sorted(set(r['reason'] for r in rs if r['status']=='unsupported' or r['intent']['family']=='size')),'capabilityLimits':cap['limitations'],'privacyFacts':cap['privacyFacts']})
write(B/'core-tool-operating-table.json',core)
flat=[]
for c in core:
 d={k:v for k,v in c.items() if k not in ['markets','portugueseDemand']}
 for m,x in c['markets'].items():d[m+'_supported_observations']=x['observations'];d[m+'_top_queries']=x['topQueries'][:3];d[m+'_largest_single_keyword_volume']=x['largestSingleKeywordVolume']
 d['BR_pt_supported_observations']=c['portugueseDemand']['observations'];d['BR_pt_top_queries']=c['portugueseDemand']['topQueries'][:3];flat.append(d)
table(B/'core-tool-operating-table.csv',flat)
def querycell(m):
 if not m['topQueries']:return 'No validated observation in this export'
 q=m['topQueries'][0];return q['query']+' ('+'/'.join(str(v) for v in q['volumeValues'])+')'
md='# Three-market core tool operating table\n\n2026-09-29. US, IN and BR remain separate. Numbers are one keyword’s reported monthly volume, not summed demand or a forecast. Core-only supported assignments are used here; all related gaps and modifiers remain in the JSON/CSV. Missing observations mean no validated assignment in these competitor exports, not zero market demand.\n\n| Core route | US top supported query | IN top supported query | BR top supported query | pt-BR | Approved children |\n|---|---|---|---|---|---|\n'
for c in core:md+='| '+c['route']+' | '+' | '.join(querycell(c['markets'][m]) for m in ['US','IN','BR'])+' | '+('Indexable' if c['tool'] in pt else 'Hold')+' | '+str(len(c['approvedChildren']))+' |\n'
md+='\nEvery row’s current title, description, canonical, HTTP status, query variants, raw KD/CPC/position/traffic, source IDs, localization state, capability limits, approved/held children and gaps are in [the full CSV](core-tool-operating-table.csv) and [JSON](core-tool-operating-table.json). The 26 English pages have server-rendered help below unchanged tool workspaces. Prioritize the six flagship tools first; do not dilute them with synonym clones.\n'
(B/'CORE-TOOLS.md').write_text(md)
gaprows=[r for r in rows if r['status']=='unsupported' or r['intent']['family']=='size']
def gap(r):
 q=''.join(x for x in unicodedata.normalize('NFD',r['normalizedKeyword']) if not unicodedata.combining(x));reason=r['reason']
 if 'png to jpg' in q or 'png to jpeg' in q:return 'Other gaps / manual scope review'
 if r['intent']['family']=='size':return 'Target-size compression'
 if 'portuguese_ocr' in reason:return 'Portuguese OCR'
 if reason in ['unsupported_conversion:pdf:png']:return 'PDF to PNG'
 if reason=='unsupported_conversion:heic:pdf':return 'HEIC to PDF'
 if reason in ['unsupported_conversion:pdf:text','unsupported_conversion:pdf:txt']:return 'PDF text extraction'
 if reason in ['unsupported_conversion:text:pdf','unsupported_conversion:txt:pdf','unsupported_conversion:md:pdf']:return 'Text/Markdown to PDF'
 if any(x in reason for x in ['conversion:doc:pdf','conversion:ppt:pdf','conversion:xls:pdf','conversion:pdf:doc','conversion:pdf:ppt','conversion:pdf:xls']):return 'Legacy Office formats'
 if any(x in q for x in ['translat','traduz','tradut','traduc']):return 'Document translation'
 if any(x in q for x in ['unlock','desbloq','senha','password','encrypt']):return 'PDF protection/unlock'
 if 'pdf:epub' in reason:return 'PDF to EPUB'
 if 'pdf:xml' in reason:return 'PDF to XML'
 return 'Other gaps / manual scope review'
groups=collections.defaultdict(list)
for r in gaprows:groups[gap(r)].append(r)
effort={'PDF to PNG':('Relatively feasible','Reuse PDF rasterization, add PNG output and memory limits. Verify multipage archive naming, resolution and transparency.'),'HEIC to PDF':('Relatively feasible','Reuse existing non-public HEIC decoder only after browser memory and image-orientation QA; connect to the real PDF image pipeline.'),'PDF text extraction':('Relatively feasible','Expose text extraction already used by converters, with page order, Unicode and empty-scan detection; OCR language support remains separate.'),'Text/Markdown to PDF':('Moderate','Adapt supported HTML rendering with safe Markdown parsing, font coverage, pagination and offline asset handling.'),'Portuguese OCR':('Moderate','Add Portuguese language data, language selection, Unicode output and real Brazilian scans; benchmark accuracy and memory.'),'Target-size compression':('Major reliability work','Build iterative size targeting with explicit quality floors and a failure result when the target is unattainable; do not promise every file reaches an exact size.'),'Legacy Office formats':('Major engineering','Older binary DOC/PPT/XLS need format-specific parsers/renderers or a disclosed server conversion service. Validate whether each keyword means a literal binary format or colloquial Office export before investing.'),'Document translation':('Major product','Translation models, document layout, privacy, cost and quality assurance are separate product work; high demand is not current capability.'),'PDF protection/unlock':('Major security/compatibility work','Define supported authorized password workflows, encryption compatibility, malformed-file handling and key/privacy model before any public promise.'),'PDF to EPUB':('Major engineering','Reading order, reflow, headings, images and EPUB validation cannot be inferred from plain PDF extraction.'),'PDF to XML':('Research first','Clarify generic XML versus fiscal/invoice schema intent. A file extension alone does not identify the required schema.'),'Other gaps / manual scope review':('Research first','Includes unsupported or out-of-scope tasks. These are observations, not approved features or page opportunities.')}
gaps=[]
for name,rs in groups.items():gaps.append({'gap':name,'engineeringAssessment':effort[name][0],'implementationBoundary':effort[name][1],'markets':{m:evidence([r for r in rs if r['sourceMarket']==m]) for m in ['US','IN','BR']},'observations':len(rs),'reasons':sorted(set(r['reason'] for r in rs)),'implemented':False})
gaps.sort(key=lambda x:(['Relatively feasible','Moderate','Research first','Major reliability work','Major engineering','Major product','Major security/compatibility work'].index(x['engineeringAssessment']),x['gap']))
write(B/'product-gap-operating-table.json',gaps)
table(B/'product-gap-operating-table.csv',[{'gap':g['gap'],'engineeringAssessment':g['engineeringAssessment'],'implementationBoundary':g['implementationBoundary'],**{m:querycell(g['markets'][m]) for m in ['US','IN','BR']},'observations':g['observations']} for g in gaps])
md='# Product gaps: evidence and engineering decisions\n\nNo capability below was implemented in this SEO batch. Feasibility is an engineering assessment from existing code, not a delivery estimate. Exact raw market values and source-row IDs are in the JSON. No cross-country sums, synonym sums, global KD or opaque opportunity score are used.\n\n| Gap | Effort assessment | US strongest observed query | IN | BR |\n|---|---|---|---|---|\n'
for g in gaps:md+='| '+g['gap']+' | '+g['engineeringAssessment']+' | '+' | '.join(querycell(g['markets'][m]) for m in ['US','IN','BR'])+' |\n'
for g in gaps:md+='\n## '+g['gap']+'\n\n'+g['implementationBoundary']+'\n'
md+='\n## Recommended sequence\n\nFirst evaluate PDF-to-PNG, text extraction and HEIC-to-PDF against real files; they reuse more existing code. Portuguese OCR then unlocks a meaningful language constraint. Treat exact-size compression, legacy Office conversion and document translation as separate engineering projects with explicit acceptance criteria. Keep English scanned PDF-to-Word supported and unchanged. Do not interpret the BR query “pdf para xml” as an invoice converter without interviewing users and checking ranking URLs.\n'
(B/'PRODUCT-GAPS.md').write_text(md)
print({'rows':len(rows),'coreTools':len(core),'gapGroups':len(gaps),'gapObservations':len(gaprows)})
