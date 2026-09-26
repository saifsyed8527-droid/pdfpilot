const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PDFPILOT_PLAYWRIGHT_MODULE || 'playwright');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const sharp = require('sharp');
const { load } = require('./load-pseo-modules.cjs');
const { DOCUMENT_TEMPLATES, templateExampleValues } = load('src/lib/content/document-templates.ts');
const { PDF_WORKFLOWS } = load('src/lib/content/pdf-workflows.ts');
const base = (process.argv[2] || 'http://127.0.0.1:4340').replace(/\/$/, '');
const writePreviews = process.argv.includes('--write-previews');
const workflowsOnly = process.argv.includes('--workflows-only');
if (writePreviews && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error('Preview generation is local only');
async function main() {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfpilot-pseo-qa-'));
  const browser = await chromium.launch({ headless: true, ...(process.env.PDFPILOT_CHROME ? { executablePath: process.env.PDFPILOT_CHROME } : {}) });
  const results = [], runtimeErrors = [], outbound = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
    // Prevent test sessions entering production analytics. Requests are inspected for the canary below.
    await context.route('https://**/*', async route => { if (new URL(route.request().url()).origin === new URL(base).origin) { await route.continue(); return; } outbound.push({ url: route.request().url(), body: route.request().postData() }); await route.abort(); });
    const page = await context.newPage(); page.setDefaultTimeout(30000);
    page.on('pageerror', error => runtimeErrors.push(error.message));
    page.on('request', request => { if (request.method() === 'POST' && request.url().startsWith(base)) outbound.push({ url: request.url(), body: request.postData() }); });
    for (const row of workflowsOnly ? [] : DOCUMENT_TEMPLATES) {
      const response = await page.goto(`${base}/templates/${row.slug}`);
      assert.equal(response.status(), 200);
      await page.getByRole('button', { name: 'Load example', exact: true }).click();
      const downloadEvent = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download my PDF', exact: true }).click();
      const download = await downloadEvent;
      const filename = path.join(out, row.slug + '.pdf'); await download.saveAs(filename);
      const pdf = await PDFDocument.load(await fs.readFile(filename));
      assert.equal(pdf.getPageCount(), 1);
      for (const [key, value] of Object.entries(templateExampleValues(row))) assert.equal(pdf.getForm().getTextField(key).getText() ?? '', value, row.slug + ':' + key);
      assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1);
      results.push({ template: row.slug, fields: pdf.getForm().getFields().length, pages: 1 });
      console.log('PASS template download', row.slug);
    }
    const canary = 'PRIVATE-PSEO-QA-CONTENT';
    let pending, download, pdf;
    if (!workflowsOnly) {
    await page.goto(base + '/templates/contact-list-template');
    await page.getByLabel('Row 1 Name', { exact: true }).fill(canary);
    await page.getByLabel('Paper size', { exact: true }).selectOption('letter');
    pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download my PDF', exact: true }).click();
    download = await pending; const ownFile = path.join(out, 'own-letter.pdf'); await download.saveAs(ownFile);
    pdf = await PDFDocument.load(await fs.readFile(ownFile)); assert.equal(pdf.getPage(0).getWidth(), 612); assert.equal(pdf.getForm().getTextField('row-0-0').getText(), canary);
    pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download blank PDF', exact: true }).click(); download = await pending;
    const blankFile = path.join(out, 'blank-letter.pdf'); await download.saveAs(blankFile);
    pdf = await PDFDocument.load(await fs.readFile(blankFile)); assert.ok(pdf.getForm().getFields().every(f => !f.getText()));
    await page.getByLabel('Row 1 Name', { exact: true }).fill('😊'); await page.getByRole('button', { name: 'Download my PDF', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Latin characters' }).waitFor();
    }

    await fs.mkdir('public/template-samples/workflows', { recursive: true });
    for (const row of PDF_WORKFLOWS) {
      assert.equal((await page.goto(`${base}/pdf-workflows/${row.slug}`)).status(), 200);
      await page.getByRole('button', { name: 'Try sample files', exact: true }).click();
      await page.getByRole('list', { name: 'Selected files' }).getByRole('listitem').last().waitFor();
      assert.equal(await page.getByRole('list', { name: 'Selected files' }).getByRole('listitem').count(), row.samples.length);
      if (row.kind.endsWith('compress')) await page.getByRole('checkbox').check();
      if (row.kind === 'extract-compress') await page.getByLabel('Pages to extract', { exact: false }).fill('3, 1');
      await page.getByRole('button', { name: 'Run workflow', exact: true }).click();
      await page.getByRole('button', { name: 'Download PDF', exact: true }).waitFor({ timeout: 150000 });
      pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download PDF', exact: true }).click(); download = await pending;
      const file = path.join(out, row.slug + '.pdf'); await download.saveAs(file);
      pdf = await PDFDocument.load(await fs.readFile(file));
      const expected = row.kind === 'word-merge' || row.kind === 'extract-compress' ? 2 : row.kind === 'word-compress' ? 1 : 5;
      assert.equal(pdf.getPageCount(), expected, row.slug);
      if (row.input === 'pdf') for (const p of pdf.getPages()) { assert.ok(Math.abs(p.getWidth() - 595.28) < 1, 'physical A4 width retained'); assert.ok(Math.abs(p.getHeight() - 841.89) < 1, 'physical A4 height retained'); }
      if (row.kind === 'merge-number' || row.kind === 'merge-watermark') {
        const text = execFileSync(process.env.PDFPILOT_PYTHON || 'python3', ['-c', 'import sys; from pypdf import PdfReader; print("\\n".join(p.extract_text() or "" for p in PdfReader(sys.argv[1]).pages))', file], { encoding: 'utf8' });
        assert.ok(text.includes('Packet A - page 1') && text.includes('Packet B - page 2'));
        assert.ok(text.indexOf('Packet A - page 1') < text.indexOf('Packet B - page 1'));
        if (row.kind === 'merge-watermark') assert.ok(text.includes('DRAFT'));
      }
      execFileSync('pdftoppm', ['-scale-to', '700', '-png', file, path.join(out, row.slug)], { stdio: 'pipe' });
      if (writePreviews) execFileSync('pdftoppm', ['-f', '1', '-singlefile', '-scale-to', '842', '-png', file, path.resolve('public/template-samples/workflows', row.slug)], { stdio: 'pipe' });
      assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1);
      results.push({ workflow: row.slug, pages: pdf.getPageCount(), bytes: (await fs.stat(file)).size });
      console.log('PASS workflow download', row.slug);
    }

    // Exercise a real reduction, not only the size guard, using a deterministic image-heavy PDF.
    const pixels = Buffer.alloc(1200 * 1600 * 3); let seed = 1234;
    for (let i = 0; i < pixels.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; pixels[i] = seed >>> 24; }
    const png = await sharp(pixels, { raw: { width: 1200, height: 1600, channels: 3 } }).png().toBuffer();
    const heavy = await PDFDocument.create(), pic = await heavy.embedPng(png); heavy.addPage([595.28, 841.89]).drawImage(pic, { x: 0, y: 0, width: 595.28, height: 841.89 });
    const heavyPath = path.join(out, 'image-heavy.pdf'); await fs.writeFile(heavyPath, await heavy.save());
    await page.goto(base + '/pdf-workflows/merge-and-compress-pdf');
    await page.getByLabel('Choose workflow files', { exact: true }).setInputFiles([heavyPath, path.resolve('public/template-samples/workflow-b.pdf')]);
    await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Run workflow', exact: true }).click();
    await page.getByRole('button', { name: 'Download PDF', exact: true }).waitFor({ timeout: 150000 });
    assert.ok(await page.getByText(/before compression →/).isVisible());
    pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download PDF', exact: true }).click(); download = await pending;
    const reducedPath = path.join(out, 'reduced.pdf'); await download.saveAs(reducedPath); pdf = await PDFDocument.load(await fs.readFile(reducedPath));
    assert.equal(pdf.getPageCount(), 3); assert.ok((await fs.stat(reducedPath)).size < (await fs.stat(heavyPath)).size);
    assert.ok(pdf.getPages().every(p => Math.abs(p.getWidth() - 595.28) < 1 && Math.abs(p.getHeight() - 841.89) < 1));
    results.push({ regression: 'compression reduces bytes and preserves A4 dimensions', passed: true });

    // Invalid ranges recover without a partial download.
    await page.goto(base + '/pdf-workflows/extract-and-compress-pdf'); await page.getByRole('button', { name: 'Try sample files', exact: true }).click();
    await page.getByRole('list', { name: 'Selected files' }).waitFor(); await page.getByRole('checkbox').check();
    await page.getByLabel('Pages to extract', { exact: false }).fill('999'); await page.getByRole('button', { name: 'Run workflow', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'from 1 to 3' }).waitFor(); assert.equal(await page.getByRole('button', { name: 'Download PDF', exact: true }).count(), 0);
    await page.getByLabel('Pages to extract', { exact: false }).fill('1'); await page.getByRole('button', { name: 'Run workflow', exact: true }).click();
    await page.getByRole('button', { name: 'Download PDF', exact: true }).waitFor({ timeout: 150000 });

    await page.goto(base + '/pdf-workflows/combine-word-documents-to-pdf'); await page.getByRole('button', { name: 'Try sample files', exact: true }).click();
    await page.getByRole('list', { name: 'Selected files' }).waitFor(); await page.getByRole('button', { name: 'Run workflow', exact: true }).click(); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Workflow cancelled' }).waitFor({ timeout: 150000 });
    assert.equal(await page.getByRole('button', { name: 'Download PDF', exact: true }).count(), 0);
    assert.equal(runtimeErrors.length, 0, JSON.stringify(runtimeErrors));
    assert.ok(!JSON.stringify(outbound).includes(canary), 'no form content in network requests');
    assert.ok(!outbound.some(item => item.url.startsWith(base)), 'no document uploads');
    await fs.writeFile(path.join(out, 'results.json'), JSON.stringify({ checkedAt: new Date().toISOString(), base, results, runtimeErrors, documentUploads: 0, canaryLeaked: false }, null, 2));
    console.log(JSON.stringify({ passed: true, checks: results.length, output: out }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
