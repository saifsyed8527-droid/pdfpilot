import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, PDFName, PDFString, degrees, rgb } from 'pdf-lib';
import * as fontkit from 'fontkit';
import { createCanvas } from '@napi-rs/canvas';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { rotatePdfPages, removePdfPages } = require('../src/lib/engines/pdf-engine.ts');
const { extractPageGroups, extractAllPagesGroups, safeBaseName } = require('../src/lib/engines/pdf-split-engine.ts');
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


test('native fields, saved widget appearance, URI links, comments and retained internal destinations survive page operations', async (t) => {
  const pdf = await PDFDocument.create();
  for (let number = 1; number <= 3; number++) {
    const page = pdf.addPage([400, 500]);
    page.drawText(`SEMANTICS PAGE ${number}`, { x: 25, y: 450 });
    const field = pdf.getForm().createTextField(`field${number}`);
    field.setText(`saved value ${number}`);
    field.addToPage(page, { x: 25, y: 350, width: 250, height: 40 });
  }
  pdf.setTitle('Native fields and links'); pdf.setAuthor('PDFPilot synthetic fixture');
  for (const annotation of [
    { Type: 'Annot', Subtype: 'Link', Rect: [25, 250, 200, 270], Border: [0, 0, 0], A: { Type: 'Action', S: 'URI', URI: PDFString.of('https://example.test/retained-link') } },
    { Type: 'Annot', Subtype: 'Text', Rect: [250, 250, 270, 270], Contents: PDFString.of('Retained comment') },
    { Type: 'Annot', Subtype: 'Link', Rect: [25, 200, 200, 220], Border: [0, 0, 0], Dest: [pdf.getPage(2).ref, PDFName.of('Fit')] },
  ]) pdf.getPage(0).node.addAnnot(pdf.context.register(pdf.context.obj(annotation)));
  const bytes = await pdf.save(), before = await inspect(bytes);
  const removed = await removePdfPages(file(bytes), [1]);
  const extracted = await extractPageGroups(bytes, 'semantics.pdf', [[1, 3]], true);
  const rotated = await rotatePdfPages(file(bytes), { 0: 90 });
  const outputs = [
    ['semantics-removed.pdf', new Uint8Array(await removed.arrayBuffer()), [0, 2]],
    ['semantics-extracted.pdf', extracted[0].bytes, [0, 2]],
    ['semantics-rotated.pdf', new Uint8Array(await rotated.arrayBuffer()), [0, 1, 2]],
  ];
  const report = [];
  for (const [name, output, indices] of outputs) {
    const after = await inspect(output), expected = name.includes('rotated') ? await inspect(bytes, [90, 0, 0]) : before;
    assert.equal(after.length, indices.length);
    indices.forEach((sourceIndex, index) => assert.deepEqual(after[index], expected[sourceIndex]));
    const parsed = await PDFDocument.load(output);
    assert.equal(parsed.getTitle(), 'Native fields and links');
    assert.equal(parsed.getAuthor(), 'PDFPilot synthetic fixture');
    const annotations = parsed.getPage(0).node.Annots().asArray().map(ref => parsed.context.lookup(ref));
    const uri = annotations.find(a => a.has(PDFName.of('A'))).lookup(PDFName.of('A')).lookup(PDFName.of('URI')).decodeText();
    const comment = annotations.find(a => a.has(PDFName.of('Contents'))).lookup(PDFName.of('Contents')).decodeText();
    assert.equal(uri, 'https://example.test/retained-link');
    assert.equal(comment, 'Retained comment');
    const actualTarget = annotations.find(a => a.has(PDFName.of('Dest'))).lookup(PDFName.of('Dest')).get(0).toString();
    const expectedTarget = parsed.getPage(parsed.getPageCount() - 1).ref.toString();
    const fields = parsed.getForm().getFields();
    assert.equal(fields.length, indices.length);
    assert.equal(actualTarget, expectedTarget);
    assert.equal(parsed.getForm().getTextField('field3').getText(), 'saved value 3');
    if (!name.includes('rotated')) assert.equal(parsed.getForm().getFieldMaybe('field2'), undefined);
    parsed.getForm().getTextField('field1').setText('Edited after page operation');
    const edited = await parsed.save();
    const reopened = await PDFDocument.load(edited);
    assert.equal(reopened.getForm().getTextField('field1').getText(), 'Edited after page operation');
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = getDocument({ data: edited.slice() });
    try {
      const independent = await task.promise, nativeFields = await independent.getFieldObjects();
      const widget = nativeFields.field1.find(field => field.type === 'text');
      assert.equal(widget.value, 'Edited after page operation');
      assert.equal(widget.editable, true);
      if (!name.includes('rotated')) assert.equal(nativeFields.field2, undefined);
      assert.equal(await independent.getPageIndex({ num: Number(actualTarget.split(' ')[0]), gen: 0 }), indices.length - 1);
    } finally { await task.destroy(); }
    assert.notDeepEqual((await inspect(edited))[0].pixels, after[0].pixels, 'native fill-and-save must update the visible field appearance');
    saveEvidence(name.replace('.pdf', '-edited.pdf'), edited);
    report.push({ name, formFieldCount: fields.length, expectedFormFieldCount: indices.length, internalLinkTargetInPageTree: actualTarget === expectedTarget });
    saveEvidence(name, output);
  }
  saveEvidence('semantics-source.pdf', bytes);
  saveEvidence('semantics-report.json', JSON.stringify(report, null, 2));
  t.diagnostic(JSON.stringify(report));
});


