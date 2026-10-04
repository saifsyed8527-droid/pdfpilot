const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PDFPILOT_PLAYWRIGHT_MODULE || 'playwright');
const { PDFDocument, PDFName } = require('pdf-lib');
const fixture = require('../fixtures/excel-pdf-boundary.cjs');
const base = process.env.PDFPILOT_QA_BASE || 'http://127.0.0.1:4403';
const out = process.env.PDFPILOT_QA_OUTPUT || '/tmp/pdfpilot-excel-pdf-worker-after';
(async () => {
  await fs.mkdir(out, { recursive: true });
  const input = await fixture();
  const inputPath = path.join(out, input.name); await fs.writeFile(inputPath, new Uint8Array(await input.arrayBuffer()));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PDFPILOT_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const trace = { base, pageErrors: [], console: [], downloads: [] };
  let releaseFonts;
  const fontGate = new Promise(resolve => { releaseFonts = resolve; });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    page.on('pageerror', error => trace.pageErrors.push(error.message));
    page.on('console', msg => trace.console.push({ type: msg.type(), text: msg.text() }));
    page.on('download', download => trace.downloads.push(download.suggestedFilename()));
    await page.route(/google-analytics|googletagmanager|clarity\.ms/, route => route.abort());
    let fontStarted;
    const waitingForFont = new Promise(resolve => { fontStarted = resolve; });
    await page.route('**/fonts/*.ttf', async route => { fontStarted(); await fontGate; await route.continue(); });
    await page.goto(base + '/excel-to-xml', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByRole('button', { name: /Switch to (dark|light) mode/ }).first().waitFor();
    await page.locator('input[type=file]').setInputFiles(inputPath);
    await page.getByRole('combobox', { name: 'Output for ' + input.name }).selectOption('pdf');
    await page.getByRole('button', { name: 'Convert files', exact: true }).click();
    let fontTimer;
    try { await Promise.race([waitingForFont, new Promise((_, reject) => { fontTimer = setTimeout(() => reject(new Error('PDF did not reach font preparation')), 45000); })]); }
    finally { clearTimeout(fontTimer); }
    const cancelledAt = Date.now();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Convert files', exact: true }).waitFor();
    trace.cancelUiMs = Date.now() - cancelledAt;
    releaseFonts();
    await page.waitForTimeout(800);
    assert.equal(trace.downloads.length, 0, 'cancelled attempt must not download');
    await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: path.join(out, 'cancelled.png'), fullPage: true });
    const ready = page.waitForEvent('download', { timeout: 90000 });
    await page.getByRole('button', { name: 'Convert files', exact: true }).click();
    const download = await ready; const output = path.join(out, 'graphics.pdf'); await download.saveAs(output);
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, 'result.png'), fullPage: true });
    const bytes = new Uint8Array(await fs.readFile(output)), pdf = await PDFDocument.load(bytes);
    const images = pdf.getPages().flatMap(p => p.node.Resources().lookup(PDFName.of('XObject'))?.entries() || []).filter(([, ref]) => pdf.context.lookup(ref).dict.get(PDFName.of('Subtype'))?.toString() === '/Image');
    assert.equal(pdf.getPageCount(), 2); assert.equal(images.length, 2, 'PNG picture and actual chart must both be embedded');
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = getDocument({ data: bytes.slice(), useSystemFonts: true }); const document = await task.promise;
    trace.pages = [];
    try {
      const { createCanvas } = require('@napi-rs/canvas');
      for (let i = 1; i <= document.numPages; i++) {
        const pdfPage = await document.getPage(i), text = (await pdfPage.getTextContent()).items.map(item => item.str || '').join(' ');
        trace.pages.push(text);
        const viewport = pdfPage.getViewport({ scale: 1.3 }), canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        await fs.writeFile(path.join(out, `page-${i}.png`), canvas.toBuffer('image/png'));
      }
    } finally { await task.destroy(); }
    assert.match(trace.pages[0].replace(/\s/g, ''), /FIRSTSHEETALPHA/); assert.match(trace.pages[0], /42/);
    assert.match(trace.pages[1].replace(/\s/g, ''), /SECONDSHEETBRAVO/); assert.match(trace.pages[1], /73/);
    assert.deepEqual(trace.pageErrors, []); assert.equal(trace.downloads.length, 1);
    trace.imageCount = images.length; trace.pageCount = pdf.getPageCount(); trace.outputBytes = bytes.length;
    await page.getByRole('button', { name: /Start over/i }).click();
    await page.getByRole('button', { name: /^Select Excel files, Drop files here$/ }).waitFor();
    trace.resetPassed = true; trace.outcome = 'passed';
  } catch (error) { trace.error = error.message; throw error; }
  finally { releaseFonts(); await browser.close(); await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(trace, null, 2)); }
  console.log(JSON.stringify(trace, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
