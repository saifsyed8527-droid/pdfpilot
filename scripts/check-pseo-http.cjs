const assert = require('node:assert/strict');
const { load } = require('./load-pseo-modules.cjs');
const { DOCUMENT_TEMPLATES, DOCUMENT_CATEGORIES } = load('src/lib/content/document-templates.ts');
const { PDF_WORKFLOWS } = load('src/lib/content/pdf-workflows.ts');
const base = (process.argv[2] || 'http://127.0.0.1:4340').replace(/\/$/, '');
const origin = 'https://pdfpilot.net';
const cases = [
  { path: '/templates' }, ...Object.keys(DOCUMENT_CATEGORIES).map(category => ({ path: '/templates/collections/' + category })),
  ...DOCUMENT_TEMPLATES.map(row => ({ path: '/templates/' + row.slug, action: 'editor', preview: '/template-samples/documents/' + row.slug + '.png' })),
  { path: '/pdf-workflows' }, ...PDF_WORKFLOWS.map(row => ({ path: '/pdf-workflows/' + row.slug, action: 'runner', preview: '/template-samples/workflows/' + row.slug + '.png' })),
];
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2].replaceAll('&amp;', '&')]));
async function main() {
  const titles = new Set(), descriptions = new Set(), incoming = new Set(), errors = [];
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => { while (next < cases.length) {
    const item = cases[next++];
    try {
      const response = await fetch(base + item.path, { redirect: 'manual', signal: AbortSignal.timeout(45000) });
      assert.equal(response.status, 200, 'HTTP status'); assert.ok(!/noindex/i.test(response.headers.get('x-robots-tag') ?? ''));
      const html = await response.text(), links = [...html.matchAll(/<link\b[^>]*>/g)].map(m => attrs(m[0]));
      const metas = [...html.matchAll(/<meta\b[^>]*>/g)].map(m => attrs(m[0]));
      assert.equal((html.match(/<h1\b/g) ?? []).length, 1, 'one H1');
      assert.match(html, /<html[^>]+lang="en"/);
      assert.equal(links.find(link => link.rel === 'canonical')?.href, origin + item.path, 'self canonical');
      assert.equal(metas.find(meta => meta.property === 'og:url')?.content, origin + item.path, 'share URL');
      assert.ok(!metas.some(meta => meta.name === 'robots' && /noindex/.test(meta.content)), 'indexable');
      const title = html.match(/<title>(.*?)<\/title>/)?.[1], description = metas.find(meta => meta.name === 'description')?.content;
      assert.ok(title && !titles.has(title), 'unique title'); titles.add(title);
      assert.ok(description?.length > 60 && !descriptions.has(description), 'unique description'); descriptions.add(description);
      const schemas = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap(m => { const parsed = JSON.parse(m[1]); return Array.isArray(parsed) ? parsed : [parsed]; });
      assert.ok(schemas.some(s => s['@type'] === 'BreadcrumbList'), 'breadcrumbs');
      assert.ok(schemas.some(s => s['@type'] === (item.action ? 'SoftwareApplication' : 'CollectionPage')), 'page schema');
      if (item.action) assert.ok(html.includes(`id="${item.action}"`), 'usable action is server-rendered');
      if (item.preview) assert.ok(html.includes(item.preview), 'actual sample preview referenced');
      for (const match of html.matchAll(/<a\b[^>]*href="([^"]+)"/g)) incoming.add(match[1].split('#')[0]);
    } catch (error) { errors.push({ path: item.path, error: error.message }); }
  } }));
  const sitemapResponse = await fetch(base + '/sitemap.xml'); assert.equal(sitemapResponse.status, 200);
  const sitemap = await sitemapResponse.text(), urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.equal(new Set(urls).size, urls.length, 'no duplicate sitemap URLs');
  for (const item of cases) {
    if (!urls.includes(origin + item.path)) errors.push({ path: item.path, error: 'missing from sitemap' });
    if (!incoming.has(item.path)) errors.push({ path: item.path, error: 'no incoming crawlable link in cohort' });
  }
  const assets = [...DOCUMENT_TEMPLATES.flatMap(row => ['png', 'pdf'].map(ext => '/template-samples/documents/' + row.slug + '.' + ext)), ...PDF_WORKFLOWS.map(row => '/template-samples/workflows/' + row.slug + '.png'), '/template-samples/workflow-a.pdf', '/template-samples/workflow-b.pdf'];
  for (const path of assets) {
    const response = await fetch(base + path, { method: 'HEAD', signal: AbortSignal.timeout(45000) });
    if (response.status !== 200) errors.push({ path, error: 'asset missing', status: response.status });
    if (path.endsWith('.pdf') && !/noindex/i.test(response.headers.get('x-robots-tag') ?? '')) errors.push({ path, error: 'sample PDF should not be indexed separately' });
  }
  for (const path of ['/templates/not-a-template', '/templates/collections/not-a-category', '/pdf-workflows/not-a-workflow']) {
    const response = await fetch(base + path, { redirect: 'manual' }); if (response.status !== 404) errors.push({ path, error: 'invalid URL does not return 404' });
  }
  for (const [path, target] of [['/', '/templates'], ['/merge-pdf', '/pdf-workflows/merge-and-compress-pdf'], ['/word-to-pdf', '/pdf-workflows/combine-word-documents-to-pdf'], ['/fill-pdf', '/templates'], ['/compare/compress-pdf-vs-split-pdf', '/pdf-workflows/merge-and-compress-pdf'], ['/glossary/what-is-flattening-a-pdf', '/templates']]) {
    const response = await fetch(base + path); const html = await response.text();
    if (response.status !== 200 || !html.includes(`href="${target}"`)) errors.push({ path, error: 'missing discovery link to ' + target });
  }
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), base, pages: cases.length, newPages: cases.length - 1, generatedDocumentTemplates: DOCUMENT_TEMPLATES.length, workflows: PDF_WORKFLOWS.length, assets: assets.length, sitemapUrls: urls.length, googleIndexedPages: null, passed: errors.length === 0, errors }, null, 2));
  if (errors.length) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
