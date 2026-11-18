const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = p => fs.readFileSync(p, 'utf8');
test('public document and tool links do not read request headers or force English static fallback', () => {
  for (const path of ['src/components/DocumentShell.tsx','src/components/seo/RouteRelatedLinks.tsx','src/components/seo/ToolGrowthLinks.tsx','src/app/(english)/layout.tsx','src/app/[locale]/layout.tsx']) {
    const source = read(path);
    assert.ok(!source.includes('next/headers'), path);
    assert.ok(!source.includes('force-static'), path);
  }
  assert.ok(read('src/app/[locale]/layout.tsx').includes('getLocaleBySegment(segment)'));
  assert.ok(read('src/components/DocumentShell.tsx').includes('lang={locale.code}'));
});
test('localized catchall preserves route-scoped links and explicit locale', () => {
  assert.ok(read('src/app/[locale]/[...slug]/page.tsx').includes('<RouteRelatedLinks'));
  assert.ok(read('src/components/seo/ToolGrowthLinks.tsx').includes('resourceDictionary(locale)'));
  for (const slug of ['merge-pdf','pdf-to-powerpoint','compress-pdf']) {
    assert.ok(read(`src/app/(english)/${slug}/layout.tsx`).includes(`path="/${slug}"`));
  }
});
