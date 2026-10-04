const test = require('node:test');
const assert = require('node:assert/strict');
const { load: loadTs } = require('../scripts/load-pseo-modules.cjs');
const { ENGLISH_ONLY_TOOL_SLUGS, LAUNCH_TOOL_SLUGS } = loadTs('src/lib/launch-catalog.ts');
const { getActiveLocales } = loadTs('src/lib/i18n/locales.ts');
const { localizedPath, localizedToolPath } = loadTs('src/lib/i18n/url-strategy.ts');
const { getLocalizedToolBySlug } = loadTs('src/lib/i18n/localized-tools.ts');
const { getHreflangLanguagesMap } = loadTs('src/lib/i18n/hreflang.ts');
const { getIndexEntries } = loadTs('src/lib/seo/index-inventory.ts');
const { LAUNCH_CAPABILITIES, CAPABILITIES } = loadTs('src/lib/pseo/capabilities.ts');

test('English product launches have working destinations without publishing unreviewed locales', () => {
  const indexed = getIndexEntries().map(entry => entry.url);
  for (const slug of ENGLISH_ONLY_TOOL_SLUGS) {
    assert.equal(getLocalizedToolBySlug(slug), undefined);
    assert.equal(indexed.filter(url => url === `https://pdfpilot.net/${slug}`).length, 1);
    assert.deepEqual(getHreflangLanguagesMap(`/${slug}`), {
      en: `https://pdfpilot.net/${slug}`,
      'x-default': `https://pdfpilot.net/${slug}`,
    });
    for (const locale of getActiveLocales()) {
      assert.equal(localizedPath(`/${slug}`, locale.code), `/${slug}`);
      assert.equal(localizedToolPath(slug, locale.code), `/${slug}`);
      if (locale.code !== 'en') assert.ok(!indexed.includes(`https://pdfpilot.net/${locale.segment}/${slug}`));
    }
  }
  assert.notEqual(localizedToolPath('merge-pdf', 'es'), '/merge-pdf');
  assert.ok(getLocalizedToolBySlug('word-to-pdf'));
});

test('launch capability declarations cover only public tools while existing pSEO stays bounded', () => {
  assert.deepEqual(LAUNCH_CAPABILITIES.map(row => row.toolId).sort(), [...LAUNCH_TOOL_SLUGS].sort());
  assert.equal(CAPABILITIES.length, 26);
  for (const slug of ENGLISH_ONLY_TOOL_SLUGS) assert.ok(!CAPABILITIES.some(row => row.toolId === slug));
});
