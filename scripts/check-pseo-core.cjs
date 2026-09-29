const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { chromium } = require(process.env.PDFPILOT_PLAYWRIGHT_MODULE || 'playwright');
const tools = require('../src/lib/pseo/capabilities.json');
const base = process.argv[2] || 'http://127.0.0.1:4368';
const out = process.argv[3] || 'docs/pseo/qa/core';
(async () => {
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.env.PDFPILOT_CHROME?{executablePath:process.env.PDFPILOT_CHROME}:{})});
 const context=await browser.newContext({viewport:{width:1366,height:900},reducedMotion:'reduce'});
 await context.route('https://**/*',r=>r.abort());
 const page=await context.newPage();const results=[],errors=[];
 page.on('pageerror',e=>errors.push({url:page.url(),message:e.message}));
 try {
  for(const tool of tools){
   const response=await page.goto(base+'/'+tool.canonicalSlug,{waitUntil:'networkidle'});
   assert.equal(response.status(),200,tool.toolId);
   assert.equal(await page.locator('h1').count(),1,tool.toolId);
   assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),'https://pdfpilot.net/'+tool.canonicalSlug);
   const picker=page.locator('input[type=file]').first();
   // HTML has a text/URL form instead of a file picker.
   assert.ok(tool.toolId==='html-to-pdf'||await picker.count()>0,tool.toolId);
   const controls=await page.locator('main button,main input,main select').evaluateAll(nodes=>nodes.map(n=>({tag:n.tagName,type:n.getAttribute('type'),label:n.getAttribute('aria-label'),text:n.textContent?.trim(),accept:n.getAttribute('accept')})));
   const shot=await page.screenshot({path:path.join(out,tool.toolId+'.png'),animations:'disabled'});
   results.push({tool:tool.toolId,h1:await page.locator('h1').innerText(),controls,sha256:crypto.createHash('sha256').update(shot).digest('hex')});
  }
  await fs.writeFile(path.join(out,'results.json'),JSON.stringify({results,errors},null,2));
  assert.deepEqual(errors,[]);
  console.log(`PASS: ${results.length} core routes, canonicals, headings, upload controls and screenshots`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
