const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { load } = require('./load-pseo-modules.cjs');
const { DOCUMENT_TEMPLATES, templateExampleValues } = load('src/lib/content/document-templates.ts');
const { createDocumentTemplate } = load('src/lib/engines/document-template-engine.ts');
async function main() {
  const directory = path.resolve('public/template-samples/documents');
  await fs.mkdir(directory, { recursive: true });
  for (const row of DOCUMENT_TEMPLATES) {
    const blob = await createDocumentTemplate(row, templateExampleValues(row));
    const output = path.join(directory, `${row.slug}.pdf`);
    await fs.writeFile(output, Buffer.from(await blob.arrayBuffer()));
    execFileSync('pdftoppm', ['-f', '1', '-singlefile', '-scale-to', '842', '-png', output, path.join(directory, row.slug)], { stdio: 'pipe' });
    console.log('Generated', row.slug);
  }
  for (const [name, count] of [['workflow-a', 3], ['workflow-b', 2]]) {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const picture = await pdf.embedJpg(await fs.readFile('public/template-samples/landscape.jpg'));
    for (let i = 0; i < count; i++) {
      const page = pdf.addPage([595.28, 841.89]);
      page.drawText(`${name === 'workflow-a' ? 'Packet A' : 'Packet B'} - page ${i + 1}`, { x: 45, y: 780, font: bold, size: 24, color: rgb(0.15, 0.25, 0.35) });
      page.drawText('Original PDFPilot demonstration document', { x: 45, y: 748, font, size: 12 });
      page.drawImage(picture, { x: 45, y: 350, width: 505, height: 337 });
      page.drawText('Check this page label, image proportions and the final page order.', { x: 45, y: 310, font, size: 11 });
      page.drawText('This sample contains no customer information.', { x: 45, y: 285, font, size: 11 });
    }
    await fs.writeFile(`public/template-samples/${name}.pdf`, await pdf.save());
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
