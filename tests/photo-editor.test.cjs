const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const canvas = require('@napi-rs/canvas');
global.createImageBitmap = async blob => { const image = await canvas.loadImage(Buffer.from(await blob.arrayBuffer())); image.close = () => {}; return image; };
global.document = { createElement: () => { const surface = canvas.createCanvas(1, 1); surface.toBlob = (done, type, quality) => done(new Blob([surface.toBuffer(type, quality === undefined ? undefined : Math.round(quality * 100))], { type })); return surface; } };
function load(filename, cache = new Map()) {
  filename = path.resolve(filename); if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', source)(name => name.startsWith('.') ? load(path.resolve(path.dirname(filename), name + '.ts'), cache) : require(name), module, module.exports); return module.exports;
}
const { renderPhoto, initialPhotoState, newPhotoLayer } = load('src/lib/engines/photo-editor-engine.ts');
function input(color = '#ffffff', width = 400, height = 200) { const s = canvas.createCanvas(width, height), c = s.getContext('2d'); c.fillStyle = color; c.fillRect(0, 0, width, height); return new File([s.toBuffer('image/png')], 'photo.png', { type: 'image/png' }); }
async function inspect(blob) { const im = await canvas.loadImage(Buffer.from(await blob.arrayBuffer())), s = canvas.createCanvas(im.width, im.height);s.getContext('2d').drawImage(im, 0, 0);return { width: im.width, height: im.height, pixel: (x, y) => Array.from(s.getContext('2d').getImageData(x, y, 1, 1).data) }; }
const state = () => initialPhotoState(400, 200);
const shape = (id, patch = {}) => ({ ...newPhotoLayer('shape', id), x: .1, y: .1, width: .4, height: .8, color: '#000000', fill: '#00ff00', ...patch });
test('photo crop, rotation, resizing and filters change actual decoded pixels', async () => {
  const s = state();s.settings.crop = { x: 200, y: 100, width: 200, height: 100 };s.settings.rotate=90;s.settings.width=100;s.settings.height=200;s.settings.filter='grayscale';
  const decoded = await inspect(await renderPhoto(input('#0000ff'), s, 'image/png'));
  assert.deepEqual([decoded.width,decoded.height],[100,200]);assert.deepEqual(decoded.pixel(50,100),[18,18,18,255]);
  const inverted=state();inverted.settings.filter='invert';assert.deepEqual((await inspect(await renderPhoto(input('#0000ff'),inverted,'image/png'))).pixel(100,100),[255,255,0,255]);
  const preview=await inspect(await renderPhoto(input(),s,'image/png',1,undefined,50));assert.deepEqual([preview.width,preview.height],[25,50]);
});
test('photo layer order, hidden layers and opacity match the exported composition', async () => {
  const s=state();s.layers=[shape('green'),shape('blue',{x:.2,y:.2,width:.3,height:.6,fill:'#0000ff',rotation:90})];
  assert.deepEqual((await inspect(await renderPhoto(input(),s,'image/png'))).pixel(140,100),[0,0,255,255]);
  s.layers[1].hidden=true;assert.deepEqual((await inspect(await renderPhoto(input(),s,'image/png'))).pixel(140,100),[0,255,0,255]);
  s.layers[1].hidden=false;s.layers[1].opacity=.5;const pixel=(await inspect(await renderPhoto(input(),s,'image/png'))).pixel(140,100);assert.equal(pixel[0],0);assert.ok(pixel[1]>=127&&pixel[1]<=128&&pixel[2]>=127&&pixel[2]<=128);
});
test('separate photo drawing strokes do not create a connecting line and image layers rotate correctly', async () => {
  const s=state();s.layers=[{...newPhotoLayer('draw','a'),x:.05,y:.1,width:.1,height:.2,color:'#ff0000',lineWidth:.03,points:[{x:0,y:0},{x:1,y:1}]},{...newPhotoLayer('draw','b'),x:.8,y:.7,width:.1,height:.2,color:'#ff0000',lineWidth:.03,points:[{x:0,y:0},{x:1,y:1}]}];
  const d=await inspect(await renderPhoto(input(),s,'image/png'));assert.deepEqual(d.pixel(40,40),[255,0,0,255]);assert.deepEqual(d.pixel(200,100),[255,255,255,255]);
  s.layers=[{...newPhotoLayer('image','logo'),image:input('#ff0000',40,20),x:.25,y:.25,width:.25,height:.25,rotation:90}];
  const image=await inspect(await renderPhoto(input(),s,'image/png'));assert.deepEqual(image.pixel(150,75),[255,0,0,255]);assert.deepEqual(image.pixel(150,35),[255,0,0,255]);assert.deepEqual(image.pixel(110,75),[255,255,255,255]);
});
test('rounded corners retain PNG transparency, JPG fills white and photo frames keep their color', async () => {
  const s=state();s.settings.corners=.3;s.settings.frame='solid';s.settings.frameWidth=.05;s.settings.frameColor='#000000';
  const png=await inspect(await renderPhoto(input('#0000ff'),s,'image/png'));assert.equal(png.pixel(0,0)[3],0);assert.deepEqual(png.pixel(200,2),[0,0,0,255]);assert.deepEqual(png.pixel(200,100),[0,0,255,255]);
  const jpg=await inspect(await renderPhoto(input('#0000ff'),s,'image/jpeg',1));assert.ok(jpg.pixel(0,0).slice(0,3).every(v=>v>245));
});
test('photo text draws within its box, with styling and a background', async () => {
  const s=state();s.layers=[{...newPhotoLayer('text','text'),text:'TEST\nPHOTO',fill:'#ffff00',color:'#000000',italic:true,underline:true,x:.25,y:.25,width:.5,height:.5}];
  const d=await inspect(await renderPhoto(input(),s,'image/png'));assert.deepEqual(d.pixel(101,51),[255,255,0,255]);assert.deepEqual(d.pixel(50,50),[255,255,255,255]);let dark=0;for(let y=55;y<145;y++)for(let x=110;x<290;x++)if(d.pixel(x,y)[0]<100)dark++;assert.ok(dark>100);
});
test('photo stickers remain visible without a filled background', async () => {
  const s=state();s.layers=[{...newPhotoLayer('sticker','star'),text:'⭐',x:.25,y:.25,width:.5,height:.5}];
  const d=await inspect(await renderPhoto(input(),s,'image/png'));let marked=0;for(let y=50;y<150;y+=2)for(let x=100;x<300;x+=2)if(d.pixel(x,y).slice(0,3).some(v=>v<240))marked++;assert.ok(marked>50);
});
test('invalid photo settings fail clearly and cancelled adjustment work can be retried', async () => {
  const s=state();s.settings.crop.x=500;await assert.rejects(renderPhoto(input(),s,'image/png'),/crop/);
  assert.throws(()=>initialPhotoState(5000,5000),/20 megapixels/);
  const drawing=state();drawing.layers=[{...newPhotoLayer('draw','invalid'),points:[{x:2,y:0}]}];await assert.rejects(renderPhoto(input(),drawing,'image/png'),/drawing points/);
  const filtered=state();filtered.settings.filter='sepia';const controller=new AbortController();setTimeout(()=>controller.abort(),0);await assert.rejects(renderPhoto(input(),filtered,'image/png',1,controller.signal),/cancelled/);
  assert.equal((await inspect(await renderPhoto(input(),state(),'image/png'))).width,400);
});
