const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const sharp = require('sharp');
const { PDFDocument, PDFName } = require('pdf-lib');
const { unzipSync } = require('fflate');
const mod = { exports: {} };
const source = ts.transpileModule(fs.readFileSync('src/lib/engines/jpg-to-pdf-engine.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function('require','module','exports',source)(require,mod,mod.exports);
const defaults = { orientation:'portrait',pageSize:'a4',margin:'none',merge:true };
async function input(name,color,rotation=0){return{file:new File([await sharp({create:{width:160,height:100,channels:3,background:color}}).composite([{input:Buffer.from('<svg width="20" height="20"><rect width="20" height="20" fill="black"/></svg>'),left:0,top:0}]).png().toBuffer()],name,{type:'image/png'}),rotation};}

test('separate scanned PDFs retain every image when filenames collide with generated suffixes',async()=>{
 const images=await Promise.all([input('scan.png','#ff0000'),input('scan.png','#00ff00'),input('scan-2.png','#0000ff')]);
 const result=await mod.exports.createImagePdf(images,{...defaults,merge:false},()=>{},()=>false);
 const entries=unzipSync(new Uint8Array(await result.blob.arrayBuffer()));
 assert.equal(Object.keys(entries).length,3,'no original scan may be overwritten by a ZIP filename collision');
 for(const bytes of Object.values(entries))assert.equal((await PDFDocument.load(bytes)).getPageCount(),1);
});

test('scan conversion preserves selected order and clockwise rotation in the actual PDF page content',async()=>{
 const images=await Promise.all([input('first.png','#ff0000'),input('second.png','#0000ff',90)]);
 const result=await mod.exports.createImagePdf([images[1],images[0]],{...defaults,pageSize:'letter',orientation:'landscape',margin:'small'},()=>{},()=>false);
 const pdf=await PDFDocument.load(await result.blob.arrayBuffer());assert.equal(pdf.getPageCount(),2);
 assert.deepEqual(pdf.getPages().map(p=>[p.getWidth(),p.getHeight()]),[[792,612],[792,612]]);
 const {createCanvas}=require('@napi-rs/canvas');const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const loading=pdfjs.getDocument({data:new Uint8Array(await result.blob.arrayBuffer())}),doc=await loading.promise;
 for(const [i,expected] of [[1,[0,0,255]],[2,[255,0,0]]]){const page=await doc.getPage(i),viewport=page.getViewport({scale:1}),canvas=createCanvas(viewport.width,viewport.height);await page.render({canvas,canvasContext:canvas.getContext('2d'),viewport}).promise;const rgb=canvas.getContext('2d').getImageData(396,306,1,1).data;assert.deepEqual([...rgb].slice(0,3),expected);const marker=canvas.getContext('2d').getImageData(i===1?550:55,i===1?55:100,1,1).data;assert.deepEqual([...marker].slice(0,3),[0,0,0],'source top-left marker follows clockwise rotation');}
 await loading.destroy();
 // Width/height remain source pixels; rotation is an actual PDF drawing transform.
 const first=pdf.getPage(0).node.Resources().lookup(PDFName.of('XObject'));
 assert.ok(first.entries().length>0);
});

test('scan cancellation yields no output, malformed images fail and retry accepts a valid image',async()=>{
 const valid=await input('scan.png','#008000');
 assert.equal(await mod.exports.createImagePdf([valid],defaults,()=>{},()=>true),null);
 await assert.rejects(mod.exports.createImagePdf([{file:new File(['not png'],'broken.png',{type:'image/png'}),rotation:0}],defaults,()=>{},()=>false));
 assert.equal((await PDFDocument.load(await(await mod.exports.createImagePdf([valid],defaults,()=>{},()=>false)).blob.arrayBuffer())).getPageCount(),1);
});
