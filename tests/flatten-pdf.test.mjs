import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { flattenPdfSafely } from '../src/lib/engines/pdf-flatten-engine.ts';

// Independent renderer: structural validity alone cannot establish that a
// flattened form still looks the same or that field text remains selectable.
async function renderedPages(bytes) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { createCanvas } = await import('@napi-rs/canvas');
  const task = getDocument({ data: new Uint8Array(bytes), standardFontDataUrl: process.cwd() + '/node_modules/pdfjs-dist/standard_fonts/' });
  try {
    const pdf = await task.promise;
    const pages = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = createCanvas(viewport.width, viewport.height);
      await page.render({ canvas, viewport }).promise;
      pages.push({
        width: canvas.width, height: canvas.height,
        pixels: canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data,
        text: (await page.getTextContent()).items.map(item => item.str).join('|'),
      });
    }
    return pages;
  } finally { await task.destroy(); }
}
async function assertSameAppearance(source, output) {
  const before = await renderedPages(source), after = await renderedPages(output);
  assert.equal(after.length, before.length);
  for (let index = 0; index < before.length; index++) {
    assert.equal(after[index].width, before[index].width);
    assert.equal(after[index].height, before[index].height);
    assert.deepEqual(after[index].pixels, before[index].pixels, `page ${index + 1} appearance must survive flattening`);
  }
  return after.map(page => page.text);
}

const file = bytes => new File([bytes], 'form.pdf', { type: 'application/pdf' });
test('form output keeps page geometry and vector appearance, removes interactive fields', async () => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([400, 600]);
  page.drawText('Original page content', { x: 20, y: 550 });
  const field = pdf.getForm().createTextField('customer');
  field.setText('PDFPilot quality fixture');
  field.addToPage(page, { x: 20, y: 450, width: 300, height: 35 });
  const check = pdf.getForm().createCheckBox('confirmed');
  check.addToPage(page, { x: 20, y: 400, width: 20, height: 20 }); check.check();
  const source = file(await pdf.save());
  const result = await flattenPdfSafely(source);
  const parsed = await PDFDocument.load(await result.blob.arrayBuffer());
  assert.equal(result.fieldCount, 2);
  assert.equal(parsed.getForm().getFields().length, 0);
  assert.deepEqual(parsed.getPage(0).getSize(), { width: 400, height: 600 });
  assert.ok(parsed.getPage(0).node.Contents().size() > 0);
  assert.match(parsed.getPage(0).node.Resources().toString(), /FlatWidget/);
  assert.equal(result.unchanged, false);
  assert.equal((await PDFDocument.load(await source.arrayBuffer())).getForm().getFields().length, 2);
});
test('no-field PDFs return original bytes, not a misleading converted copy', async () => {
  const pdf = await PDFDocument.create(); pdf.addPage();
  const bytes = await pdf.save();
  const result = await flattenPdfSafely(file(bytes));
  assert.equal(result.unchanged, true);
  assert.deepEqual(new Uint8Array(await result.blob.arrayBuffer()), bytes);
});
test('unreadable files fail without returning output', async () => {
  await assert.rejects(flattenPdfSafely(file(new TextEncoder().encode('not a PDF'))), /damaged or password/);
});
test('XFA and signature fields are explicitly rejected', async () => {
  const xfa = await PDFDocument.create(); xfa.addPage();
  xfa.getForm().acroForm.dict.set(PDFName.of('XFA'), PDFString.of('unsupported'));
  await assert.rejects(flattenPdfSafely(file(await xfa.save({ updateFieldAppearances: false }))), /XFA/);
  const signed = await PDFDocument.create(); signed.addPage();
  const signature = signed.context.obj({ FT: PDFName.of('Sig'), T: PDFString.of('signature') });
  signed.getForm().acroForm.addField(signed.context.register(signature));
  await assert.rejects(flattenPdfSafely(file(await signed.save())), /signature fields/);
});

