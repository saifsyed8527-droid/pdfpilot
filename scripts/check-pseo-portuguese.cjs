const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PDFPILOT_PLAYWRIGHT_MODULE||'playwright');
const copy=require('../src/lib/content/pt-br-tool-help.json');
const {load}=require('./load-pseo-modules.cjs');
const {CORE_PAGE_PATHS}=load('src/lib/i18n/core-content.ts');
const localizedToolPath=slug=>'/pt-br/'+(Object.entries(CORE_PAGE_PATHS.en).find(([,s])=>s===slug)?.[0]?CORE_PAGE_PATHS['pt-BR'][Object.entries(CORE_PAGE_PATHS.en).find(([,s])=>s===slug)[0]]:slug);
const base=process.argv[2]||'http://127.0.0.1:4368',out=process.argv[3]||'docs/pseo/qa/br-locales';
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.env.PDFPILOT_CHROME?{executablePath:process.env.PDFPILOT_CHROME}:{})});
 const context=await browser.newContext({viewport:{width:1366,height:900},reducedMotion:'reduce'});
 await context.route('https://**/*',r=>r.abort());const page=await context.newPage(),checks=[],errors=[];
 page.on('pageerror',e=>errors.push({url:page.url(),message:e.message}));
 try{
  for(const [tool,help] of Object.entries(copy)){
   const route=localizedToolPath(tool,'pt-BR');const response=await page.goto(base+route,{waitUntil:'networkidle'});
   assert.equal(response.status(),200,route);assert.equal(await page.locator('h1').count(),1,route);
   assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),'https://pdfpilot.net'+route);
   assert.ok(!((await page.locator('meta[name=robots]').count())?await page.locator('meta[name=robots]').getAttribute('content'):'index, follow').includes('noindex'),route);
   assert.equal(await page.locator('link[hreflang=en]').getAttribute('href'),'https://pdfpilot.net/'+tool);
   const html=await (await context.request.get(base+route)).text();
   for(const text of [help.description,help.guidance,help.limitation,...help.steps])assert.ok(html.includes(text.replaceAll('&','&amp;')),route+' server copy');
   const snapshots=[];
   for(const width of [390,768,1366])for(const theme of ['light','dark']){
    await page.setViewportSize({width,height:900});
    const toggle=page.getByRole('button',{name:theme==='dark'?'Switch to dark mode':'Switch to light mode',exact:true});if(await toggle.count())await toggle.click();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route+' overflow '+width);
    assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('dark')),theme==='dark');
    await page.screenshot({path:path.join(out,`${tool}-${width}-${theme}.png`),animations:'disabled'});snapshots.push({width,theme});
   }
   if(tool!=='html-to-pdf'){
    const type=['jpg-to-pdf','scan-pdf'].includes(tool)?'png':tool==='word-to-pdf'?'docx':tool==='excel-to-pdf'?'xlsx':tool==='powerpoint-to-pdf'?'pptx':'pdf';
    const fixture=path.resolve(type==='pptx'?'docs/pseo/qa/br-uploads/fixture.pptx':`docs/pseo/qa/functional/fixture.${type}`);
    await page.locator('input[type=file]').first().setInputFiles(fixture);await page.getByText(path.basename(fixture),{exact:false}).first().waitFor();
   }else assert.ok(await page.locator('main button').count()>0);
   checks.push({tool,route,serverRenderedCopy:true,upload:tool!=='html-to-pdf',snapshots});console.log('PASS Portuguese',tool);
  }
  assert.equal(checks.length,20);assert.deepEqual(errors,[]);
 }finally{await fs.writeFile(path.join(out,'results.json'),JSON.stringify({checks,errors},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
