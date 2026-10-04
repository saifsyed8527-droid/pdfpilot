// Read-only reproduction: node docs/qa/page-metadata-regression/inspect.cjs
const fs = require('node:fs');
const path = require('node:path');
const { PDFDocument, PDFName } = require('pdf-lib');
(async () => {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const report = {};
  for (const name of fs.readdirSync(__dirname).filter(name => name.endsWith('.pdf')).sort()) {
    const bytes = fs.readFileSync(path.join(__dirname, name));
    const parsed = await PDFDocument.load(bytes);
    const task = getDocument({ data: new Uint8Array(bytes), standardFontDataUrl: path.resolve('node_modules/pdfjs-dist/standard_fonts') + '/' });
    try {
      const doc = await task.promise, pages = [];
      for (let number = 1; number <= doc.numPages; number++) {
        const page = await doc.getPage(number);
        pages.push({ text: (await page.getTextContent()).items.map(item => item.str).join(' '), structure: await page.getStructTree() });
      }
      report[name] = { visiblePages: doc.numPages, serializedPageObjects: parsed.context.enumerateIndirectObjects().filter(([, value]) => value.get?.(PDFName.of('Type')) === PDFName.of('Page')).length, labels: await doc.getPageLabels(), pages };
    } finally { await task.destroy(); }
  }
  console.log(JSON.stringify(report, null, 2));
})();
