const test = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const { load } = require('../scripts/load-pseo-modules.cjs');
const { DOCUMENT_TEMPLATES, templateExampleValues } = load('src/lib/content/document-templates.ts');
const { createDocumentTemplate } = load('src/lib/engines/document-template-engine.ts');
const { PDF_WORKFLOWS } = load('src/lib/content/pdf-workflows.ts');
const { parseWorkflowPages, runPdfWorkflow } = load('src/lib/engines/pdf-workflow-engine.ts');

test('every document template creates fillable A4 and Letter PDFs with preserved values and in-page fields', async () => {
  for (const row of DOCUMENT_TEMPLATES) for (const paper of ['a4', 'letter']) {
    const values = templateExampleValues(row);
    const result = await createDocumentTemplate(row, values, paper);
    const pdf = await PDFDocument.load(await result.arrayBuffer());
    assert.equal(pdf.getPageCount(), 1, row.slug);
    const page = pdf.getPage(0), form = pdf.getForm();
    assert.ok(Math.abs(page.getWidth() - (paper === 'a4' ? 595.28 : 612)) < .01);
    assert.ok(Math.abs(page.getHeight() - (paper === 'a4' ? 841.89 : 792)) < .01);
    assert.equal(form.getFields().length, row.fields.length + row.rows * row.columns.length + 1);
    for (const [key, value] of Object.entries(values)) assert.equal(form.getTextField(key).getText() ?? '', value, row.slug + ':' + key);
    for (const field of form.getFields()) for (const widget of field.acroField.getWidgets()) {
      const box = widget.getRectangle();
      assert.ok(box.x >= 39 && box.y >= 39 && box.x + box.width <= page.getWidth() - 39 && box.y + box.height < page.getHeight() - 75, row.slug + ':' + field.getName());
      assert.ok(widget.getNormalAppearance(), 'a visible appearance is embedded');
    }
  }
});

test('blank document download has no demonstration or prior form values', async () => {
  const row = DOCUMENT_TEMPLATES[0];
  const pdf = await PDFDocument.load(await (await createDocumentTemplate(row, {})).arrayBuffer());
  assert.ok(pdf.getForm().getFields().every(field => !field.getText()));
});

test('unsupported characters, unknown fields and overflowing text fail instead of silently losing content', async () => {
  const row = DOCUMENT_TEMPLATES.find(row => row.slug === 'habit-tracker-template');
  await assert.rejects(createDocumentTemplate(row, { focus: '😊' }), /Latin characters/);
  await assert.rejects(createDocumentTemplate(row, { unknown: 'value' }), /unknown form field/);
  await assert.rejects(createDocumentTemplate(row, { 'row-0-1': 'W'.repeat(80) }), /too long for this layout/);
});

test('page selection preserves explicit order, removes duplicates and rejects malformed or huge ranges', () => {
  assert.deepEqual(parseWorkflowPages('3, 1-2, 3', 5), [2, 0, 1]);
  for (const source of ['', '0', '3-1', '2-99999999999', '-1', '1,,2', '1.5', '4']) assert.throws(() => parseWorkflowPages(source, 3));
});

async function fixture(label, pages = 2, filled = false) {
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) pdf.addPage([595.28, 841.89]).drawText(`${label} ${i + 1}`, { x: 40, y: 740, font });
  if (filled) { const field = pdf.getForm().createTextField('name'); field.setText('Example value'); field.addToPage(pdf.getPage(0), { x: 40, y: 600, width: 200, height: 30 }); }
  return new File([await pdf.save()], `${label}.pdf`, { type: 'application/pdf' });
}

test('merge workflows retain every input page and flatten filled form values before copying', async () => {
  const files = [await fixture('first', 2, true), await fixture('second', 1)];
  for (const kind of ['merge-number', 'merge-watermark']) {
    const workflow = PDF_WORKFLOWS.find(row => row.kind === kind);
    const output = await runPdfWorkflow(workflow, files, { firstNumber: 7, watermark: 'DRAFT' }, () => {}, () => false);
    const pdf = await PDFDocument.load(await output.blob.arrayBuffer());
    assert.equal(output.pages, 3);
    assert.equal(pdf.getForm().getFields().length, 0);
    assert.ok(pdf.getPages().every(page => Math.abs(page.getWidth() - 595.28) < .01));
    assert.ok(pdf.getPages().every(page => page.node.Contents()));
  }
});

test('workflow validation and cancellation return no partial result', async () => {
  const workflow = PDF_WORKFLOWS.find(row => row.kind === 'merge-compress');
  const file = await fixture('first');
  await assert.rejects(runPdfWorkflow(workflow, [file], {}, () => {}, () => false), /between 2 and 20/);
  await assert.rejects(runPdfWorkflow(workflow, [file, file], {}, () => {}, () => false), /compression trade-off/);
  await assert.rejects(runPdfWorkflow(workflow, [file, file], { allowRasterCompression: true }, () => {}, () => true), /cancelled/);
  const broken = new File(['not a PDF'], 'broken.pdf', { type: 'application/pdf' });
  await assert.rejects(runPdfWorkflow(workflow, [file, broken], { allowRasterCompression: true }, () => {}, () => false), /could not be opened/);
});
