const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { PDFDocument, PDFName, PDFRawStream, PDFString, StandardFonts, decodePDFRawStream, degrees, rgb } = require('pdf-lib');
const canvas = require('@napi-rs/canvas');
global.DOMMatrix ??= canvas.DOMMatrix;
global.ImageData ??= canvas.ImageData;
global.Path2D ??= canvas.Path2D;
global.document = { createElement: tag => { assert.equal(tag, 'canvas'); return canvas.createCanvas(1, 1); } };
const browserFetch = global.fetch;
global.fetch = url => {
  if (typeof url === 'string' && url.startsWith('data:')) throw new Error('The browser connect-src policy blocks fetching data URIs.');
  return typeof url === 'string' && url.startsWith('/fonts/')
    ? Promise.resolve(new Response(fs.readFileSync(path.join(process.cwd(), 'public', url)))) : browserFetch(url);
};
const pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
function load(filename, cache = new Map()) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const localRequire = name => name === '../pdfjs' ? { loadPdfjs: async () => {
    const pdfjs = await pdfjsPromise;
    return { ...pdfjs, getDocument: options => pdfjs.getDocument({ ...options, standardFontDataUrl: path.resolve('node_modules/pdfjs-dist/standard_fonts') + '/', cMapUrl: path.resolve('node_modules/pdfjs-dist/cmaps') + '/' }) };
  } } : name.startsWith('.') ? load(path.resolve(path.dirname(filename), name + '.ts'), cache) : require(name);
  new Function('require', 'module', 'exports', source)(localRequire, module, module.exports);
  return module.exports;
}
const {exportEditedPdf}=load('src/lib/editor/pdf-export.ts');
const {extractExistingFields}=load('src/lib/engines/pdf-forms-engine.ts');
const file=bytes=>new File([bytes],'editor-overlays.pdf',{type:'application/pdf'});
const base={x:50,y:50,width:100,height:50,rotation:0,zIndex:1};
const obj=(id,type,patch={})=>({...base,id,type,...patch});
function evidence(name,bytes){if(process.env.OVERLAYS_QA_DIR){fs.mkdirSync(process.env.OVERLAYS_QA_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.OVERLAYS_QA_DIR,name),Buffer.from(bytes));}}
async function source(){const pdf=await PDFDocument.create();for(const rotation of [0,90,180,270]){const page=pdf.addPage([600,620]);page.setCropBox(20,30,500,500);page.setRotation(degrees(rotation));}const bytes=await pdf.save();evidence('overlays-source.pdf',bytes);return file(bytes);}
async function inspect(blob){const pdfjs=await pdfjsPromise,task=pdfjs.getDocument({data:new Uint8Array(await blob.arrayBuffer()),standardFontDataUrl:path.resolve('node_modules/pdfjs-dist/standard_fonts')+'/'});try{const pdf=await task.promise,result=[];for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n),viewport=page.getViewport({scale:1.5}),surface=canvas.createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));await page.render({canvas:surface,viewport}).promise;result.push({pixels:surface.getContext('2d').getImageData(0,0,surface.width,surface.height).data,image:surface.toBuffer('image/png'),text:(await page.getTextContent()).items.map(x=>x.str??'').join(' '),annotations:await page.getAnnotations()});}return result;}finally{await task.destroy();}}

