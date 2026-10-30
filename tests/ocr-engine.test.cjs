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
  const pdfjs = overrides.pdfjs ?? { getDocument: () => ({ promise: Promise.resolve({
    numPages: 2,
    getPage: async () => ({
      getTextContent: async () => ({items:[]}),
      getViewport: ({scale}) => ({ width: 600*scale, height: 350*scale, scale, transform: [scale,0,0,-scale,0,350*scale], convertToPdfPoint: (x,y) => [x/scale,350-y/scale] }),
      render: () => ({ promise: Promise.resolve(), cancel: () => events.push('cancel-render') }),
      cleanup: () => events.push('cleanup'),
    }), destroy: async () => events.push('destroy'),
  }), destroy: async () => events.push('destroy') }) };
  const requireStub = name => {
    if (name === 'tesseract.js') return { createWorker: async (...args) => { events.push(['create',args[2],args[0]]);return worker; } };
    if (name === '../vendor/bidi-js/bidi.min.mjs') return require('../src/lib/vendor/bidi-js/bidi.min.mjs');
    if (name === '../pdfjs') return { loadPdfjs: async () => pdfjs };
    if (name === './ocr-options' || name === './ocr-text-layer') {
      const out = { exports: {} }; const code = ts.transpileModule(fs.readFileSync('src/lib/engines/' + name.slice(2) + '.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
      new Function('require', 'module', 'exports', code)(requireStub, out, out.exports); return out.exports;
    }
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
  global.fetch=async()=>({ok:true,arrayBuffer:async()=>fs.readFileSync('public/tesseract/pdf.ttf')});
  global.document={createElement:()=>({width:0,height:0})};
  try {
    const engine=loadEngine(); const output=await engine.createSearchableOcrPdf(new Blob([input]));
    const result=await PDFDocument.load(await output.blob.arrayBuffer());
    assert.equal(result.getPageCount(),2);assert.deepEqual(result.getPages().map(p=>p.getSize()),before.getPages().map(p=>p.getSize()));
    assert.deepEqual(images(result),images(before),'original compressed raster streams must survive byte-for-byte');
    const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const loading=pdfjs.getDocument({data:new Uint8Array(await output.blob.arrayBuffer()),useSystemFonts:true});const parsed=await loading.promise;
    const items=(await (await parsed.getPage(1)).getTextContent()).items;
    assert.ok(items.some(x=>x.str==='Native original 0'));
    const cafe=items.find(x=>x.str?.trim()==='Café');assert.ok(cafe);assert.deepEqual(cafe.transform.slice(4),[45,270]);
    assert.ok(items.some(x=>x.str?.trim()==='€42.75'));assert.match(output.recognizedText,/Page 2/);
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

test('multilingual OCR selects requested models and only requested pages, keeping dates and untouched pages', async () => {
  const pdf=await PDFDocument.create();pdf.setCreationDate(new Date('2001-02-03T04:05:06Z'));pdf.setModificationDate(new Date('2004-05-06T07:08:09Z'));
  const font=await pdf.embedFont(StandardFonts.Helvetica);pdf.addPage([600,350]).drawText('Untouched first page',{font});pdf.addPage([600,350]);
  const input=await pdf.save(), before=await PDFDocument.load(input,{updateMetadata:false});
  const oldFetch=global.fetch,oldDocument=global.document;global.fetch=async()=>({ok:true,arrayBuffer:async()=>fs.readFileSync('public/tesseract/pdf.ttf')});global.document={createElement:()=>({width:0,height:0})};
  try {
    let calls=0; const lines=['हिन्दी','العربية','中文','日本語','😀','العربية2026','שלום'];
    const engine=loadEngine({worker:{recognize:async()=>{calls++;return {data:{text:lines.join('\n'),confidence:95,blocks:[{paragraphs:[{lines:lines.map((text,i)=>({words:[{text,bbox:{x0:90,y0:50+i*60,x1:300,y1:90+i*60}}]}))}]}]}};}}});
    const result=await engine.createSearchableOcrPdf(new Blob([input]),undefined,undefined,undefined,{languages:['hin','ara','chi_sim'],pages:'2,2',dpi:150});
    assert.equal(calls,1);assert.deepEqual(result.processedPages,[2]);assert.equal(result.pageCount,2);
    assert.deepEqual(engine.events.find(e=>e[0]==='create')[2],['hin','ara','chi_sim']);assert.match(engine.events.find(e=>e[0]==='create')[1].langPath,/lang-v1$/);
    const out=await PDFDocument.load(await result.blob.arrayBuffer(),{updateMetadata:false});assert.equal(+out.getCreationDate(),+before.getCreationDate());assert.equal(+out.getModificationDate(),+before.getModificationDate());
    const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const loading=pdfjs.getDocument({data:new Uint8Array(await result.blob.arrayBuffer())});const parsed=await loading.promise;
    assert.equal((await (await parsed.getPage(1)).getTextContent()).items.map(x=>x.str??'').join(''),'Untouched first page');
    const strings=(await (await parsed.getPage(2)).getTextContent()).items.map(x=>x.str?.trim()).filter(Boolean);
    for (const text of lines) assert.ok(strings.includes(text),'logical Unicode missing: '+text+' from '+JSON.stringify(strings));
    await loading.destroy();
    if(process.env.OCR_QA_DIR){fs.mkdirSync(process.env.OCR_QA_DIR,{recursive:true});fs.writeFileSync(process.env.OCR_QA_DIR+'/unicode-layer.pdf',Buffer.from(await result.blob.arrayBuffer()));fs.writeFileSync(process.env.OCR_QA_DIR+'/unicode-layer-source.pdf',input);}
  } finally {global.fetch=oldFetch;global.document=oldDocument;}
});

test('page and language validation fail before a worker starts, with clear recovery',async()=>{
  const pdf=await PDFDocument.create();pdf.addPage();pdf.addPage();const blob=new Blob([await pdf.save()]),engine=loadEngine();
  for (const options of [{languages:[]},{languages:['../secret']},{languages:['eng','hin','ara','fra']},{pages:'2-1'},{pages:'0'},{pages:'3'},{pages:'1,'},{dpi:999}]) await assert.rejects(engine.createSearchableOcrPdf(blob,undefined,undefined,undefined,options));
  assert.equal(engine.events.length,0);
  const worker=await engine.createOcrWorker(undefined,{languages:['eng','eng']});assert.deepEqual(engine.events.find(e=>e[0]==='create')[2],['eng']);await worker.terminate();
});

test('no recognized text returns an actionable error and releases rendering resources',async()=>{
  const pdf=await PDFDocument.create();pdf.addPage();pdf.addPage();const oldFetch=global.fetch,oldDocument=global.document;
  global.fetch=async()=>({ok:true,arrayBuffer:async()=>fs.readFileSync('public/tesseract/pdf.ttf')});global.document={createElement:()=>({width:0,height:0})};
  try {const engine=loadEngine({worker:{recognize:async()=>({data:{text:'',confidence:0,blocks:[]}})}});await assert.rejects(engine.createSearchableOcrPdf(new Blob([await pdf.save()])),/No text was recognized/);assert.equal(engine.events.filter(e=>e==='terminate').length,1);assert.ok(engine.events.includes('cleanup'));assert.ok(engine.events.includes('destroy'));
    const missingBoxes=loadEngine({worker:{recognize:async()=>({data:{text:'Unpositioned text',confidence:90,blocks:[]}})}});await assert.rejects(missingBoxes.createSearchableOcrPdf(new Blob([await pdf.save()])),/could not be positioned/);
  }
  finally{global.fetch=oldFetch;global.document=oldDocument;}
});

test('signed and XFA PDFs refuse OCR before rewriting protected content',async()=>{
  for(const kind of ['signature','xfa']) {const pdf=await PDFDocument.create();pdf.addPage();if(kind==='signature')pdf.catalog.set(PDFName.of('Perms'),pdf.context.obj({DocMDP:pdf.context.register(pdf.context.obj({Type:'Sig',ByteRange:[0,1,2,3]}))}));else pdf.catalog.set(PDFName.of('AcroForm'),pdf.context.obj({XFA:pdf.context.register(pdf.context.stream('<xml/>'))}));const engine=loadEngine();await assert.rejects(engine.createSearchableOcrPdf(new Blob([await pdf.save()])),kind==='signature'?/signature/:/XFA/);assert.equal(engine.events.length,0);}
});

test('bundled language models match pinned integrity records and decompress correctly',()=>{
  const {createHash}=require('node:crypto'),{gunzipSync}=require('node:zlib'),manifest=JSON.parse(fs.readFileSync('public/tesseract/assets-v1.json','utf8'));
  assert.equal(manifest.models.length,41);for(const model of manifest.models){const gzip=fs.readFileSync('public/tesseract/lang-v1/'+model.language+'.traineddata.gz');assert.equal(createHash('sha256').update(gzip).digest('hex'),model.gzipSha256);const raw=gunzipSync(gzip);assert.equal(raw.length,model.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),model.sha256);}
  assert.equal(createHash('sha256').update(fs.readFileSync('public/tesseract/pdf.ttf')).digest('hex'),manifest.glyphlessFont.sha256);
});

test('Arabic phrases keep word order, spaces and embedded digits in searchable PDF text',async()=>{
  const pdf=await PDFDocument.create();pdf.addPage([600,350]);pdf.addPage([600,350]);
  const oldFetch=global.fetch,oldDocument=global.document;global.fetch=async()=>({ok:true,arrayBuffer:async()=>fs.readFileSync('public/tesseract/pdf.ttf')});global.document={createElement:()=>({width:0,height:0})};
  try {const phrase=['اختبار','اللغة','العربية','125'];const engine=loadEngine({worker:{recognize:async()=>({data:{text:phrase.join(' '),confidence:99,blocks:[{paragraphs:[{lines:[{words:phrase.map((text,i)=>({text,bbox:{x0:900-i*180,y0:90,x1:1020-i*180,y1:130}}))}]}]}]}})}});
    const result=await engine.createSearchableOcrPdf(new Blob([await pdf.save()]),undefined,undefined,undefined,{languages:['ara'],pages:'1'});
    const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'),task=pdfjs.getDocument({data:new Uint8Array(await result.blob.arrayBuffer())}),doc=await task.promise;
    const strings=(await(await doc.getPage(1)).getTextContent()).items.map(x=>x.str).filter(Boolean);assert.ok(strings.some(x=>x.trim()===phrase.join(' ')),JSON.stringify(strings));await task.destroy();
    if(process.env.OCR_QA_DIR)fs.writeFileSync(process.env.OCR_QA_DIR+'/arabic-phrase.pdf',Buffer.from(await result.blob.arrayBuffer()));
  }finally{global.fetch=oldFetch;global.document=oldDocument;}
});

test('Chinese and Japanese OCR joins artificial token spaces without altering Latin, digits, line breaks or Korean',async()=>{
  const text='中 文 文字 识别 测试\n日 本 語 の 文字 認識 テス ト\nPDF PILOT 2026\n合計 125 円\n한국어 문장';
  const engine=loadEngine({worker:{recognize:async()=>({data:{text,confidence:98,blocks:[]}})}});
  const worker=await engine.createOcrWorker(undefined,{languages:['chi_sim','jpn']});const result=await worker.recognize(new Blob());await worker.terminate();
  assert.equal(result.text,'中文文字识别测试\n日本語の文字認識テスト\nPDF PILOT 2026\n合計 125 円\n한국어 문장');
});

test('searchable Chinese phrases remain contiguous across recognized word boxes',async()=>{
  const pdf=await PDFDocument.create();pdf.addPage([600,350]);pdf.addPage([600,350]);const oldFetch=global.fetch,oldDocument=global.document;
  global.fetch=async()=>({ok:true,arrayBuffer:async()=>fs.readFileSync('public/tesseract/pdf.ttf')});global.document={createElement:()=>({width:0,height:0})};
  try {const phrase=['中','文','文字','识别','测试'];const engine=loadEngine({worker:{recognize:async()=>({data:{text:phrase.join(' '),confidence:99,blocks:[{paragraphs:[{lines:[{words:phrase.map((text,i)=>({text,bbox:{x0:50+i*150,y0:90,x1:180+i*150,y1:130}}))}]}]}]}})}});
    const result=await engine.createSearchableOcrPdf(new Blob([await pdf.save()]),undefined,undefined,undefined,{languages:['chi_sim'],pages:'1'});
    const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'),task=pdfjs.getDocument({data:new Uint8Array(await result.blob.arrayBuffer())}),doc=await task.promise;
    assert.ok((await(await doc.getPage(1)).getTextContent()).items.some(x=>x.str?.trim()==='中文文字识别测试'));assert.match(result.recognizedText,/中文文字识别测试/);await task.destroy();
  }finally{global.fetch=oldFetch;global.document=oldDocument;}
});
