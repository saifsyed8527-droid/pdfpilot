const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
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
const { getToolLearningLinks } = loadTs('src/lib/content/tool-related.ts');
const { resolveEntity, getBacklinks } = loadTs('src/lib/content/registry.ts');
const { getIndexEntries } = loadTs('src/lib/seo/index-inventory.ts');
const indexed = new Set(getIndexEntries().map(entry => new URL(entry.url).pathname));

test('flagship tools have bounded useful reading lists and indexed parent hubs', () => {
  for (const slug of ['merge-pdf', 'split-pdf', 'compress-pdf', 'pdf-to-jpg', 'jpg-to-pdf']) {
    const { categories, items } = getToolLearningLinks(`tool-${slug}`);
    assert.ok(categories.length > 0, slug);
    assert.ok(items.length > 0 && items.length <= 6, slug);
    assert.equal(new Set(items.map(item => item.path)).size, items.length);
    assert.ok(items.some(item => item.type === 'help'), slug);
    assert.ok(items.some(item => item.type === 'guide'), slug);
    for (const item of [...items, ...categories]) assert.ok(indexed.has(item.path), item.path);
  }
});

test('held content and unavailable tools are excluded from recommendations', () => {
  assert.equal(resolveEntity({ type: 'guide', id: 'guide-how-heic-photo-conversion-works' }), undefined);
  assert.equal(resolveEntity({ type: 'tool', id: 'tool-heic-to-jpg' }), undefined);
  const holds = loadTs('src/lib/content/search-holds.json');
  for (const item of getBacklinks('tool-compress-pdf')) assert.ok(!Object.hasOwn(holds, item.path));
  assert.deepEqual(getToolLearningLinks('tool-unknown'), { categories: [], items: [] });
});

test('formerly orphaned priority help and workflows have a category discovery path', () => {
  for (const id of [
    'help-best-compression-setting-for-email', 'help-why-is-my-compressed-pdf-blurry',
    'help-how-many-pdfs-can-i-merge-at-once', 'help-why-is-the-merge-button-disabled',
    'help-why-isnt-my-split-pdf-working', 'help-can-i-choose-the-image-quality-for-pdf-to-jpg',
    'help-why-are-my-pdf-pages-different-sizes-after-converting-from-jpg',
    'use-case-combine-bank-statements-into-one-pdf', 'use-case-merge-invoices-into-one-pdf',
    'checklist-pdf-compression',
  ]) assert.ok(getBacklinks(id).some(item => item.type === 'category'), id);
});
