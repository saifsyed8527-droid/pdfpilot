// Optional input stays local. Never copy private customer workbooks into public/.
// PDFPILOT_PLAYWRIGHT_MODULE=/path/to/playwright PDFPILOT_CHROME=/path/to/chrome
// node scripts/check-excel-pdf-browser.cjs http://127.0.0.1:3117 /path/to/input.xlsx
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.PDFPILOT_PLAYWRIGHT_MODULE || 'playwright');
const { PDFDocument } = require('pdf-lib');
const { unzipSync } = require('fflate');
const base = process.argv[2] || 'http://127.0.0.1:3117';
const input = process.argv[3];
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('Use a local preview for private workbook QA');
if (!input) throw new Error('Supply the local XLSX path');

(async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfpilot-excel-qa-'));
  console.log('QA_DIR', out);
  const browser = await chromium.launch({ headless: true, ...(process.env.PDFPILOT_CHROME ? { executablePath: process.env.PDFPILOT_CHROME } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    const errors = [], uploads = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (['POST', 'PUT'].includes(r.method())) uploads.push(r.url()); });
    await page.goto(base + '/excel-to-pdf');
    await page.waitForLoadState('networkidle');
    await page.locator('input[type=file]').setInputFiles(input);
    try { await page.getByRole('checkbox').first().waitFor({ timeout: 15000 }); }
    catch (error) {
      console.error('WORKSPACE', await page.locator('body').innerText(), errors);
      await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true });
      throw error;
    }
    const toolbar = page.getByTestId('office-add-files-toolbar');
    const plus = toolbar.getByRole('button', { name: 'Add more files', exact: true });
    const buttonBox = await plus.boundingBox(), section = await toolbar.locator('..').boundingBox();
    assert.ok(buttonBox.x + buttonBox.width > section.x + section.width - 32, 'add button is at the right edge of the file area');
    assert.ok(buttonBox.y < section.y + 40, 'add button is above the file cards');
    assert.equal(await page.getByRole('button', { name: 'Add more files', exact: true }).count(), 1);
    const convert = page.getByRole('button', { name: 'Convert to PDF', exact: true });
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    assert.equal(await convert.isEnabled(), false, 'empty sheet selection cannot convert all sheets by accident');
    await page.getByRole('button', { name: 'Select all', exact: true }).click();
    for (const [width, dark] of [[1440, false], [1440, true], [390, true], [390, false]]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(dark => { document.documentElement.classList.toggle('dark', dark); }, dark);
      await page.screenshot({ path: path.join(out, `workspace-${width}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal UI overflow');
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    const pending = page.waitForEvent('download', { timeout: 120000 });
    const started = Date.now();
    await convert.click();
    const download = await pending;
    const filename = path.join(out, 'corrected.pdf');
    await download.saveAs(filename);
    assert.equal(await download.failure(), null);
    assert.ok(download.suggestedFilename().endsWith('.pdf'));
    const pdf = await PDFDocument.load(await fs.readFile(filename));
    console.log(JSON.stringify({ pages: pdf.getPageCount(), links: pdf.getPages().reduce((n, p) => n + (p.node.Annots()?.size() || 0), 0), elapsedMs: Date.now() - started, filename }));
    await page.screenshot({ path: path.join(out, 'result.png'), fullPage: true });
    await page.getByRole('button', { name: /^Start over$/i }).click();
    await page.locator('input[type=file]').setInputFiles(input);
    await page.getByRole('checkbox').first().waitFor();
    const boxes = page.getByRole('checkbox');
    const sheetCount = await boxes.count();
    for (let i = 1; i < sheetCount; i++) await boxes.nth(i).uncheck();
    const singlePending = page.waitForEvent('download', { timeout: 120000 });
    await page.getByRole('button', { name: 'Convert to PDF', exact: true }).click();
    const single = await singlePending;
    await single.saveAs(path.join(out, 'selected-sheet.pdf'));
    assert.ok((await PDFDocument.load(await fs.readFile(path.join(out, 'selected-sheet.pdf')))).getPageCount() <= pdf.getPageCount());
    await page.getByRole('button', { name: /^Start over$/i }).click();
    await page.locator('input[type=file]').setInputFiles(input);
    await page.getByRole('checkbox').first().waitFor();
    const chooserPending = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Add more files', exact: true }).click();
    await (await chooserPending).setFiles(input);
    await page.getByRole('checkbox').nth(sheetCount * 2 - 1).waitFor();
    const batchPending = page.waitForEvent('download', { timeout: 120000 });
    await page.getByRole('button', { name: 'Convert to PDF', exact: true }).click();
    const batch = await batchPending;
    await batch.saveAs(path.join(out, 'batch.zip'));
    const outputs = Object.values(unzipSync(await fs.readFile(path.join(out, 'batch.zip'))));
    assert.equal(outputs.length, 2, 'adding the same file twice must not overwrite an output');
    for (const bytes of outputs) assert.equal((await PDFDocument.load(bytes)).getPageCount(), pdf.getPageCount());
    assert.deepEqual(errors, [], 'no browser runtime errors');
    assert.deepEqual(uploads, [], 'no workbook uploads');
    console.log('PASS UI, sheet selection, add-files dialog, batch ZIP, local conversion and download');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
