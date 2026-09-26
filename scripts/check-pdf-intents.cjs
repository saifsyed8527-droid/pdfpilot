// Checks the rendered HTML and sitemap without running browser JavaScript.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { load } = require('./load-pseo-modules.cjs');
const { PUBLISHED_PDF_INTENTS } = load('src/lib/content/pdf-intents.ts');
const base = process.argv[2] || 'http://127.0.0.1:4352';

async function get(path) {
  const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200, `${path} status`);
  return response.text();
}

(async () => {
  const results = await Promise.all(PUBLISHED_PDF_INTENTS.map(async page => {
    const html = await get(page.path);
    assert.ok(html.includes(`data-intent-id="${page.id}"`), `${page.path}: server-rendered content`);
    assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, `${page.path}: one heading`);
    assert.ok(html.includes(`rel="canonical" href="https://pdfpilot.net${page.path}"`), `${page.path}: canonical`);
    assert.ok(!/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/.test(html), `${page.path}: indexable`);
    assert.ok(!/PDF tool not connected|Not for publication|Provisional branding/.test(html), `${page.path}: no placeholders`);
    const schemas = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].flatMap(match => JSON.parse(match[1]));
    assert.ok(schemas.some(schema => schema['@type'] === 'BreadcrumbList'), `${page.path}: breadcrumbs`);
    const faq = schemas.find(schema => schema['@type'] === 'FAQPage');
    assert.equal(faq.mainEntity.length, page.faqs.length, `${page.path}: FAQ parity`);
    for (const id of page.related) {
      const related = PUBLISHED_PDF_INTENTS.find(row => row.id === id);
      assert.ok(html.includes(`href="${related.path}"`), `${page.path}: related link to ${id}`);
    }
    return { path: page.path, status: 200, serverRendered: true, canonical: true, schema: true };
  }));
  const sitemap = await get('/sitemap.xml');
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
  assert.equal(urls.length, new Set(urls).size, 'No duplicate sitemap URLs');
  for (const page of PUBLISHED_PDF_INTENTS) assert.ok(urls.includes(`https://pdfpilot.net${page.path}`));
  assert.ok(urls.includes('https://pdfpilot.net/use-cases'));
  const library = await get('/use-cases');
  for (const page of PUBLISHED_PDF_INTENTS) assert.ok(library.includes(`href="${page.path}"`));
  // Shared route handlers must continue serving old content and localized tools.
  for (const path of ['/es/unir-pdf', '/es/comprimir-pdf', '/use-cases/compress-a-resume-for-email', '/guides/how-pdf-compression-works', '/templates']) await get(path);
  const report = { base, checkedAt: new Date().toISOString(), pages: results, library: true, sitemapUrls: urls.length, existingRoutes: 5 };
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
