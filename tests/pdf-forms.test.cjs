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
global.fetch = url => typeof url === 'string' && url.startsWith('/fonts/')
  ? Promise.resolve(new Response(fs.readFileSync(path.join(process.cwd(), 'public', url)))) : browserFetch(url);
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
const { exportPdfForm, extractExistingFields, buildNewFields, hasFormTextChanges } = load('src/lib/engines/pdf-forms-engine.ts');
const { extractPageTextRuns } = load('src/lib/editor/existing-text.ts');
const SCALE = 1.5;
const file = bytes => new File([bytes], 'forms-source.pdf', {type:'application/pdf'});
function evidence(name, bytes) { if(process.env.FORMS_QA_DIR) { fs.mkdirSync(process.env.FORMS_QA_DIR,{recursive:true}); fs.writeFileSync(path.join(process.env.FORMS_QA_DIR,name),Buffer.from(bytes)); } }
function field(name, patch={}) { return {id:name,kind:'text',name,pageIndex:0,x:60,y:90,width:300,height:45,required:false,readOnly:false,fontSize:12,textColor:'#000000',borderColor:'#1255bb',borderWidth:1,fillColor:'#ffffff',isExisting:false,...patch}; }
async function fixture(rotated=false) { const pdf=await PDFDocument.create(); for(const angle of rotated?[0,90,180,270]:[0]) {const p=pdf.addPage([400,500]);p.setCropBox(20,30,360,440);p.setRotation(degrees(angle));p.drawText('Original page '+angle,{x:70,y:350,size:16});} return file(await pdf.save()); }
async function exportForm(input, patch={}) { return exportPdfForm(input,{fields:[],values:{},textEdits:[],scale:SCALE,...patch}); }
async function inspect(blob) {
 const pdfjs=await pdfjsPromise, task=pdfjs.getDocument({data:new Uint8Array(await blob.arrayBuffer()),standardFontDataUrl:path.resolve('node_modules/pdfjs-dist/standard_fonts')+'/'});
 try {const doc=await task.promise,result=[];for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n),viewport=page.getViewport({scale:SCALE}),target=canvas.createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));await page.render({canvas:target,viewport}).promise;result.push({runs:await extractPageTextRuns(page,pdfjs,viewport,target),image:target.toBuffer('image/png'),width:target.width,height:target.height,annots:await page.getAnnotations()});}return result;}finally{await task.destroy();}
}
function edit(run, patch={}) {return {id:'edit-'+run.id,runId:run.id,pageIndex:0,x:run.xPx,y:run.yPx,width:run.widthPx,height:run.heightPx,rotation:run.rotation,textAngle:run.textAngle,originalText:run.str,newText:run.str,originalXPt:run.xPt,originalYPt:run.yPt,originalWidthPt:run.widthPt,originalHeightPt:run.heightPt,originalFontSizePt:run.fontSizePt,fontSizePt:run.fontSizePt,originalColor:'#000000',color:'#000000',coverColor:run.coverColor,bold:false,italic:false,underline:false,align:'left',...patch};}

