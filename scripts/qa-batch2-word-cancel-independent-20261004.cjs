// F combined-candidate acceptance adapted from C; only QA instrumentation.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PDFPILOT_PLAYWRIGHT_MODULE || 'playwright');
const { unzipSync, strFromU8 } = require('fflate');
const base = process.env.PDFPILOT_QA_BASE || 'http://127.0.0.1:4403';
const out = process.env.PDFPILOT_QA_OUTPUT || 'docs/product-completion/qa-batch2/word-cancel';
const fixture = path.resolve('docs/qa/2026-10-04-mixed-pdf-word/mixed-input.pdf');
(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PDFPILOT_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  let page; const runtime = {console:[],pageErrors:[],requestFailures:[]};
  try {
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    const errors = [], downloads = [];
    page.on('pageerror', error => {errors.push(error.message);runtime.pageErrors.push(error.stack);});
    page.on('console',m=>{if(m.type()==='error')runtime.console.push(m.text());});
    page.on('requestfailed',r=>runtime.requestFailures.push({url:r.url(),failure:r.failure()}));
    page.on('download', download => downloads.push(download));
    await page.route(/google-analytics|googletagmanager|clarity\.ms/, route => route.abort());
    await page.addInitScript(() => {
      window.__wordCancelQa = [];
      const NativeWorker = window.Worker;
      let next = 0;
      window.Worker = class extends NativeWorker {
        constructor(url, options) {
          super(url, options);
          const source = String(url);
          if (!source.includes('/tesseract/worker.min.js')) return;
          const id = ++next;
          const events = window.__wordCancelQa;
          events.push({ id, event: 'created', time: performance.now() });
          const post = this.postMessage.bind(this);
          this.postMessage = (...args) => {
            const action = args[0]?.action;
            if (action) events.push({ id, event: 'post', action, time: performance.now() });
            return post(...args);
          };
          const terminate = this.terminate.bind(this);
          this.terminate = () => {
            events.push({ id, event: 'terminated', time: performance.now() });
            return terminate();
          };
        }
      };
    });
    await page.goto(base + '/pdf-to-word', { waitUntil: 'domcontentloaded', timeout: 120000 });
    // Theme toggle's mounted effect confirms hydration before synthetic input events.
    await page.getByRole('button', { name: /Switch to (dark|light) mode/ }).waitFor();
    await page.locator('input[type=file]').setInputFiles(fixture);
    await page.getByRole('button', { name: 'Convert to WORD', exact: true }).waitFor();

    await page.getByRole('button', { name: 'Convert to WORD', exact: true }).click();
    await page.waitForFunction(() => window.__wordCancelQa.some(e => e.event === 'created'), null, { timeout: 60000 });
    const startupAbort = await page.evaluate(() => performance.now());
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Convert to WORD', exact: true }).waitFor();
    const startupUiReady = await page.evaluate(() => performance.now());
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, 'startup-cancelled.png'), fullPage: true });
    await page.waitForFunction(() => window.__wordCancelQa.some(e => e.id === 1 && e.event === 'terminated'), null, { timeout: 60000 });
    assert.equal(downloads.length, 0, 'startup cancellation must not download');
    const startupEvents = await page.evaluate(() => window.__wordCancelQa.filter(e => e.id === 1));
    assert.ok(!startupEvents.some(e => e.action === 'recognize'), 'first attempt must be cancelled during startup');
    assert.equal(startupEvents.filter(e => e.event === 'terminated').length, 1);

    await page.getByRole('button', { name: 'Convert to WORD', exact: true }).click();
    await page.waitForFunction(() => window.__wordCancelQa.some(e => e.id === 2 && e.event === 'post' && e.action === 'recognize'), null, { timeout: 60000 });
    const recognitionAbort = await page.evaluate(() => performance.now());
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.waitForFunction(() => window.__wordCancelQa.some(e => e.id === 2 && e.event === 'terminated'), null, { timeout: 5000 });
    const recognitionEvents = await page.evaluate(() => window.__wordCancelQa.filter(e => e.id === 2));
    await page.getByRole('button', { name: 'Convert to WORD', exact: true }).waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, 'recognition-cancelled.png'), fullPage: true });
    assert.equal(downloads.length, 0, 'active cancellation must not download');
    assert.equal(recognitionEvents.filter(e => e.event === 'terminated').length, 1);
    const recognitionTermination = recognitionEvents.find(e => e.event === 'terminated').time - recognitionAbort;
    assert.ok(recognitionTermination < 1500, `active worker termination took ${recognitionTermination}ms`);

    const ready = page.waitForEvent('download', { timeout: 180000 });
    await page.getByRole('button', { name: 'Convert to WORD', exact: true }).click();
    const download = await ready;
    const output = path.join(out, 'retry-mixed.docx');
    await download.saveAs(output);
    const entries = unzipSync(await fs.readFile(output));
    const xml = strFromU8(entries['word/document.xml']);
    await fs.writeFile(path.join(out, 'retry-document.xml'), xml);
    const first = xml.indexOf('SELECTABLE COVER ALPHA'), middle = xml.indexOf('SCANNED ATTACHMENT BRAVO'), last = xml.indexOf('SELECTABLE END CHARLIE');
    assert.ok(first >= 0 && first < middle && middle < last, 'retry retains every page in order');
    assert.equal((xml.match(/w:type="page"/g) || []).length, 2);
    assert.ok(!Object.keys(entries).some(name => name.startsWith('word/media/')));
    await page.getByText('Your file is ready', { exact: false }).first().waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, 'retry-result.png'), fullPage: true });
    assert.equal(downloads.length, 1, 'cancelled attempts must not later download');
    assert.deepEqual(errors, []);
    const result = {
      startupUiReadyMs: startupUiReady - startupAbort,
      startupTerminationMs: startupEvents.find(e => e.event === 'terminated').time - startupAbort,
      recognitionTerminationMs: recognitionTermination,
      startupEvents, recognitionEvents,
      retry: { output, pageBreaks: 2, editable: true, pageOrderPreserved: true },
      downloads: downloads.length, errors,
    };
    await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } catch(error) {if(page){await fs.writeFile(path.join(out,'failure-ui.txt'),await page.locator('body').innerText()).catch(()=>{});await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});runtime.workerEvents=await page.evaluate(()=>window.__wordCancelQa).catch(()=>[]);}throw error;} finally {await fs.writeFile(path.join(out,'runtime.json'),JSON.stringify(runtime,null,2)); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