test('all overlay types keep identical visible placement on cropped pages at four native rotations',async()=>{
 const image=canvas.createCanvas(120,60),ctx=image.getContext('2d');ctx.fillStyle='#0000ff';ctx.fillRect(0,0,120,60);ctx.fillStyle='#ffff00';ctx.fillRect(10,10,30,40);
 const objects=[obj('text','text',{text:'Added text',width:360,height:70,fontSize:20,fontWeight:'bold',fontStyle:'italic',color:'#cc0000',underline:true,strikethrough:true,align:'center',linkUrl:'https://pdfpilot.net',rotation:15}),obj('rectangle','rectangle',{x:50,y:150,width:180,height:90,rotation:23,fillColor:'#f0aaaa',strokeColor:'#2233dd',strokeWidth:3,opacity:0.8}),obj('ellipse','ellipse',{x:290,y:150,width:120,height:85,rotation:37,fillColor:'#eeeeaa',strokeColor:'#005500',strokeWidth:2,opacity:0.7}),obj('line','line',{x:50,y:300,width:400,height:6,rotation:-12,strokeColor:'#224466',strokeWidth:4}),obj('image','image',{x:50,y:360,width:120,height:70,rotation:35,dataUrl:image.toDataURL('image/png'),format:'png'}),obj('draw','draw',{x:250,y:360,width:100,height:80,rotation:15,points:[{x:0,y:0},{x:50,y:60},{x:100,y:30}],strokeColor:'#226600',strokeWidth:4,kind:'draw'}),obj('note','note',{x:50,y:500,width:240,height:110,rotation:-18,text:'Note text on two lines\nSecond line',color:'#fef08a'}),obj('link','link',{x:430,y:530,width:140,height:40,rotation:33,url:'pdfpilot.net'}),obj('field','form-field',{x:420,y:370,width:180,height:45,rotation:90,name:'name',fieldType:'text',fontSize:12,required:true}),obj('choice','form-field',{x:420,y:650,width:220,height:40,name:'city',fieldType:'dropdown',fontSize:12,options:['Delhi','Paris'],required:false})];
 const all=Object.fromEntries([0,1,2,3].map(page=>[page,objects.map(object=>({...object,id:object.id+'-'+page,...(object.type==='form-field'?{name:object.name+'-'+page}:{})}))]));const output=await exportEditedPdf(await source(),all,1.5),pages=await inspect(output),parsed=await PDFDocument.load(await output.arrayBuffer());
 for(let i=0;i<4;i++){assert.match(pages[i].text,/Added text/);assert.match(pages[i].text,/Second line/);assert.equal(pages[i].annotations.filter(a=>a.subtype==='Link').length,2);assert.equal(parsed.getPage(i).getRotation().angle,i*90);if(i){let changed=0;for(let n=0;n<pages[0].pixels.length;n+=4)if(Math.max(...[0,1,2].map(c=>Math.abs(pages[0].pixels[n+c]-pages[i].pixels[n+c])))>8)changed++;assert.ok(changed/(750*750)<0.004,`rotation ${i*90}: ${changed} changed pixels`);}evidence('overlays-'+i+'.png',pages[i].image);}
 const fields=await extractExistingFields(parsed,1.5);for(let i=0;i<4;i++){const field=fields.find(f=>f.name==='name-'+i);assert.equal(field.contentRotation,90);assert.ok(Math.abs(field.width-45)<0.001);assert.ok(Math.abs(field.height-180)<0.001);assert.ok(Math.abs(field.x+field.width/2-510)<0.001);assert.ok(Math.abs(field.y+field.height/2-392.5)<0.001);assert.ok(parsed.getForm().getTextField('name-'+i).isRequired());}
 evidence('overlays-exported.pdf',await output.arrayBuffer());
});
test('new bookmarks append to the existing tree and retain Unicode titles and original destinations',async()=>{
 const pdf=await PDFDocument.create(),page=pdf.addPage(),second=pdf.addPage();const root=pdf.context.obj({Type:'Outlines',Count:1}),rootRef=pdf.context.register(root),old=pdf.context.obj({Title:PDFString.of('Original bookmark'),Parent:rootRef,Dest:[page.ref,PDFName.of('Fit')]}),oldRef=pdf.context.register(old);root.set(PDFName.of('First'),oldRef);root.set(PDFName.of('Last'),oldRef);pdf.catalog.set(PDFName.of('Outlines'),rootRef);
 const output=await exportEditedPdf(file(await pdf.save()),{},1.5,[{id:'new',title:'नया अध्याय',pageIndex:1}]),parsed=await PDFDocument.load(await output.arrayBuffer()),actualRoot=parsed.catalog.lookup(PDFName.of('Outlines')),first=parsed.context.lookup(actualRoot.get(PDFName.of('First'))),last=parsed.context.lookup(actualRoot.get(PDFName.of('Last')));assert.equal(first.get(PDFName.of('Title')).decodeText(),'Original bookmark');assert.equal(last.get(PDFName.of('Title')).decodeText(),'नया अध्याय');assert.equal(first.get(PDFName.of('Next')).toString(),actualRoot.get(PDFName.of('Last')).toString());assert.equal(last.get(PDFName.of('Prev')).toString(),actualRoot.get(PDFName.of('First')).toString());assert.equal(actualRoot.get(PDFName.of('Count')).asNumber(),2);assert.equal(last.get(PDFName.of('Dest')).get(0).toString(),parsed.getPage(1).ref.toString());evidence('bookmarks-appended.pdf',await output.arrayBuffer());
});
test('link hit areas follow cropped native rotation and unsupported schemes fail clearly',async()=>{
 const input=await source();for(let page=0;page<4;page++){const output=await exportEditedPdf(input,{[page]:[obj('link','link',{x:60,y:90,width:150,height:60,url:'pdfpilot.net/help'})]},1.5),pdf=await PDFDocument.load(await output.arrayBuffer()),annotation=pdf.context.lookup(pdf.getPage(page).node.Annots().get(0)),rect=annotation.get(PDFName.of('Rect')).asArray().map(n=>n.asNumber());const expected=[[60,430,160,470],[80,70,120,170],[380,90,480,130],[420,390,460,490]][page];assert.deepEqual(rect,expected);assert.equal(annotation.lookup(PDFName.of('A')).get(PDFName.of('URI')).decodeText(),'https://pdfpilot.net/help');}
 await assert.rejects(exportEditedPdf(input,{0:[obj('bad','link',{url:'javascript:alert(1)'})]},1.5),/must use/);
});
test('editor cancellation, XFA, overflowing notes and unsupported field rotations fail without output',async()=>{
 const input=await source();await assert.rejects(exportEditedPdf(input,{},1.5,[],[],undefined,()=>true),/cancelled/);await assert.rejects(exportEditedPdf(input,{0:[obj('note','note',{text:'Too much content '.repeat(100),color:'#ffff00'})]},1.5),/does not fit/);await assert.rejects(exportEditedPdf(input,{0:[obj('field','form-field',{name:'tilted',fieldType:'text',fontSize:12,required:false,rotation:17})]},1.5),/90°/);
 const pdf=await PDFDocument.create();pdf.addPage();pdf.getForm();pdf.catalog.lookup(PDFName.of('AcroForm')).set(PDFName.of('XFA'),PDFString.of('xfa'));await assert.rejects(exportEditedPdf(file(await pdf.save({updateFieldAppearances:false})),{},1.5),/XFA/);
});
test('separate signature strokes stay separate and resizing changes the actual exported ink on every native rotation',async()=>{
 const {signatureFromStrokes,scaledDrawStrokes,signatureCanvasPoint}=load('src/lib/editor/signature.ts');
 assert.deepEqual(signatureCanvasPoint(110,47.5,{left:10,top:10,width:200,height:75},400,150),{x:200,y:75});
 const signature=signatureFromStrokes([[{x:10,y:10},{x:110,y:10}],[{x:10,y:50},{x:110,y:50}]],'#0000ff');
 const draw=obj('signature','draw',{x:50,y:50,width:240,height:100,rotation:0,points:signature.points,strokes:signature.strokes,strokeColor:signature.color,strokeWidth:2,kind:'signature'});
 assert.deepEqual(scaledDrawStrokes(draw),[[{x:0,y:0},{x:240,y:0}],[{x:0,y:100},{x:240,y:100}]]);
 const input=await source(),output=await exportEditedPdf(input,Object.fromEntries([0,1,2,3].map(i=>[i,[draw]])),1.5),pages=await inspect(output);
 for(let i=0;i<4;i++){const pixel=(x,y)=>Array.from(pages[i].pixels.slice((y*750+x)*4,(y*750+x)*4+3));assert.ok(pixel(170,50)[2]>200&&pixel(170,50)[0]<80);assert.ok(pixel(170,150)[2]>200&&pixel(170,150)[0]<80);assert.ok(pixel(170,100).every(value=>value>245),'no joining diagonal between pen strokes');assert.ok(pixel(288,50)[0]<80,'ink extends to the resized right edge');evidence('signature-'+i+'.png',pages[i].image);}
 evidence('signatures-exported.pdf',await output.arrayBuffer());
});
test('saved signatures are validated and empty drawings fail before an editor object is inserted',()=>{
 const {parseSavedSignature,signatureFromStrokes}=load('src/lib/editor/signature.ts');assert.throws(()=>signatureFromStrokes([], '#000000'),/Draw/);assert.equal(parseSavedSignature('broken'),null);assert.equal(parseSavedSignature(JSON.stringify({kind:'upload',width:100,height:50,color:'#000000',dataUrl:'https://example.com/track.png'})),null);const typed={kind:'type',text:'Test Signature',color:'#000000',width:200,height:50};assert.equal(parseSavedSignature(JSON.stringify(typed)).text,'Test Signature');assert.equal(parseSavedSignature(JSON.stringify({...typed,width:-1})),null);const drawn=signatureFromStrokes([[{x:2,y:3},{x:20,y:40}]],'#000000');assert.equal(parseSavedSignature(JSON.stringify(drawn)).strokes.length,1);assert.equal(parseSavedSignature(JSON.stringify({...drawn,strokes:[[{x:Infinity,y:1}]]})),null);
});
