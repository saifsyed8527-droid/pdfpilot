#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path');
const {load}=require('./load-pseo-modules.cjs');
const {CAPABILITIES,CAPABILITY_BY_ID}=load('src/lib/pseo/capabilities.ts');
const {classifyKeyword}=load('src/lib/pseo/classify.ts');
const {isLocaleIndexable}=load('src/lib/i18n/indexable-locales.ts');
const {portugueseIntent}=load('src/lib/pseo/portuguese.ts');
const {generatePortugueseCandidate,isPortugueseRecipe}=load('src/lib/pseo/portuguese-content.ts');
const {PDF_WORKFLOWS}=load('src/lib/content/pdf-workflows.ts');
const {generateCandidate,fingerprint}=load('src/lib/pseo/content.ts');
const {qualityIssues,catalogIssues}=load('src/lib/pseo/quality.ts');
const {pageSchema,reviewSchema}=load('src/lib/pseo/schema.ts');
const {importCsv,writeJson,digest,atomic}=require('./pseo-import.cjs');
const read=(f,fallback)=>fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):fallback;
function reservedSlugs(){
 return new Set([...fs.readdirSync('src/app').filter(s=>!s.startsWith('[')&&!s.startsWith('(')),...read('src/lib/tools-data.json',[]).map(t=>t.slug),'en','in','us','uk','de','es','fr','ar','hi','pt','ja','zh','ko','it','ru','nl','tr','id']);
}
function capabilityDrift(){
 return CAPABILITIES.flatMap(t=>t.evidence.flatMap(e=>!fs.existsSync(e.path)||digest(fs.readFileSync(e.path))!==e.sha256?[`${t.toolId}:${e.path}`]:[]));
}
/** Deployments receive reviewed manifests, but intentionally not raw keyword exports. */
function validateRuntime(root,output='src/lib/content/pseo-pages.json'){
 const manifest=read(output,[]).map(p=>pageSchema.parse(p));
 const candidates=read(path.join(root,'manifests/candidates.json'),[]).map(p=>pageSchema.parse(p));
 const reviews=Object.fromEntries(Object.entries(read(path.join(root,'manifests/reviews.json'),{})).map(([k,v])=>[k,reviewSchema.parse(v)]));
 const candidateBySignature=new Map(candidates.map(p=>[p.intentSignature,p]));
 const issues=catalogIssues(manifest);
 if(fingerprint(candidates.filter(p=>p.indexable))!==fingerprint(manifest))issues.push('approved_candidate_manifest_mismatch');
 for(const page of manifest){
  const candidate=candidateBySignature.get(page.intentSignature);
  if(!candidate||fingerprint(candidate)!==fingerprint(page))issues.push(`candidate_manifest_mismatch:${page.slug}`);
  const review=reviews[page.intentSignature];
  issues.push(...qualityIssues(page,reservedSlugs(),review).map(issue=>`${page.slug}:${issue}`));
  if(review?.evidence.some(p=>path.isAbsolute(p)||p.split(/[\\/]/).includes('..')||!fs.existsSync(p)))issues.push(`missing_review_evidence:${page.slug}`);
 }
 issues.push(...capabilityDrift().map(issue=>'capability_drift:'+issue));
 if(issues.length)throw new Error(issues.join('\n'));
 return {publicTools:CAPABILITIES.length,approvedPages:manifest.length};
}
function build(root,{emit=true}={}){
 const state=read(path.join(root,'manifests/state.json'),{version:1,sources:[]});
 for(const source of state.sources){
  if(digest(fs.readFileSync(path.join(root,source.rawPath)))!==source.sha256)throw new Error(`Raw source integrity failed: ${source.id}`);
  if(digest(fs.readFileSync(path.join(root,'normalized',source.id+'.jsonl')))!==source.normalizedSha256)throw new Error(`Normalized source integrity failed: ${source.id}`);
 }
 const reviews=Object.fromEntries(Object.entries(read(path.join(root,'manifests/reviews.json'),{})).map(([k,v])=>[k,reviewSchema.parse(v)]));
 const old=read(path.join(root,'manifests/candidates.json'),[]);const previous=new Map(old.map(p=>[p.intentSignature,p]));
 const rows=state.sources.flatMap(s=>fs.readFileSync(path.join(root,'normalized',s.id+'.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse));
 const groups=new Map(),ledger=[],seen=new Set();
 const collisions=[];
 for(const row of rows){
  const intent=row.language==='pt-BR'?portugueseIntent(row.keyword):classifyKeyword(row.keyword);
  if(row.language!=='en')intent.signature=row.language+':'+intent.signature;const duplicateKey=row.language+':'+row.normalizedKeyword;const duplicate=seen.has(duplicateKey);seen.add(duplicateKey);
  const entry={...row,intent,duplicate,status:'review_required',reason:intent.reason,canonicalUrl:null};
  if(row.warnings.some(w=>w.startsWith('column_count:'))){entry.status='rejected';entry.reason='malformed_csv_row';}
  else if(row.language==='pt-BR'){entry.status=intent.family==='unsupported'||intent.family==='size'?'unsupported':intent.family==='irrelevant'?'irrelevant':intent.family==='core'?'localized_core_candidate':'localization_candidate';entry.reason=intent.reason;entry.proposedLocale='pt-BR';if(intent.family==='core'&&intent.toolId){entry.canonicalUrl='https://pdfpilot.net/pt-br/'+CAPABILITY_BY_ID.get(intent.toolId).canonicalSlug;if(isLocaleIndexable('/'+CAPABILITY_BY_ID.get(intent.toolId).canonicalSlug,'pt-BR'))entry.status='localized_core_page';}if(isPortugueseRecipe(intent)){entry.status='review_required';const group=groups.get(intent.signature)??{intent,rows:[]};group.rows.push(row);groups.set(intent.signature,group);}}
  else if(row.language!=='en'){entry.status='review_required';entry.reason='query_language_review';}
  else if(intent.family==='core'){entry.status='core_page';entry.canonicalUrl='https://pdfpilot.net/'+CAPABILITY_BY_ID.get(intent.toolId).canonicalSlug;}
  else if(['irrelevant','unsupported','informational','workflow'].includes(intent.family)){entry.status=intent.family==='irrelevant'?'irrelevant':intent.family==='unsupported'?'unsupported':'review_required';
   const workflow=intent.family==='workflow'&&!/\b\d+(?:\.\d+)?(?:kb|mb|gb)\b/.test(row.normalizedKeyword)?PDF_WORKFLOWS.find(w=>[...w.tools].sort().join('+')===intent.modifier):undefined;
   if(workflow){entry.status='existing_workflow_page';entry.reason='owned_by_existing_workflow';entry.canonicalUrl='https://pdfpilot.net/pdf-workflows/'+workflow.slug;}
  }
  else{const group=groups.get(intent.signature)??{intent,rows:[]};group.rows.push(row);groups.set(intent.signature,group);}
  ledger.push(entry);
 }
 const date=state.sources.map(s=>s.importedAt).sort().at(-1)??'2026-09-28';
 const candidates=[];const reserved=reservedSlugs();
 const drift=capabilityDrift();
 for(const group of [...groups.values()].sort((a,b)=>a.intent.signature.localeCompare(b.intent.signature))){
  const page=(group.rows[0].language==='pt-BR'?generatePortugueseCandidate:generateCandidate)(group.intent,group.rows,date,previous.get(group.intent.signature));if(!page)continue;
  const review=reviews[page.intentSignature];
  const issues=qualityIssues(page,reserved,review);
  if(drift.some(d=>d.startsWith(page.baseToolId+':')))issues.push('capability_source_changed');
  const evidence=review?.evidence??[];
  if(evidence.some(p=>path.isAbsolute(p)||p.split(/[\\/]/).includes('..')||!fs.existsSync(p)))issues.push('missing_review_evidence');
  if(previous.get(page.intentSignature)?.contentFingerprint!==page.contentFingerprint)page.updatedAt=date;
  page.indexable=issues.length===0;page.rejectionReason=issues;page.lastReviewed=review?.reviewedAt??null;
  page.qualityStatus=page.indexable?'approved':issues.every(i=>i==='editorial_review_required'||i==='platform_end_to_end_verification_required')?'validated':'rejected';
  candidates.push(page);
  if(group.rows.length>1)collisions.push({signature:page.intentSignature,owner:page.canonicalUrl,keywords:[...new Set(group.rows.map(r=>r.normalizedKeyword))],action:'merged_into_one_intent'});
 }
 const approved=candidates.filter(p=>p.indexable);
 for(const p of approved)p.relatedPages=approved.filter(x=>x.baseToolId===p.baseToolId&&x.language===p.language&&x.slug!==p.slug).sort((a,b)=>a.slug.localeCompare(b.slug)).slice(0,6).map(x=>x.slug);
 const errors=catalogIssues(approved);
 if(errors.length)throw new Error(`Catalog QA failed; existing runtime manifest was preserved:\n${errors.join('\n')}`);
 const bySignature=new Map(candidates.map(p=>[p.intentSignature,p]));
 for(const row of ledger){
  if(row.status!=='review_required')continue;
  const p=bySignature.get(row.intent.signature);if(!p)continue;
  row.status=p.indexable?'approved_page':'candidate';row.reason=p.rejectionReason.join('; ');row.canonicalUrl=p.canonicalUrl;
 }
 const countBy=fn=>{const result={};for(const row of ledger){const key=fn(row)??'unmapped';result[key]=(result[key]??0)+1;}return result;};
 const report={version:1,totalSourceRows:ledger.length,normalizedKeywords:seen.size,mappedToPublicTools:ledger.filter(r=>r.intent.toolId).length,unsupported:ledger.filter(r=>r.status==='unsupported'||r.reason.includes('not_supported')).length,irrelevant:ledger.filter(r=>r.status==='irrelevant').length,duplicates:ledger.filter(r=>r.duplicate).length,mergedIntoExistingIntent:[...groups.values()].reduce((n,g)=>n+Math.max(0,g.rows.length-1),0),corePageKeywords:ledger.filter(r=>r.status==='core_page').length,pseoCandidates:candidates.length,approvedPseoPages:approved.length,rejectedPseoPages:candidates.filter(p=>p.qualityStatus==='rejected').length,byTool:countBy(r=>r.intent.toolId),byModifierType:countBy(r=>r.intent.family),bySourceMarket:countBy(r=>r.sourceMarket),byLanguage:countBy(r=>r.language),cannibalizationConflicts:collisions,unsupportedFeatureRequests:ledger.filter(r=>r.status==='unsupported'||r.reason.includes('not_supported')).map(r=>({id:r.id,keyword:r.keyword,reason:r.reason})),finalGeneratedUrls:approved.map(p=>p.canonicalUrl),capabilityDrift:drift};
 if(emit){
  writeJson(path.join(root,'manifests/candidates.json'),candidates);
  writeJson(path.join(root,'reports/latest.json'),report);
  atomic(path.join(root,'reports/keyword-to-page.jsonl'),ledger.map(r=>JSON.stringify(r)).join('\n')+(ledger.length?'\n':''));
  writeJson(path.join(root,'rejected/latest.json'),ledger.filter(r=>['unsupported','irrelevant','rejected'].includes(r.status)||r.status==='candidate'));
  const q=s=>'"'+String(s??'').replaceAll('"','""')+'"';
  atomic(path.join(root,'reports/keyword-to-page.csv'),['source_dataset,source_file,source_row,market,language,keyword,status,reason,canonical_url',...ledger.map(r=>[r.sourceDataset,r.sourceFile,r.sourceRowId,r.sourceMarket,r.language,r.keyword,r.status,r.reason,r.canonicalUrl].map(q).join(','))].join('\n')+'\n');
 }
 return {approved,candidates,ledger,report};
}
function main(argv){
 const [command,...args]=argv;const options={};const positional=[];
 for(let i=0;i<args.length;i++){if(args[i].startsWith('--')){const key=args[i].slice(2);if(!args[i+1]||args[i+1].startsWith('--'))throw new Error(`Missing value for --${key}`);options[key]=args[++i];}else positional.push(args[i]);}
 const root=path.resolve(options.data||'data/pseo');
 if(command==='refresh-languages'){console.log(require('./pseo-import.cjs').refreshLanguages(root));build(root);}
 else if(command==='import'){const file=positional[0];if(!file)throw new Error('pseo import <file.csv> --market IN --language en');const result=importCsv(file,root,options);const state=build(root);console.log(JSON.stringify({import:result,...state.report},null,2));}
 else if(command==='review-template'){
  const [slug,file]=positional;const page=build(root).candidates.find(p=>p.slug===slug);
  if(!page||!file)throw new Error('pseo review-template <candidate-slug> <output.json>');
  if(fs.existsSync(file))throw new Error('Review template file already exists; it was not overwritten.');
  writeJson(file,{status:'approved',reviewer:'',reviewedAt:new Date().toISOString().slice(0,10),contentFingerprint:page.contentFingerprint,capabilityFingerprint:fingerprint(CAPABILITY_BY_ID.get(page.baseToolId)),distinctUtility:'',evidence:[],...(['device','platform'].includes(page.pageType)?{verifiedPlatform:page.modifierValue}:{})});
  console.log(`Review template written to ${file}. Complete reviewer, distinctUtility and actual QA evidence before recording it.`);
 }else if(command==='build'){const result=build(root);const output=options.output||'src/lib/content/pseo-pages.json';writeJson(output,result.approved);console.log(JSON.stringify({manifest:output,pages:result.approved.length},null,2));}
 else if(command==='validate'){
  const result=build(root,{emit:false});const manifest=read(options.output||'src/lib/content/pseo-pages.json',[]).map(p=>pageSchema.parse(p));
  const issues=catalogIssues(manifest);if(fingerprint(manifest)!==fingerprint(result.approved))issues.push('runtime_manifest_out_of_date: run npm run pseo -- build');
  if(result.report.capabilityDrift.length)issues.push(...result.report.capabilityDrift.map(s=>'capability_drift:'+s));
  if(issues.length)throw new Error(issues.join('\n'));console.log(`PASS: ${CAPABILITIES.length} public tools; ${manifest.length} indexable pSEO pages; all catalog checks passed.`);
 }else if(command==='validate-runtime'){
  const result=validateRuntime(root,options.output||'src/lib/content/pseo-pages.json');
  console.log(`PASS: ${result.publicTools} public tools; ${result.approvedPages} reviewed pSEO pages; runtime manifest and capability evidence match.`);
 }else if(command==='report'){const result=build(root);require('./pseo-research.cjs').writeResearchReports(root,result,CAPABILITIES);console.log(JSON.stringify(result.report,null,2));}
 else if(command==='review'){
  const [slug,file]=positional;if(!slug||!file)throw new Error('pseo review <candidate-slug> <review.json>');
  const candidates=build(root).candidates;const page=candidates.find(p=>p.slug===slug);if(!page)throw new Error('Unknown candidate');
  const review=reviewSchema.parse(read(file,null));const problems=qualityIssues(page,reservedSlugs(),review);
  if(review.status==='approved'&&problems.length)throw new Error(problems.join('\n'));
  if(review.evidence.some(p=>path.isAbsolute(p)||p.split(/[\\/]/).includes('..')||!fs.existsSync(p)))throw new Error('Evidence must name existing repository-relative files');
  const reviews=read(path.join(root,'manifests/reviews.json'),{});reviews[page.intentSignature]=review;writeJson(path.join(root,'manifests/reviews.json'),reviews);build(root);console.log(`Recorded ${review.status} review for ${slug}; run build to update the local manifest.`);
 }else throw new Error('Commands: import, validate, validate-runtime, build, report, review-template, review. See docs/pseo/README.md.');
}
module.exports={build,capabilityDrift,reservedSlugs,validateRuntime,main};
if(require.main===module){
 const args=process.argv.slice(2);const dataIndex=args.indexOf('--data');const root=path.resolve(dataIndex>=0?args[dataIndex+1]:'data/pseo');const lock=path.join(root,'.lock');let locked=false;
 try{fs.mkdirSync(root,{recursive:true});fs.mkdirSync(lock);locked=true;fs.writeFileSync(path.join(lock,'owner.json'),JSON.stringify({pid:process.pid,command:args[0]}));main(args);}
 catch(error){console.error(error.code==='EEXIST'&&!locked?'Another pSEO command holds the data lock. Wait for it to finish; see the recovery instructions if it exited.':error.message);process.exitCode=1;}
 finally{if(locked)fs.rmSync(lock,{recursive:true,force:true});}
}
