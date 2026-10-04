const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PDFPILOT_PLAYWRIGHT_MODULE || 'playwright');
const { PDFDocument } = require('pdf-lib');
const { unzipSync, strFromU8 } = require('fflate');
const base = process.env.PDFPILOT_QA_BASE || 'http://127.0.0.1:4403';
const fixtures = process.env.PDFPILOT_QA_FIXTURES;
const out = process.env.PDFPILOT_QA_OUTPUT || '/tmp/pdfpilot-c-input-errors';
if (!fixtures) throw new Error('Set PDFPILOT_QA_FIXTURES to the synthetic fixture directory.');
const cases = [
  ['pdf-to-word','alpha-password.pdf','alpha.pdf','Convert to WORD','.docx'],
  ['pdf-to-powerpoint','alpha-password.pdf','alpha.pdf','Convert to PPTX','.pptx'],
  ['word-to-pdf','invalid.docx','office-simple.docx','Convert to PDF','.pdf'],
  ['powerpoint-to-pdf','invalid.pptx','slides-simple.pptx','Convert to PDF','.pdf'],
];
(async () => {
  await fs.mkdir(out,{recursive:true});
  const browser = await chromium.launch({headless:true, executablePath:process.env.PDFPILOT_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const results=[];
  try {
    for (const [slug, invalid, valid, action, suffix] of cases.filter(c=>!process.env.PDFPILOT_QA_SLUGS||process.env.PDFPILOT_QA_SLUGS.split(',').includes(c[0]))) {
      const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      // No third-party analytics requests are required for this synthetic local QA.
      await page.route(/google-analytics|googletagmanager|clarity\.ms/,r=>r.abort());
      await page.goto(`${base}/${slug}`,{waitUntil:'networkidle',timeout:120000});
      await page.screenshot({path:path.join(out,`${slug}-initial.png`),fullPage:true});
      await page.locator('input[type=file]').setInputFiles(path.join(fixtures,invalid));
      const expected=invalid.endsWith('.pdf')?'This PDF is password-protected. Remove the password and try again.':`This is not a readable ${invalid.endsWith('.docx')?'DOCX':'PPTX'} file.`;
      if (invalid.endsWith('.pdf')) await page.getByText('Preview unavailable',{exact:false}).first().waitFor();
      await page.getByRole('button',{name:action,exact:true}).click();
      await page.locator('aside [role=alert]').filter({hasText:expected}).waitFor();
      assert.ok(!(await page.locator('body').innerText()).includes('Reading PDF…'));
      const widths=[];
      for (const width of [375,768,1440]) {
        await page.setViewportSize({width,height:1000});
        await page.emulateMedia({colorScheme:width===768?'dark':'light'});
        await page.waitForTimeout(300);
        await page.screenshot({path:path.join(out,`${slug}-error-${width}.png`),fullPage:true});
        const layout=await page.evaluate(()=>({innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,12).map(e=>({tag:e.tagName,classes:e.className,right:e.getBoundingClientRect().right,text:e.textContent.slice(0,80)}))}));
        if(layout.scrollWidth>width+1) console.warn('SHARED_UI_OVERFLOW',slug,JSON.stringify(layout));
        widths.push(layout);
      }
      if (!invalid.endsWith('.pdf')) await page.getByRole('button',{name:`Remove ${invalid}`,exact:true}).click();
      await page.locator('input[type=file]').setInputFiles(path.join(fixtures,valid));
      await page.getByText(valid,{exact:true}).first().waitFor();
      assert.equal(await page.locator('aside [role=alert]').count(),0,'replacement must clear inline error');
      await page.screenshot({path:path.join(out,`${slug}-loaded.png`),fullPage:true});
      const downloadPromise=page.waitForEvent('download',{timeout:180000});
      await page.getByRole('button',{name:action,exact:true}).click();
      const download=await downloadPromise;
      const target=path.join(out,`${slug}${suffix}`);await download.saveAs(target);
      await page.getByText('Your file is ready',{exact:false}).first().waitFor();
      await page.screenshot({path:path.join(out,`${slug}-result.png`),fullPage:true});
      const bytes=await fs.readFile(target);let inspection;
      if(suffix==='.docx') {
        const entries=unzipSync(bytes);const xml=strFromU8(entries['word/document.xml']);
        await fs.writeFile(path.join(out,`${slug}.xml`),xml);
        assert.match(xml,/ALPHA|Alpha/);assert.match(xml,/PAGE|Page/);
        assert.equal((xml.match(/w:type="page"/g)||[]).length,1);
        inspection={pageBreaks:1,editableText:true,xml:path.join(out,`${slug}.xml`)};
      } else if(suffix==='.pptx') {
        const entries=unzipSync(bytes);const slides=Object.keys(entries).filter(k=>/^ppt\/slides\/slide\d+\.xml$/.test(k)).sort();
        assert.equal(slides.length,2);const slideXml=slides.map(k=>strFromU8(entries[k]));
        assert.ok(slideXml.every(x=>x.includes('<p:pic>')),'each slide retains its page image');
        assert.ok(slideXml.every(x=>x.includes('<a:t>')),'each slide has text');
        for(let i=0;i<slides.length;i++)await fs.writeFile(path.join(out,`${slug}-${i+1}.xml`),slideXml[i]);
        inspection={slides:slides.length,pageImages:2,textLayers:2};
      } else {
        const pdf=await PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),slug==='powerpoint-to-pdf'?2:1);
        inspection={pages:pdf.getPageCount(),dimensions:pdf.getPages().map(p=>p.getSize())};
      }
      assert.deepEqual(errors,[],'no uncaught page errors');
      const reset=page.getByRole('button',{name:/Start Over|Start over|Convert more/i}).first();
      await reset.click();await page.locator('input[type=file]').waitFor({state:'attached'});
      results.push({slug,invalid,valid,expected,output:target,bytes:bytes.length,inspection,widths,errors,replacementCleared:true,reset:true});
      await page.close();
    }
    await fs.writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2));
    console.log(JSON.stringify(results,null,2));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
