const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { loadTs } = require('./load-ts.cjs');
const { htmlImageGeometry, captureHtmlElementToImage } = loadTs('src/lib/engines/html-to-image-engine.ts');
const settings = { format: 'png', scale: 1, area: 'full', quality: .9 };

test('full-page image preserves layout size and two-times pixel density', () => {
  assert.deepEqual(htmlImageGeometry(768, 2400, 800, { ...settings, scale: 2 }), { width: 768, height: 2400, scale: 2, outputWidth: 1536, outputHeight: 4800 });
});
test('first-screen capture clips height without stretching the page', () => {
  assert.equal(htmlImageGeometry(320, 10000, 844, { ...settings, area: 'viewport' }).height, 844);
  assert.equal(htmlImageGeometry(320, 400, 844, { ...settings, area: 'viewport' }).height, 400);
});
test('oversized or malformed image settings fail before canvas allocation', () => {
  for (const [w,h] of [[1920,17000],[4096,8192],[NaN,100],[0,100],[-100,100]]) assert.throws(() => htmlImageGeometry(w,h,800,settings));
  for (const patch of [{scale:3},{format:'gif'},{area:'other'},{quality:0},{quality:NaN}]) assert.throws(() => htmlImageGeometry(100,100,100,{...settings,...patch}));
  assert.doesNotThrow(() => htmlImageGeometry(1920,17000,800,{...settings,area:'viewport'}));
});
test('SVG uses layout units independently of prior bitmap scale setting', () => {
  assert.equal(htmlImageGeometry(1440,2000,800,{...settings,scale:2,format:'svg'}).outputWidth,1440);
});
test('cancelled capture refuses work before reading the document', async () => {
  const controller = new AbortController();controller.abort();
  await assert.rejects(() => captureHtmlElementToImage(null,settings,undefined,controller.signal), {name:'AbortError'});
});
test('vendored SVG library matches pinned files and its documented cancellation patch', () => {
  const base='src/lib/vendor/html-to-image/';const provenance=JSON.parse(fs.readFileSync(base+'PROVENANCE.json'));
  assert.equal(provenance.version,'1.11.13');assert.equal(provenance.license,'MIT');
  for(const [file,hash] of Object.entries(provenance.files)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(base+file)).digest('hex'),hash,file);
});
