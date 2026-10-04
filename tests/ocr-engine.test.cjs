const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { PDFDocument, StandardFonts, PDFName } = require('pdf-lib');

function loadEngine(overrides = {}) {
  const events = [];
  const worker = {
    async recognize() { return { data: { text: 'Café total €42.75', confidence: 98, blocks: [{ paragraphs: [{ lines: [{ words: [{ text: 'Café', bbox: {x0:90,y0:120,x1:180,y1:160} }, { text: '€42.75', bbox: {x0:90,y0:240,x1:220,y1:280} }] }] }] }] } }; },
    async terminate() { events.push('terminate'); },
    ...overrides.worker,
  };
  const pdfjs = { getDocument: () => ({ promise: Promise.resolve({
    numPages: 2,
    getPage: async () => ({
      getTextContent: async () => ({items:[]}),
      getViewport: () => ({ width: 1200, height: 700, convertToPdfPoint: (x,y) => [x/2,350-y/2] }),
      render: () => ({ promise: Promise.resolve(), cancel: () => events.push('cancel-render') }),
      cleanup: () => events.push('cleanup'),
    }), destroy: async () => events.push('destroy'),
  }), destroy: async () => events.push('destroy') }) };
  const requireStub = name => {
    if (name === 'tesseract.js') return { createWorker: async (...args) => { events.push(['create',args[2]]);return worker; } };
    if (name === '../pdfjs') return { loadPdfjs: async () => pdfjs };
    return require(name);
  };
  const source = ts.transpileModule(fs.readFileSync('src/lib/engines/ocr-engine.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const mod = {exports:{}};
  new Function('require','module','exports',source)(requireStub,mod,mod.exports);
  return {...mod.exports,events};
}

test('searchable OCR preserves source images, page count, geometry and Unicode positioned text', async () => {
  const pdf=await PDFDocument.create(), font=await pdf.embedFont(StandardFonts.Helvetica);
  const png=await pdf.embedPng(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==','base64'));
  for(let i=0;i<2;i++){const page=pdf.addPage([600,350]);page.drawImage(png,{x:20,y:20,width:100,height:100});page.drawText('Native original '+i,{x:10,y:10,font,size:9});}
  const input=await pdf.save();
  const before=await PDFDocument.load(input);
  const images=p=>p.context.enumerateIndirectObjects().filter(([,obj])=>obj.dict?.get(PDFName.of('Subtype'))?.toString()==='/Image').map(([,obj])=>Buffer.from(obj.contents));
  const oldFetch=global.fetch,oldDocument=global.document;
  global.fetch=async()=>({ok:true,arrayBuffer:async()=>fs.readFileSync('public/fonts/NotoSans-Regular.ttf')});
  global.document={createElement:()=>({width:0,height:0})};
  try {
    const engine=loadEngine(); const output=await engine.createSearchableOcrPdf(new Blob([input]));
    const result=await PDFDocument.load(await output.blob.arrayBuffer());
    assert.equal(result.getPageCount(),2);assert.deepEqual(result.getPages().map(p=>p.getSize()),before.getPages().map(p=>p.getSize()));
    assert.deepEqual(images(result),images(before),'original compressed raster streams must survive byte-for-byte');
    const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const loading=pdfjs.getDocument({data:new Uint8Array(await output.blob.arrayBuffer()),useSystemFonts:true});const parsed=await loading.promise;
    const items=(await (await parsed.getPage(1)).getTextContent()).items;
    assert.ok(items.some(x=>x.str==='Native original 0'));
    const cafe=items.find(x=>x.str==='Café');assert.ok(cafe);assert.deepEqual(cafe.transform.slice(4),[45,270]);
    assert.ok(items.some(x=>x.str==='€42.75'));assert.match(output.recognizedText,/Page 2/);
    await loading.destroy();assert.equal(engine.events.filter(x=>x==='terminate').length,1);assert.ok(engine.events.includes('destroy'));
  } finally { global.fetch=oldFetch;global.document=oldDocument; }
});

test('aborting an active recognition terminates worker and settles without waiting for Tesseract',async()=>{
  let started;const gate=new Promise(resolve=>{started=resolve});
  const engine=loadEngine({worker:{recognize:()=>{started();return new Promise(()=>{});}}});
  const controller=new AbortController(); const pending=engine.recognizeText(new Blob(['image']),undefined,controller.signal);
  await gate;controller.abort();await assert.rejects(pending,{name:'AbortError'});
  assert.equal(engine.events.filter(x=>x==='terminate').length,1);
  const next=loadEngine();assert.match((await next.recognizeText(new Blob(['image']))).text,/Café/);
});

test('TXT and editable DOCX exports retain recognized Unicode and line ordering',async()=>{
  const engine=loadEngine(),text='Café €42.75\nSecond line — résumé';
  assert.equal(await (await engine.exportOcrResult(text,'txt')).text(),text);
  const {unzipSync}=require('fflate');const files=unzipSync(new Uint8Array(await (await engine.exportOcrResult(text,'docx')).arrayBuffer()));
  const xml=Buffer.from(files['word/document.xml']).toString();assert.match(xml,/Café €42.75/);assert.match(xml,/Second line — résumé/);assert.ok(xml.indexOf('Café')<xml.indexOf('Second line'));
});
