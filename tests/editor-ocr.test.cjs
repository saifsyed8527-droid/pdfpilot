const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
function load(filename) {
  filename = path.resolve(filename); const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(id => id.startsWith('.') ? load(path.resolve(path.dirname(filename), id + '.ts')) : require(id), module, module.exports);
  return module.exports;
}
const { groupEditorOcrLines } = load('src/lib/editor/ocr-lines.ts');
const word = (text, x0, y0, x1, y1, line = 0) => ({ text, bbox: { x0, y0, x1, y1 }, line });
test('Arabic keeps logical word order and one line while columns stay independent', () => {
  const lines = groupEditorOcrLines([word('مرحبا', 110, 10, 180, 30), word('بالعالم', 20, 10, 100, 30), word('Column two', 250, 10, 390, 30, 1)], ['ara'], 400, 300);
  assert.equal(lines.length, 2); assert.equal(lines[0].text, 'مرحبا بالعالم');
  assert.deepEqual([lines[0].x0, lines[0].x1], [20, 180]); assert.equal(lines[1].text, 'Column two');
});
test('Japanese joins CJK words, keeps Latin/numbers and gives stable content/geometry IDs', () => {
  const words = [word('日本', 10, 10, 40, 30), word('語', 45, 10, 60, 30), word('125', 65, 10, 100, 30)];
  const [line] = groupEditorOcrLines(words, ['jpn'], 200, 200);
  assert.equal(line.text, '日本語 125'); assert.equal(line.id, groupEditorOcrLines(words, ['jpn'], 200, 200)[0].id);
  assert.notEqual(line.id, groupEditorOcrLines([{ ...words[0], text: '中国' }, ...words.slice(1)], ['jpn'], 200, 200)[0].id);
});
test('native and previously edited words are excluded before mixed-line grouping, including rotated runs', () => {
  const words = [word('Native', 10, 10, 80, 30), word('Scan', 90, 10, 140, 30), word('Retained', 170, 90, 190, 150, 1), word('Separate', 250, 100, 330, 120, 2)];
  const exclude = [{ xPx: 8, yPx: 8, widthPx: 75, heightPx: 25, rotation: 0 }, { xPx: 150, yPx: 110, widthPx: 60, heightPx: 20, rotation: 90 }];
  const lines = groupEditorOcrLines(words, ['eng'], 400, 200, exclude);
  assert.deepEqual(lines.map(l => l.text), ['Scan', 'Separate']);
});
test('OCR geometry rejects invalid boxes, clips valid edge words and bounds excessive inputs', () => {
  const lines = groupEditorOcrLines([word('edge', -3, -4, 20, 25), word('bad', NaN, 0, 10, 10, 1), word('outside', 300, 300, 320, 330, 2), word('inverted', 20, 10, 10, 20, 3)], ['eng'], 100, 100);
  assert.equal(lines.length, 1); assert.equal(lines[0].x0, 0); assert.equal(lines[0].y0, 0);
  assert.throws(() => groupEditorOcrLines(Array(50001).fill(word('x', 0, 0, 1, 1)), ['eng'], 100, 100), /too many/);
});
test('scanned fragments never make a replacement box across an excluded native word', () => {
  const lines = groupEditorOcrLines([word('Left', 10, 10, 40, 30), word('Native', 50, 10, 100, 30), word('Right', 110, 10, 150, 30)], ['eng'], 300, 100, [{ xPx: 49, yPx: 9, widthPx: 52, heightPx: 22, rotation: 0 }]);
  assert.deepEqual(lines.map(l => [l.text, l.x0, l.x1]), [['Left', 10, 40], ['Right', 110, 150]]);
});
test('script font assets match pinned official bytes and include licenses', () => {
  const base = 'public/fonts/editor-v1', manifest = JSON.parse(fs.readFileSync(`${base}/integrity.json`));
  assert.equal(manifest.files.length, 22);
  for (const entry of manifest.files) { const bytes = fs.readFileSync(`${base}/${entry.file}`); assert.equal(bytes.length, entry.bytes); assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), entry.sha256); assert.match(entry.source, /^https:\/\/raw\.githubusercontent\.com\/notofonts\//); }
  assert.match(fs.readFileSync(`${base}/OFL-Noto.txt`, 'utf8'), /SIL OPEN FONT LICENSE/);
  assert.match(fs.readFileSync(`${base}/OFL-CJK.txt`, 'utf8'), /SIL OPEN FONT LICENSE/);
});
