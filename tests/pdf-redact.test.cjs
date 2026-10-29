const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { PDFDocument, PDFName, PDFRawStream, PDFString, StandardFonts, decodePDFRawStream, degrees, rgb } = require('pdf-lib');
const canvas = require('@napi-rs/canvas');
global.DOMMatrix ??= canvas.DOMMatrix; global.ImageData ??= canvas.ImageData; global.Path2D ??= canvas.Path2D;
global.document = { createElement: tag => { assert.equal(tag, 'canvas'); return canvas.createCanvas(1, 1); } };
const pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
const fontOptions = { standardFontDataUrl: path.resolve('node_modules/pdfjs-dist/standard_fonts') + '/', cMapUrl: path.resolve('node_modules/pdfjs-dist/cmaps') + '/' };
function load(filename, cache = new Map()) {
 filename=path.resolve(filename);if(cache.has(filename))return cache.get(filename).exports;
 const module={exports:{}};cache.set(filename,module);
 const source=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const req=name=>name==='../pdfjs'?{loadPdfjs:async()=>{const pdfjs=await pdfjsPromise;return{...pdfjs,getDocument:options=>pdfjs.getDocument({...options,...fontOptions})};}}:name.startsWith('.')?load(path.resolve(path.dirname(filename),name+'.ts'),cache):require(name);
 new Function('require','module','exports',source)(req,module,module.exports);return module.exports;
}
const {redactPdf,findRedactionMatches,redactionPageSelection,redactionPattern}=load('src/lib/engines/pdf-redact-engine.ts');
const {drawInVisualSpace}=load('src/lib/engines/pdf-visual-page.ts');
const asFile=bytes=>new File([bytes],'redaction-source.pdf',{type:'application/pdf'});
const area=(pageIndex,patch={})=>({id:'area-'+pageIndex,pageIndex,x:.1,y:.1,width:.3,height:.2,...patch});
function evidence(name,bytes){if(process.env.REDACT_QA_DIR){fs.mkdirSync(process.env.REDACT_QA_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.REDACT_QA_DIR,name),Buffer.from(bytes));}}
async function open(file){const pdfjs=await pdfjsPromise;const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),...fontOptions});return {pdf:await task.promise,task};}
async function fixture(){
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);pdf.setTitle('SECRET-EXFIL');pdf.setAuthor('SECRET-EXFIL');
 for(const rotation of [0,90,180,270]){const page=pdf.addPage([560,650]);page.setCropBox(20,30,500,580);page.setRotation(degrees(rotation));await drawInVisualSpace(page,(w,h)=>{page.drawRectangle({x:20,y:20,width:40,height:30,color:rgb(0,0.5,0)});page.drawText('PUBLIC DOCUMENT',{x:40,y:h-50,size:20,font});page.drawText('SECRET-EXFIL',{x:50,y:h-150,size:18,font});page.drawText('Contact: example@example.com',{x:50,y:h-210,size:14,font});page.drawText('Phone: +1 (202) 555-0123',{x:50,y:h-250,size:14,font});page.drawText('Card: 4111 1111 1111 1111',{x:50,y:h-290,size:14,font});page.drawText('Literal: SENSI+TIVE (123)',{x:50,y:h-330,size:14,font});});}
 const form=pdf.getForm(),field=form.createTextField('private-field');field.addToPage(pdf.getPage(0),{x:40,y:50,width:160,height:30});field.setText('SECRET-EXFIL');
 await pdf.attach(new TextEncoder().encode('SECRET-EXFIL'),'private.txt',{mimeType:'text/plain'});
 const annotation=pdf.context.register(pdf.context.obj({Type:'Annot',Subtype:'Link',Rect:[40,40,140,60],A:{S:'URI',URI:PDFString.of('https://example.test/SECRET-EXFIL')}}));pdf.getPage(1).node.addAnnot(annotation);
 const bytes=await pdf.save();evidence('redaction-source.pdf',bytes);return asFile(bytes);
}
test('redaction removes source text, annotations, forms, metadata and attachments from a new PDF',async()=>{
 const input=await fixture(),{pdf,task}=await open(input);let marks;try{marks=(await findRedactionMatches(pdf,'text','SECRET-EXFIL')).flatMap(m=>m.areas);}finally{await task.destroy();}
 assert.equal(marks.length,5);assert.equal(marks.filter(mark=>mark.pageIndex===0).length,2);const progress=[];const output=await redactPdf(input,marks,{},(done,total)=>progress.push([done,total]));assert.deepEqual(progress,[[1,4],[2,4],[3,4],[4,4]]);
 const parsed=await PDFDocument.load(await output.arrayBuffer());assert.equal(parsed.getPageCount(),4);assert.equal(parsed.getTitle(),'Redacted document');assert.equal(parsed.getAuthor(),undefined);
 for(const key of ['AcroForm','Names','Outlines','Metadata','OpenAction'])assert.equal(parsed.catalog.has(PDFName.of(key)),false,key);
 for(const page of parsed.getPages())assert.equal(page.node.Annots()?.size() ?? 0,0);
 for(const [,object] of parsed.context.enumerateIndirectObjects()){const bytes=object instanceof PDFRawStream?decodePDFRawStream(object).decode():Buffer.from(object.toString());assert.equal(Buffer.from(bytes).includes(Buffer.from('SECRET-EXFIL')),false);}
 const viewed=await open(output);try{for(let i=0;i<4;i++){const page=await viewed.pdf.getPage(i+1);assert.equal((await page.getTextContent()).items.length,0);assert.equal((await page.getAnnotations()).length,0);const v=page.getViewport({scale:1});assert.deepEqual([v.width,v.height],i%2?[580,500]:[500,580]);const surface=canvas.createCanvas(Math.ceil(v.width),Math.ceil(v.height));await page.render({canvas:surface,viewport:v}).promise;const mark=marks.find(m=>m.pageIndex===i),point=surface.getContext('2d').getImageData(Math.floor((mark.x+mark.width/2)*v.width),Math.floor((mark.y+mark.height/2)*v.height),1,1).data;assert.deepEqual([...point],[0,0,0,255]);evidence('redacted-'+i+'.png',surface.toBuffer('image/png'));}}finally{await viewed.task.destroy();}
 evidence('redacted.pdf',await output.arrayBuffer());
});
test('search finds literal punctuation, email, phone and valid card candidates on cropped rotated pages',async()=>{
 const {pdf,task}=await open(await fixture());try{for(const [kind,query] of [['text','sensi+tive (123)'],['email',''],['phone',''],['card','']]){const matches=await findRedactionMatches(pdf,kind,query);assert.equal(matches.length,4,kind);for(const match of matches){assert.ok(match.areas.length);for(const area of match.areas)assert.ok(area.x>=0&&area.y>=0&&area.x+area.width<=1.000001&&area.y+area.height<=1.000001);}}assert.equal((await findRedactionMatches(pdf,'text','not in document')).length,0);await assert.rejects(findRedactionMatches(pdf,'text','PUBLIC',()=>true),/cancelled/);}finally{await task.destroy();}
 assert.throws(()=>redactionPattern('text',''),/Enter/);assert.throws(()=>redactionPattern('text','a'.repeat(201)),/Enter/);
});
test('search can mark a phrase spanning separate text objects and ignores invalid card candidates',async()=>{
 const source=await PDFDocument.create(),font=await source.embedFont(StandardFonts.Helvetica),page=source.addPage();page.drawText('First',{x:30,y:700,font,size:12});page.drawText('Last',{x:65,y:700,font,size:12});page.drawText('4111 1111 1111 1112',{x:30,y:650,font,size:12});const {pdf,task}=await open(asFile(await source.save()));try{const matches=await findRedactionMatches(pdf,'text','First Last');assert.equal(matches.length,1);assert.equal(matches[0].areas.length,2);assert.equal((await findRedactionMatches(pdf,'card','')).length,0);}finally{await task.destroy();}
});
test('whole-page white redaction removes scanned pixels at 300 DPI and keeps other pages visible',async()=>{
 const source=await PDFDocument.create();for(let i=0;i<2;i++){const page=source.addPage([150,200]);page.drawRectangle({x:0,y:0,width:150,height:200,color:rgb(0.8,0.1,0.1)});}const output=await redactPdf(asFile(await source.save()),[area(0,{x:0,y:0,width:1,height:1})],{dpi:300,color:'#ffffff'});const {pdf,task}=await open(output);try{for(let i=0;i<2;i++){const page=await pdf.getPage(i+1),viewport=page.getViewport({scale:1}),surface=canvas.createCanvas(150,200);await page.render({canvas:surface,viewport}).promise;const pixel=[...surface.getContext('2d').getImageData(75,100,1,1).data];assert.deepEqual(pixel,i===0?[255,255,255,255]:[204,26,26,255]);}}finally{await task.destroy();}
});
test('invalid redactions, malformed PDFs, huge pages and cancellation do not produce an output',async()=>{
 const input=await fixture();await assert.rejects(redactPdf(input,[]),/at least/);for(const invalid of [area(9),area(0,{width:0}),area(0,{x:-1}),area(0,{x:.9,width:.2}),area(0,{height:NaN})])await assert.rejects(redactPdf(input,[invalid]),/outside/);
 await assert.rejects(redactPdf(input,[area(0)],{color:'transparent'}),/valid/);await assert.rejects(redactPdf(input,[area(0)],{dpi:600}),/valid/);await assert.rejects(redactPdf(new Blob(['broken']),[area(0)]));await assert.rejects(redactPdf(input,[area(0)],{isCancelled:()=>true}),/cancelled/);
 const controller=new AbortController(),done=[];await assert.rejects(redactPdf(input,[area(0)],{signal:controller.signal},n=>{done.push(n);controller.abort();}),/cancelled/);assert.deepEqual(done,[1]);
 const huge=await PDFDocument.create();huge.addPage([16000,16000]);await assert.rejects(redactPdf(asFile(await huge.save()),[area(0)]),/too large/);
 const retry=await redactPdf(input,[area(0)]);assert.ok(retry.size>100);
});
test('page scope supports current, all, odd, even and validated ranges',()=>{
 assert.deepEqual(redactionPageSelection('current',2,5),[2]);assert.deepEqual(redactionPageSelection('all',0,5),[0,1,2,3,4]);assert.deepEqual(redactionPageSelection('odd',0,5),[0,2,4]);assert.deepEqual(redactionPageSelection('even',0,5),[1,3]);assert.deepEqual(redactionPageSelection('range',0,5,'5,1-3,2'),[0,1,2,4]);for(const range of ['', '0','3-1','1,,2','1.5','1-999999999'])assert.throws(()=>redactionPageSelection('range',0,5,range));
});
