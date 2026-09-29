const fs=require('node:fs/promises'),assert=require('node:assert/strict');
const {request}=require(process.env.PDFPILOT_PLAYWRIGHT_MODULE||'playwright');
const {load}=require('./load-pseo-modules.cjs');
const {getActiveLocales}=load('src/lib/i18n/locales.ts');
const {CORE_PAGE_PATHS}=load('src/lib/i18n/core-content.ts');
const approved=require('../src/lib/content/pseo-pages.json');
const base=process.argv[2]||'http://127.0.0.1:4368';
(async()=>{
 const context=await request.newContext();const checks=[];
 try{
  for(const locale of getActiveLocales().filter(l=>l.code!=='en')){
   for(const path of ['/'+locale.segment,'/'+locale.segment+'/'+CORE_PAGE_PATHS[locale.code].merge]){
    const response=await context.get(base+path);assert.equal(response.status(),200,path);const html=await response.text();assert.match(html,new RegExp('rel="canonical"[^>]*href="https://pdfpilot.net'+path+'"'));checks.push({path,status:200});
   }
  }
  for(const path of ['/not-a-real-pseo-task','/compress-pdf-to-100kb','/heic-to-pdf','/in/compress-pdf','/es/png-to-pdf','/sitemaps/pseo/missing.xml']){const status=(await context.get(base+path)).status();assert.equal(status,404,path);checks.push({path,status});}
  const sitemap=await (await context.get(base+'/sitemap.xml')).text();const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);assert.equal(new Set(urls).size,urls.length);
  assert.ok(urls.length>26);assert.ok(urls.every(u=>!u.includes('/pseo-preview/')));
  // Verify all existing sitemap destinations against the actual local production server.
  const queue=[...urls];const failures=[];await Promise.all(Array.from({length:6},async()=>{while(queue.length){const url=queue.shift();const path=new URL(url).pathname;const response=await context.get(base+path);if(response.status()!==200)failures.push({url,status:response.status()});}}));assert.deepEqual(failures,[]);
  const robots=await(await context.get(base+'/robots.txt')).text();assert.match(robots,/Sitemap: https:\/\/pdfpilot.net\/sitemap.xml/);assert.equal(robots.includes('/sitemaps/pseo.xml'),approved.length>0,'pSEO index announcement follows approved catalog');
  const index=await(await context.get(base+'/sitemaps/pseo.xml')).text();const chunkUrls=[...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);const taskUrls=[];
  for(const chunk of chunkUrls){const response=await context.get(base+new URL(chunk).pathname);assert.equal(response.status(),200);const xml=await response.text();taskUrls.push(...[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]));}
  assert.deepEqual(taskUrls.sort(),approved.map(p=>p.canonicalUrl).sort());for(const url of taskUrls){const response=await context.get(base+new URL(url).pathname);assert.equal(response.status(),200);const html=await response.text();assert.ok(html.includes('href="'+url+'"'));assert.ok(!html.includes('name="robots" content="noindex'));}
  const hub=await(await context.get(base+'/pdf-workflows')).text();for(const p of approved)assert.ok(hub.includes('href="/'+p.slug+'"'),'hub links '+p.slug);
  for(const tool of [...new Set(approved.map(p=>p.baseToolSlug))]){const html=await(await context.get(base+'/'+tool)).text();for(const p of approved.filter(p=>p.baseToolSlug===tool))assert.ok(html.includes('href="/'+p.slug+'"'),'parent links '+p.slug);}
  const csp=(await context.get(base+'/pdf-to-word')).headers()['content-security-policy'];const workerCsp=(await context.get(base+'/tesseract/worker.min.js')).headers()['content-security-policy'];assert.ok(!csp.includes("'wasm-unsafe-eval'"));assert.ok(!csp.includes("'unsafe-eval'"));assert.ok(workerCsp.includes("'wasm-unsafe-eval'"));assert.ok(!workerCsp.includes("'unsafe-eval'"));
  for(const p of require('../data/pseo/manifests/candidates.json').filter(p=>!p.indexable))assert.equal((await context.get(base+'/'+p.slug)).status(),404,'held/rejected '+p.slug);
  if(process.env.PSEO_QA_PREVIEW!=='1')for(const slug of ['png-to-pdf','pdf-to-word-scanned'])assert.equal((await context.get(base+'/pseo-preview/'+slug)).status(),404);
  const unknownQuery=await context.get(base+'/pdf-workflows?q=png');assert.match(await unknownQuery.text(),/name="robots" content="noindex, follow"/);
  await fs.mkdir('docs/pseo/qa/http',{recursive:true});await fs.writeFile('docs/pseo/qa/http/results.json',JSON.stringify({checks,sitemapUrls:urls.length,failures,pseoUrls:taskUrls,chunkUrls,internalLinksVerified:true,scopedWasmPolicyVerified:true,previewSwitch:process.env.PSEO_QA_PREVIEW==='1'},null,2));
  console.log(`PASS: ${taskUrls.length} approved pSEO URLs; ${checks.length} locale/404 checks; ${urls.length} unique sitemap URLs all return 200; no fixtures or rejected pages in sitemap.`);
 }finally{await context.dispose();}
})().catch(e=>{console.error(e);process.exitCode=1});
