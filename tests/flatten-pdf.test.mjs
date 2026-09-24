import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { flattenPdfSafely } from '../src/lib/engines/pdf-flatten-engine.ts';

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
