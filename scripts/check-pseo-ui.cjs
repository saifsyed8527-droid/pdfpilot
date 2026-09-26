const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PDFPILOT_PLAYWRIGHT_MODULE || 'playwright');
const base = (process.argv[2] || 'http://127.0.0.1:4340').replace(/\/$/, '');
async function main() {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfpilot-pseo-ui-'));
  console.log('UI evidence', output);
  const browser = await chromium.launch({ headless: true, ...(process.env.PDFPILOT_CHROME ? { executablePath: process.env.PDFPILOT_CHROME } : {}) });
  const errors = [], checks = [];
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    await context.route('https://**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    const page = await context.newPage(); page.on('pageerror', error => { const detail = { path: page.url(), message: error.message }; errors.push(detail); console.error('Browser error', detail); });
    for (const dark of [false, true]) for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [slug, url] of [['gallery', '/templates'], ['document', '/templates/habit-tracker-template'], ['workflows', '/pdf-workflows'], ['workflow', '/pdf-workflows/merge-and-compress-pdf']]) {
        assert.equal((await page.goto(base + url)).status(), 200);
        await page.getByRole('button', { name: /^Switch to (dark|light) mode$/ }).waitFor();
        const changeTheme = page.getByRole('button', { name: dark ? 'Switch to dark mode' : 'Switch to light mode', exact: true });
        if (await changeTheme.count()) await changeTheme.click();
        await page.waitForFunction(dark => document.documentElement.classList.contains('dark') === dark, dark);
        for (const img of await page.locator('main img').all()) { await img.scrollIntoViewIfNeeded(); await img.evaluate(image => image.decode()); }
        await page.getByRole('heading', { level: 1 }).scrollIntoViewIfNeeded();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, url + ' horizontal overflow');
        await page.screenshot({ path: path.join(output, `${slug}-${dark ? 'dark' : 'light'}-${width}.png`) });
        if (slug === 'document') { await page.locator('#editor').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(output, `editor-${dark ? 'dark' : 'light'}-${width}.png`) }); }
        checks.push({ url, dark, width });
      }
    }
    await page.goto(base + '/templates'); await page.getByRole('searchbox', { name: 'Search PDF templates', exact: true }).fill('meeting');
    assert.equal(await page.locator('main').getByRole('status').textContent(), '3 editable templates');
    await page.getByRole('searchbox').fill('doesnotexist'); assert.ok(await page.getByText('No matching template.', { exact: false }).isVisible());
    await page.goto(base + '/');
    await page.locator('main input[type="search"]').fill('weekly planner');
    assert.ok(await page.getByRole('link', { name: /weekly planner template/i }).isVisible(), 'new templates are discoverable in homepage search');

    await page.goto(base + '/templates/contact-list-template');
    await page.waitForFunction(() => Boolean(window.dataLayer), { timeout: 10000 });
    const canary = 'PRIVATE-PSEO-CANARY';
    await page.getByLabel('Row 1 Name', { exact: true }).fill(canary);
    let pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download my PDF', exact: true }).click(); await pending;
    await page.waitForFunction(() => window.dataLayer.some(entry => entry[1] === 'template_downloaded'));
    let events = await page.evaluate(() => window.dataLayer.map(entry => Array.from(entry)));
    assert.ok(events.some(event => event[1] === 'template_started'));
    assert.ok(!JSON.stringify(events).includes(canary), 'form text never enters analytics');

    await page.goto(base + '/pdf-workflows/merge-pdf-and-add-page-numbers');
    await page.route('**/template-samples/workflow-a.pdf', route => route.fulfill({ status: 503, body: 'Unavailable' }));
    await page.getByRole('button', { name: 'Try sample files', exact: true }).click(); await page.getByRole('alert').filter({ hasText: 'sample could not be loaded' }).waitFor();
    await page.unroute('**/template-samples/workflow-a.pdf');
    await page.getByRole('button', { name: 'Try sample files', exact: true }).click(); await page.getByRole('list', { name: 'Selected files' }).waitFor();
    await page.getByRole('button', { name: 'Move file 2 up', exact: true }).click();
    assert.ok((await page.getByRole('list', { name: 'Selected files' }).getByRole('listitem').first().textContent()).includes('workflow-b.pdf'));
    await page.getByRole('button', { name: 'Run workflow', exact: true }).click(); await page.getByRole('button', { name: 'Download PDF', exact: true }).waitFor();
    pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download PDF', exact: true }).click(); await pending;
    await page.waitForFunction(() => window.dataLayer?.some(entry => entry[1] === 'tool_chain_downloaded'));
    events = await page.evaluate(() => window.dataLayer.map(entry => Array.from(entry)));
    for (const name of ['tool_chain_started', 'tool_chain_completed', 'tool_chain_downloaded']) assert.ok(events.some(event => event[1] === name), name);
    assert.ok(!JSON.stringify(events).includes('workflow-a.pdf') && !JSON.stringify(events).includes('workflow-b.pdf'), 'filenames never enter analytics');
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ checkedAt: new Date().toISOString(), checks, runtimeErrors: errors, analyticsEvents: ['template_started', 'template_downloaded', 'tool_chain_started', 'tool_chain_completed', 'tool_chain_downloaded'], sampleFailureRecovery: true, fileReordering: true, search: true }, null, 2));
    console.log(JSON.stringify({ passed: true, layouts: checks.length, output }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
