import fs from "fs";
import { extractPdfText, dumpRawItems } from "./extract-lib.mjs";

const DIR = "/tmp/pdf2word-audit";

async function test(name) {
  console.log(`\n=== ${name} ===`);
  const bytes = new Uint8Array(fs.readFileSync(`${DIR}/${name}`));
  const pages = await extractPdfText(bytes);
  for (const page of pages) {
    console.log(`-- page ${page.pageNumber} --`);
    page.paragraphs.forEach((p, i) => console.log(`  [${page.paragraphStyles[i]}] ${JSON.stringify(p)}`));
  }
  return pages;
}

await test("basic.pdf");
await test("real-world.pdf");
await test("faux-bold-duplicate.pdf");
await test("unicode-latin.pdf");
await test("image-only.pdf");

console.log("\n=== two-column.pdf: paragraph output ===");
await test("two-column.pdf");

console.log("\n=== two-column.pdf: raw item order (x,y) ===");
const bytes = new Uint8Array(fs.readFileSync(`${DIR}/two-column.pdf`));
const items = await dumpRawItems(bytes);
items.forEach((it) => console.log(`  x=${it.x.toFixed(1)} y=${it.y.toFixed(1)} eol=${it.hasEOL} "${it.str}"`));
