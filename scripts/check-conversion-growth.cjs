// Read-only HTTP release check. Counts URLs, never claims Google indexing or traffic.
const assert = require('node:assert/strict');
const { loadTs } = require('../tests/load-ts.cjs');
const pages = require('../src/lib/content/conversion-templates.json');
const { getActiveLocales } = loadTs('src/lib/i18n/locales.ts');
const { CORE_PAGE_PATHS } = loadTs('src/lib/i18n/core-content.ts');
const base = (process.argv[2] || 'http://127.0.0.1:4320').replace(/\/$/,'');
const origin = 'https://pdfpilot.net';
const slugs=['jpg-to-pdf','word-to-pdf','powerpoint-to-pdf'];
const toolPath=(slug,l)=>l.code==='en'?`/${slug}`:`/${l.segment}/${slug==='jpg-to-pdf'?CORE_PAGE_PATHS[l.code].jpgToPdf:slug}`;
const cases=getActiveLocales().flatMap(l=>slugs.map(slug=>({path:toolPath(slug,l),locale:l.code,slug,alternates:Object.fromEntries([...getActiveLocales().map(other=>[other.code,origin+toolPath(slug,other)]),['x-default',origin+'/'+slug]])})));
const root='/templates/conversions';
cases.push({path:root,locale:'en'},...slugs.map(slug=>({path:root+'/'+slug,locale:'en'})),...pages.map(p=>({path:root+'/'+p.tool+'/'+p.slug,locale:'en',template:true})));
const errors=[];
const parseAttrs=tag=>Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2].replaceAll('&amp;','&')]));
async function check(item) {
  try {
    const res=await fetch(base+item.path,{signal:AbortSignal.timeout(45000),redirect:'manual'});
    assert.equal(res.status,200,item.path+' status');
    const html=await res.text();
    assert.match(html,new RegExp(`<html[^>]*lang="${item.locale}"`));
    assert.equal((html.match(/<h1\b/g)||[]).length,1,'one visible page heading');
    assert.ok(!/<meta[^>]*name="robots"[^>]*content="[^"]*noindex/.test(html),'indexable');
    const links=[...html.matchAll(/<link\b[^>]*>/g)].map(m=>parseAttrs(m[0]));
    assert.equal(links.find(l=>l.rel==='canonical')?.href,origin+item.path,'self canonical');
    if(item.path.startsWith(root)) {
      const metas=[...html.matchAll(/<meta\b[^>]*>/g)].map(m=>parseAttrs(m[0]));
      assert.equal(metas.find(m=>m.property==='og:url')?.content,origin+item.path,'template share URL');
      assert.ok(metas.find(m=>m.name==='description')?.content.length>60,'meaningful description');
      assert.ok(metas.find(m=>m.name==='twitter:title')?.content.includes('PDF'),'template share title');
    }
    if(item.template) assert.ok(html.includes('data-template-runner='),'usable converter on the template page');
    if(item.alternates) {
      const actual=Object.fromEntries(links.filter(l=>l.rel==='alternate'&&l.hrefLang).map(l=>[l.hrefLang,l.href]));
      assert.deepEqual(actual,item.alternates,'complete reciprocal alternates');
      assert.ok(html.includes(`data-conversion-details="${item.slug}"`),'localized instructions');
      const schemas=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const d=JSON.parse(m[1]);return Array.isArray(d)?d:[d];});
      const software=schemas.find(s=>s['@type']==='SoftwareApplication');
      assert.equal(software?.url,origin+item.path,'localized software URL');
      assert.equal(software?.inLanguage,item.locale,'localized schema language');
    }
  } catch(error) { errors.push({path:item.path,error:error.message}); }
}
(async()=>{
  let next=0;
  await Promise.all(Array.from({length:4},async()=>{while(next<cases.length) await check(cases[next++]);}));
  const sitemapResponse=await fetch(base+'/sitemap.xml',{signal:AbortSignal.timeout(45000)});
  assert.equal(sitemapResponse.status,200);
  const sitemap=await sitemapResponse.text();
  const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
  for(const c of cases) if(!urls.includes(origin+c.path)) errors.push({path:c.path,error:'missing from sitemap'});
  assert.equal(new Set(urls).size,urls.length,'sitemap has no duplicates');
  assert.ok(!urls.some(url=>url.includes('/workflows')),'legacy articles removed from sitemap');
  const redirects=[['/workflows',root],...pages.filter(p=>p.legacy).map(p=>['/workflows/'+p.legacy,root+'/'+p.tool+'/'+p.slug]),['/workflows/pptx-fonts-to-pdf',root+'/powerpoint-to-pdf/standard-slides'],['/workflows/pptx-charts-smartart-to-pdf','/powerpoint-to-pdf#conversion-details']];
  for(const [from,to] of redirects) {
    const r=await fetch(base+from,{redirect:'manual'});
    if(r.status!==308||r.headers.get('location')!==to) errors.push({path:from,error:'expected permanent redirect to '+to,actual:r.status,location:r.headers.get('location')});
  }
  for(const bad of [root+'/jpg-to-pdf/not-a-template',root+'/unknown/a4-portrait','/workflows/not-a-template']) {
    const r=await fetch(base+bad,{redirect:'manual'});if(r.status!==404) errors.push({path:bad,error:'expected 404',actual:r.status});
  }
  const assets=[...new Set(pages.flatMap(p=>p.samples.map(s=>'/template-samples/'+s))) , ...pages.map(p=>`/template-samples/previews/${p.tool}-${p.slug}.png`)];
  for(const asset of assets) {
    const r=await fetch(base+asset,{method:'HEAD',signal:AbortSignal.timeout(45000)});
    if(r.status!==200) errors.push({path:asset,error:'missing sample/preview',actual:r.status});
  }
  console.log(JSON.stringify({checkedAt:new Date().toISOString(),base,checked:cases.length,redirects:redirects.length,assets:assets.length,toolLanguageUrls:36,conversionTemplatePages:pages.length,templateHubs:4,sitemapUrls:urls.length,googleIndexedPages:null,passed:errors.length===0,errors},null,2));
  if(errors.length) process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
