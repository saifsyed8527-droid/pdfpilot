const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const path = require('node:path');
const ts = require('typescript');
const cache = new Map();
function loadTs(source) {
  const filename = path.resolve(source);
  if (cache.has(filename)) return cache.get(filename).exports;
  if (filename.endsWith('.json')) return JSON.parse(fs.readFileSync(filename, 'utf8'));
  const module = { exports: {} };
  cache.set(filename, module);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const localRequire = name => {
    // The catalog's icon values do not affect routing; skip its browser-only icon package.
    if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
    const suffix = path.extname(name) ? '' : '.ts';
    if (name.startsWith('@/')) return loadTs(path.resolve('src', name.slice(2) + suffix));
    if (name.startsWith('.')) return loadTs(path.resolve(path.dirname(filename), name + suffix));
    return require(name);
  };
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  return module.exports;
}
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

test('every launch declaration is bound to the reviewed source and output tests', () => {
  for (const capability of LAUNCH_CAPABILITIES) {
    for (const evidence of capability.evidence) {
      assert.equal(createHash('sha256').update(fs.readFileSync(evidence.path)).digest('hex'), evidence.sha256,
        `${capability.toolId}: stale evidence ${evidence.path}`);
    }
  }
});

test('language choices remain available for translated tools and are hidden on English-only launches', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { LanguageSwitcher } = loadTs('src/components/language-switcher.tsx');
  const html = path => renderToStaticMarkup(React.createElement(LanguageSwitcher, { currentPathname: path }));
  for (const slug of ENGLISH_ONLY_TOOL_SLUGS) assert.equal(html(`/${slug}`), '');
  for (const path of ['/merge-pdf', '/es/merge-pdf', '/']) assert.match(html(path), /Choose language/);
});
