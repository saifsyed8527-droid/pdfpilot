// Independent combined-candidate browser/output checks. No engine is mocked.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PDFPILOT_PLAYWRIGHT_MODULE || 'playwright');
const { PDFDocument, StandardFonts, PDFName } = require('pdf-lib');
const { unzipSync } = require('fflate');
const base = process.argv[2], out = path.resolve(process.argv[3]);
assert.ok(base && process.argv[3], 'Pass base URL and unique output directory');
const fixtureRoot = process.env.PDFPILOT_PAGES_FIXTURES || '/tmp/pdfpilot-pages-b';
const source = path.join(fixtureRoot, 'Résumé Ω 文档.pdf');
const report = { base, started: new Date().toISOString(), checks: [], outputs: [], layouts: [], keyboard: [], errors: [], console: [], requestsFailed: [] };
const plans = [];
let downloads = 0;

(async () => {
  await fs.mkdir(out, { recursive: true });
  const original = await fs.readFile(source);
  await fs.writeFile(path.join(out, 'source.pdf'), original);
  const short = await PDFDocument.create(), src = await PDFDocument.load(original);
  for (const page of await short.copyPages(src, [0, 1])) short.addPage(page);
  const replacement = path.join(out, 'replacement-two-pages.pdf');
  await fs.writeFile(replacement, await short.save());
  const many = await PDFDocument.create(), font = await many.embedFont(StandardFonts.Helvetica);
  for (let n = 1; n <= 300; n++) many.addPage([100, 140]).drawText('PAGE ' + n, { x: 5, y: 70, size: 10, font });
  const manyFile = path.join(out, 'cancellation-300-pages.pdf');
  await fs.writeFile(manyFile, await many.save());
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PDFPILOT_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('download', () => downloads++);
  page.on('console', m => { if (m.type() === 'error') report.console.push(m.text()); });
  page.on('requestfailed', r => report.requestsFailed.push({ url: r.url(), failure: r.failure() }));
  const action = slug => slug === 'rotate-pdf' ? page.getByRole('button', { name: 'Rotate PDF', exact: true }) : slug === 'delete-pages' ? page.getByRole('button', { name: /^Remove (pages|\d+ pages?)$/ }) : page.getByRole('button', { name: 'Extract Pages', exact: true });
  async function open(slug) {
    const response = await page.goto(base + '/' + slug, { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), 200);
    await page.getByRole('button', { name: /^Switch to (dark|light) mode$/ }).waitFor();
  }
  async function input(slug, file = source, count = 4) {
    await page.locator('input[type=file]').first().setInputFiles(file);
    if (slug === 'rotate-pdf') await page.getByRole('button', { name: 'Rotate page 1 clockwise', exact: true }).waitFor();
    else await page.getByRole('button', { name: /^Page 1(, selected)?$/ }).waitFor();
    if (count <= 4) {
      if (slug === 'rotate-pdf') await page.getByRole('button', { name: `Rotate page ${count} clockwise`, exact: true }).waitFor();
      else await page.getByRole('button', { name: new RegExp(`^Page ${count}(, selected)?$`) }).waitFor();
    }
  }
  async function snapshot(slug, state, primary) {
    for (const width of [375, 768, 1440]) for (const dark of [false, true]) {
      await page.setViewportSize({ width, height: 1000 });
      const current = await page.locator('html').evaluate(e => e.classList.contains('dark'));
      if (current !== dark) await page.getByRole('button', { name: dark ? 'Switch to dark mode' : 'Switch to light mode', exact: true }).click();
      assert.equal(await page.locator('html').evaluate(e => e.classList.contains('dark')), dark);
      await page.evaluate(() => window.scrollTo(0, 0));
      const metrics = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
      assert.ok(metrics.scrollWidth <= width + 1, `${slug} ${state} overflow at ${width}`);
      const box = primary ? await primary.boundingBox() : null;
      if (box && width === 375) assert.ok(box.y < 450, `${slug} primary action too low: ${box.y}`);
      const screenshot = `${slug}-${state}-${width}-${dark ? 'dark' : 'light'}.png`;
      await page.screenshot({ path: path.join(out, screenshot), fullPage: true, animations: 'disabled' });
      report.layouts.push({ slug, state, dark, ...metrics, primary: box, screenshot });
    }
  }
  async function tabTo(locator, label) {
    for (let n = 0; n < 180; n++) {
      if (await locator.evaluate(e => e === document.activeElement)) {
        const focus = await locator.evaluate(e => ({ visible: e.matches(':focus-visible'), outline: getComputedStyle(e).outline, ring: getComputedStyle(e).getPropertyValue('--tw-ring-shadow') }));
        assert.ok(focus.visible, label + ' keyboard focus invisible');
        report.keyboard.push({ label, ...focus });
        return;
      }
      await page.keyboard.press('Tab');
    }
    assert.fail(label + ' unreachable through Tab');
  }
  async function convert(slug, name, indices, rotations, semantic = false) {
    await tabTo(action(slug), slug + ' primary');
    const pending = page.waitForEvent('download');
    await page.keyboard.press('Enter');
    const download = await pending;
    const file = path.join(out, name);
    await download.saveAs(file);
    report.outputs.push({ slug, file: name, suggestedFilename: download.suggestedFilename() });
    if (name.endsWith('.zip')) {
      const entries = unzipSync(await fs.readFile(file));
      assert.equal(Object.keys(entries).length, indices.length);
      for (const [i, entry] of Object.entries(entries).entries()) {
        const dest = path.join(out, `${slug}-${i + 1}.pdf`);
        await fs.writeFile(dest, entry[1]);
        plans.push({ path: dest, indices: [indices[i]], rotations });
      }
    } else plans.push({ path: file, indices, rotations, semantic });
    if (semantic) {
      const pdf = await PDFDocument.load(await fs.readFile(file));
      const expectedFields = indices.map(i => ['field' + (i + 1), 'saved value ' + (i + 1)]);
      assert.deepEqual(pdf.getForm().getFields().map(f => [f.getName(), f.getText()]), expectedFields, 'native field catalog and saved values must survive');
      const refs = new Set(pdf.getPages().map(p => p.ref.toString()));
      for (const field of pdf.getForm().getFields()) for (const widget of field.acroField.getWidgets()) assert.ok(refs.has(widget.P()?.toString()), 'widget must belong to a retained page');
      const annotations = (pdf.getPage(0).node.Annots()?.asArray() || []).map(ref => pdf.context.lookup(ref));
      assert.ok(annotations.some(a => a.get(PDFName.of('Subtype'))?.toString() === '/Text'), 'retained comment missing');
      assert.ok(annotations.some(a => { const actionRef = a.get(PDFName.of('A')); if (!actionRef) return false; const aDict = pdf.context.lookup(actionRef); return aDict.get(PDFName.of('URI'))?.decodeText?.() === 'https://example.test/retained-link'; }), 'URI link missing');
      const destination = annotations.find(a => a.get(PDFName.of('Dest')))?.get(PDFName.of('Dest'));
      assert.equal(pdf.context.lookup(destination).get(0).toString(), pdf.getPage(indices.indexOf(2)).ref.toString(), 'internal link must target the retained third source page in the output page tree');
      report.checks.push({ slug, semanticNativeFields: expectedFields, retainedUriCommentAndInternalTarget: true });
    }
    await page.getByRole('button', { name: /^Start over$/i }).waitFor();
    await snapshot(slug, name.replace(/\./g, '-'), page.getByRole('button', { name: /^(Download|Download PDF|Download ZIP)$/ }).first());
    await tabTo(page.getByRole('button', { name: /^Start over$/i }), slug + ' reset');
    await page.keyboard.press('Enter');
    await page.locator('input[type=file]').waitFor({ state: 'attached' });
  }
  try {
    await open('rotate-pdf'); await input('rotate-pdf');
    await tabTo(page.getByRole('button', { name: 'Rotate Right', exact: true }), 'rotate all right'); await page.keyboard.press('Enter');
    await tabTo(page.getByRole('button', { name: 'Rotate page 1 counterclockwise', exact: true }), 'rotate page one left'); await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Rotate page 1 clockwise', exact: true }).click();
    await snapshot('rotate-pdf', 'configured', action('rotate-pdf'));
    await convert('rotate-pdf', 'rotated.pdf', [0, 1, 2, 3], [90, 180, 270, 0]);
    report.checks.push('Rotate global and per-page controls, keyboard action/reset and real four-page output');

    await open('delete-pages'); await input('delete-pages');
    const remove = page.getByLabel('Pages to remove', { exact: true });
    await remove.fill('1-4'); assert.equal(await action('delete-pages').isDisabled(), true);
    await remove.fill('9'); await page.locator('#page-range-error').waitFor(); assert.equal(await action('delete-pages').isDisabled(), true);
    await tabTo(remove, 'delete range'); await page.keyboard.press('Meta+A'); await page.keyboard.insertText('2,4'); await snapshot('delete-pages', 'configured', action('delete-pages'));
    await convert('delete-pages', 'removed.pdf', [0, 2]);
    await input('delete-pages'); await page.getByRole('button', { name: 'Remove all but last', exact: true }).click();
    await convert('delete-pages', 'last-page.pdf', [3]);
    await input('delete-pages'); await page.getByRole('button', { name: 'Page 4', exact: true }).click();
    await input('delete-pages', replacement, 2);
    await page.getByRole('button', { name: 'Page 1', exact: true }).click({ modifiers: ['Shift'] });
    assert.equal(await remove.inputValue(), '1');
    await convert('delete-pages', 'replacement-kept-page-2.pdf', [1]);
    report.checks.push('Delete ranges/order, delete-all/invalid guards, all-but-last, replacement clears Shift anchor');

    await open('extract-pages'); await input('extract-pages');
    await snapshot('extract-pages', 'all', action('extract-pages'));
    await convert('extract-pages', 'all-pages.zip', [0, 1, 2, 3]);
    await input('extract-pages'); await tabTo(page.getByRole('button', { name: 'Select pages', exact: true }), 'extract selected mode'); await page.keyboard.press('Enter');
    const extract = page.getByLabel('Pages to extract', { exact: true });
    assert.equal(await action('extract-pages').isDisabled(), true);
    await extract.fill('1,9'); await page.locator('#page-range-error').waitFor(); assert.equal(await action('extract-pages').isDisabled(), true);
    await tabTo(extract, 'extract range'); await page.keyboard.press('Meta+A'); await page.keyboard.insertText('1,3');
    await tabTo(page.getByRole('checkbox', { name: 'Merge selected pages into one PDF file', exact: true }), 'merge selected pages'); await page.keyboard.press('Space');
    await snapshot('extract-pages', 'selected', action('extract-pages'));
    await convert('extract-pages', 'selected-merged.pdf', [0, 2]);
    report.checks.push('Extract all four separate PDFs and selected merged pages, empty/invalid guards');

    const semanticFile = path.join(fixtureRoot, 'semantics-source.pdf');
    await fs.copyFile(semanticFile, path.join(out, 'source-semantics.pdf'));
    for (const slug of ['rotate-pdf', 'delete-pages', 'extract-pages']) {
      await open(slug); await input(slug, semanticFile, 3);
      if (slug === 'rotate-pdf') await page.getByRole('button', { name: 'Rotate Right', exact: true }).click();
      if (slug === 'delete-pages') await page.getByLabel('Pages to remove', { exact: true }).fill('2');
      if (slug === 'extract-pages') {
        await page.getByRole('button', { name: 'Select pages', exact: true }).click();
        await page.getByLabel('Pages to extract', { exact: true }).fill('1,3');
        await page.getByRole('checkbox', { name: 'Merge selected pages into one PDF file', exact: true }).check();
      }
      await convert(slug, slug + '-semantics.pdf', slug === 'rotate-pdf' ? [0, 1, 2] : [0, 2], slug === 'rotate-pdf' ? [90, 90, 90] : undefined, true);
    }

    for (const slug of ['rotate-pdf', 'delete-pages', 'extract-pages']) {
      for (const invalid of [path.join(fixtureRoot, 'malformed.pdf'), path.join(fixtureRoot, 'empty.pdf'), path.resolve('tests/fixtures/product-qa/page-operations-protected.pdf')]) {
        await open(slug);
        await page.locator('input[type=file]').setInputFiles(invalid);
        await page.locator('main [role=alert]').filter({ hasText: /PDF|password|empty|page|read/i }).first().waitFor();
        assert.equal(await page.getByText('Rendering page previews…', { exact: true }).count(), 0);
        assert.equal(await action(slug).isDisabled(), true);
        await page.screenshot({ path: path.join(out, slug + '-' + path.basename(invalid) + '-error.png'), fullPage: true });
        await input(slug);
        if (slug === 'rotate-pdf') await page.getByRole('button', { name: 'Rotate Right', exact: true }).click();
        if (slug === 'delete-pages') await page.getByLabel('Pages to remove', { exact: true }).fill('2');
        assert.equal(await action(slug).isEnabled(), true);
      }
      report.checks.push(slug + ': malformed/protected/zero-page errors, no stuck grid, valid replacement');

      await open(slug); await input(slug, manyFile, 300);
      if (slug === 'rotate-pdf') await page.getByRole('button', { name: 'Rotate Right', exact: true }).click();
      if (slug === 'delete-pages') await page.getByLabel('Pages to remove', { exact: true }).fill('1');
      const before = downloads;
      await action(slug).click();
      const cancel = page.getByRole('button', { name: 'Cancel', exact: true });
      await cancel.waitFor({ timeout: 15000 });
      const frozen = await page.locator('fieldset button, button[aria-label^="Rotate page"], [aria-label="Extract mode"] button, input[type=checkbox]').evaluateAll(els => els.length > 0 && els.every(el => el.matches(':disabled')));
      assert.ok(frozen, slug + ' page/mode controls must freeze during processing');
      await cancel.click();
      await action(slug).waitFor();
      await page.waitForTimeout(600);
      assert.equal(downloads, before, slug + ' cancelled output must not download');
      assert.equal(await page.getByRole('button', { name: /^(Download|Download PDF|Download ZIP)$/ }).count(), 0);
      await page.screenshot({ path: path.join(out, slug + '-cancelled.png'), fullPage: true });
      // Retry the same real input. Inspect count and boundary text without rendering 300 pages.
      const pending = page.waitForEvent('download'); await action(slug).click();
      const download = await pending; const target = path.join(out, slug + '-retry-' + download.suggestedFilename()); await download.saveAs(target);
      if (slug === 'extract-pages') assert.equal(Object.keys(unzipSync(await fs.readFile(target))).length, 300);
      else assert.equal((await PDFDocument.load(await fs.readFile(target))).getPageCount(), slug === 'delete-pages' ? 299 : 300);
      assert.equal(downloads, before + 1);
      report.checks.push(slug + ': real 300-page cancellation, frozen controls, no stale result, successful retry');
    }
    assert.deepEqual(report.errors, []);
  } catch (error) {
    report.failure = error.stack; process.exitCode = 1;
    await fs.writeFile(path.join(out, 'failure-ui.txt'), await page.locator('body').innerText()).catch(() => {});
    await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {});
  } finally { await browser.close(); }

  // Independent semantic/render inspection after Chromium has closed.
  if (!report.failure) {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const { createCanvas } = require('@napi-rs/canvas');
    const sourceTask = getDocument({ data: new Uint8Array(original), useSystemFonts: true, standardFontDataUrl: path.resolve('node_modules/pdfjs-dist/standard_fonts') + '/' });
    const sourceDoc = await sourceTask.promise;
    async function render(pdf, index, rotation) {
      const p = await pdf.getPage(index + 1), viewport = p.getViewport({ scale: 1, ...(rotation == null ? {} : { rotation }) });
      const canvas = createCanvas(viewport.width, viewport.height);
      await p.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise;
      return { text: (await p.getTextContent()).items.map(x => x.str).join('|'), width: canvas.width, height: canvas.height, pixels: Buffer.from(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data), png: canvas.toBuffer('image/png') };
    }
    try {
      for (const plan of plans) {
        const task = getDocument({ data: new Uint8Array(await fs.readFile(plan.path)), useSystemFonts: true, standardFontDataUrl: path.resolve('node_modules/pdfjs-dist/standard_fonts') + '/' });
        const doc = await task.promise; assert.equal(doc.numPages, plan.indices.length);
        const semanticTask = plan.semantic ? getDocument({ data: new Uint8Array(await fs.readFile(path.join(out, 'source-semantics.pdf'))), useSystemFonts: true, standardFontDataUrl: path.resolve('node_modules/pdfjs-dist/standard_fonts') + '/' }) : null;
        const referenceDoc = semanticTask ? await semanticTask.promise : sourceDoc;
        const comparisons = [];
        for (let i = 0; i < plan.indices.length; i++) {
          const index = plan.indices[i], before = await render(referenceDoc, index, plan.rotations?.[index]), after = await render(doc, i);
          assert.equal(after.text, before.text); if (!plan.semantic) assert.match(after.text, /café Ω Привет/);
          assert.equal(after.width, before.width); assert.equal(after.height, before.height);
          assert.equal(Buffer.compare(after.pixels, before.pixels), 0, path.basename(plan.path) + ' page ' + (i + 1) + ' pixels differ');
          await fs.writeFile(plan.path + '-page-' + (i + 1) + '.png', after.png);
          comparisons.push({ sourcePage: index + 1, text: after.text, width: after.width, height: after.height, changedPixels: 0 });
        }
        await task.destroy(); if (semanticTask) await semanticTask.destroy(); report.checks.push({ output: path.basename(plan.path), comparisons });
      }
    } finally { await sourceTask.destroy(); }
    report.status = 'passed';
  } else report.status = 'failed';
  report.finished = new Date().toISOString();
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, checks: report.checks, failure: report.failure }, null, 2));
})().catch(async error => { report.status = 'failed'; report.failure = error.stack; await fs.mkdir(out, { recursive: true }); await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.error(error); process.exitCode = 1; });