test('all common field types, repeated widgets, links and comments survive with no dangling widgets', async () => {
  const { PDFDict, degrees } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const first = pdf.addPage([500, 700]);
  const second = pdf.addPage([700, 500]); second.setRotation(degrees(90)); second.setCropBox(10, 20, 650, 460);
  first.drawText('Original selectable text', { x: 40, y: 650 });
  const form = pdf.getForm();
  const text = form.createTextField('name'); text.setText('Ada Lovelace');
  text.addToPage(first, { x: 40, y: 560, width: 260, height: 30 });
  text.addToPage(second, { x: 50, y: 350, width: 260, height: 30 });
  const multi = form.createTextField('notes'); multi.enableMultiline(); multi.setText('First line\nSecond line'); multi.addToPage(first, { x: 40, y: 470, width: 260, height: 70 });
  const box = form.createCheckBox('check'); box.addToPage(first, { x: 40, y: 420, width: 20, height: 20 }); box.check();
  const radio = form.createRadioGroup('choice'); radio.addOptionToPage('A', first, { x: 90, y: 420, width: 20, height: 20 }); radio.addOptionToPage('B', first, { x: 120, y: 420, width: 20, height: 20 }); radio.select('B');
  const drop = form.createDropdown('country'); drop.addOptions(['India', 'Brazil']); drop.select('India'); drop.addToPage(first, { x: 40, y: 350, width: 180, height: 30 });
  const list = form.createOptionList('list'); list.addOptions(['One', 'Two', 'Three']); list.select('Two'); list.addToPage(first, { x: 40, y: 200, width: 180, height: 110 });
  const link = pdf.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [300, 600, 450, 620], A: { S: 'URI', URI: PDFString.of('https://pdfpilot.net') } });
  const note = pdf.context.obj({ Type: 'Annot', Subtype: 'Text', Rect: [350, 500, 370, 520], Contents: PDFString.of('Keep this comment') });
  first.node.addAnnot(pdf.context.register(link)); first.node.addAnnot(pdf.context.register(note));
  const source = await pdf.save();
  const result = await flattenPdfSafely(file(source));
  const parsed = await PDFDocument.load(await result.blob.arrayBuffer());
  assert.equal(result.fieldCount, 6); assert.equal(result.annotationCount, 2);
  assert.equal(parsed.catalog.AcroForm(), undefined);
  assert.deepEqual(parsed.getPage(1).getCropBox(), { x: 10, y: 20, width: 650, height: 460 });
  assert.equal(parsed.getPage(1).getRotation().angle, 90);
  const annotations = parsed.getPages().flatMap(p => p.node.Annots()?.asArray() ?? []).map(ref => parsed.context.lookup(ref, PDFDict));
  assert.deepEqual(annotations.map(a => a.get(PDFName.of('Subtype')).toString()), ['/Link', '/Text']);
  assert.equal(annotations[1].get(PDFName.of('Contents')).decodeText(), 'Keep this comment');
  const pageText = await assertSameAppearance(source, await result.blob.arrayBuffer());
  assert.match(pageText[0], /Original selectable text\|Ada Lovelace\|First line\|Second line\|India/);
  assert.equal(pageText[1], 'Ada Lovelace');
  if (process.env.FLATTEN_QA_DIR) {
    const fs = await import('node:fs/promises'); await fs.mkdir(process.env.FLATTEN_QA_DIR, { recursive: true });
    await fs.writeFile(process.env.FLATTEN_QA_DIR + '/forms-source.pdf', source);
    await fs.writeFile(process.env.FLATTEN_QA_DIR + '/forms-flattened.pdf', new Uint8Array(await result.blob.arrayBuffer()));
  }
});