test('new fields save Fill mode values, multiline text, flags, radio values and comma-containing list options',async()=>{
 const input=await fixture(),fields=[field('name',{required:true,multiline:true,height:90}),field('agree',{kind:'checkbox',y:210,width:24,height:24}),field('location',{kind:'dropdown',options:['New York, NY','Paris'],y:270}),field('topics',{kind:'listbox',options:['One, two','Three'],multiSelect:true,y:340,height:95}),field('choice-a',{kind:'radio',groupName:'choice',optionLabel:'A',y:470,width:24,height:24}),field('choice-b',{kind:'radio',groupName:'choice',optionLabel:'B',x:100,y:470,width:24,height:24}),field('locked',{defaultValue:'Keep',readOnly:true,y:530})];
 const result=await exportForm(input,{fields,values:{name:'Line one\nLine two',agree:true,location:'New York, NY',topics:['One, two','Three'],choice:'B',locked:'Do not replace'}}),bytes=await result.blob.arrayBuffer(),pdf=await PDFDocument.load(bytes),form=pdf.getForm();
 assert.equal(form.getTextField('name').getText(),'Line one\nLine two');assert.ok(form.getTextField('name').isMultiline());assert.ok(form.getTextField('name').isRequired());assert.ok(form.getCheckBox('agree').isChecked());assert.deepEqual(form.getDropdown('location').getSelected(),['New York, NY']);assert.deepEqual(form.getOptionList('topics').getSelected(),['One, two','Three']);assert.equal(form.getRadioGroup('choice').getSelected(),'B');assert.equal(form.getTextField('locked').getText(),'Keep');
 const extracted=await extractExistingFields(pdf,SCALE);assert.deepEqual(extracted.find(f=>f.name==='topics').defaultValues,['One, two','Three']);assert.equal(extracted.find(f=>f.optionLabel==='B').defaultValue,'B');
 evidence('forms-new-filled.pdf',bytes);evidence('forms-source.pdf',await input.arrayBuffer());
});
test('clearing imported text, checkbox, radio, dropdown and multiple selections persists after reopening',async()=>{
 const input=await fixture(),fields=[field('text',{defaultValue:'Before'}),field('check',{kind:'checkbox',defaultValue:'true',y:170,width:24,height:24}),field('menu',{kind:'dropdown',options:['A','B'],defaultValue:'A',y:230}),field('list',{kind:'listbox',options:['A, B','C'],defaultValues:['A, B','C'],multiSelect:true,y:300,height:90}),field('radio',{kind:'radio',groupName:'radio',optionLabel:'Yes',defaultValue:'Yes',y:420,width:24,height:24})];
 const original=await exportForm(input,{fields});const result=await exportForm(file(await original.blob.arrayBuffer()),{values:{text:'',check:false,menu:'',list:[],radio:''}});const form=(await PDFDocument.load(await result.blob.arrayBuffer())).getForm();assert.equal(form.getTextField('text').getText(),undefined);assert.equal(form.getCheckBox('check').isChecked(),false);assert.deepEqual(form.getDropdown('menu').getSelected(),[]);assert.deepEqual(form.getOptionList('list').getSelected(),[]);assert.equal(form.getRadioGroup('radio').getSelected(),undefined);
 evidence('forms-existing.pdf',await original.blob.arrayBuffer());evidence('forms-cleared.pdf',await result.blob.arrayBuffer());
});
test('new widget geometry matches the displayed cropped page at all four rotations and keeps text upright',async()=>{
 const input=await fixture(true),fields=[0,1,2,3].flatMap(pageIndex=>[field('upright-'+pageIndex,{pageIndex,defaultValue:'Upright '+pageIndex}),field('signature-'+pageIndex,{kind:'signature',pageIndex,y:180,required:true})]);const result=await exportForm(input,{fields});const pdf=await PDFDocument.load(await result.blob.arrayBuffer()),extracted=await extractExistingFields(pdf,SCALE),pages=await inspect(result.blob);
 for(const expected of fields){const actual=extracted.find(f=>f.name===expected.name);for(const key of ['x','y','width','height'])assert.ok(Math.abs(actual[key]-expected[key])<0.01,expected.name+' '+key+' '+actual[key]);if(expected.kind==='text')assert.equal(actual.contentRotation,0);}
 for(let i=0;i<4;i++){assert.equal(pages[i].annots.find(a=>a.fieldName==='upright-'+i).rotation,i*90);assert.equal(pdf.getPage(i).getRotation().angle,i*90);}
 evidence('forms-rotated.pdf',await result.blob.arrayBuffer());for(let i=0;i<4;i++)evidence('forms-rotated-'+i+'.png',pages[i].image);
});
test('Hindi values and options render with embedded fonts and remain editable after reopening',async()=>{
 const fields=[field('नाम',{defaultValue:'नमस्ते भारत'}),field('city',{kind:'dropdown',options:['दिल्ली','मुंबई'],defaultValue:'दिल्ली',y:180})];const result=await exportForm(await fixture(),{fields,values:{'नाम':'मेरा नाम भारत',city:'मुंबई'}}),pdf=await PDFDocument.load(await result.blob.arrayBuffer()),form=pdf.getForm();assert.equal(form.getTextField('नाम').getText(),'मेरा नाम भारत');assert.deepEqual(form.getDropdown('city').getSelected(),['मुंबई']);const pages=await inspect(result.blob);assert.ok(pages[0].annots.find(a=>a.fieldName==='नाम').hasAppearance);evidence('forms-hindi.pdf',await result.blob.arrayBuffer());evidence('forms-hindi.png',pages[0].image);
 const again=await exportForm(file(await result.blob.arrayBuffer()),{values:{'नाम':'नमस्ते फिर से'}});assert.equal((await PDFDocument.load(await again.blob.arrayBuffer())).getForm().getTextField('नाम').getText(),'नमस्ते फिर से');
});
test('native text edits remove old searchable text and export style-only changes without moving rotated text',async()=>{
 for(const rotation of [0,90,180,270]){const pdf=await PDFDocument.create(),page=pdf.addPage([400,500]);page.setRotation(degrees(rotation));page.setCropBox(20,30,360,440);page.drawText('Original text',{x:80,y:350,size:18});page.drawText('Keep this text',{x:80,y:300,size:16});const input=file(await pdf.save()),before=await inspect(input),run=before[0].runs.find(r=>r.str==='Original text'),result=await exportForm(input,{textEdits:[edit(run,{newText:'नमस्ते भारत',underline:true})]}),after=await inspect(result.blob);assert.deepEqual(result.flattenedPages,[]);assert.ok(!after[0].runs.some(r=>r.str.includes('Original')));assert.ok(after[0].runs.some(r=>r.str.includes('नमस्ते')));assert.ok(after[0].runs.some(r=>r.str==='Keep this text'));const replacement=after[0].runs.find(r=>r.str.includes('नमस्ते'));assert.ok(Math.abs(replacement.xPt-run.xPt)<0.1);assert.ok(Math.abs(replacement.yPt-run.yPt)<0.1);
 const styled=await exportForm(input,{textEdits:[edit(run,{underline:true})]});assert.ok(hasFormTextChanges(edit(run,{underline:true})));assert.notDeepEqual((await inspect(styled.blob))[0].image,before[0].image);if(rotation===90){evidence('forms-text-edited.pdf',await result.blob.arrayBuffer());evidence('forms-text-source.pdf',await input.arrayBuffer());}}
});
test('complex text fallback removes stale text while preserving interactive fields and untouched pages',async()=>{
 const pdf=await PDFDocument.create(),page=pdf.addPage([400,500]),font=await pdf.embedFont(StandardFonts.Helvetica);page.node.set(PDFName.of('Resources'),pdf.context.obj({Font:{F1:font.ref}}));page.node.set(PDFName.of('Contents'),pdf.context.obj([pdf.context.register(pdf.context.flateStream('BT /F1 18 Tf 1 0 0 1 40 420 Tm (Old original) Tj 0 -40 Td (Other text) Tj ET'))]));pdf.addPage([400,500]).drawText('Untouched');const input=file(await pdf.save()),before=await inspect(input),result=await exportForm(input,{fields:[field('filled')],values:{filled:'Retained form'},textEdits:[edit(before[0].runs[0],{newText:'New words'})]}),after=await inspect(result.blob),parsed=await PDFDocument.load(await result.blob.arrayBuffer());assert.deepEqual(result.flattenedPages,[1]);assert.ok(!after[0].runs.some(r=>/Old original|Other text/.test(r.str)));assert.ok(after[0].runs.some(r=>r.str==='New words'));assert.deepEqual(after[1].image,before[1].image);assert.equal(parsed.getForm().getTextField('filled').getText(),'Retained form');
});
test('invalid field names, geometry, values, unsupported glyphs and cancellation fail clearly',async()=>{
 const input=await fixture();await assert.rejects(exportForm(input,{fields:[field('same'),field('same',{y:180})]}),/already used/);await assert.rejects(exportForm(input,{fields:[field('out',{x:500})]}),/fully inside/);await assert.rejects(exportForm(input,{fields:[field('menu',{kind:'dropdown',options:['A','B']})],values:{menu:'Missing'}}),/available options/);await assert.rejects(exportForm(input,{fields:[field('name')],values:{name:'漢字'}}),/cannot display/);await assert.rejects(exportForm(input,{isCancelled:()=>true}),/cancelled/);
 let cancelled=false;await assert.rejects(exportForm(input,{fields:[field('name')],onProgress:n=>{if(n>=45)cancelled=true;},isCancelled:()=>cancelled}),/cancelled/);
});
test('XFA forms are rejected before pdf-lib can silently strip their form definition',async()=>{const pdf=await PDFDocument.create();pdf.addPage();pdf.getForm();pdf.catalog.lookup(PDFName.of('AcroForm')).set(PDFName.of('XFA'),PDFString.of('<xfa/>'));const input=file(await pdf.save({updateFieldAppearances:false}));await assert.rejects(exportForm(input),/XFA/);await assert.rejects(extractExistingFields(await PDFDocument.load(await input.arrayBuffer()),SCALE),/XFA/);});
