// HTTP/link verification only. Visual and functional tool review belongs to the owner.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LAUNCH_TOOL_SLUGS } from '../src/lib/launch-catalog.ts';

const base = process.argv[2] ?? 'http://127.0.0.1:4320';
const all = JSON.parse(readFileSync(new URL('../src/lib/tools-data.json', import.meta.url), 'utf8'));
const approved = new Set(LAUNCH_TOOL_SLUGS);
const hidden = all.filter(tool => !approved.has(tool.slug));
const get = path => fetch(base + path, { redirect: 'manual', signal: AbortSignal.timeout(30000) });
const home = await get('/');
assert.equal(home.status, 200);
const html = await home.text();
const main = html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? '';
const hrefs = [...main.matchAll(/href="\/([^"?#]+)"/g)].map(match => match[1]).filter(slug => all.some(tool => tool.slug === slug));
assert.deepEqual(hrefs, LAUNCH_TOOL_SLUGS, 'Homepage tools must match the owner list in order');
for (const slug of LAUNCH_TOOL_SLUGS) {
  const response = await get('/' + slug);
  assert.equal(response.status, 200, slug);
  const body = await response.text();
  for (const tool of hidden) assert.ok(!body.includes(`href="${tool.path}"`), `${slug} links to hidden ${tool.slug}`);
}
for (const tool of hidden) {
  const response = await get(tool.path);
  assert.equal(response.status, 404, `Unlisted tool ${tool.slug}`);
  assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/);
}
for (const path of ['/fr/flatten-pdf', '/es/xml-to-excel', '/de/unlock-pdf']) {
  assert.equal((await get(path)).status, 404, path);
}
const sitemap = await (await get('/sitemap.xml')).text();
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]));
for (const tool of hidden) assert.ok(!urls.some(url => url.pathname === tool.path || url.pathname.endsWith(tool.path)), `Sitemap contains ${tool.path}`);
console.log(JSON.stringify({ passed: true, base, homepageOrder: true, approvedToolRoutes: LAUNCH_TOOL_SLUGS.length, unlistedToolRoutes: hidden.length, localizedUnlistedProbes: 3, hiddenRelatedLinks: 0, visualReview: 'owner_pending', checkedAt: new Date().toISOString() }, null, 2));