test('custom scaled and rotated appearances are retained and mapped into their rectangle', async () => {
  const { PDFRawStream, decodePDFRawStream } = await import('pdf-lib');
  const pdf = await PDFDocument.create(); const page = pdf.addPage([400, 500]);
  page.drawText('Custom appearance fixture', { x: 30, y: 450, size: 16 });
  const field = pdf.getForm().createTextField('custom'); field.setText('Custom'); field.addToPage(page, { x: 60, y: 200, width: 240, height: 80 });
  const widget = field.acroField.getWidgets()[0];
  const appearance = pdf.context.flateStream('0 0.5 0.8 rg 10 20 40 20 re f', { Type: 'XObject', Subtype: 'Form', BBox: [10, 20, 50, 40], Matrix: [0, 1, -1, 0, 40, -10], Resources: {} });
  widget.setNormalAppearance(pdf.context.register(appearance));
  pdf.getForm().markFieldAsClean(field.ref);
  const source = await pdf.save({ updateFieldAppearances: false });
  const result = await flattenPdfSafely(file(source));
  const parsed = await PDFDocument.load(await result.blob.arrayBuffer());
  const all = parsed.context.enumerateIndirectObjects().filter(([, obj]) => obj instanceof PDFRawStream);
  assert.ok(all.some(([,obj]) => Buffer.from(decodePDFRawStream(obj).decode()).toString().includes('0 0.5 0.8 rg')));
  assert.equal(all.filter(([,obj]) => obj.dict.get(PDFName.of('Subtype')) === PDFName.of('Image')).length, 0);
  await assertSameAppearance(source, await result.blob.arrayBuffer());
  if (process.env.FLATTEN_QA_DIR) {
    const fs = await import('node:fs/promises'); await fs.mkdir(process.env.FLATTEN_QA_DIR, { recursive: true });
    await fs.writeFile(process.env.FLATTEN_QA_DIR + '/matrix-source.pdf', source);
    await fs.writeFile(process.env.FLATTEN_QA_DIR + '/matrix-flattened.pdf', new Uint8Array(await result.blob.arrayBuffer()));
  }
});

test('invisible widgets are removed without exposing their hidden values', async () => {
  const { PDFRawStream, decodePDFRawStream } = await import('pdf-lib');
  const pdf = await PDFDocument.create(); const page = pdf.addPage();
  const field = pdf.getForm().createTextField('hidden'); field.setText('hidden content'); field.addToPage(page, { x: 20, y: 20 });
  field.acroField.getWidgets()[0].setFlags(2);
  const result = await flattenPdfSafely(file(await pdf.save()));
  const parsed = await PDFDocument.load(await result.blob.arrayBuffer());
  const contents = parsed.getPage(0).node.Contents();
  if (contents) for (const ref of contents.asArray()) {
    const stream = parsed.context.lookup(ref, PDFRawStream);
    assert.ok(!Buffer.from(decodePDFRawStream(stream).decode()).toString().includes('FlatWidget'));
  }
  assert.equal(parsed.getPage(0).node.Annots().size(), 0);
});

test('stale appearances, conditional visibility, orphan widgets and unknown fields fail safely', async () => {
  const { PDFBool } = await import('pdf-lib');
  for (const kind of ['stale', 'conditional', 'orphan', 'unknown']) {
    const pdf = await PDFDocument.create(); const page = pdf.addPage();
    const field = pdf.getForm().createTextField('test'); field.setText('value'); field.addToPage(page, { x: 10, y: 20 });
    if (kind === 'stale') pdf.catalog.AcroForm().set(PDFName.of('NeedAppearances'), PDFBool.True);
    if (kind === 'conditional') field.acroField.getWidgets()[0].setFlags(32);
    if (kind === 'orphan') page.node.addAnnot(pdf.context.register(pdf.context.obj({ Type: 'Annot', Subtype: 'Widget', Rect: [0, 0, 20, 20] })));
    if (kind === 'unknown') pdf.getForm().acroForm.addField(pdf.context.register(pdf.context.obj({ FT: 'Unknown', T: PDFString.of('unknown') })));
    await assert.rejects(flattenPdfSafely(file(await pdf.save())), /appearance|safely/, kind);
  }
});

