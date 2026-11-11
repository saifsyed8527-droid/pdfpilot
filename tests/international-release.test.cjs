const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {loadTs}=require('../scripts/seo-load-ts.cjs');
const {TOOL_ONLY_LOCALE_CODES,getActiveLocales}=loadTs('src/lib/i18n/locales.ts');
const {getIndexEntries}=loadTs('src/lib/seo/index-inventory.ts');
const {getHreflangLanguagesMap}=loadTs('src/lib/i18n/hreflang.ts');
const {translateWorkspaceText}=loadTs('src/lib/i18n/workspace-text.ts');
const {TOOLS}=loadTs('src/lib/tools.ts');
const {localizedToolName,localizedToolPath}= {...loadTs('src/lib/i18n/ui-copy.ts'),...loadTs('src/lib/i18n/url-strategy.ts')};
const {searchAll}=loadTs('src/lib/search.ts');
test('all 14 added languages have complete workspace copy with stable interpolation arguments',()=>{
 const source=require('../docs/seo/workspace-language/source-strings.json');
 for(const code of TOOL_ONLY_LOCALE_CODES){const words=require('../src/lib/i18n/workspaces/'+code+'.json');assert.deepEqual(Object.keys(words).sort(),source.slice().sort(),code);
  for(const key of source){assert.equal(typeof words[key],'string',code+': '+key);assert.ok(words[key].trim(),code+': '+key);assert.deepEqual((words[key].match(/\{[^}]+\}/g)||[]).sort(),(key.match(/\{[^}]+\}/g)||[]).sort(),code+': '+key);}
 }
});
test('workspace text preserves filenames, input data, unknown errors and escaped replacement characters',()=>{
 const words={'Remove {0}':'Rimuovi {0}','Merge {0} PDFs':'Unisci {0} PDF'};
 assert.equal(translateWorkspaceText(words,'Remove {0}',['Price $& <draft>.pdf']),'Rimuovi Price $& <draft>.pdf');
 assert.equal(translateWorkspaceText(words,'Merge {0} PDFs',[2]),'Unisci 2 PDF');
 assert.equal(translateWorkspaceText(words,'User text {0} remains unchanged'),'User text {0} remains unchanged');
 assert.equal(translateWorkspaceText(words,'unknown code E42'),'unknown code E42');
});
test('published inventory adds exactly 1540 language URLs, without advertising untranslated resources',()=>{
 const entries=getIndexEntries(),urls=new Set(entries.map(e=>e.url));assert.equal(urls.size,6088);assert.equal(entries.length,urls.size);
 for(const code of TOOL_ONLY_LOCALE_CODES){const prefix='https://pdfpilot.net/'+code.toLowerCase();assert.equal(entries.filter(e=>e.url===prefix||e.url.startsWith(prefix+'/')).length,110,code);assert.ok(!Object.hasOwn(getHreflangLanguagesMap('/guides'),code));}
 assert.equal(getActiveLocales().length,26);assert.equal(Object.keys(getHreflangLanguagesMap('/merge-pdf')).length,27);
});
test('native tool names find the correct local tool URL for every new language',()=>{
 for(const code of TOOL_ONLY_LOCALE_CODES){const index=TOOLS.map(tool=>({type:'tool',name:localizedToolName(tool.slug,code,tool.name),description:'',path:localizedToolPath(tool.slug,code),haystack:localizedToolName(tool.slug,code,tool.name).toLowerCase()}));for(const entry of index){assert.ok(searchAll(index,entry.name).tools.some(result=>result.path===entry.path),code+': '+entry.path);}}
});
