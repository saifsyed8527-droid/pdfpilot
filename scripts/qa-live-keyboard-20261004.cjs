// App interactions use only Tab/Shift+Tab, typing, Space and Enter. Synthetic
// files are supplied through the file chooser opened by the keyboard.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PDFPILOT_PLAYWRIGHT_MODULE || 'playwright');
const { PDFDocument, PDFName } = require('pdf-lib');
const base = process.argv[2];
const out = path.resolve(process.argv[3]);
assert.ok(base && process.argv[3], 'Pass explicit base URL and evidence directory');
const sample = 'Keyboard café + नमस्ते\nLine two';
const configs = [
  { slug: 'base64-encode', action: 'Encode to Base64', input: sample, output: Buffer.from(sample).toString('base64') },
  { slug: 'base64-decode', action: 'Decode Base64', input: Buffer.from(sample).toString('base64'), output: sample },
  { slug: 'url-encode', action: 'URL Encode', input: sample, output: encodeURIComponent(sample) },
  { slug: 'url-decode', action: 'URL Decode', input: encodeURIComponent(sample), output: sample },
];
const report = { base, started: new Date().toISOString(), environment: 'Fresh isolated Chromium; emulated 1440/light and 375/dark viewports; OS file chooser supplied synthetic fixture by Playwright', cases: [], errors: [] };
let sequence = 0;
(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PDFPILOT_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const width of (process.env.PDFPILOT_QA_KEYBOARD_WIDTHS || '1440,375').split(',').map(Number)) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: width === 375 ? 'dark' : 'light', acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
      const page = await context.newPage();
      page.setDefaultTimeout(60000);
      page.on('pageerror', e => report.errors.push(e.message));
      async function reach(locator, name, record, reverse = false) {
        await locator.waitFor({ state: 'visible' });
        let reached = false;
        for (let i = 0; i < 180; i++) {
          if (await locator.evaluate(el => el === document.activeElement)) { reached = true; break; }
          await page.keyboard.press(reverse ? 'Shift+Tab' : 'Tab');
        }
        assert.ok(reached, `${record.slug} ${width}: ${name} unreachable by keyboard`);
        const focus = await locator.evaluate(el => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return { focusVisible: el.matches(':focus-visible'), outline: s.outline, boxShadow: s.boxShadow, ring: s.getPropertyValue('--tw-ring-shadow'), color: s.color, background: s.backgroundColor, rect: { x: r.x, y: r.y, width: r.width, height: r.height }, viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth }; });
        assert.ok(focus.focusVisible, `${name}: :focus-visible missing`);
        assert.ok((!focus.outline.includes('none') && !focus.outline.includes(' 0px')) || /[1-9][0-9]*px/.test(focus.ring), `${name}: no visible focus outline/ring (${JSON.stringify(focus)})`);
        assert.ok(focus.rect.width > 0 && focus.rect.height > 0);
        assert.ok(focus.scrollWidth <= width + 1, `${name}: horizontal overflow`);
        const screenshot = `${String(++sequence).padStart(3, '0')}-${record.slug}-${width}-${name}.png`;
        await page.screenshot({ path: path.join(out, screenshot), fullPage: true });
        record.focus.push({ name, ...focus, screenshot });
      }
      async function open(slug, record) {
        const response = await page.goto(base + '/' + slug, { waitUntil: 'domcontentloaded' });
        assert.equal(response.status(), 200);
        await page.getByRole('button', { name: /^Switch to (dark|light) mode$/ }).waitFor();
        const actualDark = await page.locator('html').evaluate(el => el.classList.contains('dark'));
        if (actualDark !== (width === 375)) {
          await reach(page.getByRole('button', { name: width === 375 ? 'Switch to dark mode' : 'Switch to light mode', exact: true }), 'theme-toggle', record);
          await page.keyboard.press('Enter');
          await page.getByRole('button', { name: width === 375 ? 'Switch to light mode' : 'Switch to dark mode', exact: true }).waitFor();
          await page.evaluate(() => Promise.all(document.getAnimations().filter(a => a instanceof CSSTransition).map(a => a.finished.catch(() => {}))));
        }
        record.dark = await page.locator('html').evaluate(el => el.classList.contains('dark'));
        assert.equal(record.dark, width === 375, 'Assert actual PDFPilot theme, not browser media preference');
      }
      for (const config of configs) {
        const record = { slug: config.slug, width, focus: [], checks: [] };
        report.cases.push(record);
        await open(config.slug, record);
        const input = page.locator('#' + config.slug + '-input');
        const action = page.getByRole('button', { name: config.action, exact: true });
        assert.equal(await action.isDisabled(), true);
        await reach(input, 'input', record);
        await page.keyboard.insertText(config.input);
        if (config.slug === 'url-decode') {
          await reach(page.getByRole('checkbox'), 'plus-setting', record);
          await page.keyboard.press('Space');
          assert.equal(await page.getByRole('checkbox').isChecked(), true);
        }
        await reach(action, 'convert', record, true);
        await page.keyboard.press('Enter');
        await page.getByRole('button', { name: 'Download output', exact: true }).waitFor();
        assert.equal(await page.locator('#' + config.slug + '-output').inputValue(), config.output);
        const filename = page.getByLabel('Download filename', { exact: true });
        await reach(filename, 'filename', record);
        await page.keyboard.press('Meta+A');
        await page.keyboard.insertText(config.slug + '-keyboard.txt');
        await reach(page.getByRole('button', { name: 'Copy output', exact: true }), 'copy', record);
        await page.keyboard.press('Enter');
        await page.getByText('Output copied to clipboard.', { exact: true }).waitFor();
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), config.output);
        await reach(page.getByRole('button', { name: 'Download output', exact: true }), 'download', record, true);
        const pending = page.waitForEvent('download');
        await page.keyboard.press('Enter');
        const download = await pending;
        assert.equal(download.suggestedFilename(), config.slug + '-keyboard.txt');
        const target = path.join(out, width + '-' + download.suggestedFilename());
        await download.saveAs(target);
        assert.deepEqual(await fs.readFile(target), Buffer.from(config.output));
        const reset = page.getByRole('button', { name: 'Reset all input and output', exact: true });
        await reach(reset, 'reset', record, true);
        await page.keyboard.press('Enter');
        assert.equal(await input.inputValue(), '');
        assert.equal(await page.locator('#' + config.slug + '-output').inputValue(), '');
        assert.equal(await page.getByRole('button', { name: 'Download output', exact: true }).count(), 0);
        record.checks.push('Keyboard text input, setting where relevant, conversion, custom filename, exact clipboard and downloaded bytes, reset');
        if (width === 1440) {
          await reach(page.getByRole('button', { name: 'File', exact: true }), 'file-mode', record);
          await page.keyboard.press('Enter');
          await reach(page.getByRole('button', { name: 'Choose file', exact: true }), 'file-chooser', record);
          const chooser = page.waitForEvent('filechooser');
          await page.keyboard.press('Enter');
          await (await chooser).setFiles({ name: 'keyboard-input.txt', mimeType: 'text/plain', buffer: Buffer.from(config.input) });
          await action.waitFor();
          await reach(action, 'file-convert', record, true);
          await page.keyboard.press('Enter');
          await page.getByRole('button', { name: 'Download output', exact: true }).waitFor();
          assert.equal(await page.locator('#' + config.slug + '-output').inputValue(), config.output);
          await reach(reset, 'file-reset', record, true);
          await page.keyboard.press('Enter');
          record.checks.push('Keyboard file-mode selection, actual chooser activation, conversion, reset');
        }
        record.status = 'passed';
      }
      const record = { slug: 'flatten-pdf', width, focus: [], checks: [] };
      report.cases.push(record);
      await open('flatten-pdf', record);
      await reach(page.getByRole('button', { name: 'Select PDF files, Drop files here', exact: true }), 'select-files', record);
      const chooser = page.waitForEvent('filechooser');
      await page.keyboard.press('Enter');
      await (await chooser).setFiles(path.join(process.env.PDFPILOT_FLATTEN_FIXTURES || '/tmp/pdfpilot-flatten-b', 'forms-source.pdf'));
      await reach(page.getByRole('button', { name: 'Switch to list view', exact: true }), 'list-view', record);
      await page.keyboard.press('Enter');
      assert.equal(await page.getByRole('button', { name: 'Switch to grid view', exact: true }).getAttribute('aria-pressed'), 'true');
      await reach(page.getByRole('button', { name: 'Flatten PDF', exact: true }), 'flatten', record);
      await page.keyboard.press('Enter');
      await page.getByText('6 fields flattened · 2 pages', { exact: true }).waitFor();
      await reach(page.getByRole('button', { name: 'Download PDF', exact: true }).last(), 'download', record);
      const pending = page.waitForEvent('download');
      await page.keyboard.press('Enter');
      const download = await pending;
      const target = path.join(out, width + '-flattened-keyboard.pdf');
      await download.saveAs(target);
      const pdf = await PDFDocument.load(await fs.readFile(target));
      assert.equal(pdf.getPageCount(), 2);
      assert.equal(pdf.getForm().getFields().length, 0);
      const annotationTypes = pdf.getPages().flatMap(p => (p.node.Annots()?.asArray() || []).map(ref => pdf.context.lookup(ref).get(PDFName.of('Subtype'))?.toString()));
      assert.ok(annotationTypes.includes('/Link') && annotationTypes.includes('/Text'));
      assert.ok(!annotationTypes.includes('/Widget'));
      await reach(page.getByRole('button', { name: 'Start over', exact: true }), 'reset', record);
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Select PDF files, Drop files here', exact: true }).waitFor();
      record.checks.push('Keyboard chooser, list-view setting, flatten, real zero-field two-page download with annotations retained, reset');
      record.status = 'passed';
      await context.close();
    }
    assert.deepEqual(report.errors, []);
    report.status = 'passed';
  } catch (error) { report.status = 'failed'; report.failure = error.stack; process.exitCode = 1; }
  finally { report.finished = new Date().toISOString(); await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); console.log(JSON.stringify({ status: report.status, cases: report.cases.map(c => ({ slug: c.slug, width: c.width, status: c.status })), failure: report.failure }, null, 2)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
