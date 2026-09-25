const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { loadTs } = require("./load-ts.cjs");
const { wordPdfFilename, safeWordLink, checkWordArchiveEntry, WORD_PDF_LIMITS } = loadTs("src/lib/engines/word-pdf-policy.ts");

test("Word output names have one PDF extension and safe download characters", () => {
  assert.equal(wordPdfFilename("Evlar_Homepage_Desktop_Final_Look.docx"), "Evlar_Homepage_Desktop_Final_Look.pdf");
  assert.equal(wordPdfFilename("Arabic تقرير.DOCX"), "Arabic تقرير.pdf");
  assert.equal(wordPdfFilename("folder/name:report.docx"), "folder_name_report.pdf");
});

test("only safe external hyperlinks and internal bookmarks enter the PDF", () => {
  for (const link of ["https://example.org/a?q=1", "http://example.org/", "mailto:test@example.org", "#chapter-2"]) assert.equal(safeWordLink(link), link);
  for (const link of ["javascript:alert(1)", "data:text/html,hello", "file:///etc/passwd", "//example.org", "/relative", "https://user:pass@example.org", "java\nscript:alert(1)"]) assert.equal(safeWordLink(link), null);
});

test("DOCX expansion limits reject oversized archives before decompression", () => {
  assert.doesNotThrow(() => checkWordArchiveEntry("word/media/image1.png", 10000, 1, 10000));
  for (const args of [
    ["../image.png", 1, 1, 1], ["/image.png", 1, 1, 1],
    ["word/document.xml", WORD_PDF_LIMITS.xmlBytes + 1, 1, 1],
    ["word/media/image.png", WORD_PDF_LIMITS.partBytes + 1, 1, 1],
    ["word/document.xml", 1, WORD_PDF_LIMITS.entries + 1, 1],
    ["word/document.xml", 1, 1, WORD_PDF_LIMITS.expandedBytes + 1],
  ]) assert.throws(() => checkWordArchiveEntry(...args));
});

test("Word-to-PDF uses visual rendering, sequential work, and no text-only fallback", () => {
  const client = fs.readFileSync("src/app/word-to-pdf/word-to-pdf-client.tsx", "utf8");
  const engine = fs.readFileSync("src/lib/engines/word-pdf-engine.ts", "utf8");
  assert.ok(client.includes("convertWordToPdf(item.file"));
  assert.ok(!client.includes("extractDocxBlocks"));
  assert.ok(!client.includes("renderBlocksToPdf"));
  assert.ok(client.includes("withConcurrency(items, 1"));
  assert.ok(client.includes("not selectable or searchable"));
  assert.ok(engine.includes('setAttribute("sandbox", "allow-same-origin")'));
  assert.ok(engine.includes("renderAltChunks: false"));
  assert.ok(engine.includes("finally { metricStyle.remove(); frame.remove(); }"));
  assert.ok(engine.includes("await image.decode()"));
  assert.ok(engine.includes("ignoreLastRenderedPageBreak: true"));
  assert.ok(engine.includes("data-word-symbol-bullet"));
  assert.ok(client.includes("Keep detailed"));
  assert.ok(!engine.includes("fetch("));
  assert.ok(!engine.includes("XMLHttpRequest"));
});
