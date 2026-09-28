const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PDFPILOT_PLAYWRIGHT_MODULE || 'playwright');
const { PDFDocument } = require('pdf-lib');
const base = process.argv[2] || 'http://127.0.0.1:3118';
const source = process.argv[3] || 'https://phaelora.in/';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw new Error('Use a local preview');
(async () => {
  const out = await fs.mkdtemp('/tmp/pdfpilot-html-qa-');
  console.log('OUTPUT', out);
  const browser = await chromium.launch({headless:true, executablePath:process.env.PDFPILOT_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) console.log('HTTP_ERROR', r.status(), r.url().slice(0,180)); });
    await page.goto(base+'/html-to-pdf');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button',{name:'Add HTML',exact:true}).click();
    if (source.startsWith('https:')) {
      await page.locator('#html-url').fill(source);
      await page.getByRole('button',{name:'Add',exact:true}).click();
    } else {
      await page.getByRole('button',{name:'HTML file',exact:true}).click();
      await page.locator('input[type=file]').setInputFiles(source);
    }
    const convert = page.getByRole('button',{name:'Convert to PDF',exact:true});
    await convert.waitFor({timeout:60000});
    await page.waitForFunction(() => {const f=document.querySelector('iframe[title="HTML preview"]'); return f?.contentDocument?.readyState==='complete';},null,{timeout:60000});
    const frame = page.frames().find(f => f.parentFrame());
    await frame.evaluate(() => document.fonts.ready);
    console.log('SOURCE', await frame.evaluate(() => ({width:innerWidth,height:innerHeight,scrollHeight:document.documentElement.scrollHeight,images:document.images.length,broken:Array.from(document.images).filter(i=>!i.naturalWidth&&i.getClientRects().length).map(i=>i.src),headings:Array.from(document.querySelectorAll('h1,h2')).map(x=>x.textContent.trim())})));
    await page.screenshot({path:path.join(out,'preview.png'),fullPage:true});
    const before = await frame.evaluate(() => ({width:innerWidth,height:innerHeight,documentHeight:document.documentElement.scrollHeight}));
    const downloadPromise = page.waitForEvent('download',{timeout:180000});
    await convert.click();
    const download = await downloadPromise.catch(async error => {console.log('FAILURE_UI',await page.locator('body').innerText());throw error;});
    await download.saveAs(path.join(out,'corrected.pdf'));
    const pdf=await PDFDocument.load(await fs.readFile(path.join(out,'corrected.pdf')));
    console.log('PDF',pdf.getPages().map(p=>({width:p.getWidth(),height:p.getHeight(),links:p.node.Annots()?.size()||0})), 'ERRORS',errors);
    assert.equal(pdf.getPageCount(),1);
    assert.ok(Math.abs(pdf.getPage(0).getHeight()-before.documentHeight*595/before.width)<1,'export retains preview document aspect ratio');
    assert.equal(errors.length,0);
  } finally {await browser.close();}
})().catch(error => {console.error(error);process.exitCode=1;});