test('blank/no-page, encrypted and oversized PDFs fail without output', async () => {
  const pdf = await PDFDocument.create();
  await assert.rejects(flattenPdfSafely(file(await pdf.save({ addDefaultPage: false }))), /no pages/);
  const oversized = { size: 100 * 1024 * 1024 + 1, arrayBuffer() { throw new Error('must not read'); } };
  await assert.rejects(flattenPdfSafely(oversized), /100MB/);
  const encrypted = await PDFDocument.create(); encrypted.addPage();
  encrypted.context.trailerInfo.Encrypt = encrypted.context.register(encrypted.context.obj({ Filter: 'Standard', V: 1, R: 2 }));
  await assert.rejects(flattenPdfSafely(file(await encrypted.save())), /password-protected/);
});

test('ZIP keeps duplicate and Unicode filenames, removes traversal, and contains every actual PDF', async () => {
  const { flattenArchiveEntries } = await import('../src/lib/engines/pdf-flatten-engine.ts');
  const { zipSync, unzipSync } = await import('fflate');
  const pdf = await PDFDocument.create(); pdf.addPage(); const bytes = await pdf.save();
  const result = await flattenPdfSafely(file(bytes));
  const names = ['same.pdf', 'same.pdf', '../合同.pdf', '1_same.pdf'];
  const entries = await flattenArchiveEntries(names.map(name => ({ name, blob: result.blob })));
  const unzipped = unzipSync(zipSync(entries, { level: 0 }));
  assert.deepEqual(Object.keys(unzipped), ['1_same_flattened.pdf', '2_same_flattened.pdf', '3_.._合同_flattened.pdf', '4_1_same_flattened.pdf']);
  for (const contents of Object.values(unzipped)) { assert.deepEqual(contents, bytes); assert.equal((await PDFDocument.load(contents)).getPageCount(), 1); }
});

test('Unicode embedded fonts and original images remain intact without rasterizing the page', async () => {
  const { readFile, writeFile, mkdir } = await import('node:fs/promises');
  const fontkit = await import('fontkit');
  const sharp = (await import('sharp')).default;
  const { PDFRawStream } = await import('pdf-lib');
  const pdf = await PDFDocument.create(); const page = pdf.addPage([400, 400]);
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await readFile('public/fonts/NotoSansDevanagari-Regular.ttf'));
  const text = pdf.getForm().createTextField('unicode'); text.setText('नमस्ते'); text.addToPage(page, { x: 30, y: 250, width: 300, height: 60, font });
  pdf.getForm().updateFieldAppearances(font);
  const jpeg = await sharp({ create: { width: 100, height: 60, channels: 3, background: '#f97316' } }).jpeg().toBuffer();
  page.drawImage(await pdf.embedJpg(jpeg), { x: 30, y: 100, width: 200, height: 120 });
  const source = await pdf.save({ updateFieldAppearances: false });
  const result = await flattenPdfSafely(file(source)); const output = new Uint8Array(await result.blob.arrayBuffer());
  const parsed = await PDFDocument.load(output);
  const images = parsed.context.enumerateIndirectObjects().filter(([,obj]) => obj instanceof PDFRawStream && obj.dict.get(PDFName.of('Subtype')) === PDFName.of('Image'));
  assert.equal(images.length, 1); assert.deepEqual(Buffer.from(images[0][1].getContents()), jpeg);
  const { PDFDict } = await import('pdf-lib');
  const descriptor = parsed.context.enumerateIndirectObjects().find(([,obj]) => obj instanceof PDFDict && obj.has(PDFName.of('FontFile2')))?.[1];
  assert.ok(descriptor, 'embedded TrueType font is retained');
  const fontStream = parsed.context.lookup(descriptor.get(PDFName.of('FontFile2')), PDFRawStream);
  const original = await PDFDocument.load(source);
  const originalDescriptor = original.context.enumerateIndirectObjects().find(([,obj]) => obj instanceof PDFDict && obj.has(PDFName.of('FontFile2')))[1];
  assert.deepEqual(fontStream.getContents(), original.context.lookup(originalDescriptor.get(PDFName.of('FontFile2')), PDFRawStream).getContents());
  await assertSameAppearance(source, output);
  if (process.env.FLATTEN_QA_DIR) {
    await mkdir(process.env.FLATTEN_QA_DIR, { recursive: true });
    await writeFile(process.env.FLATTEN_QA_DIR + '/unicode-source.pdf', source);
    await writeFile(process.env.FLATTEN_QA_DIR + '/unicode-flattened.pdf', output);
  }
});

