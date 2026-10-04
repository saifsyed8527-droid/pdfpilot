// Independent QA: synthetic inputs; actual browser downloads; output assertions.
// Usage: PDFPILOT_PLAYWRIGHT_MODULE=/.../playwright node scripts/qa-reference-production-20261004.cjs [base] [out]
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PDFPILOT_PLAYWRIGHT_MODULE || 'playwright');
const { PDFDocument } = require('pdf-lib');
const { unzipSync } = require('fflate');
const { inspectPDF } = require('./qa-output-inspector-20261004.cjs');
const base=process.argv[2] || 'https://pdfpilot.net';
const out=path.resolve(process.argv[3] || 'docs/product-completion/qa-production-2026-10-04');
const fixtureRoot=process.env.PDFPILOT_FIXTURES || path.resolve(__dirname, '../tests/fixtures/product-qa');
const report={base,started:new Date().toISOString(),environment:'Isolated headless desktop Chromium; viewports emulated, not native devices',cases:[]};

async function main(){await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.PDFPILOT_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {for(const slug of (process.env.PDFPILOT_QA_TOOLS || 'merge-pdf,split-pdf,compress-pdf,powerpoint-to-pdf').split(',')) {
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});const page=await context.newPage();const record={slug,errors:[],httpErrors:[],screenshots:[],checks:[]};report.cases.push(record);page.on('pageerror',e=>record.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)record.httpErrors.push({status:r.status(),url:r.url()});});
 try {const response=await page.goto(base+'/'+slug,{waitUntil:'domcontentloaded',timeout:60000});record.response={status:response.status(),headers:await response.allHeaders()};await page.getByRole('button',{name:/Switch to (dark|light) mode/}).waitFor({timeout:60000});await page.locator('input[type=file]').first().waitFor({state:'attached'});
 const fixtures=slug==='merge-pdf'?['alpha.pdf','beta.pdf']:slug==='powerpoint-to-pdf'?['slides-simple.pptx']:['alpha.pdf'];
 await page.locator('input[type=file]').first().setInputFiles(fixtures.map(x=>path.join(fixtureRoot,x)));
 if(slug==='merge-pdf') {await page.getByRole('button',{name:'Merge 2 PDFs',exact:true}).waitFor();await page.getByRole('button',{name:'Rotate beta.pdf',exact:true}).click();record.checks.push('Rotate beta input 90 degrees');}
 if(slug==='split-pdf') {await page.getByRole('button',{name:'Fixed',exact:true}).click();record.checks.push('Fixed group size default one page');}
 const label=slug==='merge-pdf'?'Merge 2 PDFs':slug==='split-pdf'?'Split PDF':slug==='compress-pdf'?'Compress PDF':'Convert to PDF';
 const action=page.getByRole('button',{name:label,exact:true});await action.waitFor({timeout:60000});await page.waitForFunction((label)=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()===label&&!b.disabled),label,{timeout:60000});
 record.loadedText=(await page.locator('main').innerText());
 await page.screenshot({path:path.join(out,slug+'-loaded-1440.png'),fullPage:true});
 const downloadPromise=page.waitForEvent('download',{timeout:180000});await action.click();const download=await downloadPromise;const filename=download.suggestedFilename();const filepath=path.join(out,slug+'-'+filename);await download.saveAs(filepath);record.download=path.basename(filepath);record.resultText=await page.locator('main').innerText();
 if(slug==='split-pdf') {const entries=unzipSync(await fs.readFile(filepath));record.outputs=[];assert.equal(Object.keys(entries).length,2);let i=0;for(const [name,data] of Object.entries(entries)){const extracted=path.join(out,'split-'+name);await fs.writeFile(extracted,data);const info=await inspectPDF(extracted,out);assert.equal(info.pages,1);assert.match(info.text[0],i++===0?/ALPHA PAGE ONE/:/ALPHA PAGE TWO/);record.outputs.push({name,...info});}}
 else {record.output=await inspectPDF(filepath,out);if(slug==='merge-pdf'){assert.equal(record.output.pages,3);assert.deepEqual(record.output.text,['ALPHA PAGE ONE','ALPHA PAGE TWO','BETA PAGE ONE']);const doc=await PDFDocument.load(await fs.readFile(filepath));assert.equal(doc.getPage(2).getRotation().angle,90);}if(slug==='compress-pdf'){assert.equal(record.output.pages,2);assert.deepEqual(record.output.text,['ALPHA PAGE ONE','ALPHA PAGE TWO']);assert.deepEqual(await fs.readFile(filepath),await fs.readFile(path.join(fixtureRoot,'alpha.pdf')));assert.match(record.resultText,/original|already|0%/i);record.checks.push('Incompressible input is byte-identical; no fake savings');}if(slug==='powerpoint-to-pdf'){assert.equal(record.output.pages,2);assert.match(record.output.text[0],/PDFPilot Slide One/);assert.match(record.output.text[1],/PDFPilot Slide Two/);}}
 for(const width of [1440,768,375]){await page.setViewportSize({width,height:1000});const name=slug+'-result-'+width+'.png';await page.screenshot({path:path.join(out,name),fullPage:true});const overflow=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));record.screenshots.push({name,...overflow});assert.ok(overflow.scrollWidth<=width+1,'Result must not horizontally overflow');}
 await page.getByRole('button',{name:/^Start over$/i}).click();await page.locator('input[type=file]').first().waitFor({state:'attached'});record.checks.push('Result download, responsive result and reset completed');record.status='passed';console.log(slug,'PASS');
 }catch(e){record.status='failed';record.failure=e.message;record.failureText=await page.locator('body').innerText().catch(()=> '');await page.screenshot({path:path.join(out,slug+'-failure.png'),fullPage:true}).catch(()=>{});console.error(slug,'FAIL',e.message);}
 await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await context.close();
 }
}finally{await browser.close();report.finished=new Date().toISOString();await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));}
if(report.cases.some(x=>x.status!=='passed'))process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
