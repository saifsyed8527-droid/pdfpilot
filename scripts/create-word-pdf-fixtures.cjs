// Synthetic, non-private fixtures. Never copy customer documents into the repo.
const fs = require("node:fs/promises");
const path = require("node:path");
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, ExternalHyperlink, PageBreak, WidthType } = require("docx");
const { unzipSync, zipSync, strToU8, strFromU8 } = require("fflate");
const sharp = require("sharp");

async function main() {
  const out = await fs.mkdtemp("/private/tmp/pdfpilot-word-fixtures-");
  const image = await sharp(Buffer.from('<svg width="600" height="180" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="180" fill="#e0f2fe"/><rect x="20" y="20" width="140" height="140" fill="#0284c7"/><circle cx="270" cy="90" r="65" fill="#f59e0b"/><text x="360" y="105" font-size="36" fill="#0f172a">IMAGE OK</text></svg>')).png().toBuffer();
  const picture = () => new Paragraph({ children: [new ImageRun({ type: "png", data: image, transformation: { width: 500, height: 150 } })] });
  const rich = new Document({ sections: [{ properties: {}, children: [
    new Paragraph({ children: [new TextRun({ text: "Image / table / link regression", bold: true, size: 36, color: "164E63" })] }),
    new Paragraph("A browser-local document. Keep this paragraph, the image and every table row."),
    picture(),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: Array.from({length: 55}, (_, i) => new TableRow({ tableHeader: i === 0, children: [new TableCell({ children: [new Paragraph(i === 0 ? "Row" : `Row ${i}`)] }), new TableCell({ children: [new Paragraph(i === 0 ? "Value" : `Table value ${i} — keep me`)] })] })) }),
    new Paragraph({ children: [new ExternalHyperlink({ link: "https://example.org/documentation", children: [new TextRun({ text: "Clickable documentation link", style: "Hyperlink" })] })] }),
    new Paragraph("العربية: الصور والجداول محفوظة. हिन्दी: चित्र और तालिकाएँ।"),
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph("Long paragraph follows — it must continue without lost lines."),
    new Paragraph({ children: [new TextRun({ text: Array.from({length: 240}, (_, i) => `Sentence ${i + 1}: preserve every word and keep the formatting. `).join(""), italics: true })] }),
    new Paragraph("END OF DOCUMENT — all content retained."),
  ] }] });
  const richBytes = await Packer.toBuffer(rich);
  await fs.writeFile(path.join(out, "images-tables-links.docx"), richBytes);
  await fs.writeFile(path.join(out, "image-only.docx"), await Packer.toBuffer(new Document({ sections: [{ children: [picture()] }] })));
  // Same-size sections with different margins previously inherited the first
  // section's margins, clipping full-page images from Google Docs exports.
  const landscape = { width: 15840, height: 12240 };
  await fs.writeFile(path.join(out, "section-margins.docx"), await Packer.toBuffer(new Document({ sections: [
    { properties: { page: { size: landscape, margin: { top: 765, right: 822, bottom: 680, left: 822 } } }, children: [new Paragraph("Section with margins"), picture()] },
    { properties: { page: { size: landscape, margin: { top: 0, right: 0, bottom: 0, left: 0 } } }, children: [new Paragraph({ children: [new ImageRun({ type: "png", data: image, transformation: { width: 1052, height: 812 } })] })] },
  ] })));
  const external = unzipSync(richBytes);
  external["word/_rels/document.xml.rels"] = strToU8(strFromU8(external["word/_rels/document.xml.rels"]).replace(/Target="media\/[^"]+"/, 'Target="https://example.org/private-image.png" TargetMode="External"'));
  await fs.writeFile(path.join(out, "blocked-external-image.docx"), zipSync(external));
  console.log(out);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
