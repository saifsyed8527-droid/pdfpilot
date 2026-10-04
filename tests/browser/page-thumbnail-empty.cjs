const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const { chromium } = require(process.env.PDFPILOT_PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.PDFPILOT_QA_BASE || 'http://127.0.0.1:4401';
const output = process.env.PDFPILOT_QA_OUTPUT || '/tmp/pdfpilot-thumbnail-grid';
const expectPending = process.env.PDFPILOT_QA_EXPECT_EMPTY_PENDING === '1';

(async () => {
  await fs.mkdir(output, { recursive: true });
  const empty = await PDFDocument.create();
  const valid = await PDFDocument.create();
  const font = await valid.embedFont(StandardFonts.Helvetica);
  for (const label of ['FIRST PAGE', 'SECOND PAGE', 'THIRD PAGE']) {
    valid.addPage([400, 300]).drawText(label, { font, x: 40, y: 220 });
  }
  const files = {
    empty: { name: 'zero-pages.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await empty.save({ addDefaultPage: false })) },
    invalid: { name: 'invalid.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a PDF') },
    valid: { name: 'three-pages.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await valid.save()) },
  };
  await fs.writeFile(path.join(output, 'zero-pages.pdf'), files.empty.buffer);
  await fs.writeFile(path.join(output, 'three-pages.pdf'), files.valid.buffer);
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const emptyTask = getDocument({ data: new Uint8Array(files.empty.buffer) });
  try {
    assert.equal((await emptyTask.promise).numPages, 0, 'fixture must parse as a real zero-page PDF, not an invalid-file error');
  } finally {
    await emptyTask.destroy();
  }
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PDFPILOT_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const results = [];
  try {
    for (const slug of ['rotate-pdf', 'extract-pages']) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route(/google-analytics|googletagmanager|clarity\.ms/, route => route.abort());
      await page.goto(`${base}/${slug}`, { waitUntil: 'networkidle', timeout: 120000 });
      const upload = () => page.locator('input[type=file]').first();
      const preview = () => page.getByRole('group', { name: slug === 'rotate-pdf' ? 'Page actions' : 'Select pages', exact: true });
      const reset = async () => {
        const change = page.getByRole('button', { name: /^(Change file|Clear)$/ }).first();
        await change.click();
        await upload().waitFor({ state: 'attached' });
      };
      const replace = async file => {
        // Extract keeps the grid mounted while its File prop changes; Rotate
        // intentionally returns to its picker through its existing control.
        if (slug === 'rotate-pdf') await reset();
        await upload().setInputFiles(file);
      };

      await upload().setInputFiles(files.empty);
      if (expectPending) {
        // The real fixture parses successfully with numPages=0. Capture the
        // existing terminal state after worker startup has had time to settle.
        await page.getByText('Rendering page previews…', { exact: true }).waitFor();
        await page.waitForTimeout(3000);
        assert.equal(await page.getByText('Rendering page previews…', { exact: true }).count(), 1);
        assert.equal(await page.locator('main [role=alert]').count(), 0);
      } else {
        await page.getByRole('alert').filter({ hasText: "This PDF has no pages. Choose a different PDF." }).waitFor({ timeout: 10000 });
        assert.equal(await page.getByText('Rendering page previews…', { exact: true }).count(), 0);
        assert.equal(await preview().count(), 0);
      }
      await page.screenshot({ path: path.join(output, `${slug}-empty.png`), fullPage: true });
      await replace(files.invalid);
      await page.getByRole('alert').filter({ hasText: "The file may be corrupted or not a valid PDF." }).waitFor();
      assert.equal(await page.getByText('Rendering page previews…', { exact: true }).count(), 0);
      await replace(files.valid);
      await preview().locator('img').nth(2).waitFor();
      assert.equal(await preview().locator('img').count(), 3);
      assert.equal(await page.locator('main [role=alert]').count(), 0);
      assert.equal(await page.getByText('Rendering page previews…', { exact: true }).count(), 0);
      assert.equal(await page.getByText(/Loading page .*of/).count(), 0);

      for (const width of [375, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        const theme = page.getByRole('button', { name: width === 768 ? 'Switch to dark mode' : 'Switch to light mode', exact: true });
        if (await theme.count()) await theme.click();
        await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation instanceof CSSTransition).map(animation => animation.finished.catch(() => {}))));
        await page.screenshot({ path: path.join(output, `${slug}-recovered-${width}.png`), fullPage: true });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `no overflow at ${width}`);
      }
      if (slug === 'rotate-pdf') {
        await page.getByRole('button', { name: 'Rotate page 2 clockwise', exact: true }).click();
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Rotate PDF', exact: true }).click();
        const target = path.join(output, 'rotated.pdf');
        await (await download).saveAs(target);
        const parsed = await PDFDocument.load(await fs.readFile(target));
        assert.equal(parsed.getPageCount(), 3);
        assert.deepEqual(parsed.getPages().map(p => p.getRotation().angle), [0, 90, 0]);
        const rotatedTask = getDocument({ data: new Uint8Array(await fs.readFile(target)), useSystemFonts: true });
        try {
          const rotated = await rotatedTask.promise;
          const text = [];
          for (let i = 1; i <= rotated.numPages; i++) {
            text.push((await (await rotated.getPage(i)).getTextContent()).items.map(item => item.str || '').join(' '));
          }
          assert.deepEqual(text, ['FIRST PAGE', 'SECOND PAGE', 'THIRD PAGE']);
        } finally {
          await rotatedTask.destroy();
        }
        await page.getByRole('img', { name: 'Preview of the first page after rotation' }).waitFor();
        await page.getByRole('button', { name: /^Start over$/i }).click();
        await upload().waitFor({ state: 'attached' });
      } else {
        await page.getByRole('button', { name: 'Page 2, selected', exact: true }).click();
        assert.equal(await page.getByRole('button', { name: 'Page 2', exact: true }).getAttribute('aria-pressed'), 'false');
        assert.equal(await preview().locator('[aria-pressed=true]').count(), 2);
      }
      assert.deepEqual(errors, [], 'no uncaught browser errors');
      results.push({ slug, emptyState: expectPending ? 'reproduced stuck loading' : 'terminal error', malformedError: true, replacementPages: 3, viewportWidths: [375, 768, 1440], errors });
      await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
      await page.close();
    }
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
