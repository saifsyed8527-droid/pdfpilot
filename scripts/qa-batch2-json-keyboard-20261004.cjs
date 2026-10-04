// Keyboard-only app controls; synthetic file chooser input is supplied by Playwright.
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PDFPILOT_PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2], out = path.resolve(process.argv[3]);
assert.ok(base && process.argv[3]);
const source = String.raw`{ "id":9007199254740993, "x":-0, "x":1e-400, "unicode":"नमस्ते", "escape":"\u0041" }`;
const tokens = s => s.match(/"(?:\\[\s\S]|[^"\\])*"|[{}\[\],:]|[^\s{}\[\],:]+/g).join('');
const report = { base, cases: [], errors: [], environment: 'Fresh Chromium; emulated 1440/light and 375/actual dark; app controls keyboard-only' };
(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PDFPILOT_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const width of [1440, 375]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
      const page = await context.newPage(); page.setDefaultTimeout(60000); page.on('pageerror', e => report.errors.push(e.message));
      for (const [slug, actionName] of [['json-formatter', 'Format JSON'], ['json-minifier', 'Minify JSON'], ['json-validator', 'Validate JSON']]) {
        const record = { slug, width, focus: [], checks: [] }; report.cases.push(record);
        async function reach(locator, name, reverse = false) {
          await locator.waitFor({ state: 'visible' });
          let reached = false;
          for (let n = 0; n < 160; n++) { if (await locator.evaluate(el => el === document.activeElement)) { reached = true; break; } await page.keyboard.press(reverse ? 'Shift+Tab' : 'Tab'); }
          assert.ok(reached, slug + ' keyboard unreachable: ' + name);
          const focus = await locator.evaluate(el => ({ visible: el.matches(':focus-visible'), outline: getComputedStyle(el).outline, shadow: getComputedStyle(el).boxShadow }));
          assert.ok(focus.visible, slug + ' focus not visible: ' + name);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
          const screenshot = `${slug}-${width}-${name}.png`; await page.screenshot({ path: path.join(out, screenshot), fullPage: true, animations: 'disabled' });
          record.focus.push({ name, ...focus, screenshot });
        }
        const response = await page.goto(base + '/' + slug, { waitUntil: 'domcontentloaded' }); assert.equal(response.status(), 200);
        await page.getByRole('button', { name: /^Switch to (dark|light) mode$/ }).waitFor();
        if (width === 375 && !(await page.locator('html').evaluate(el => el.classList.contains('dark')))) {
          await reach(page.getByRole('button', { name: 'Switch to dark mode', exact: true }), 'theme'); await page.keyboard.press('Enter');
          await page.getByRole('button', { name: 'Switch to light mode', exact: true }).waitFor();
        }
        record.dark = await page.locator('html').evaluate(el => el.classList.contains('dark')); assert.equal(record.dark, width === 375);
        const input = page.getByLabel('JSON input', { exact: true }), action = page.getByRole('button', { name: actionName, exact: true });
        await reach(input, 'input'); await page.keyboard.insertText(source);
        if (slug === 'json-formatter') {
          await reach(page.getByLabel('Indentation', { exact: true }), 'indentation'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
          assert.equal(await page.getByLabel('Indentation', { exact: true }).inputValue(), '4');
        }
        await reach(action, 'convert', true); await page.keyboard.press('Enter'); await page.getByText('Valid JSON syntax', { exact: true }).waitFor();
        const output = page.getByLabel(slug === 'json-validator' ? 'Validation report' : 'JSON output', { exact: true });
        const expected = await output.inputValue();
        if (slug === 'json-validator') assert.match(expected, /^Valid JSON syntax/); else assert.equal(tokens(expected), tokens(source));
        if (slug === 'json-formatter') assert.match(expected, /\n {4}"id"/);
        await reach(page.getByRole('button', { name: 'Copy result', exact: true }), 'copy'); await page.keyboard.press('Enter');
        await page.getByText('Result copied to clipboard.', { exact: true }).waitFor(); assert.equal(await page.evaluate(() => navigator.clipboard.readText()), expected);
        const downloadButton = page.getByRole('button', { name: slug === 'json-validator' ? 'Download report' : 'Download JSON', exact: true });
        await reach(downloadButton, 'download', true); const pending = page.waitForEvent('download'); await page.keyboard.press('Enter'); const download = await pending;
        const target = path.join(out, width + '-' + slug + '-' + download.suggestedFilename()); await download.saveAs(target); assert.equal((await fs.readFile(target)).toString(), expected);
        await reach(input, 'invalid-input', true); await page.keyboard.press('Meta+A'); await page.keyboard.insertText('{\n "a":1,\n}');
        assert.equal(await downloadButton.count(), 0); await reach(action, 'validate-error', true); await page.keyboard.press('Enter'); await page.getByText('Invalid JSON syntax', { exact: true }).waitFor();
        await reach(page.getByRole('button', { name: 'Go to error', exact: true }), 'go-to-error'); await page.keyboard.press('Enter');
        assert.equal(await input.evaluate(el => el === document.activeElement), true); assert.equal(await input.evaluate(el => el.selectionStart), (await input.inputValue()).indexOf('}'));
        const reset = page.getByRole('button', { name: 'Reset all input and output', exact: true }); await reach(reset, 'reset', true); await page.keyboard.press('Enter');
        assert.equal(await input.inputValue(), ''); assert.equal(await output.inputValue(), '');
        await reach(page.getByRole('button', { name: 'Choose JSON file', exact: true }), 'file-chooser'); const chooser = page.waitForEvent('filechooser'); await page.keyboard.press('Enter');
        await (await chooser).setFiles({ name: 'keyboard.json', mimeType: 'application/json', buffer: Buffer.from(source) });
        await reach(action, 'file-convert', true); await page.keyboard.press('Enter'); await page.getByText('Valid JSON syntax', { exact: true }).waitFor();
        await reach(reset, 'file-reset', true); await page.keyboard.press('Enter');
        record.status = 'passed'; record.checks.push('Keyboard text/file input, indentation where applicable, exact tokens/copy/download, error location and reset');
      }
      await context.close();
    }
    assert.deepEqual(report.errors, []); report.status = 'passed';
  } catch (error) { report.status = 'failed'; report.failure = error.stack; process.exitCode = 1; }
  finally { await browser.close(); await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
