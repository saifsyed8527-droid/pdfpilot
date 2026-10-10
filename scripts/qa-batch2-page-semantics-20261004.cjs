// Independent real-download semantic evidence. Known failures are collected, not hidden.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { PDFDocument, PDFName } = require('pdf-lib');
const { chromium } = require(process.env.PDFPILOT_PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2], out = path.resolve(process.argv[3]);
assert.ok(base && process.argv[3], 'Pass URL and evidence directory');
const pagesRoot = process.env.PDFPILOT_PAGES_FIXTURES || '/tmp/pdfpilot-pages-b';
const metadataRoot = process.env.PDFPILOT_METADATA_FIXTURES || '/tmp/pdfpilot-page-metadata-b';
const report = { base, sourceCommit: process.env.PDFPILOT_SOURCE_COMMIT, scope: 'Document semantics; independent of bounded UI/cancellation acceptance', fullToolCertification: false, started: new Date().toISOString(), outputs: [], properties: [], pageErrors: [], console: [] };
function check(name, actual, expected, scope) {
  let pass = true; try { assert.deepEqual(actual, expected); } catch { pass = false; }
  report.properties.push({ scope, name, actual, expected, pass });
}
function shape(node) {
  if (!node) return node;
  return { ...(node.role ? { role: node.role } : {}), ...(node.type ? { type: node.type } : {}), ...(node.alt ? { alt: node.alt } : {}), ...(node.children ? { children: node.children.map(shape) } : {}) };
}
const cases = [
  { kind: 'forms', file: path.join(pagesRoot, 'semantics-source.pdf'), count: 3, indices: [0, 2], remove: '2', extract: '1,3' },
  { kind: 'tags', file: path.join(metadataRoot, 'tagged-source.pdf'), count: 3, indices: [0, 2], remove: '2', extract: '1,3' },
  { kind: 'labels', file: path.join(metadataRoot, 'labels-source.pdf'), count: 7, indices: [1, 5, 6], remove: '1,3-5', extract: '2,6-7' },
];
(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PDFPILOT_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  page.setDefaultTimeout(60000);
  page.on('pageerror', e => report.pageErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.console.push(m.text()); });
  try {
    for (const item of cases) {
      await fs.copyFile(item.file, path.join(out, item.kind + '-source.pdf'));
      for (const slug of ['rotate-pdf', 'delete-pages', 'extract-pages']) {
        const response = await page.goto(base + '/' + slug, { waitUntil: 'domcontentloaded' });
        assert.equal(response.status(), 200);
        await page.getByRole('button', { name: /^Switch to (dark|light) mode$/ }).waitFor();
        await page.locator('input[type=file]').setInputFiles(item.file);
        if (slug === 'rotate-pdf') {
          await page.getByRole('button', { name: `Rotate page ${item.count} clockwise`, exact: true }).waitFor();
          await page.getByRole('button', { name: 'Rotate Right', exact: true }).click();
        } else {
          await page.getByRole('button', { name: new RegExp(`^Page ${item.count}(, selected)?$`) }).waitFor();
          if (slug === 'delete-pages') await page.getByLabel('Pages to remove', { exact: true }).fill(item.remove);
          else {
            await page.getByRole('button', { name: 'Select pages', exact: true }).click();
            await page.getByLabel('Pages to extract', { exact: true }).fill(item.extract);
            await page.getByRole('checkbox', { name: 'Merge selected pages into one PDF file', exact: true }).check();
          }
        }
        const action = slug === 'rotate-pdf' ? page.getByRole('button', { name: 'Rotate PDF', exact: true }) : slug === 'delete-pages' ? page.getByRole('button', { name: /^Remove \d+ pages?$/ }) : page.getByRole('button', { name: 'Extract Pages', exact: true });
        const pending = page.waitForEvent('download'); await action.click();
        const download = await pending, name = slug + '-' + item.kind + '.pdf';
        await download.saveAs(path.join(out, name));
        const indices = slug === 'rotate-pdf' ? Array.from({ length: item.count }, (_, i) => i) : item.indices;
        report.outputs.push({ slug, kind: item.kind, file: name, indices, suggestedFilename: download.suggestedFilename() });
        await page.getByRole('button', { name: /^Start over$/i }).waitFor();
        await page.screenshot({ path: path.join(out, name + '-result.png'), fullPage: true, animations: 'disabled' });
        await page.getByRole('button', { name: /^Start over$/i }).click();
      }
    }
  } catch (error) {
    report.browserFailure = error.stack;
    await fs.writeFile(path.join(out, 'failure-ui.txt'), await page.locator('body').innerText()).catch(() => {});
    await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {});
  } finally { await browser.close(); }
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  async function inspect(file) {
    const bytes = await fs.readFile(file), lib = await PDFDocument.load(bytes);
    const task = getDocument({ data: new Uint8Array(bytes), standardFontDataUrl: path.resolve('node_modules/pdfjs-dist/standard_fonts') + '/' });
    const pdf = await task.promise;
    try {
      const inspected = { lib, count: pdf.numPages, labels: await pdf.getPageLabels(), pages: [], pageObjects: lib.context.enumerateIndirectObjects().filter(([, value]) => value.get?.(PDFName.of('Type')) === PDFName.of('Page')).length };
      for (let n = 1; n <= pdf.numPages; n++) {
        const p = await pdf.getPage(n), content = await p.getTextContent({ includeMarkedContent: true });
        inspected.pages.push({ text: content.items.filter(x => 'str' in x).map(x => x.str).join('|'), structure: await p.getStructTree(), annotations: await p.getAnnotations() });
      }
      return inspected;
    } finally { await task.destroy(); }
  }
  for (const output of report.outputs) {
    const scope = output.slug + '/' + output.kind;
    try {
      const source = await inspect(path.join(out, output.kind + '-source.pdf')), result = await inspect(path.join(out, output.file));
      check('visible page count', result.count, output.indices.length, scope);
      check('no hidden serialized page objects', result.pageObjects, result.count, scope);
      check('retained selectable text/order', result.pages.map(p => p.text), output.indices.map(i => source.pages[i].text), scope);
      if (output.kind === 'labels') check('exact retained page labels', result.labels, output.indices.map(i => source.labels[i]), scope);
      if (output.kind === 'tags') for (let n = 0; n < output.indices.length; n++) check('page ' + (n + 1) + ' accessibility structure', shape(result.pages[n].structure), shape(source.pages[output.indices[n]].structure), scope);
      if (output.kind === 'forms') {
        const fields = result.lib.getForm().getFields(), expected = output.indices.map(i => ['field' + (i + 1), 'saved value ' + (i + 1)]);
        check('native field catalog and values', fields.map(f => [f.getName(), f.getText()]), expected, scope);
        const pageRefs = new Set(result.lib.getPages().map(p => p.ref.toString()));
        check('native widget page ownership', fields.length > 0 && fields.every(f => f.acroField.getWidgets().every(w => pageRefs.has(w.P()?.toString()))), true, scope);
        const anns = result.pages[0].annotations;
        check('retained external URI', anns.some(a => a.url === 'https://example.test/retained-link'), true, scope);
        check('retained text comment', anns.some(a => a.subtype === 'Text'), true, scope);
        const raw = (result.lib.getPage(0).node.Annots()?.asArray() || []).map(ref => result.lib.context.lookup(ref));
        const dest = raw.find(a => a.get(PDFName.of('Dest')))?.get(PDFName.of('Dest'));
        check('internal destination points to retained original page 3', dest ? result.lib.context.lookup(dest).get(0).toString() : null, result.lib.getPage(output.indices.indexOf(2)).ref.toString(), scope);
        const field = fields.find(f => f.getName() === expected[0][0]);
        if (field) {
          field.setText('F VERIFIED NATIVE FIELD');
          const edited = path.join(out, output.file.replace(/\.pdf$/, '-edited.pdf'));
          await fs.writeFile(edited, await result.lib.save());
          const reloaded = await inspect(edited);
          check('editable native field survives save/reload', reloaded.pages[0].annotations.some(a => a.fieldName === expected[0][0] && a.fieldValue === 'F VERIFIED NATIVE FIELD'), true, scope);
        } else check('editable native field survives save/reload', 'native field missing', true, scope);
      }
    } catch (error) { report.properties.push({ scope, name: 'inspection exception', actual: error.stack, pass: false }); }
  }
  check('browser runtime errors', report.pageErrors, [], 'browser');
  report.failedProperties = report.properties.filter(p => !p.pass);
  report.status = report.browserFailure ? 'browser-failed' : report.failedProperties.length ? 'known-semantic-gaps' : 'all-tested-properties-pass';
  report.fullToolCertification = false; // This bounded fixture matrix is not every required tool acceptance check.
  report.finished = new Date().toISOString();
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, outputs: report.outputs.length, failedProperties: report.failedProperties, browserFailure: report.browserFailure }, null, 2));
  if (report.browserFailure || report.failedProperties.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
