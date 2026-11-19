const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const path = require('node:path');
const ts = require('typescript');
const cache = new Map();
function loadTs(source) {
  let filename = path.resolve(source);
  if (!fs.existsSync(filename) && filename.endsWith(".ts")) filename += "x";
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
const { getActiveLocales, isToolOnlyLocale } = loadTs('src/lib/i18n/locales.ts');
const locales = getActiveLocales().filter(l => !isToolOnlyLocale(l.code));
const { getIndexEntries } = loadTs('src/lib/seo/index-inventory.ts');
const { localizedPath, parseLocalizedPath } = loadTs('src/lib/i18n/url-strategy.ts');
const { getHreflangLanguagesMap } = loadTs('src/lib/i18n/hreflang.ts');
const { connectionSitemapXml, connectionSitemapUrls } = loadTs('src/lib/connections/sitemap.ts');
const { connectionCount } = loadTs('src/lib/connections/registry.ts');
const pages = require('../src/lib/i18n/resource-pages.json');

test('all resource URLs have translated metadata, reciprocal alternates and sitemap discovery', () => {
  const inventory = getIndexEntries();
  const byUrl = new Map(inventory.map(entry => [entry.url,entry]));
  assert.equal(byUrl.size,inventory.length);
  for(const locale of locales) {
    const words=locale.code==='en'?{}:require('../src/lib/i18n/resources/'+locale.code+'.json');
    for(const [path,page] of Object.entries(pages)) {
      const canonical='https://pdfpilot.net'+localizedPath(path,locale.code);
      const alternates=getHreflangLanguagesMap(path);
      assert.equal(alternates[locale.code],canonical);
      assert.equal(Object.keys(alternates).length,13);
      assert.deepEqual(byUrl.get(canonical)?.alternates?.languages,alternates,canonical);
      assert.equal(parseLocalizedPath(new URL(canonical).pathname).path,path,canonical);
      if(locale.code!=='en') for(const key of ['title','description']) {
        assert.ok(words[page[key]],locale.code+' '+path+' '+key);
        assert.notEqual(words[page[key]],page[key],locale.code+' '+path+' '+key);
      }
    }
  }
});

test('locale dictionaries cover the same resource text and preserve whitespace boundaries', () => {
  const reference=Object.keys(require('../src/lib/i18n/resources/ru.json')).sort();
  const {resourceText}=loadTs('src/lib/i18n/resource-text.ts');
  for(const locale of locales.filter(l=>l.code!=='en')) {
    const words=require('../src/lib/i18n/resources/'+locale.code+'.json');
    assert.deepEqual(Object.keys(words).sort(),reference,locale.code);
    assert.ok(Object.values(words).every(value=>typeof value==='string'&&value.trim().length>0));
  }
  assert.equal(resourceText({'Download PDF':'Скачать PDF'},'  Download  PDF '),'  Скачать PDF ');
  assert.equal(resourceText({'example.csv':'пример.csv'},'example.csv'),'example.csv');
  assert.equal(resourceText({'Price':'$&'},'Price'),'$&');
});

test('retired connection sitemap endpoints no longer advertise any language URLs', () => {
  assert.equal(connectionCount(),0);
  assert.deepEqual(connectionSitemapUrls(),[]);
  for(const locale of locales) assert.equal(connectionSitemapXml(locale.segment||'en','0.xml'),undefined);
  for(const [locale,page] of [['missing','0.xml'],['en','01.xml'],['en','-1.xml'],['en','9999999999999999999.xml'],['ru','1.xml']]) assert.equal(connectionSitemapXml(locale,page),undefined);
});

test('retired task directories cannot acquire localized resource routes', () => {
  const pages=require('../src/lib/i18n/resource-pages.json');
  assert.ok(Object.keys(pages).every(path=>!/^\/(templates|pdf-workflows)(\/|$)/.test(path)));
  const source=require('node:fs').readFileSync('src/app/(english)/templates/tasks/page.tsx','utf8');
  assert.match(source,/notFound\(\)/);
});

test('family sitemaps retain every URL while bounding response sizes and preserving old indexes', () => {
  const {familySitemapChunks,familyXml,sitemapIndexXml}=loadTs('src/lib/seo/sitemap-families.ts');
  const chunks=familySitemapChunks(),urls=[];
  for(const chunk of chunks) {
    const xml=familyXml(chunk.id);
    assert.ok(Buffer.byteLength(xml)<4*1024*1024,chunk.id+' exceeds response budget');
    assert.ok(chunk.entries.length<=1000);
    urls.push(...chunk.entries.map(entry=>entry.url));
    assert.ok(sitemapIndexXml().includes('/'+chunk.id+'.xml'));
  }
  assert.equal(new Set(urls).size,urls.length);
  assert.deepEqual(urls.sort(),getIndexEntries().map(entry=>entry.url).sort());
  assert.match(familyXml('locales'),/<sitemapindex/);
  assert.ok(!sitemapIndexXml().includes('/families/locales.xml'));
  for(const invalid of ['locales-01','locales-999','core-0','missing'])assert.equal(familyXml(invalid),undefined);
});
