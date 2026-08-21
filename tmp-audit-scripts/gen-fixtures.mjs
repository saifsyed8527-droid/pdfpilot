import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "fs";

const OUT = "/tmp/pdf2word-audit";
fs.mkdirSync(OUT, { recursive: true });

// 1. basic.pdf - heading + paragraphs, single column
async function genBasic() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  page.drawText("Annual Report 2026", { x: 50, y: 730, size: 24, font: bold });
  page.drawText("Executive Summary", { x: 50, y: 690, size: 16, font: bold });
  const body1 = "This report summarizes the financial performance of the company over the past fiscal year. Revenue grew steadily across all three quarters.";
  wrapText(page, body1, 50, 665, 500, 11, font);
  page.drawText("Key Findings", { x: 50, y: 600, size: 16, font: bold });
  const body2 = "Operating margins improved due to cost reductions in the supply chain. Customer retention remained above ninety percent throughout the year.";
  wrapText(page, body2, 50, 575, 500, 11, font);

  fs.writeFileSync(`${OUT}/basic.pdf`, await doc.save());
  console.log("basic.pdf written");
}

function wrapText(page, text, x, y, maxWidth, size, font) {
  const words = text.split(" ");
  let line = "";
  let curY = y;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth) {
      page.drawText(line, { x, y: curY, size, font });
      curY -= size * 1.4;
      line = w;
    } else {
      line = test;
    }
  }
  if (line) page.drawText(line, { x, y: curY, size, font });
}

// 2. unicode.pdf - accented latin, cyrillic, CJK (using Helvetica for latin-ish, but need real unicode font for cyrillic/CJK)
// pdf-lib's StandardFonts (WinAnsi) can't encode Cyrillic/CJK - use this to confirm honest failure behavior,
// and separately test with the project's own Noto fonts used for real unicode support (via fontkit + embedFont with subset:false)
async function genUnicodeLatin() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText("Accented Latin Test", { x: 50, y: 730, size: 18, font });
  page.drawText("Café, naïve, résumé, jalapeño, Zürich, Björk", { x: 50, y: 690, size: 12, font });
  page.drawText("El niño comió en el café con crème brûlée.", { x: 50, y: 665, size: 12, font });
  fs.writeFileSync(`${OUT}/unicode-latin.pdf`, await doc.save());
  console.log("unicode-latin.pdf written");
}

// 3. two-column.pdf - real multi-column layout, reading order test
async function genTwoColumn() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  page.drawText("Newsletter", { x: 50, y: 740, size: 20, font: bold });

  const leftCol = [
    "LEFT-ONE. This is the first left column sentence.",
    "LEFT-TWO. This is the second left column sentence.",
    "LEFT-THREE. This is the third left column sentence.",
    "LEFT-FOUR. This is the fourth left column sentence.",
  ];
  const rightCol = [
    "RIGHT-ONE. This is the first right column sentence.",
    "RIGHT-TWO. This is the second right column sentence.",
    "RIGHT-THREE. This is the third right column sentence.",
    "RIGHT-FOUR. This is the fourth right column sentence.",
  ];

  let y = 700;
  for (const line of leftCol) {
    page.drawText(line, { x: 50, y, size: 11, font });
    y -= 20;
  }
  y = 700;
  for (const line of rightCol) {
    page.drawText(line, { x: 320, y, size: 11, font });
    y -= 20;
  }

  fs.writeFileSync(`${OUT}/two-column.pdf`, await doc.save());
  console.log("two-column.pdf written");
}

// 4. faux-bold-duplicate.pdf - same text drawn twice at near-identical Y, tiny X offset
// (a real technique older PDF generators use to simulate bold without an embedded bold font)
async function genFauxBoldDuplicate() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  page.drawText("Normal heading above", { x: 50, y: 740, size: 14, font });

  // faux-bold: identical text, same Y, offset X by 0.3pt
  const fauxBoldText = "Simulated Bold Heading Via Double Draw";
  page.drawText(fauxBoldText, { x: 50, y: 700, size: 14, font });
  page.drawText(fauxBoldText, { x: 50.3, y: 700, size: 14, font });

  page.drawText("Normal paragraph text follows this heading and should read once only, not twice.", { x: 50, y: 670, size: 11, font });

  fs.writeFileSync(`${OUT}/faux-bold-duplicate.pdf`, await doc.save());
  console.log("faux-bold-duplicate.pdf written");
}

// 5. image-only.pdf - a page with only a drawn rectangle (no text) - simulates scanned doc
async function genImageOnly() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  page.drawRectangle({ x: 50, y: 400, width: 500, height: 300, color: rgb(0.8, 0.8, 0.8) });
  fs.writeFileSync(`${OUT}/image-only.pdf`, await doc.save());
  console.log("image-only.pdf written");
}

// 6. real-world.pdf - multi-section doc with headings at varied sizes + normal-spaced heading-body (regression check for prior fix)
async function genRealWorld() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  page.drawText("Project Proposal", { x: 50, y: 740, size: 22, font: bold });
  page.drawText("Background", { x: 50, y: 705, size: 15, font: bold }); // normal-ish gap from title
  wrapText(page, "The team has identified a need for improved reporting infrastructure across the organization. This section outlines the motivation.", 50, 682, 500, 11, font);
  page.drawText("Scope", { x: 50, y: 610, size: 15, font: bold });
  wrapText(page, "The scope covers three departments: finance, operations, and marketing. Each department will receive a dedicated dashboard.", 50, 587, 500, 11, font);
  page.drawText("Timeline", { x: 50, y: 515, size: 15, font: bold });
  wrapText(page, "Implementation is expected to take twelve weeks, split into three four-week phases with a review at the end of each phase.", 50, 492, 500, 11, font);

  fs.writeFileSync(`${OUT}/real-world.pdf`, await doc.save());
  console.log("real-world.pdf written");
}

await genBasic();
await genUnicodeLatin();
await genTwoColumn();
await genFauxBoldDuplicate();
await genImageOnly();
await genRealWorld();
console.log("done");