test('removed-page destinations and widgets are pruned while shared and nested native fields stay editable', async () => {
  const pdf = await PDFDocument.create();
  const pages = [pdf.addPage([400, 500]), pdf.addPage([400, 500]), pdf.addPage([400, 500])];
  pages.forEach((page, index) => page.drawText(`KEEP-TEST PAGE ${index + 1}`, { x: 25, y: 460 }));
  const form = pdf.getForm(), shared = form.createTextField('customer.name'); shared.setText('Ada');
  for (const page of pages.slice(0, 2)) shared.addToPage(page, { x: 25, y: 380, width: 200, height: 35 });
  const removed = form.createTextField('removed.branch.value'); removed.setText('REMOVED-PRIVATE-VALUE'); removed.addToPage(pages[1], { x: 25, y: 300, width: 250, height: 30 });
  const check = form.createCheckBox('confirmed'); check.addToPage(pages[0], { x: 25, y: 330, width: 20, height: 20 }); check.check();
  const radio = form.createRadioGroup('contact'); radio.addOptionToPage('Email', pages[0], { x: 25, y: 270, width: 20, height: 20 }); radio.addOptionToPage('Phone', pages[1], { x: 25, y: 270, width: 20, height: 20 }); radio.select('Email');
  const select = form.createDropdown('category'); select.addOptions(['One', 'Two']); select.select('Two'); for (const page of pages.slice(1)) select.addToPage(page, { x: 25, y: 350, width: 200, height: 35 });
  const destination = page => pdf.context.obj([page.ref, PDFName.of('Fit')]);
  pdf.catalog.set(PDFName.of('Dests'), pdf.context.obj({ removed: destination(pages[1]), kept: destination(pages[2]) }));
  pdf.catalog.set(PDFName.of('Names'), pdf.context.obj({ Dests: { Names: [PDFString.of('removedNamed'), destination(pages[1]), PDFString.of('keptNamed'), destination(pages[2])] } }));
  pdf.catalog.set(PDFName.of('OpenAction'), destination(pages[1]));
  const links = [
    { Dest: destination(pages[1]) },
    { A: { S: 'GoTo', D: destination(pages[1]) } },
    { Dest: PDFName.of('removed') },
    { Dest: PDFString.of('removedNamed') },
    { Dest: PDFString.of('keptNamed') },
    { Dest: destination(pages[2]) },
  ];
  for (const extra of links) pages[0].node.addAnnot(pdf.context.register(pdf.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [220, 200, 350, 230], Border: [0, 0, 0], ...extra })));
  const source = await pdf.save();
  const outputs = [new Uint8Array(await (await removePdfPages(file(source), [1])).arrayBuffer()), (await extractPageGroups(source, 'forms.pdf', [[1, 3]], true))[0].bytes];
  for (const output of outputs) {
    const parsed = await PDFDocument.load(output), keptForm = parsed.getForm();
    assert.deepEqual(keptForm.getFields().map(field => field.getName()).sort(), ['category', 'confirmed', 'contact', 'customer.name']);
    assert.equal(keptForm.getTextField('customer.name').acroField.getWidgets().length, 1);
    assert.equal(keptForm.getTextField('customer.name').getText(), 'Ada');
    assert.equal(keptForm.getCheckBox('confirmed').isChecked(), true);
    assert.deepEqual(keptForm.getDropdown('category').getSelected(), ['Two']);
    assert.deepEqual(keptForm.getDropdown('category').getOptions(), ['One', 'Two']);
    assert.deepEqual(keptForm.getRadioGroup('contact').getOptions(), ['Email']);
    assert.equal(keptForm.getRadioGroup('contact').getSelected(), 'Email');
    assert.equal(parsed.catalog.has(PDFName.of('OpenAction')), false);
    const keptLinks = parsed.getPage(0).node.Annots().asArray().map(ref => parsed.context.lookup(ref)).filter(dict => dict.get(PDFName.of('Subtype')) === PDFName.of('Link'));
    assert.equal(keptLinks.length, 2, 'only links targeting retained pages remain');
    assert.equal(parsed.context.enumerateIndirectObjects().filter(([, value]) => value.get?.(PDFName.of('Type')) === PDFName.of('Page')).length, 2, 'detached removed pages must not remain serialized');
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = getDocument({ data: output.slice() });
    try {
      const independent = await task.promise;
      assert.equal(await independent.getDestination('removed'), null);
      assert.equal(await independent.getDestination('removedNamed'), null);
      assert.equal(await independent.getPageIndex((await independent.getDestination('keptNamed'))[0]), 1);
      const fields = await independent.getFieldObjects();
      assert.equal(fields['removed.branch.value'], undefined);
      assert.equal(fields['customer.name'].filter(field => field.page >= 0).length, 1);
    } finally { await task.destroy(); }
    keptForm.getTextField('customer.name').setText('Grace'); keptForm.getCheckBox('confirmed').uncheck(); keptForm.getDropdown('category').select('One');
    const edited = await PDFDocument.load(await parsed.save());
    assert.equal(edited.getForm().getTextField('customer.name').getText(), 'Grace');
    assert.equal(edited.getForm().getCheckBox('confirmed').isChecked(), false);
    assert.deepEqual(edited.getForm().getDropdown('category').getSelected(), ['One']);
  }
  saveEvidence('nested-forms-source.pdf', source); saveEvidence('nested-forms-removed.pdf', outputs[0]); saveEvidence('nested-forms-extracted.pdf', outputs[1]);
});


