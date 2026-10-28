const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { PDFDocument, PDFName } = require('pdf-lib');
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
const { markdownToPdf } = load('src/lib/engines/markdown-pdf-engine.ts');
async function textOf(blob) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), standardFontDataUrl: path.resolve('node_modules/pdfjs-dist/standard_fonts') + '/' });
  const doc = await task.promise, pages = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n), content = await page.getTextContent();
      const items = content.items.filter(item => 'str' in item);
      pages.push({ text: items.map(item => item.str).join(' '), items, width: page.view[2], height: page.view[3] });
    }
  } finally { await task.destroy(); }
  return pages;
}
function evidence(name, bytes) {
  if (!process.env.ARCHIVE_QA_DIR) return;
  fs.mkdirSync(process.env.ARCHIVE_QA_DIR, { recursive: true }); fs.writeFileSync(path.join(process.env.ARCHIVE_QA_DIR, name), bytes);
}
test('Markdown tables retain every row and long cell across page boundaries', async () => {
  const long = 'LastWordMustRemain'.repeat(20);
  const markdown = '| Reference | Description |\n|---|---|\n' + Array.from({ length: 95 }, (_, n) => `| item-${String(n).padStart(3,'0')} | ${n === 48 ? long : `Description number ${n}`} |`).join('\n');
  const blob = await markdownToPdf(markdown), pages = await textOf(blob);
  const text = pages.map(page => page.text).join(' ');
  assert.ok(pages.length > 2);
  for (let n = 0; n < 95; n++) assert.ok(text.includes(`item-${String(n).padStart(3,'0')}`), 'row ' + n);
  assert.ok(text.replace(/\s/g,'').includes(long));
  for (const page of pages) {
    assert.match(page.text, /Reference.*Description/);
    for (const item of page.items) { assert.ok(item.transform[4] >= 45); assert.ok(item.transform[4] + item.width <= page.width - 40, JSON.stringify(item)); assert.ok(item.transform[5] >= 43); }
  }
  evidence('markdown-table.md', markdown); evidence('markdown-table.pdf', new Uint8Array(await blob.arrayBuffer()));
});
test('Markdown preserves rich text, lists, code, quotes and safe clickable links', async () => {
  const markdown = '# Feature document\n\n**Bold** and *italic* with ~~old~~ and [PDFPilot](https://pdfpilot.net).\n\n1. First entry\n2. Second entry\n   - Nested detail\n\n- [x] Finished\n- [ ] Pending\n\n> A quoted paragraph\n\n```js\nconst answer = 42;\n    console.log(answer);\n```\n\n---\n\n[Unsafe](javascript:alert(1))\n\n<script>example</script>';
  const blob = await markdownToPdf(markdown), pages = await textOf(blob), text = pages.map(page => page.text).join(' ');
  for (const expected of ['Bold','italic','old','1. First entry','2. Second entry','Nested detail','[x] Finished','[ ] Pending','A quoted paragraph','const answer = 42;','console.log(answer);','<script>example</script>']) assert.ok(text.includes(expected), expected);
  const pdf = await PDFDocument.load(await blob.arrayBuffer());
  const annotations = pdf.getPages().flatMap(page => page.node.Annots()?.asArray() ?? []).map(ref => pdf.context.lookup(ref));
  assert.equal(annotations.length, 1); assert.equal(annotations[0].lookup(PDFName.of('A')).lookup(PDFName.of('URI')).decodeText(), 'https://pdfpilot.net/');
  evidence('markdown-features.md', markdown); evidence('markdown-features.pdf', new Uint8Array(await blob.arrayBuffer()));
});
test('Markdown Unicode and embedded images render without discarding source content', async () => {
  const picture = canvas.createCanvas(30, 20); const ctx = picture.getContext('2d'); ctx.fillStyle='#2277ee';ctx.fillRect(0,0,30,20);
  const markdown = '# नमस्ते भारत\n\nUseful text → ✓\n\n![Blue image](' + picture.toDataURL('image/png') + ')\n\n![Remote photo](https://example.com/image.jpg)';
  const blob = await markdownToPdf(markdown, { pageSize: 'letter', orientation: 'landscape' }), pages = await textOf(blob);
  const text = pages.map(page=>page.text).join(' ');
  assert.match(text, /नमस्ते भारत/); assert.match(text, /Useful\s+text\s+→\s+✓/); assert.match(text, /Remote photo/); assert.equal(pages[0].width, 792); assert.equal(pages[0].height, 612);
  const pdf = await PDFDocument.load(await blob.arrayBuffer()); assert.equal(pdf.getPage(0).node.Resources().lookup(PDFName.of('XObject')).keys().length, 1);
  evidence('markdown-unicode.md', markdown); evidence('markdown-unicode.pdf', new Uint8Array(await blob.arrayBuffer()));
});
test('Markdown empty input, invalid font size and cancellation never return a success PDF', async () => {
  await assert.rejects(markdownToPdf('  \n '), /empty/);
  await assert.rejects(markdownToPdf('Test', { fontSize: NaN }), /font size/);
  await assert.rejects(markdownToPdf('Test', { isCancelled: () => true }), /cancelled/);
});
