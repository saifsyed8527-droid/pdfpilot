// Read-only production diagnostic: synthetic PDF, No OCR rejection only.
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PDFPILOT_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PDFPILOT_QA_BASE || 'https://pdfpilot.net';
const out = process.env.PDFPILOT_QA_OUTPUT || '/tmp/pdfpilot-word-early-action';
const fixture = path.resolve('docs/qa/2026-10-04-mixed-pdf-word/mixed-input.pdf');
const modes = (process.env.PDFPILOT_QA_CASES || 'early,early,preview-ready').split(',');
(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PDFPILOT_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const results = [];
  try {
    for (const [index, mode] of modes.entries()) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
      const page = await context.newPage();
      const trace = { mode, events: [], console: [], pageErrors: [], requestFailures: [], downloads: [] };
      const now = () => Date.now();
      page.on('console', message => trace.console.push({ time: now(), type: message.type(), text: message.text() }));
      page.on('pageerror', error => trace.pageErrors.push({ time: now(), message: error.message }));
      page.on('download', download => trace.downloads.push({ time: now(), filename: download.suggestedFilename() }));
      page.on('request', request => {
        if (/\.m?js(?:\?|$)|\.wasm(?:\?|$)/.test(request.url())) trace.events.push({ kind: 'request', time: now(), url: request.url(), resource: request.resourceType() });
      });
      page.on('response', response => {
        if (/\.m?js(?:\?|$)|\.wasm(?:\?|$)/.test(response.url())) trace.events.push({ kind: 'response', time: now(), url: response.url(), status: response.status() });
      });
      page.on('requestfinished', request => {
        if (/\.m?js(?:\?|$)|\.wasm(?:\?|$)/.test(request.url())) trace.events.push({ kind: 'requestfinished', time: now(), url: request.url(), timing: request.timing() });
      });
      page.on('requestfailed', request => trace.requestFailures.push({ time: now(), url: request.url(), error: request.failure() }));
      await page.route(/google-analytics|googletagmanager|clarity\.ms/, route => route.abort());
      await page.addInitScript(() => {
        window.__pdfWorkerTrace = [];
        window.__pdfActionTrace = [];
        document.addEventListener('click', event => {
          const button = event.target.closest?.('button');
          if (button?.textContent.trim() === 'Convert to WORD') window.__pdfActionTrace.push({
            time: performance.now(),
            previewReady: [...document.querySelectorAll('article img')].some(image => image.complete && image.naturalWidth > 0),
          });
        }, true);
        const NativeWorker = window.Worker;
        let serial = 0;
        const describe = value => value && typeof value === 'object'
          ? Object.fromEntries(['action', 'sourceName', 'targetName', 'callbackId', 'streamId', 'stream', 'callback', 'isReply', 'kind'].filter(key => ['string', 'number', 'boolean'].includes(typeof value[key])).map(key => [key, value[key]]))
          : { type: typeof value };
        window.Worker = class extends NativeWorker {
          constructor(url, options) {
            super(url, options);
            const id = ++serial, events = window.__pdfWorkerTrace;
            events.push({ id, event: 'create', url: String(url), time: performance.now() });
            const post = this.postMessage.bind(this), terminate = this.terminate.bind(this);
            this.postMessage = (...args) => { events.push({ id, event: 'post', time: performance.now(), message: describe(args[0]) }); return post(...args); };
            this.terminate = () => { events.push({ id, event: 'terminate', time: performance.now() }); return terminate(); };
            this.addEventListener('message', event => events.push({ id, event: 'receive', time: performance.now(), message: describe(event.data) }));
            this.addEventListener('error', event => events.push({ id, event: 'error', time: performance.now(), message: event.message }));
            this.addEventListener('messageerror', () => events.push({ id, event: 'messageerror', time: performance.now() }));
          }
        };
      });
      try {
        const navigationResponse = await page.goto(base + '/pdf-to-word', { waitUntil: 'domcontentloaded', timeout: 60000 });
        trace.navigationResponse = { status: navigationResponse.status(), headers: await navigationResponse.allHeaders() };
        await page.getByRole('button', { name: /Switch to (dark|light) mode/ }).waitFor();
        trace.navigation = await page.evaluate(() => ({ timeOrigin: performance.timeOrigin, time: performance.now() }));
        await page.locator('input[type=file]').setInputFiles(fixture);
        if (mode === 'preview-ready') await page.waitForFunction(() => [...document.querySelectorAll('article img')].some(image => image.complete && image.naturalWidth > 0), null, { timeout: 30000 });
        await page.getByRole('button', { name: /No OCR Fast conversion/ }).click();
        trace.beforeAction = await page.evaluate(() => ({ time: performance.now(), body: document.body.innerText.slice(0, 1800), previewReady: [...document.querySelectorAll('article img')].some(image => image.complete && image.naturalWidth > 0), workers: window.__pdfWorkerTrace.slice() }));
        await page.getByRole('button', { name: 'Convert to WORD', exact: true }).click();
        trace.clickedAt = now();
        try {
          await page.locator('aside [role=alert]').filter({ hasText: 'No selectable text on page 2.' }).waitFor({ timeout: 20000 });
          trace.outcome = 'expected-mixed-page-error';
        } catch {
          trace.at20s = { body: await page.locator('body').innerText(), workers: await page.evaluate(() => window.__pdfWorkerTrace) };
          try {
            await page.locator('aside [role=alert]').filter({ hasText: 'No selectable text on page 2.' }).waitFor({ timeout: 40000 });
            trace.outcome = 'late-mixed-page-error';
          } catch { trace.outcome = 'no-expected-error-after-60s'; }
        }
        trace.elapsedMs = now() - trace.clickedAt;
        trace.finalBody = await page.locator('body').innerText();
        trace.workers = await page.evaluate(() => window.__pdfWorkerTrace);
        trace.actions = await page.evaluate(() => window.__pdfActionTrace);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: path.join(out, `${index + 1}-${mode}.png`), fullPage: true });
      } catch (error) {
        trace.harnessError = error.message;
        trace.finalBody = await page.locator('body').innerText().catch(() => 'unavailable');
        trace.workers = await page.evaluate(() => window.__pdfWorkerTrace).catch(() => []);
      } finally {
        await fs.writeFile(path.join(out, `${index + 1}-${mode}.json`), JSON.stringify(trace, null, 2));
        results.push({ case: index + 1, mode, outcome: trace.outcome, elapsedMs: trace.elapsedMs, previewReadyAtAction: trace.actions?.[0]?.previewReady, workerCount: trace.workers?.filter(event => event.event === 'create').length, pageErrors: trace.pageErrors, harnessError: trace.harnessError });
        await context.close();
      }
    }
  } finally { await browser.close(); }
  await fs.writeFile(path.join(out, 'summary.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
