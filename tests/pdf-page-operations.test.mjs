import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, degrees, rgb } from 'pdf-lib';
import * as fontkit from 'fontkit';
import { createCanvas } from '@napi-rs/canvas';
import { rotatePdfPages, removePdfPages } from '../src/lib/engines/pdf-engine.ts';
import { extractPageGroups, extractAllPagesGroups, safeBaseName } from '../src/lib/engines/pdf-split-engine.ts';
import { zipSync, unzipSync } from 'fflate';

const file = bytes => new File([bytes], 'Résumé Ω 文档.pdf', { type: 'application/pdf' });
let fixture;
async function source() {
  if (fixture) return fixture;
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fs.readFileSync('public/fonts/NotoSans-Regular.ttf'), { subset: false });
  const canvas = createCanvas(64, 32), context = canvas.getContext('2d');
  context.fillStyle = '#dc2626'; context.fillRect(0, 0, 32, 32);
  context.fillStyle = '#2563eb'; context.fillRect(32, 0, 32, 32);
  const image = await pdf.embedPng(canvas.toBuffer('image/png'));
  for (let index = 0; index < 4; index++) {
    const page = pdf.addPage([400 + index * 20, 550 - index * 10]);
    page.drawText(`PAGE ${index + 1} café Ω Привет`, { font, x: 35, y: 430, size: 18 });
    page.drawImage(image, { x: 35, y: 350, width: 128, height: 64 });
    page.drawRectangle({ x: 35, y: 250, width: 30 + index * 20, height: 40, color: rgb(0, .5, .1) });
    page.setRotation(degrees(index * 90));
    page.setCropBox(10, 20, 350 + index * 10, 480 - index * 10);
  }
  pdf.setTitle('Page operations fixture');
  fixture = await pdf.save();
  if (process.env.PAGES_QA_DIR) {
    fs.mkdirSync(process.env.PAGES_QA_DIR, { recursive: true });
    fs.writeFileSync(path.join(process.env.PAGES_QA_DIR, file(fixture).name), fixture);
  }
  return fixture;
}
async function inspect(bytes, rotations) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: new Uint8Array(bytes), standardFontDataUrl: process.cwd() + '/node_modules/pdfjs-dist/standard_fonts/' });
  try {
    const pdf = await task.promise, pages = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale: 1, ...(rotations ? { rotation: rotations[number - 1] } : {}) });
      const canvas = createCanvas(viewport.width, viewport.height);
      await page.render({ canvas, viewport }).promise;
      pages.push({ width: canvas.width, height: canvas.height,
        pixels: canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data,
        text: (await page.getTextContent()).items.map(item => item.str).join('|') });
    }
    return pages;
  } finally { await task.destroy(); }
}
async function assertPages(output, indices, rotations) {
  const before = await inspect(await source(), rotations), after = await inspect(output);
  assert.equal(after.length, indices.length);
  for (let index = 0; index < after.length; index++) {
    assert.deepEqual(after[index], before[indices[index]], `output page ${index + 1} must preserve source page ${indices[index] + 1} including selectable Unicode, image pixels and geometry`);
    assert.match(after[index].text, /café Ω Привет/);
  }
}
function saveEvidence(name, bytes) {
  if (process.env.PAGES_QA_DIR) fs.writeFileSync(path.join(process.env.PAGES_QA_DIR, name), bytes);
}

test('rotate selected pages adds deltas to existing rotation and preserves vector text, images, crop and metadata', async () => {
  const bytes = await source(), output = await rotatePdfPages(file(bytes), { 0: 90, 2: -90, 3: 180 });
  const saved = new Uint8Array(await output.arrayBuffer()), parsed = await PDFDocument.load(saved);
  assert.deepEqual(parsed.getPages().map(page => page.getRotation().angle), [90, 90, 90, 90]);
  assert.equal(parsed.getTitle(), 'Page operations fixture');
  const original = await PDFDocument.load(bytes);
  assert.deepEqual(parsed.getPages().map(page => page.getCropBox()), original.getPages().map(page => page.getCropBox()));
  await assertPages(saved, [0, 1, 2, 3], [90, 90, 90, 90]);
  assert.deepEqual((await PDFDocument.load(bytes)).getPages().map(page => page.getRotation().angle), [0, 90, 180, 270]);
  saveEvidence('rotated.pdf', saved);
});

test('delete preserves retained page order, crop, rotation, Unicode text and image appearance', async () => {
  const progress = [], output = await removePdfPages(file(await source()), [1, 3, 1], (...args) => progress.push(args));
  const saved = new Uint8Array(await output.arrayBuffer());
  await assertPages(saved, [0, 2]);
  assert.deepEqual(progress, [[1, 2], [2, 2]]);
  saveEvidence('removed.pdf', saved);
  const last = await removePdfPages(file(await source()), [0, 1, 2]);
  await assertPages(await last.arrayBuffer(), [3]);
  saveEvidence('last-page.pdf', new Uint8Array(await last.arrayBuffer()));
});

