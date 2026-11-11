const test=require('node:test'),assert=require('node:assert/strict');
const {loadTs}=require('../scripts/seo-load-ts.cjs');
const {LOCALES,PREVIEW_LOCALE_CODES,getActiveLocales}=loadTs('src/lib/i18n/locales.ts');
const {uiText,localizedToolName}=loadTs('src/lib/i18n/ui-copy.ts');
const {localizedToolSummary}=loadTs('src/lib/i18n/tool-summaries.ts');
const {TOOLS}=loadTs('src/lib/tools.ts');
const {getIndexEntries}=loadTs('src/lib/seo/index-inventory.ts');
const {getHreflangLanguagesMap}=loadTs('src/lib/i18n/hreflang.ts');
const {localizedToolPath,localizedPath,parseLocalizedPath}=loadTs('src/lib/i18n/url-strategy.ts');
const {previewTable}=loadTs('src/lib/i18n/preview-copy.ts');
test('all 26 benchmark languages are registered; 14 new languages are explicit preview only',()=>{
 assert.equal(LOCALES.length,26);assert.equal(PREVIEW_LOCALE_CODES.length,14);assert.equal(getActiveLocales().length,process.env.NEXT_PUBLIC_PREVIEW_LOCALES==='1'?26:12);
 for(const code of PREVIEW_LOCALE_CODES){
  assert.ok(!Object.hasOwn(getHreflangLanguagesMap('/merge-pdf'),code));
  assert.ok(!getIndexEntries().some(e=>new URL(e.url).pathname.startsWith('/'+code.toLowerCase()+'/')));
 }
});
test('every preview has 109 tool names/summaries, routed workspaces and preserved interface placeholders',()=>{
 const english=require('../docs/seo/language-drafts/en-source.json');
 function shape(a,b,path){
  if(typeof a==='string'){
   assert.equal(typeof b,'string',path);assert.ok(b.trim(),path);assert.deepEqual((b.match(/\{[^}]+\}/g)||[]).sort(),(a.match(/\{[^}]+\}/g)||[]).sort(),path);
  }else if(Array.isArray(a)){assert.equal(b.length,a.length,path);a.forEach((v,i)=>shape(v,b[i],path+'.'+i));}
  else {assert.deepEqual(Object.keys(b).sort(),Object.keys(a).sort(),path);for(const [k,v] of Object.entries(a))shape(v,b[k],path+'.'+k);}
 }
 for(const code of PREVIEW_LOCALE_CODES){
  const copy=require('../src/lib/i18n/preview/'+code+'.json');shape(english,copy,code);
  assert.equal(previewTable('PDF_IMAGE_ROWS')[code].length,29);
  assert.equal(previewTable('FORM_MARK_LABELS')[code].length,4);
  assert.notEqual(uiText(code,'Back to Home'),'Back to Home');
  for(const tool of TOOLS){assert.ok(localizedToolName(tool.slug,code,'MISSING')!=='MISSING');assert.ok(localizedToolSummary(tool.slug,code,'MISSING')!=='MISSING');const path=localizedToolPath(tool.slug,code);assert.equal(parseLocalizedPath(path).path,tool.path);}
  assert.equal(localizedPath('/guides',code),'/guides');assert.equal(localizedPath('/integrations',code),'/integrations');
 }
});
