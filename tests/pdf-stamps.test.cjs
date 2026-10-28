const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { PDFDocument, degrees, rgb } = require('pdf-lib');
const canvas = require('@napi-rs/canvas');
global.DOMMatrix ??= canvas.DOMMatrix; global.ImageData ??= canvas.ImageData; global.Path2D ??= canvas.Path2D;
const originalFetch = global.fetch;
global.fetch = url => typeof url === 'string' && url.startsWith('/fonts/') ? Promise.resolve(new Response(fs.readFileSync(path.join(process.cwd(), 'public', url)))) : originalFetch(url);
function load(filename, cache = new Map()) {
  filename = path.resolve(filename); if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', source)(name => name.startsWith('.') ? load(path.resolve(path.dirname(filename), name + '.ts'), cache) : require(name), module, module.exports);
  return module.exports;
}
const { addPageNumbersToPdf } = load('src/lib/engines/pdf-page-numbers-engine.ts');
const { addWatermarkToPdf } = load('src/lib/engines/pdf-watermark-engine.ts');
const { cropPdfDocument } = load('src/lib/engines/pdf-crop-engine.ts');
const numberSettings = { pageMode: 'single', firstPageCover: false, position: 8, margin: 'recommended', firstNumber: 1, fromPage: 1, toPage: 4, textFormat: 'custom', customText: 'Label {n} of {p}', fontFamily: 'helvetica', fontSize: 12, bold: true, italic: false, underline: true, color: '#1255bb' };
const watermarkSettings = { mode: 'text', text: 'Watermark', fontFamily: 'helvetica', fontSize: 30, bold: false, italic: false, underline: true, color: '#1255bb', position: 0, mosaic: false, transparency: 75, rotation: 0, fromPage: 1, toPage: 4, layer: 'over' };
const region = { pageIndex: 1, xFrac: 0.1, yFrac: 0.2, widthFrac: 0.5, heightFrac: 0.6 };
function evidence(name, bytes) { if (process.env.STAMPS_QA_DIR) { fs.mkdirSync(process.env.STAMPS_QA_DIR, { recursive: true }); fs.writeFileSync(path.join(process.env.STAMPS_QA_DIR, name), bytes); } }
async function fixture() {
  const pdf = await PDFDocument.create();
  for (const angle of [0, 90, 180, 270]) { const page = pdf.addPage([400, 500]); page.setCropBox(20,30,360,440); page.setRotation(degrees(angle)); page.drawText('Original ' + angle, { x: 80, y: 230, size: 12 }); }
  const bytes = await pdf.save(); evidence('stamps-source.pdf', bytes);
  return new File([bytes], 'stamps-source.pdf', { type: 'application/pdf' });
}
async function inspect(blob, callback) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), standardFontDataUrl: path.resolve('node_modules/pdfjs-dist/standard_fonts') + '/' });
  try { return await callback(await task.promise, pdfjs); } finally { await task.destroy(); }
}
async function labels(blob) {
  return inspect(blob, async (doc, pdfjs) => {
    const result=[];
    for (let n=1;n<=doc.numPages;n++) { const page=await doc.getPage(n), viewport=page.getViewport({scale:1}), items=(await page.getTextContent()).items.filter(item=>'str' in item).map(item=>({...item,visual:pdfjs.Util.transform(viewport.transform,item.transform)})); result.push({ items, width:viewport.width, height:viewport.height, view:page.view }); }
    return result;
  });
}
test('page numbers stay upright in the visible bottom-right corner on all native rotations', async () => {
  const output=await addPageNumbersToPdf(await fixture(), numberSettings), pages=await labels(output.blob);
  assert.equal(pages.length,4);
  for(let n=0;n<4;n++) { const page=pages[n], label=page.items.find(item=>item.str===`Label ${n+1} of 4`); assert.ok(label); assert.ok(label.visual[0]>0); assert.ok(Math.abs(label.visual[1])<0.001); assert.ok(Math.abs(label.visual[4]+label.width-(page.width-28))<0.2); assert.ok(Math.abs(label.visual[5]-(page.height-28))<0.2); assert.ok(page.items.some(item=>item.str==='Original '+n*90)); }
  const parsed=await PDFDocument.load(await output.blob.arrayBuffer()); assert.deepEqual(parsed.getPages().map(page=>page.getRotation().angle),[0,90,180,270]);
  evidence('numbers-rotated.pdf',new Uint8Array(await output.blob.arrayBuffer()));
});
test('numbering preserves the selected range, starting number and facing-page outer edges', async () => {
  const output=await addPageNumbersToPdf(await fixture(), {...numberSettings,fromPage:2,firstNumber:9,pageMode:'facing',firstPageCover:true}),pages=await labels(output.blob);
  assert.ok(!pages[0].items.some(item=>item.str.startsWith('Label')));
  for(let n=1;n<4;n++) { const label=pages[n].items.find(item=>item.str===`Label ${n+8} of 4`); assert.ok(label); if(n%2) assert.ok(Math.abs(label.visual[4]-28)<0.2); else assert.ok(Math.abs(label.visual[4]+label.width-(pages[n].width-28))<0.2); }
});
test('Hindi page labels and watermarks retain extractable Unicode', async () => {
  const input=await fixture();
  for(const [name,output] of [['numbers-hindi',await addPageNumbersToPdf(input,{...numberSettings,customText:'पृष्ठ {n} / {p}'})],['watermark-hindi',await addWatermarkToPdf(input,{...watermarkSettings,text:'नमस्ते भारत'},null)]]) {
    const pages=await labels(output.blob); for(const page of pages) assert.match(page.items.map(item=>item.str).join(' '),name.startsWith('numbers')?/पृष्ठ/:/नमस्ते भारत/);
    evidence(name+'.pdf',new Uint8Array(await output.blob.arrayBuffer()));
  }
});
test('watermarks fit within rotated cropped pages at edge positions and diagonal angles', async () => {
  for(const angle of [0,45,90,180,270]) {
    const output=await addWatermarkToPdf(await fixture(),{...watermarkSettings,text:'A long watermark across the page',position:8,rotation:angle},null),pages=await labels(output.blob);
    for(const page of pages) {
      const item=page.items.find(item=>item.str.startsWith('A long')); assert.ok(item);
      const t=item.visual, unitX=[t[0]/Math.hypot(t[0],t[1]),t[1]/Math.hypot(t[0],t[1])],unitY=[t[2]/Math.hypot(t[2],t[3]),t[3]/Math.hypot(t[2],t[3])];
      for(const [dx,dy] of [[0,0],[item.width,0],[0,item.height],[item.width,item.height]]) { const x=t[4]+unitX[0]*dx+unitY[0]*dy,y=t[5]+unitX[1]*dx+unitY[1]*dy; assert.ok(x>=-1&&x<=page.width+1,`x ${x}`);assert.ok(y>=-1&&y<=page.height+1,`y ${y}`); }
    }
    if(angle===45) evidence('watermark-diagonal.pdf',new Uint8Array(await output.blob.arrayBuffer()));
  }
});
test('image watermark size follows page width and below/over layers render in the right order', async () => {
  const pdf=await PDFDocument.create(),page=pdf.addPage([400,500]); page.drawRectangle({x:170,y:225,width:60,height:50,color:rgb(1,0,0)});
  const input=new File([await pdf.save()],'layer.pdf'); const picture=canvas.createCanvas(1000,500),context=picture.getContext('2d');context.fillStyle='#0000ff';context.fillRect(0,0,1000,500);const image=new File([picture.toBuffer('image/png')],'blue.png',{type:'application/octet-stream'});
  for(const layer of ['over','below']) {
    const output=await addWatermarkToPdf(input,{...watermarkSettings,mode:'image',fromPage:1,toPage:1,layer,position:4,transparency:100},image);
    await inspect(output.blob,async doc=>{ const page=await doc.getPage(1),viewport=page.getViewport({scale:1}),target=canvas.createCanvas(viewport.width,viewport.height); await page.render({canvas:target,canvasContext:target.getContext('2d'),viewport}).promise; const ctx=target.getContext('2d'),center=ctx.getImageData(200,250,1,1).data; assert.deepEqual(Array.from(center).slice(0,3),layer==='over'?[0,0,255]:[255,0,0]);assert.deepEqual(Array.from(ctx.getImageData(135,250,1,1).data).slice(0,3),[255,255,255]);assert.deepEqual(Array.from(ctx.getImageData(145,250,1,1).data).slice(0,3),[0,0,255]); });
    evidence('watermark-image-'+layer+'.pdf',new Uint8Array(await output.blob.arrayBuffer()));
  }
});
test('crop selection follows the same visible area at every page rotation', async () => {
  const input=await fixture(),before=await labels(input),output=await cropPdfDocument(input,region,'all'),after=await labels(output.blob);
  for(let n=0;n<4;n++) { assert.ok(Math.abs(after[n].width-before[n].width*0.5)<0.01);assert.ok(Math.abs(after[n].height-before[n].height*0.6)<0.01); }
  const expected=[[56,118,236,382],[92,74,308,294],[164,118,344,382],[92,206,308,426]];
  after.forEach((page,n)=>page.view.forEach((v,i)=>assert.ok(Math.abs(v-expected[n][i])<0.01,JSON.stringify(page.view))));
  const one=await labels((await cropPdfDocument(input,region,'current')).blob);assert.deepEqual(one[0].view,before[0].view);assert.deepEqual(one[2].view,before[2].view);
  evidence('cropped-rotations.pdf',new Uint8Array(await output.blob.arrayBuffer()));
});
test('stamp and crop cancellation between pages prevents an output file', async () => {
  const input=await fixture();
  for(const process of [(progress,cancelled)=>addPageNumbersToPdf(input,numberSettings,progress,cancelled),(progress,cancelled)=>addWatermarkToPdf(input,watermarkSettings,null,progress,cancelled),(progress,cancelled)=>cropPdfDocument(input,region,'all',progress,cancelled)]) {
    let cancelled=false,updates=0; await assert.rejects(process(()=>{cancelled=true;updates++;},()=>cancelled),/cancelled/);assert.equal(updates,1);
  }
});
test('invalid ranges, unsupported labels and invalid crop rectangles fail explicitly', async () => {
  const input=await fixture();
  await assert.rejects(addPageNumbersToPdf(input,{...numberSettings,toPage:20}),/page range/);
  await assert.rejects(addPageNumbersToPdf(input,{...numberSettings,customText:'漢字'}),/does not support/);
  await assert.rejects(addPageNumbersToPdf(input,{...numberSettings,customText:'Long'.repeat(200)}),/does not fit/);
  await assert.rejects(addWatermarkToPdf(input,{...watermarkSettings,text:''},null),/Enter watermark text/);
  await assert.rejects(cropPdfDocument(input,{...region,xFrac:NaN},'all'),/crop rectangle/);
  await assert.rejects(cropPdfDocument(input,{...region,xFrac:0.9},'all'),/crop rectangle/);
  await assert.rejects(cropPdfDocument(input,{...region,pageIndex:9},'current'),/existing page/);
});
