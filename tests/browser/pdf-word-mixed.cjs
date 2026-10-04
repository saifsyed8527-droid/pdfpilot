const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require(process.env.PDFPILOT_PLAYWRIGHT_MODULE||'playwright');
const {unzipSync,strFromU8}=require('fflate');
const base=process.env.PDFPILOT_QA_BASE||'http://127.0.0.1:4403';
const out=process.env.PDFPILOT_QA_OUTPUT||'/tmp/pdfpilot-c-mixed-browser';
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.PDFPILOT_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(/google-analytics|googletagmanager|clarity\.ms/,r=>r.abort());
  await page.goto(base+'/pdf-to-word',{waitUntil:'domcontentloaded',timeout:120000});
  await page.locator('input[type=file]').setInputFiles(path.resolve('docs/qa/2026-10-04-mixed-pdf-word/mixed-input.pdf'));
  await page.getByRole('button',{name:/No OCR Fast conversion/}).click();
  await page.getByRole('button',{name:'Convert to WORD',exact:true}).click();
  await page.locator('aside [role=alert]').filter({hasText:'No selectable text on page 2.'}).waitFor({timeout:60000});
  await page.screenshot({path:path.join(out,'no-ocr-error.png'),fullPage:true});
  await page.getByRole('button',{name:/Auto Recommended/}).click();
  const downloadPromise=page.waitForEvent('download',{timeout:180000});
  await page.getByRole('button',{name:'Convert to WORD',exact:true}).click();
  await page.getByRole('button',{name:'Cancel',exact:true}).waitFor({timeout:60000});
  await page.screenshot({path:path.join(out,'processing.png'),fullPage:true});
  const download=await downloadPromise;const output=path.join(out,'mixed-browser.docx');await download.saveAs(output);
  const entries=unzipSync(await fs.readFile(output));const xml=strFromU8(entries['word/document.xml']);
  await fs.writeFile(path.join(out,'document.xml'),xml);
  const cover=xml.indexOf('SELECTABLE COVER ALPHA'),middle=xml.indexOf('SCANNED ATTACHMENT BRAVO'),end=xml.indexOf('SELECTABLE END CHARLIE');
  assert.ok(cover>=0&&cover<middle&&middle<end,'every page retained in source order');
  assert.equal((xml.match(/w:type="page"/g)||[]).length,2);
  assert.ok(!Object.keys(entries).some(name=>name.startsWith('word/media/')),'editable text output, not page images');
  await page.getByText('Your file is ready',{exact:false}).first().waitFor();
  for(const width of [375,768,1440]){
   await page.setViewportSize({width,height:1000});
   const button=page.getByRole('button',{name:width===768?'Switch to dark mode':'Switch to light mode',exact:true});if(await button.count())await button.click();
   await page.screenshot({path:path.join(out,`result-${width}.png`),fullPage:true});
  }
  await page.getByRole('button',{name:/Start Over|Start over/}).click();await page.locator('input[type=file]').waitFor({state:'attached'});
  assert.deepEqual(errors,[]);
  const result={output,selectableCover:true,recognizedMiddle:true,selectableEnd:true,order:true,pageBreaks:2,editable:true,noOcrError:true,reset:true,errors};
  await fs.writeFile(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
