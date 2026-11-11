const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {loadTs}=require('../scripts/seo-load-ts.cjs');
const {getIndexEntries}=loadTs('src/lib/seo/index-inventory.ts');
const {sitemapIndexXml,familyXml}=loadTs('src/lib/seo/sitemap-families.ts');
const {pseoSitemapXml}=loadTs('src/lib/pseo/sitemap.ts');
const {connectionSitemapXml}=loadTs('src/lib/connections/sitemap.ts');
const {getSoftwareApplicationSchema}=loadTs('src/lib/seo/software.ts');
const {TOOLS}=loadTs('src/lib/tools.ts');
const {getActiveLocales}=loadTs('src/lib/i18n/locales.ts');
const {localizedToolPath}=loadTs('src/lib/i18n/url-strategy.ts');
const {getHreflangLanguagesMap}=loadTs('src/lib/i18n/hreflang.ts');
const locs=xml=>[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
test('root sitemap has one owner for every URL across every child, no nested indexes or oversized bodies',()=>{
 const seen=new Set();const expected=new Set(getIndexEntries().map(e=>e.url));
 for(const url of locs(sitemapIndexXml())){
  const p=new URL(url).pathname;let xml;
  if(p.includes('/families/'))xml=familyXml(p.split('/').pop().replace(/\.xml$/,''));
  else if(p.includes('/pseo/'))xml=pseoSitemapXml(p.split('/').pop());
  else {const [,language,page]=p.match(/connections\/([^/]+)\/([^/]+)$/);xml=connectionSitemapXml(language,page);}
  assert.ok(xml,url);assert.match(xml,/<urlset\b/);assert.doesNotMatch(xml,/<sitemapindex\b/);
  assert.ok(Buffer.byteLength(xml)<4*1024*1024,url);
  for(const canonical of locs(xml)){assert.ok(!seen.has(canonical),'Duplicate: '+canonical);seen.add(canonical);assert.equal(new URL(canonical).origin,'https://pdfpilot.net');assert.equal(new URL(canonical).search,'');}
 }
 for(const url of expected)assert.ok(seen.has(url),'Missing '+url);
 assert.equal(seen.size,10504);
});
test('each registered tool has schema wiring and free truthful schemas in each active language',()=>{
 for(const tool of TOOLS){
  const dir='src/app/'+tool.slug;
  const source=fs.readdirSync(dir).filter(f=>/\.tsx$/.test(f)).map(f=>fs.readFileSync(dir+'/'+f,'utf8')).join('\n');
  assert.ok(source.includes('getSoftwareApplicationSchema'),tool.slug);
  for(const locale of getActiveLocales()){
   const path=localizedToolPath(tool.slug,locale.code);const schema=getSoftwareApplicationSchema({...tool,path,inLanguage:locale.code});
   assert.equal(schema.url,'https://pdfpilot.net'+path);assert.equal(schema.inLanguage,locale.code);assert.equal(schema.offers.price,'0');assert.equal(schema.isAccessibleForFree,true);assert.ok(!schema.aggregateRating);assert.equal(schema.mainEntityOfPage['@id'],schema.url);
   const alternate=getHreflangLanguagesMap(tool.path);assert.equal(alternate[locale.code],schema.url);
  }
 }
 assert.equal(getSoftwareApplicationSchema({name:'Example',path:'/example'}).inLanguage,'en');
});
