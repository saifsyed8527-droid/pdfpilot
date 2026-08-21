import { PDFDocument, StandardFonts } from "pdf-lib";
import fs from "fs";

const OUT = "/tmp/pdf2word-audit";

async function genFalsePositiveCheck() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  // Legitimate typo/repetition, side by side, same line - words are NOT
  // overlapping in x (word2 starts where word1 ends), must be preserved.
  page.drawText("I saw the the cat run away.", { x: 50, y: 730, size: 12, font });

  // Two side-by-side "Total" table cells on the same row, far apart in x -
  // must both be preserved, not treated as a duplicate draw.
  page.drawText("Total", { x: 50, y: 690, size: 12, font });
  page.drawText("Total", { x: 300, y: 690, size: 12, font });

  // Triple-stacked faux-bold (some generators double-draw AND stroke) -
  // all three collapse to one occurrence.
  const triple = "Extra Bold Simulated";
  page.drawText(triple, { x: 50, y: 650, size: 14, font });
  page.drawText(triple, { x: 50.3, y: 650, size: 14, font });
  page.drawText(triple, { x: 49.7, y: 650, size: 14, font });

  fs.writeFileSync(`${OUT}/false-positive-check.pdf`, await doc.save());
  console.log("false-positive-check.pdf written");
}

await genFalsePositiveCheck();
