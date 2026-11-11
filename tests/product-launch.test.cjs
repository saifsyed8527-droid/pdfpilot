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
const { LOCALIZED_LAUNCH_TOOL_SLUGS, LAUNCH_TOOL_SLUGS } = loadTs('src/lib/launch-catalog.ts');
const { getActiveLocales } = loadTs('src/lib/i18n/locales.ts');
const { localizedPath, localizedToolPath } = loadTs('src/lib/i18n/url-strategy.ts');
const { getLocalizedToolBySlug } = loadTs('src/lib/i18n/localized-tools.ts');
const { getHreflangLanguagesMap } = loadTs('src/lib/i18n/hreflang.ts');
const { getIndexEntries } = loadTs('src/lib/seo/index-inventory.ts');
const { LAUNCH_CAPABILITIES, CAPABILITIES } = loadTs('src/lib/pseo/capabilities.ts');

test('every public tool has one canonical working path per language and reciprocal discovery', () => {
  const inventory = getIndexEntries();
  const urls = new Set(inventory.map(entry => entry.url));
  assert.equal(urls.size, inventory.length);
  for (const slug of LAUNCH_TOOL_SLUGS) {
    assert.equal(getLocalizedToolBySlug(slug)?.slug, slug);
    const alternates = getHreflangLanguagesMap('/' + slug);
    assert.equal(Object.keys(alternates).length, getActiveLocales().length + 1);
    for (const {code} of getActiveLocales()) {
      const href = 'https://pdfpilot.net' + localizedToolPath(slug, code);
      assert.equal(alternates[code], href);
      assert.ok(urls.has(href), href);
      assert.equal(localizedPath('/' + slug, code), localizedToolPath(slug, code));
    }
    assert.equal(alternates['x-default'], alternates.en);
  }
});

test('launch capability declarations cover only public tools while existing pSEO stays bounded', () => {
  assert.equal(LAUNCH_CAPABILITIES.length, 34);
  assert.equal(new Set(LAUNCH_CAPABILITIES.map(row => row.toolId)).size, 34);
  assert.ok(LAUNCH_CAPABILITIES.every(row => LAUNCH_TOOL_SLUGS.includes(row.toolId)));
  assert.equal(CAPABILITIES.length, 26);
  assert.deepEqual(new Set(CAPABILITIES.map(row => row.toolId)), new Set(LOCALIZED_LAUNCH_TOOL_SLUGS));
});

test('every launch declaration is bound to the reviewed source and output tests', () => {
  for (const capability of LAUNCH_CAPABILITIES) {
    for (const evidence of capability.evidence) {
      assert.equal(createHash('sha256').update(fs.readFileSync(evidence.path)).digest('hex'), evidence.sha256,
        `${capability.toolId}: stale evidence ${evidence.path}`);
    }
  }
});

test('the closed language chooser exposes canonical links in the initial HTML', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { LanguageSwitcher } = loadTs('src/components/language-switcher.tsx');
  for (const slug of ['merge-pdf', 'redact-pdf', 'json-to-yaml']) {
    const html = renderToStaticMarkup(React.createElement(LanguageSwitcher, { currentPathname: '/' + slug }));
    for (const locale of getActiveLocales()) assert.ok(html.includes('href="' + localizedToolPath(slug, locale.code) + '"'));
  }
});
