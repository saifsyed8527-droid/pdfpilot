const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PDFPILOT_PLAYWRIGHT_MODULE || '/Users/apple/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { PDFDocument } = require('pdf-lib');

const base = process.env.PDFPILOT_QA_BASE || 'http://127.0.0.1:4401';
const out = path.join(__dirname, process.env.PDFPILOT_QA_LABEL || 'baseline');
const fixtures = path.join(__dirname, 'fixtures');
const only = process.argv[2];
const records = [];
const widths = [375, 768, 1440];

(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const slug of ['merge-pdf', 'split-pdf', 'compress-pdf', 'powerpoint-to-pdf'].filter(s => !only || s === only)) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, acceptDownloads: true, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const capture = async (state, sizes = widths, themes = ['light', 'dark']) => {
        for (const width of sizes) for (const theme of themes) {
          await page.setViewportSize({ width, height: 960 });
          await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), theme === 'dark');
          await page.screenshot({ path: path.join(out, `${slug}-${state}-${width}-${theme}.png`), fullPage: true });
          const metrics = await page.evaluate(() => ({
            viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth,
            processingStatus: [...document.querySelectorAll('[role=status]')].map(el => el.textContent).filter(text => /Merging|Splitting|Compressing|Converting|Reading|Preparing/.test(text || '')),
            headings: [...document.querySelectorAll('h1,h2')].map(el => el.textContent),
            buttons: [...document.querySelectorAll('button')].filter(el => el.getBoundingClientRect().height).map(el => ({ label: el.getAttribute('aria-label') || el.innerText, disabled: el.disabled, y: Math.round(el.getBoundingClientRect().y) })),
            overflow: [...document.querySelectorAll('main *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 12).map(el => ({ tag: el.tagName, text: el.textContent.slice(0, 150), class: el.className })),
          }));
          records.push({ slug, state, width, theme, ...metrics });
        }
      };
      try {
        await page.goto(`${base}/${slug}`, { waitUntil: 'networkidle' });
        await capture('initial');
        await page.setViewportSize({width:1440,height:960});
        const input = page.locator('input[type=file]').first();
        const files = slug === 'merge-pdf' ? ['alpha.pdf','beta.pdf'] : slug === 'powerpoint-to-pdf' ? ['slides-simple.pptx'] : ['alpha.pdf'];
        await input.setInputFiles(files.map(f => path.join(fixtures, f)));
        const action = page.getByRole('button', { name: slug === 'merge-pdf' ? 'Merge 2 PDFs' : slug === 'split-pdf' ? 'Split PDF' : slug === 'compress-pdf' ? 'Compress PDF' : 'Convert to PDF', exact: true });
        await action.waitFor({ state: 'visible' });
        await page.waitForFunction(() => [...document.querySelectorAll('button')].some(el => /^(Merge 2 PDFs|Split PDF|Compress PDF|Convert to PDF)$/.test(el.innerText) && !el.disabled), {timeout:30000});
        if (slug !== 'powerpoint-to-pdf') await page.locator('img[src^="data:"]').first().waitFor({timeout:30000});
        await capture('loaded');
        await page.setViewportSize({width:1440,height:960});
        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', {rate:6});
        const downloadPromise = page.waitForEvent('download', {timeout:120000});
        const processingPromise = page.getByRole('status').filter({hasText:/Merging|Splitting|Compressing|Converting|Reading|Preparing/}).first().waitFor({timeout:10000}).then(() => capture('processing',[1440],['light'])).catch(() => records.push({slug,state:'processing',note:'Transient processing state not captured; no artificial delay injected.'}));
        await action.click();
        const download = await downloadPromise;
        await download.saveAs(path.join(out, `${slug}-output${path.extname(download.suggestedFilename())}`));
        await processingPromise;
        await cdp.send('Emulation.setCPUThrottlingRate', {rate:1});
        const output = path.join(out, `${slug}-output${path.extname(download.suggestedFilename())}`);
        const bytes = await fs.readFile(output);
        records.push({slug,state:'download',filename:download.suggestedFilename(),bytes:bytes.length,pages:output.endsWith('.pdf')?(await PDFDocument.load(bytes)).getPageCount():null});
        await capture('result');
        await page.getByRole('button',{name:/^Start over$/i}).click();
        await page.locator('input[type=file]').first().waitFor();
        records.push({slug,state:'reset',passed:await page.locator('.pdf-tool-landing').count()===1});
        await page.locator('input[type=file]').first().setInputFiles(path.join(fixtures,slug==='powerpoint-to-pdf'?'invalid.pptx':'invalid.pdf'));
        if (slug === 'powerpoint-to-pdf') await page.getByRole('button',{name:'Convert to PDF',exact:true}).click();
        if (slug === 'merge-pdf' || slug === 'compress-pdf') await page.getByText("Couldn't read this file",{exact:true}).waitFor({timeout:30000});
        else await page.getByRole('alert').filter({hasText:/could|invalid|failed|supported|malformed|read/i}).first().waitFor({timeout:30000});
        await capture('error');
        await page.goto(`${base}/${slug}`,{waitUntil:'networkidle'});
        const longName = 'annualreport'.repeat(18)+(slug==='powerpoint-to-pdf'?'.pptx':'.pdf');
        const buffer = await fs.readFile(path.join(fixtures,files[0]));
        await page.locator('input[type=file]').first().setInputFiles({name:longName,mimeType:slug==='powerpoint-to-pdf'?'application/vnd.openxmlformats-officedocument.presentationml.presentation':'application/pdf',buffer});
        await page.getByRole('heading',{name:slug==='powerpoint-to-pdf'?'PowerPoint to PDF':slug==='merge-pdf'?'Merge PDF':slug==='split-pdf'?'Split PDF':'Compress PDF',exact:true}).first().waitFor();
        await capture('long-filename');
      } catch (error) {
        records.push({slug,state:'failure',error:String(error),body:(await page.locator('body').innerText({timeout:3000}).catch(()=>'' )).slice(-5000)});
        await page.screenshot({path:path.join(out,`${slug}-failure.png`),fullPage:true,timeout:3000}).catch(()=>{});
      }
      records.push({slug,state:'browser-errors',errors});
      await context.close();
      await fs.writeFile(path.join(out, 'report.json'),JSON.stringify({base,records},null,2));
      console.log(slug,JSON.stringify(records.filter(r=>r.slug===slug && (r.state==='failure'||r.state==='download'||r.scrollWidth>r.width||r.state==='browser-errors'))));
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