test('extract all and merged selections produce correctly named files, exact page order and parseable ZIP', async () => {
  const bytes = await source(), outputs = await extractPageGroups(bytes, file(bytes).name, extractAllPagesGroups(4), false);
  assert.deepEqual(outputs.map(output => output.name), [1, 2, 3, 4].map(n => `Résumé Ω 文档_page_${n}.pdf`));
  const zip = zipSync(Object.fromEntries(outputs.map(output => [output.name, output.bytes]))), unzipped = unzipSync(zip);
  assert.deepEqual(Object.keys(unzipped), outputs.map(output => output.name));
  for (let index = 0; index < outputs.length; index++) {
    assert.equal(outputs[index].pageCount, 1);
    await assertPages(unzipped[outputs[index].name], [index]);
  }
  const merged = await extractPageGroups(bytes, file(bytes).name, [[4], [2, 3], [2]], true);
  assert.equal(merged[0].pageCount, 4);
  await assertPages(merged[0].bytes, [3, 1, 2, 1]);
  saveEvidence('extracted.zip', zip); saveEvidence('extracted-merged.pdf', merged[0].bytes);
  assert.equal(safeBaseName('../unsafe\\file.pdf'), '.._unsafe_file');
});

test('invalid, empty and out-of-bounds operations reject without silently creating a blank page', async () => {
  const input = file(await source());
  for (const selection of [[], [0, 1, 2, 3], [-1], [4], [1.5]]) await assert.rejects(removePdfPages(input, selection));
  for (const rotations of [{ '-1': 90 }, { 4: 90 }, { 1: 45 }, { 1: NaN }]) await assert.rejects(rotatePdfPages(input, rotations));
  for (const groups of [[], [[]], [[0]], [[5]], [[1.5]]]) {
    for (const merge of [true, false]) await assert.rejects(extractPageGroups(await source(), 'invalid.pdf', groups, merge));
  }
  const empty = await (await PDFDocument.create()).save({ addDefaultPage: false });
  saveEvidence('empty.pdf', empty);
  await assert.rejects(rotatePdfPages(file(empty), {}), /does not contain any pages/);
  await assert.rejects(removePdfPages(file(empty), [0]), /does not contain any pages/);
  await assert.rejects(extractPageGroups(empty, 'empty.pdf', [[1]], true), /does not contain any pages/);
  const malformed = new TextEncoder().encode('This is not a PDF');
  saveEvidence('malformed.pdf', malformed);
  await assert.rejects(rotatePdfPages(file(malformed), { 0: 90 }));
  await assert.rejects(removePdfPages(file(malformed), [0]));
  await assert.rejects(extractPageGroups(malformed, 'bad.pdf', [[1]], false));
  assert.ok(await rotatePdfPages(input, { 0: 90 }), 'valid retry after malformed input succeeds');
});

test('cancel during processing or after serialization suppresses all output; subsequent retry succeeds', async () => {
  const input = file(await source());
  for (const operation of [
    (progress, cancelled) => rotatePdfPages(input, { 0: 90 }, progress, cancelled),
    (progress, cancelled) => removePdfPages(input, [0], progress, cancelled),
    (progress, cancelled) => extractPageGroups(fixture, 'pages.pdf', [[1], [2]], false, progress, cancelled),
  ]) {
    let cancelled = false;
    const result = await operation(() => { cancelled = true; }, () => cancelled);
    assert.ok(result === null || result.length === 0, 'no partial/cancelled output');
  }
  // Force cancellation at the real asynchronous save boundary, where stale UI
  // results used to escape useProcessingTask's own progress/toast generation guard.
  const save = PDFDocument.prototype.save;
  let cancelled = false;
  PDFDocument.prototype.save = async function (...args) { const bytes = await save.apply(this, args); cancelled = true; return bytes; };
  try {
    assert.equal(await rotatePdfPages(input, { 0: 90 }, undefined, () => cancelled), null);
    cancelled = false;
    assert.equal(await removePdfPages(input, [0], undefined, () => cancelled), null);
    cancelled = false;
    assert.deepEqual(await extractPageGroups(fixture, 'pages.pdf', [[1]], true, undefined, () => cancelled), []);
  } finally { PDFDocument.prototype.save = save; }
  assert.ok(await removePdfPages(input, [0]));
});

// Synthetic one-page fixture generated from alpha.pdf with pypdf RC4-128,
// password "pdfpilot-test-password". Real encryption, not a mocked /Encrypt flag.
test('password-protected PDFs reject and cannot leak an apparently successful output', async () => {
  const bytes = fs.readFileSync('tests/fixtures/product-qa/page-operations-protected.pdf');
  await assert.rejects(rotatePdfPages(file(bytes), { 0: 90 }), /encrypted/);
  await assert.rejects(removePdfPages(file(bytes), [0]), /encrypted/);
  await assert.rejects(extractPageGroups(bytes, 'protected.pdf', [[1]], false), /encrypted/);
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const locked = getDocument({ data: new Uint8Array(bytes) });
  try { await assert.rejects(locked.promise, { name: 'PasswordException' }); } finally { await locked.destroy(); }
  const unlocked = getDocument({ data: new Uint8Array(bytes), password: 'pdfpilot-test-password' });
  try { assert.equal((await unlocked.promise).numPages, 1); } finally { await unlocked.destroy(); }
});

test('many tiny extraction outputs yield so a scheduled user cancellation can run', async () => {
  let cancelled = false, processed = 0;
  const outputs = await extractPageGroups(await source(), 'many.pdf', Array.from({ length: 40 }, () => [1]), false,
    (done) => { processed = done; if (done === 1) setTimeout(() => { cancelled = true; }, 0); },
    () => cancelled);
  assert.equal(cancelled, true);
  assert.ok(processed < 40, `must stop before all ${processed} outputs complete`);
  assert.deepEqual(outputs, []);
});