test('an indirect checkbox appearance-state dictionary selects the current state', async () => {
  const pdf = await PDFDocument.create(); const page = pdf.addPage();
  const field = pdf.getForm().createCheckBox('check'); field.addToPage(page, { x: 30, y: 30, width: 20, height: 20 }); field.check();
  pdf.getForm().updateFieldAppearances();
  const widget = field.acroField.getWidgets()[0]; widget.setNormalAppearance(pdf.context.register(widget.getNormalAppearance()));
  const result = await flattenPdfSafely(file(await pdf.save({ updateFieldAppearances: false })));
  assert.equal(result.fieldCount, 1); assert.equal((await PDFDocument.load(await result.blob.arrayBuffer())).getPage(0).node.Annots().size(), 0);
});

test('missing Latin appearances are generated but unrenderable Unicode is never silently lost', async () => {
  for (const value of ['Readable value', 'नमस्ते']) {
    const pdf = await PDFDocument.create(); const page = pdf.addPage();
    const field = pdf.getForm().createTextField('value'); field.addToPage(page, { x: 30, y: 30 }); field.setText(value);
    field.acroField.getWidgets()[0].dict.delete(PDFName.of('AP'));
    const input = file(await pdf.save({ updateFieldAppearances: false }));
    if (value === 'Readable value') assert.equal((await flattenPdfSafely(input)).fieldCount, 1);
    else await assert.rejects(flattenPdfSafely(input), /preserved safely/);
  }
});

test('Invisible bit does not hide a recognized Widget or lose its visible value', async () => {
  const { PDFRawStream, decodePDFRawStream } = await import('pdf-lib');
  const pdf = await PDFDocument.create(); const page = pdf.addPage([400, 200]);
  const field = pdf.getForm().createTextField('recognized-widget');
  field.setText('Visible widget value'); field.addToPage(page, { x: 30, y: 100, width: 300, height: 40 });
  field.acroField.getWidgets()[0].setFlags(1);
  const source = await pdf.save();
  const result = await flattenPdfSafely(file(source)); const output = new Uint8Array(await result.blob.arrayBuffer());
  const parsed = await PDFDocument.load(output);
  const contents = parsed.getPage(0).node.Contents();
  assert.ok(contents, 'recognized widget must be painted, not discarded');
  assert.ok(contents.asArray().some(ref => Buffer.from(decodePDFRawStream(parsed.context.lookup(ref, PDFRawStream)).decode()).toString().includes('FlatWidget')));
  assert.equal(parsed.getPage(0).node.Annots().size(), 0);
  assert.match((await assertSameAppearance(source, output))[0], /Visible widget value/);
  if (process.env.FLATTEN_QA_DIR) {
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(process.env.FLATTEN_QA_DIR, { recursive: true });
    await writeFile(process.env.FLATTEN_QA_DIR + '/invisible-bit-source.pdf', source);
    await writeFile(process.env.FLATTEN_QA_DIR + '/invisible-bit-flattened.pdf', output);
  }
});

test('push-button labels become visible page content without retaining interactive widgets', async () => {
  const pdf = await PDFDocument.create(); const page = pdf.addPage([300, 200]);
  const button = pdf.getForm().createButton('submit');
  button.addToPage('Submit form', page, { x: 30, y: 80, width: 180, height: 40 });
  const source = await pdf.save();
  const result = await flattenPdfSafely(file(source));
  const output = await result.blob.arrayBuffer();
  const parsed = await PDFDocument.load(output);
  assert.equal(result.fieldCount, 1);
  assert.equal(parsed.catalog.AcroForm(), undefined);
  assert.equal(parsed.getPage(0).node.Annots().size(), 0);
  assert.match((await assertSameAppearance(source, output))[0], /Submit form/);
});
