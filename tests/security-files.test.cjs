const test=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./security-load.cjs');
const {zipSync,strToU8}=require('fflate');
const {checkOfficeArchive}=load('src/lib/engines/archive-guard.ts');
const {checkRenderBudget}=load('src/lib/engines/render-budget.ts');
const {rowsToJson,rowsToCsv}=load('src/lib/engines/data-conversion-engine.ts');
const zip=(entries)=>zipSync(Object.fromEntries(Object.entries(entries).map(([k,v])=>[k,strToU8(v)])));
test('Office preflight retains valid DOCX/XLSX and rejects wrong format and unsafe paths',async()=>{
  await checkOfficeArchive(zip({'word/document.xml':'<document/>'}),'word/document.xml');
  await checkOfficeArchive(zip({'xl/workbook.xml':'<workbook/>'}),'xl/workbook.xml');
  await assert.rejects(checkOfficeArchive(zip({'other.xml':'hello'}),'word/document.xml'),/expected/);
  for(const name of ['../word/document.xml','word/constructor','/absolute','word\\document.xml'])await assert.rejects(checkOfficeArchive(zip({[name]:'x'})),/unsafe/);
  await assert.rejects(checkOfficeArchive(strToU8('not a zip'),'word/document.xml'),/valid/);
});
test('oversized ZIP metadata is rejected before decompression',async()=>{
  const bytes=zip({'word/document.xml':'<document/>'});
  const buffer=Buffer.from(bytes);
  const central=buffer.indexOf(Buffer.from([0x50,0x4b,1,2]));
  buffer.writeUInt32LE(512*1024*1024,central+24);
  await assert.rejects(checkOfficeArchive(buffer,'word/document.xml'),/unsafe/);
});
test('PDF pixel budgets reject nonfinite, huge and cumulative canvas allocations',()=>{
  assert.equal(checkRenderBudget(1190,1684),2003960);
  for(const dimensions of [[Infinity,10],[0,10],[-10,10],[100000,100000],[4000,4000,64000000]])assert.throws(()=>checkRenderBudget(...dimensions),/too large/);
});
test('data conversion preserves special keys without invoking prototype setters; delimiters are literal',()=>{
  const data=JSON.parse(rowsToJson([['__proto__','constructor','safe'],['value','other','yes']]));
  assert.equal(Object.hasOwn(data[0],'__proto__'),true);assert.equal(data[0].__proto__,'value');assert.equal({}.safe,undefined);
  assert.equal(rowsToCsv([['a[b','c']], '['),'"a[b"[c\r\n');
});
