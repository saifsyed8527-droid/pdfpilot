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
const locales = loadTs('src/lib/i18n/locales.ts').getActiveLocales();
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

test('connection sitemap chunks cover every valid connection in every language and reject invalid chunks', () => {
  assert.equal(connectionSitemapUrls().length,locales.length*Math.ceil(connectionCount()/1000));
  for(const locale of locales) {
    const xml=connectionSitemapXml(locale.segment||'en','0.xml');
    assert.equal((xml.match(/<loc>/g)||[]).length,connectionCount());
    assert.equal((xml.match(/hreflang=/g)||[]).length,connectionCount()*13);
  }
  for(const [locale,page] of [['missing','0.xml'],['en','01.xml'],['en','-1.xml'],['en','9999999999999999999.xml'],['ru','1.xml']]) assert.equal(connectionSitemapXml(locale,page),undefined);
});

test('localized task directory renders native card text and locale links before hydration', () => {
  const React = require('react'), {renderToStaticMarkup}=require('react-dom/server');
  const {ResourceLocaleProvider}=loadTs('src/components/i18n/ResourceLocaleProvider.tsx');
  const {TaskDirectory}=loadTs('src/components/templates/TaskDirectory.tsx');
  const words=require('../src/lib/i18n/resources/ru.json');
  const title='Assemble a dispatch packet with a form at the end';
  const card={path:'/templates/tasks/assemble-a-dispatch-packet',title,purpose:'Bundle the three shipping pages and the handover form into one attachment so the recipient can print them in order.',tool:'Merge PDF',group:'documents'};
  const html=renderToStaticMarkup(React.createElement(ResourceLocaleProvider,{locale:'ru',words},React.createElement(TaskDirectory,{cards:[card]})));
  assert.ok(html.includes(words[title]));
  assert.ok(html.includes('href="/ru/templates/tasks/assemble-a-dispatch-packet"'));
  assert.ok(html.includes(words['Find a task or tool']));
  assert.ok(!html.includes('href="/templates/tasks/'));
});
