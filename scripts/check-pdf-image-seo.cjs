const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PDFPILOT_PLAYWRIGHT_MODULE || 'playwright');
const { load } = require('./load-pseo-modules.cjs');
const { PDF_IMAGE_COPY } = load('src/lib/i18n/pdf-image-copy.ts');
const { CORE_PAGE_PATHS } = load('src/lib/i18n/core-content.ts');
const { LOCALES } = load('src/lib/i18n/locales.ts');
const pages = require('../src/lib/content/pseo-pages.json').filter(p => p.baseToolId === 'pdf-to-jpg');
const base = process.argv[2] || 'http://127.0.0.1:4371';
const out = path.resolve('docs/qa/pdf-images-2026-09-29');
(async () => {
  assert.equal(pages.length, 6);
  const browser = await chromium.launch({ headless: true, ...(process.env.PDFPILOT_CHROME ? { executablePath: process.env.PDFPILOT_CHROME } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await context.route('https://**/*', route => route.abort());
  const page = await context.newPage(), checks = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(60000);
  async function meta(url, canonical) {
    const response = await page.goto(base + url, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200, url);
    assert.equal(await page.locator('h1').count(), 1, url + ' single heading');
    assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'), canonical);
    const robots = await page.locator('meta[name=robots]').evaluateAll(nodes => nodes.map(n => n.content).join(' '));
    assert.ok(!robots.includes('noindex'));
    assert.ok(!(response.headers()['x-robots-tag'] || '').includes('noindex'));
    assert.ok((await page.locator('meta[name=description]').getAttribute('content')).length > 30);
    return page.locator('link[rel=alternate][hreflang]').evaluateAll(nodes => Object.fromEntries(nodes.map(n => [n.hreflang, n.href])));
  }
  try {
    const coreAlternates = {};
    for (const locale of LOCALES) {
      const route = '/' + [locale.segment, CORE_PAGE_PATHS[locale.code].pdfToJpg].filter(Boolean).join('/');
      coreAlternates[locale.code] = await meta(route, 'https://pdfpilot.net' + route);
      assert.equal(coreAlternates[locale.code]['x-default'], 'https://pdfpilot.net/pdf-to-jpg');
      checks.push({ test: 'localized core canonical, indexability and metadata', locale: locale.code, route });
    }
    for (const values of Object.values(coreAlternates)) assert.deepEqual(values, coreAlternates.en, 'reciprocal core language set');
    for (const intent of pages) {
      const route = new URL(intent.canonicalUrl).pathname, copy = PDF_IMAGE_COPY[intent.language];
      const alternates = await meta(route, intent.canonicalUrl);
      const counterpart = pages.find(p => p.modifierValue === intent.modifierValue && p.language !== intent.language);
      assert.equal(alternates[intent.language], intent.canonicalUrl);
      assert.equal(alternates[counterpart.language], counterpart.canonicalUrl);
      assert.equal(alternates['x-default'], pages.find(p => p.modifierValue === intent.modifierValue && p.language === 'en').canonicalUrl);
      assert.equal(await page.locator('h1').innerText(), intent.h1);
      assert.ok((await page.locator('body').innerText()).includes(intent.howToSteps[0]));
      const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
      assert.ok(schemas.map(JSON.parse).some(s => s['@type'] === 'WebPage' && s.url === intent.canonicalUrl && s.inLanguage === intent.language));
      const core = intent.language === 'pt-BR' ? '/pt-br/pdf-para-jpg' : '/pdf-to-jpg';
      assert.ok(await page.locator(`a[href="${core}"]`).count());
      const [picker] = await Promise.all([page.waitForEvent('filechooser'), page.locator('.pdf-tool-landing [role=button]').click()]);
      await picker.setFiles(path.join(out, 'quality.pdf'));
      await page.getByRole('heading', { name: copy.options, exact: true }).waitFor();
      if (intent.modifierValue === 'pdf-to-png') await page.getByRole('button', { name: 'PNG', exact: true }).click();
      if (intent.modifierValue === 'extract-images') await page.getByRole('button', { name: new RegExp('^' + copy.images) }).click();
      await page.getByRole('button', { name: copy.convert, exact: true }).click();
      const download = page.getByRole('button', { name: copy.download + ' (ZIP)', exact: true });
      await download.waitFor({ timeout: 120000 });
      const downloaded = page.waitForEvent('download'); await download.click();
      assert.equal(await (await downloaded).failure(), null);
      if (intent.language === 'pt-BR') assert.equal(await page.getByText('Continue with your PDF', { exact: true }).count(), 0);
      checks.push({ test: 'intent metadata, reciprocal languages, schema and real localized conversion/download', route });
    }
    const index = await (await context.request.get(base + '/sitemaps/pseo.xml')).text();
    let allXml = '';
    for (const [, url] of index.matchAll(/<loc>(.*?)<\/loc>/g)) allXml += await (await context.request.get(base + new URL(url).pathname)).text();
    for (const intent of pages) assert.ok(allXml.includes('<loc>' + intent.canonicalUrl + '</loc>'));
    const root = await (await context.request.get(base + '/sitemap.xml')).text();
    for (const [, url] of index.matchAll(/<loc>(.*?)<\/loc>/g)) assert.ok(root.includes(url), 'root sitemap includes each pSEO chunk');
    checks.push({ test: 'six approved intents in sitemap hierarchy', passed: true });
    assert.equal((await context.request.get(base + '/pdf-to-jpg-600-dpi')).status(), 404);
    checks.push({ test: 'unsupported fabricated intent returns 404', passed: true });
    await page.goto(base + '/pdf-to-jpg', { waitUntil: 'networkidle' });
    assert.ok(await page.locator('a[href="/pdf-to-png"]').count());
    await page.screenshot({ path: path.join(out, 'landing-final.png'), fullPage: true });
    checks.push({ test: 'core page links approved image tasks', passed: true });
    assert.deepEqual(errors, []);
  } finally {
    await fs.writeFile(path.join(out, 'seo-results.json'), JSON.stringify({ checks, errors }, null, 2) + '\n');
    await browser.close();
  }
  console.log(JSON.stringify({ passed: checks.length, errors }));
})().catch(error => { console.error(error); process.exitCode = 1; });
