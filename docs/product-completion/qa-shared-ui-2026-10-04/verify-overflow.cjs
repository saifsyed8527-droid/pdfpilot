const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PDFPILOT_PLAYWRIGHT_MODULE || '/Users/apple/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = process.env.PDFPILOT_QA_BASE || 'http://127.0.0.1:4401';
const out = path.join(__dirname, 'fixed');
(async () => {
  await fs.mkdir(out,{recursive:true});
  const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const report = [];
  try {
    const page = await browser.newPage({viewport:{width:768,height:960}});
    for (const slug of ['merge-pdf','split-pdf']) {
      await page.goto(`${base}/${slug}`,{waitUntil:'domcontentloaded',timeout:120000});
      await page.locator('.pdf-tool-landing').waitFor({timeout:120000});
      await page.locator('input[type=file]').first().setInputFiles({name:'annualreport'.repeat(18)+'.pdf',mimeType:'application/pdf',buffer:await fs.readFile(path.join(__dirname,'fixtures','alpha.pdf'))});
      await page.locator('.pdf-tool-landing').waitFor({state:'detached'});
      for (const width of [375,768,1440]) for (const theme of ['light','dark']) {
        await page.setViewportSize({width,height:960});
        await page.evaluate(dark=>document.documentElement.classList.toggle('dark',dark),theme==='dark');
        if(slug==='merge-pdf') {
          const add=page.getByRole('button',{name:'Add more PDFs',exact:true});
          await add.hover();
          await add.focus();
        }
        await page.screenshot({path:path.join(out,`${slug}-${width}-${theme}.png`),fullPage:true});
        const metrics=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,focus:document.activeElement?.getAttribute('aria-label')}));
        report.push({slug,theme,...metrics});
        assert.ok(metrics.width<=width+1,`${slug} ${width} ${theme} overflowed to ${metrics.width}`);
      }
    }
    console.log('PASS: long filename and hovered/focused tooltip fit all 6 viewport/theme combinations for both routes.');
  } finally {await fs.writeFile(path.join(out,'report.json'),JSON.stringify({base,report},null,2));await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
