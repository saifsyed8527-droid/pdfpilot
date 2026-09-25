const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadTs } = require('./load-ts.cjs');
const pages = require('../src/lib/content/conversion-workflows.json');
const { getActiveLocales } = loadTs('src/lib/i18n/locales.ts');
const { CONVERSION_TOOL_SLUGS, CONVERSION_COPY, conversionCopy } = loadTs('src/lib/i18n/conversion-copy.ts');
const { CONVERSION_UI_KEYS, CONVERSION_UI_ROWS } = loadTs('src/lib/i18n/conversion-ui.ts');

test('three-tool cohort has distinct intents, executable product facts and source provenance', () => {
  assert.equal(pages.length, 12);
  assert.equal(new Set(pages.map(p=>p.slug)).size, pages.length);
  assert.equal(new Set(pages.map(p=>p.title)).size, pages.length);
  for (const tool of CONVERSION_TOOL_SLUGS) assert.equal(pages.filter(p=>p.tool===tool).length, 4);
  for (const p of pages) {
    assert.equal(p.status, 'reviewed');
    assert.ok(CONVERSION_TOOL_SLUGS.includes(p.tool));
    assert.ok(/^[a-z0-9-]+$/.test(p.slug));
    assert.equal(p.steps.length, 4);
    assert.ok(p.checks.length>=3 && p.settings.length>=4 && p.limitation.length>80);
    assert.ok(p.sourceFiles.every(f=>fs.existsSync(f)), p.slug);
    assert.ok(!JSON.stringify(p).includes('/Users/'), 'no private file paths');
    assert.ok(!JSON.stringify(p).includes('Zagros'), 'no customer evidence published');
  }
  // Guard against keyword-swapped clones: each pair must have different workflow instructions.
  for (const p of pages) for (const q of pages) if (p!==q) {
    assert.notEqual(p.intro, q.intro);
    assert.notDeepEqual(p.steps, q.steps);
  }
});

test('all twelve locales expose truthful scoped capabilities and UI copy', () => {
  for (const l of getActiveLocales()) {
    assert.equal(CONVERSION_COPY[l.code].length,12,l.code);
    if(l.code!=='en') assert.equal(CONVERSION_UI_ROWS[l.code].split('|').length,CONVERSION_UI_KEYS.length,l.code);
    for(const slug of CONVERSION_TOOL_SLUGS) {
      const copy=conversionCopy(l.code,slug);
      assert.ok(copy.description.length>20 && copy.limitations.length>20);
      assert.equal(copy.steps.length,3);
      if(l.code!=='en') assert.notEqual(copy.limitations,conversionCopy('en',slug).limitations);
    }
  }
});

test('English tool canonicals have reciprocal language maps and shared implementation', () => {
  for(const slug of CONVERSION_TOOL_SLUGS) {
    const source=fs.readFileSync(`src/app/${slug}/tool-page.tsx`,'utf8');
    assert.ok(source.includes(`getHreflangLanguagesMap("/${slug}")`));
    assert.ok(source.includes(`<ConversionDetails tool="${slug}" locale={locale}`));
  }
  const sitemap=fs.readFileSync('src/app/sitemap.ts','utf8');
  assert.ok(sitemap.includes('CONVERSION_WORKFLOWS.map'));
  assert.ok(sitemap.includes('TOOLS.some(tool => tool.path === path)'));
  assert.ok(fs.readFileSync('src/app/workflows/[slug]/page.tsx','utf8').includes('dynamicParams = false'));
});
