const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {loadTs}=require('../scripts/seo-load-ts.cjs');
const {isRetiredResourcePath:retired}=loadTs('src/lib/seo/retired-routes.ts');
test('retirement is segment scoped and excludes real tools and essential navigation',()=>{
 for(const root of ['templates','pdf-workflows','integrations','workflows']) {
  assert.ok(retired('/'+root));assert.ok(retired('/'+root+'/example'));
 }
 for(const path of ['/merge-pdf','/fill-pdf','/categories','/privacy','/templates-new'])assert.equal(retired(path),false);
});
test('index inventory retains 3004 URLs and no retired pages or alternates',()=>{
 const entries=loadTs('src/lib/seo/index-inventory.ts').getIndexEntries();
 assert.equal(entries.length,3004);
 for(const e of entries)for(const url of [e.url,...Object.values(e.alternates?.languages??{})])assert.doesNotMatch(new URL(url).pathname,/\/(templates|pdf-workflows|integrations|workflows)(\/|$)/);
 assert.ok(entries.some(e=>e.url==='https://pdfpilot.net/hi/merge-pdf'));
 assert.ok(entries.some(e=>e.url==='https://pdfpilot.net/categories'));
});
test('retired resources disappear from search, locale registry, connection sitemap and hreflang',()=>{
 const {SEARCH_INDEX}=loadTs('src/lib/search-index.ts');
 assert.ok(SEARCH_INDEX.every(e=>!retired(e.path)));
 assert.ok(Object.keys(require('../src/lib/i18n/resource-pages.json')).every(p=>!retired(p)));
 const connections=loadTs('src/lib/connections/registry.ts');assert.equal(connections.connectionCount(),0);assert.deepEqual([...connections.connectionPaths()],[]);assert.equal(connections.isConnectionPath('/integrations/google-drive/merge-pdf'),false);
 const maps=loadTs('src/lib/connections/sitemap.ts');assert.deepEqual(maps.connectionSitemapUrls(),[]);assert.equal(maps.connectionSitemapXml('en','0.xml'),undefined);
 assert.deepEqual(loadTs('src/lib/i18n/hreflang.ts').getHreflangAlternates('/templates'),[]);
});
test('all retired entry points use genuine notFound and navigation excludes editorial routes',()=>{
 for(const family of ['templates','pdf-workflows','integrations','workflows']){
  const dir='src/app/(english)/'+family;
  for(const file of fs.readdirSync(dir,{recursive:true}).filter(f=>f.endsWith('page.tsx'))){const source=fs.readFileSync(dir+'/'+file,'utf8');assert.match(source,/notFound\(\)/);assert.doesNotMatch(source,/permanentRedirect|generateStaticParams/);}
 }
 const footer=fs.readFileSync('src/components/footer.tsx','utf8');assert.doesNotMatch(footer,/href: "\/guides"/);assert.doesNotMatch(footer,/href: "\/(templates|pdf-workflows|integrations)/);
});
test('expanded cleanup retains only genuine tools, essentials and navigation directories',()=>{
 const tools=loadTs('src/lib/tools.ts').TOOLS;
 const {parseLocalizedPath}=loadTs('src/lib/i18n/url-strategy.ts');
 const categories=loadTs('src/lib/content/categories.ts').CATEGORIES;
 const allowed=new Set(['/', '/about','/privacy','/terms','/categories',...tools.map(t=>t.path),...categories.map(c=>c.path)]);
 const entries=loadTs('src/lib/seo/index-inventory.ts').getIndexEntries();
 for(const entry of entries) {
   assert.ok(allowed.has(parseLocalizedPath(new URL(entry.url).pathname).path),entry.url);
   for(const url of Object.values(entry.alternates?.languages??{}))assert.ok(allowed.has(parseLocalizedPath(new URL(url).pathname).path),url);
 }
 assert.equal(loadTs('src/lib/search-index.ts').SEARCH_INDEX.length,109);
 for(const intent of require('../src/lib/content/pseo-pages.json'))assert.ok(retired('/'+intent.slug));
 for(const family of ['guides','help','compare','use-cases','industries','glossary','checklists'])assert.ok(retired('/'+family+'/any-detail'));
 const navbar=fs.readFileSync('src/components/navbar.tsx','utf8');assert.doesNotMatch(navbar,/localizedPath\("\/guides"/);
 assert.equal(loadTs('src/lib/pseo/sitemap.ts').pseoSitemapChunks().length,0);
});