test('inline annotation and inline GoTo action preserve a retained target without indirect-dictionary detection', async () => {
  const pdf = await PDFDocument.create();
  const pages = [pdf.addPage([400, 500]), pdf.addPage([400, 500]), pdf.addPage([400, 500])];
  pages.forEach((page, index) => page.drawText(`INLINE PAGE ${index + 1}`, { x: 30, y: 450 }));
  // Both Link and its action intentionally stay direct, unlike usual pdf-lib
  // registered annotations. Only the actual target page is an indirect reference.
  pages[0].node.set(PDFName.of('Annots'), pdf.context.obj([
    { Type: 'Annot', Subtype: 'Link', Rect: [30, 350, 200, 380], Border: [0, 0, 0], A: { S: 'GoTo', D: [pages[2].ref, PDFName.of('Fit')] } },
    { Type: 'Annot', Subtype: 'Link', Rect: [30, 300, 200, 330], Border: [0, 0, 0], A: { S: 'GoTo', D: [pages[1].ref, PDFName.of('Fit')] } },
  ]));
  const bytes = await pdf.save();
  const outputs = await extractPageGroups(bytes, 'inline.pdf', [[1, 3]], true);
  const parsed = await PDFDocument.load(outputs[0].bytes);
  const annotations = parsed.getPage(0).node.Annots();
  assert.equal(annotations.size(), 1, 'inline link to a removed page must be dropped');
  const action = parsed.context.lookup(annotations.get(0)).lookup(PDFName.of('A'));
  assert.equal(action.lookup(PDFName.of('D')).get(0).toString(), parsed.getPage(1).ref.toString());
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: outputs[0].bytes.slice() });
  try {
    const independent = await task.promise;
    const links = (await (await independent.getPage(1)).getAnnotations()).filter(annotation => annotation.subtype === 'Link');
    assert.equal(links.length, 1);
    assert.equal(await independent.getPageIndex(links[0].dest[0]), 1);
  } finally { await task.destroy(); }
  saveEvidence('inline-links-source.pdf', bytes); saveEvidence('inline-links-extracted.pdf', outputs[0].bytes);
});
