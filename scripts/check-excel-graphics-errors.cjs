// Browser-only failure/cancellation regression using the synthetic QA workbook.
// Never use a production URL or a private customer workbook here.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { unzipSync, zipSync, strFromU8, strToU8 } = require('fflate');
const { chromium } = require(process.env.PDFPILOT_PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:3117';
const input = process.argv[3];
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base) || !input) throw new Error('Supply a local preview URL and the synthetic graphics workbook');

(async () => {
  const original = unzipSync(await fs.readFile(input));
  const unsupported = { ...original };
  unsupported['xl/charts/chart1.xml'] = strToU8(strFromU8(original['xl/charts/chart1.xml']).replaceAll('barChart', 'bar3DChart'));
  const linked = { ...original };
  const pictureRels = Object.keys(linked).find(n => /^xl\/drawings\/_rels\/.+\.rels$/.test(n) && /relationships\/image/.test(strFromU8(linked[n])));
  assert.ok(pictureRels, 'fixture has embedded pictures');
  linked[pictureRels] = strToU8(strFromU8(linked[pictureRels]).replace(/(<(?:\w+:)?Relationship\b[^>]*\bType="[^"]*\/image"[^>]*\bTarget=")[^"]*(")/, '$1https://example.invalid/private-picture.png$2 TargetMode="External"'));
  assert.match(strFromU8(linked[pictureRels]), /example\.invalid/);
  const browser = await chromium.launch({ headless: true, ...(process.env.PDFPILOT_CHROME ? { executablePath: process.env.PDFPILOT_CHROME } : {}) });
  try {
    for (const [name, entries, message] of [['unsupported', unsupported, /native PDF export/], ['linked', linked, /linked, not embedded/]]) {
      const page = await browser.newPage({ acceptDownloads: true });
      const downloads = [], remote = [], errors = [];
      page.on('download', d => downloads.push(d));
      page.on('pageerror', e => errors.push(e.message));
      page.on('request', r => { if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== base) remote.push(r.url()); });
      await page.goto(base + '/excel-to-pdf');
      await page.locator('input[type=file]').setInputFiles({ name: `${name}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(zipSync(entries)) });
      await page.getByRole('checkbox').first().waitFor();
      await page.getByRole('button', { name: 'Convert to PDF', exact: true }).click();
      const alert = page.getByRole('alert').filter({ hasText: message });
      await alert.waitFor({ timeout: 20000 });
      assert.match(await alert.innerText(), message);
      assert.equal(downloads.length, 0, 'no incomplete PDF is downloaded');
      assert.deepEqual(remote, [], 'linked image URLs must not be fetched');
      assert.deepEqual(errors, []);
      if (name === 'unsupported') {
        await page.getByRole('button', { name: 'Clear', exact: true }).click();
        await page.getByRole('checkbox', { name: 'Bar', exact: true }).check();
        const ready = page.waitForEvent('download', { timeout: 30000 });
        await page.getByRole('button', { name: 'Convert to PDF', exact: true }).click();
        const download = await ready;
        assert.equal(await download.failure(), null, 'an unselected unsupported sheet does not block a supported sheet');
      }
      await page.close();
      console.log('PASS', name, 'clear error, no partial download, no remote fetch');
    }
    const page = await browser.newPage({ acceptDownloads: true });
    const downloads = [];
    page.on('download', d => downloads.push(d));
    await page.route('**/fonts/*.ttf', async route => { await new Promise(resolve => setTimeout(resolve, 1000)); await route.continue(); });
    await page.goto(base + '/excel-to-pdf');
    await page.locator('input[type=file]').setInputFiles(input);
    await page.getByRole('checkbox').first().waitFor();
    await page.getByRole('button', { name: 'Convert to PDF', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).waitFor({ state: 'hidden' });
    await page.waitForTimeout(1800);
    assert.equal(downloads.length, 0, 'cancellation prevents a late/stale download');
    assert.ok(await page.getByRole('button', { name: 'Convert to PDF', exact: true }).isEnabled());
    console.log('PASS cancellation: no stale download, retry remains available');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
