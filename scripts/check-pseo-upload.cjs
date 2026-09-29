const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PDFPILOT_PLAYWRIGHT_MODULE||'playwright');
const tools=require('../src/lib/pseo/capabilities.json');
const base=process.argv[2]||'http://127.0.0.1:4368';const out=process.argv[3]||'docs/pseo/qa/uploads';
(async()=>{
 await fs.mkdir(out,{recursive:true});const fixture=path.resolve('docs/pseo/qa/functional');
 const PptxGenJS=require('pptxgenjs');const pptx=new PptxGenJS();pptx.addSlide().addText('PDFPilot QA',{x:1,y:1,w:5,h:1});const pptxFile=path.resolve(out,'fixture.pptx');await fs.writeFile(pptxFile,await pptx.write({outputType:'nodebuffer'}));
 const html=path.resolve(out,'fixture.html');await fs.writeFile(html,'<!doctype html><html><body><h1>PDFPilot HTML QA</h1><p>Local HTML document.</p></body></html>');
 const browser=await chromium.launch({headless:true,...(process.env.PDFPILOT_CHROME?{executablePath:process.env.PDFPILOT_CHROME}:{})});
 const context=await browser.newContext({viewport:{width:1366,height:900}});await context.route('https://**/*',r=>r.abort());const page=await context.newPage();page.setDefaultTimeout(20000);const checks=[],errors=[];
 page.on('pageerror',e=>errors.push({url:page.url(),message:e.message,stack:e.stack}));
 try{
  for(const tool of tools){
   await page.goto(base+'/'+tool.toolId,{waitUntil:'networkidle'});
   let file=path.join(fixture,'fixture.pdf');
   if(['jpg-to-pdf','scan-pdf'].includes(tool.toolId))file=path.join(fixture,'fixture.png');
   if(tool.toolId==='word-to-pdf')file=path.join(fixture,'fixture.docx');
   if(['excel-to-pdf','excel-to-xml'].includes(tool.toolId))file=path.join(fixture,'fixture.xlsx');
   if(tool.toolId==='powerpoint-to-pdf')file=pptxFile;
   if(tool.toolId==='html-to-pdf'){file=html;await page.getByRole('button',{name:'Add HTML',exact:true}).click();await page.getByRole('button',{name:'HTML file',exact:true}).click();}
   await page.locator('input[type=file]').first().setInputFiles(file);
   await page.getByText(path.basename(file),{exact:false}).first().waitFor();
   const buttons=await page.locator('main button').allTextContents();assert.ok(buttons.length>0);
   checks.push({tool:tool.toolId,uploaded:path.basename(file),controls:buttons.map(s=>s.trim()).filter(Boolean)});console.log('PASS upload',tool.toolId);
  }
 }finally{await fs.writeFile(path.join(out,'results.json'),JSON.stringify({checks,errors},null,2));await browser.close();}
 assert.equal(checks.length,26);assert.deepEqual(errors,[]);
})().catch(e=>{console.error(e);process.exitCode=1});
