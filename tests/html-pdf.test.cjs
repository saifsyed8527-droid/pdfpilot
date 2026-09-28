const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./load-ts.cjs');
const { htmlPdfGeometry } = loadTs('src/lib/engines/html-to-pdf-engine.ts');
const settings = { screenSize:'1440', pageSize:'a4', orientation:'portrait', oneLongPage:true, margin:'none', blockAds:false, removeOverlays:false };
test('website long-page dimensions retain source aspect ratio', () => {
  const result=htmlPdfGeometry(1440,7260,settings);
  assert.equal(result.pageWidth,595);
  assert.equal(result.pageHeight,7260*595/1440);
  assert.equal(result.margin,0);
});
test('standard pages retain paper dimensions in both orientations', () => {
  for(const [orientation,w,h] of [['portrait',595,842],['landscape',842,595]]) {
    const result=htmlPdfGeometry(1440,7260,{...settings,oneLongPage:false,orientation});
    assert.equal(result.pageWidth,w); assert.equal(result.pageHeight,h);
  }
});
test('margins preserve uniform content scaling', () => {
  const result=htmlPdfGeometry(1000,2000,{...settings,margin:'small'});
  assert.equal(result.pageHeight,1110);
  assert.equal(result.ratio,.515);
});
test('oversized one-page PDF fails explicitly instead of truncating or squashing', () => {
  assert.throws(()=>htmlPdfGeometry(320,20000,settings),/Turn off/);
  assert.doesNotThrow(()=>htmlPdfGeometry(320,20000,{...settings,oneLongPage:false}));
});
