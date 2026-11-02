const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");
const XLSX = require("xlsx");
const { createWorker } = require("tesseract.js");
const {
  PDFDocument,
  StandardFonts,
  degrees,
  PDFName,
  PDFNumber,
} = require("pdf-lib");
const {
  createCanvas,
  DOMMatrix,
  ImageData,
  Path2D,
  GlobalFonts,
} = require("@napi-rs/canvas");
Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
global.document = {
  createElement(type) {
    assert.equal(type, "canvas");
    return createCanvas(1, 1);
  },
};
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "pdfpilot-table-"));
test.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
let pdfjs,
  starts = 0,
  stops = 0;
async function library() {
  pdfjs ??= await import("pdfjs-dist/legacy/build/pdf.mjs");
  const root = path.dirname(require.resolve("pdfjs-dist/package.json"));
  return {
    ...pdfjs,
    getDocument(options) {
      return pdfjs.getDocument({
        ...options,
        standardFontDataUrl: root + "/standard_fonts/",
        cMapUrl: root + "/cmaps/",
        wasmUrl: root + "/wasm/",
        useSystemFonts: false,
      });
    },
  };
}
// The browser adapter is replaced only at the platform boundary. Real local
// PDF.js rendering and pinned Tesseract language models produce every OCR word.
async function createOcrWorker(signal, { languages }) {
  let progress;
  const worker = await createWorker(languages, 1, {
    langPath: path.resolve("public/tesseract/lang-v1"),
    cachePath: scratch,
    logger(m) {
      if (m.status === "recognizing text") progress?.(m.progress * 100);
    },
  });
  starts++;
  let terminated = false;
  const terminate = async () => {
    if (!terminated) {
      terminated = true;
      stops++;
      signal?.removeEventListener("abort", abort);
      await worker.terminate();
    }
  };
  const abort = () => {
    void terminate();
  };
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) {
    await terminate();
    throw new DOMException("Cancelled", "AbortError");
  }
  return {
    terminate,
    async recognize(canvas, onProgress) {
      progress = onProgress;
      const { data } = await worker.recognize(
        canvas.toBuffer("image/png"),
        {},
        { text: true, blocks: true },
      );
      return {
        text: data.text,
        confidence: data.confidence,
        words:
          data.blocks?.flatMap((block) =>
            block.paragraphs.flatMap((paragraph) =>
              paragraph.lines.flatMap((line) =>
                line.words.map(({ text, bbox, confidence }) => ({
                  text,
                  bbox,
                  confidence,
                })),
              ),
            ),
          ) ?? [],
      };
    },
  };
}
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (name) =>
      name === "../pdfjs"
        ? { loadPdfjs: library }
        : name === "./ocr-engine"
          ? { createOcrWorker }
          : name.startsWith(".")
            ? load(path.resolve(path.dirname(file), name + ".ts"))
            : require(name),
    module,
    module.exports,
  );
  return module.exports;
}
const { detectTableGrids } = load("src/lib/engines/pdf-table-layout.ts");
const { createExcelFromPdfTables, extractPdfTables } = load(
  "src/lib/engines/pdf-table-engine.ts",
);
const file = (bytes) =>
  new File([bytes], "tables.pdf", { type: "application/pdf" });
function evidence(name, bytes) {
  if (process.env.TABLE_QA_DIR) {
    fs.mkdirSync(process.env.TABLE_QA_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(process.env.TABLE_QA_DIR, name),
      Buffer.from(bytes),
    );
  }
}
async function workbook(result, name) {
  const bytes = new Uint8Array(await result.blob.arrayBuffer());
  if (name) evidence(name, bytes);
  return XLSX.read(bytes, { type: "array" });
}
function rows(wb, sheet = wb.SheetNames[0]) {
  return XLSX.utils.sheet_to_json(wb.Sheets[sheet], {
    header: 1,
    raw: true,
    defval: "",
  });
}
const firstTable = [
  ["Item name", "Code", "Amount"],
  ["Water bottle", "0012", "1,250.50"],
  ["=SUM(A1:A2)", "0007", "-8.00"],
];
const secondTable = [
  ["Region", "Units"],
  ["NW", "15"],
  ["SE", "20"],
];
test("existing bank-statement task retains dates, signs, description columns and balances", async () => {
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica),
    page = pdf.addPage([595, 842]);
  const expected = [
    ["Date", "Description", "Debit", "Credit", "Balance"],
    ["2026-09-01", "Opening balance", "0.00", "0.00", "1000.00"],
    ["2026-09-02", "Sample purchase", "-125.50", "0.00", "874.50"],
    ["2026-09-03", "Sample deposit", "0.00", "250.00", "1124.50"],
  ];
  expected.forEach((row, i) =>
    row.forEach((text, c) =>
      page.drawText(text, {
        x: [35, 135, 315, 395, 475][c],
        y: 730 - i * 28,
        size: 10,
        font,
      }),
    ),
  );
  const bytes = await pdf.save();
  evidence("statement.pdf", bytes);
  const result = await createExcelFromPdfTables(file(bytes), "multiple-sheets");
  assert.deepEqual(rows(await workbook(result, "statement.xlsx")), expected);
  assert.equal(result.pageReports[0].ocr, false);
});
async function fixture() {
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica);
  const first = pdf.addPage([700, 500]);
  first.setCropBox(20, 30, 600, 400);
  first.setRotation(degrees(90));
  for (const [i, row] of firstTable.entries())
    row.forEach((text, c) =>
      first.drawText(text, {
        x:
          c === 0 ? 40 : c === 1 ? 300 : 560 - font.widthOfTextAtSize(text, 14),
        y: 400 - i * 35,
        size: 14,
        font,
      }),
    );
  for (const [i, row] of secondTable.entries())
    row.forEach((text, c) =>
      first.drawText(text, {
        x: c === 0 ? 40 : 300,
        y: 200 - i * 35,
        size: 14,
        font,
      }),
    );
  first.drawText("HIDDEN", { x: 650, y: 485, size: 12, font });
  const canvas = createCanvas(1200, 800),
    ctx = canvas.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, 1200, 800);
  ctx.fillStyle = "black";
  ctx.font = "32px Arial";
  for (const [i, row] of [
    ["Item", "Code", "Amount"],
    ["Notebook", "0012", "1250.50"],
    ["Pencil", "0007", "8.00"],
  ].entries())
    row.forEach((text, c) =>
      ctx.fillText(text, [50, 600, 900][c], 80 + i * 90),
    );
  const png = canvas.toBuffer("image/png"),
    image = await pdf.embedPng(png),
    scan = pdf.addPage([600, 420]);
  scan.drawImage(image, { x: 0, y: 20, width: 600, height: 400 });
  scan.drawText("Scanned attachment", { x: 20, y: 5, size: 8, font });
  const prose = pdf.addPage([600, 420]);
  prose.drawText("This page contains ordinary prose.", {
    x: 30,
    y: 360,
    size: 18,
    font,
  });
  prose.drawText("There is no table on this page.", {
    x: 30,
    y: 330,
    size: 18,
    font,
  });
  const bytes = await pdf.save();
  evidence("source.pdf", bytes);
  evidence("scan.png", png);
  return bytes;
}
test("table inference keeps adjacent words and right-aligned values together, separates tables and rejects prose", () => {
  const input = [],
    add = (text, x, y, width, rtl = false) =>
      input.push({ text, x, y, width, height: 12, rtl });
  add("Item", 10, 10, 25);
  add("name", 39, 10, 30);
  add("Amount", 250, 10, 50);
  add("Water", 10, 35, 30);
  add("bottle", 44, 35, 30);
  add("1,250.50", 242, 35, 58);
  add("Pencil", 10, 60, 40);
  add("-8.00", 264, 60, 36);
  add("Region", 10, 200, 40);
  add("Units", 250, 200, 30);
  add("NW", 10, 225, 15);
  add("15", 250, 225, 15);
  assert.deepEqual(detectTableGrids(input), [
    [
      ["Item name", "Amount"],
      ["Water bottle", "1,250.50"],
      ["Pencil", "-8.00"],
    ],
    [
      ["Region", "Units"],
      ["NW", "15"],
    ],
  ]);
  assert.deepEqual(
    detectTableGrids([
      {
        text: "A paragraph with no columns",
        x: 0,
        y: 0,
        width: 200,
        height: 12,
      },
      { text: "Another paragraph", x: 0, y: 24, width: 140, height: 12 },
    ]),
    [],
  );
  assert.throws(() => detectTableGrids(Array(100001).fill({})), /too many/);
});
test("RTL cells keep word order and CJK adjacent tokens gain no unwanted spaces", () => {
  const input = [];
  for (let row = 0; row < 2; row++) {
    input.push(
      { text: "عالم", x: 10, y: row * 30, width: 25, height: 12, rtl: true },
      { text: "مرحبا", x: 38, y: row * 30, width: 30, height: 12, rtl: true },
      { text: "合", x: 200, y: row * 30, width: 12, height: 12 },
      { text: "計", x: 214, y: row * 30, width: 12, height: 12 },
    );
  }
  assert.deepEqual(detectTableGrids(input), [
    [
      ["مرحبا عالم", "合計"],
      ["مرحبا عالم", "合計"],
    ],
  ]);
});
test("sparse wide tables are bounded before allocating the full worksheet grid", () => {
  const input = [];
  for (let row = 0; row < 4000; row++) {
    const count = row < 2 || row === 3999 ? 256 : 1;
    for (let column = 0; column < count; column++)
      input.push({
        text: "x",
        x: column * 10,
        y: row * 10,
        width: 1,
        height: 1,
      });
  }
  assert.throws(() => detectTableGrids(input), /one million cells/);
});
test("native tables honor CropBox and rotation, preserve leading zeros and formula-like strings, and split sheets by table", async () => {
  const result = await createExcelFromPdfTables(
    file(await fixture()),
    "multiple-sheets",
    undefined,
    { mode: "text", pages: "1", languages: [] },
  );
  const wb = await workbook(result, "native.xlsx");
  assert.deepEqual(wb.SheetNames, ["Page 1 Table 1", "Page 1 Table 2"]);
  assert.deepEqual(rows(wb), firstTable);
  assert.deepEqual(rows(wb, wb.SheetNames[1]), secondTable);
  assert.equal(wb.Sheets[wb.SheetNames[0]].A3.f, undefined);
  assert.equal(wb.Sheets[wb.SheetNames[0]].B2.t, "s");
  assert.equal(result.sourcePages, 3);
  assert.equal(result.tablePageCount, 1);
  assert.equal(result.totalRows, 6);
  const scaled = await PDFDocument.load(await fixture());
  scaled.getPage(0).node.set(PDFName.of("UserUnit"), PDFNumber.of(2));
  const doubled = await extractPdfTables(file(await scaled.save()), undefined, {
    mode: "text",
    pages: "1",
  });
  assert.deepEqual(doubled.tables[0].rows, firstTable);
});
test("Auto uses real local OCR even with a selectable caption and reports the page without a table", async () => {
  const result = await createExcelFromPdfTables(
    file(await fixture()),
    "multiple-sheets",
    undefined,
    { languages: ["eng"] },
  );
  const wb = await workbook(result, "auto.xlsx");
  assert.deepEqual(wb.SheetNames, [
    "Page 1 Table 1",
    "Page 1 Table 2",
    "Page 2",
  ]);
  assert.deepEqual(rows(wb, "Page 2"), [
    ["Item", "Code", "Amount"],
    ["Notebook", "0012", "1250.50"],
    ["Pencil", "0007", "8.00"],
  ]);
  assert.deepEqual(
    result.pageReports.map((p) => [p.page, p.tables, p.ocr]),
    [
      [1, 2, false],
      [2, 1, true],
      [3, 0, true],
    ],
  );
  assert.equal(starts, stops);
  evidence("auto-report.json", JSON.stringify(result.pageReports, null, 2));
});
test("Free OCR and one-sheet output retain source/table labels while No OCR reports a scan honestly", async () => {
  const bytes = await fixture();
  const result = await createExcelFromPdfTables(
    file(bytes),
    "one-sheet",
    undefined,
    { mode: "ocr", pages: "2", languages: ["eng"] },
  );
  const wb = await workbook(result, "ocr.xlsx");
  assert.equal(wb.SheetNames.length, 1);
  assert.equal(rows(wb)[1][1], "0012");
  assert.equal(result.pageReports[0].ocr, true);
  const combined = await createExcelFromPdfTables(
    file(bytes),
    "one-sheet",
    undefined,
    { mode: "text", pages: "1" },
  );
  const single = rows(await workbook(combined, "single.xlsx"));
  assert.equal(single[0][0], "Page 1 · Table 1");
  assert.equal(single[5][0], "Page 1 · Table 2");
  await assert.rejects(
    createExcelFromPdfTables(file(bytes), "one-sheet", undefined, {
      mode: "text",
      pages: "2",
    }),
    /No aligned tables/,
  );
});
test("Hindi scan uses the selected bundled language model and preserves recognized Unicode in XLSX", async () => {
  GlobalFonts.registerFromPath(
    path.resolve("public/fonts/NotoSansDevanagari-Regular.ttf"),
    "TableHindi",
  );
  const canvas = createCanvas(1500, 900),
    ctx = canvas.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, 1500, 900);
  ctx.fillStyle = "black";
  ctx.font = "42px TableHindi";
  const expected = [
    ["नाम", "संख्या", "मूल्य"],
    ["किताब", "12", "250"],
    ["पानी", "24", "100"],
  ];
  expected.forEach((row, i) =>
    row.forEach((text, c) =>
      ctx.fillText(text, [60, 660, 1150][c], 120 + i * 140),
    ),
  );
  const png = canvas.toBuffer("image/png"),
    pdf = await PDFDocument.create(),
    img = await pdf.embedPng(png);
  pdf
    .addPage([750, 450])
    .drawImage(img, { x: 0, y: 0, width: 750, height: 450 });
  const bytes = await pdf.save();
  evidence("hindi.pdf", bytes);
  evidence("hindi.png", png);
  const result = await createExcelFromPdfTables(
    file(bytes),
    "multiple-sheets",
    undefined,
    { mode: "ocr", languages: ["hin", "eng"], dpi: 300 },
  );
  assert.deepEqual(rows(await workbook(result, "hindi.xlsx")), expected);
  assert.equal(starts, stops);
  const hindiOnly = await extractPdfTables(file(bytes), undefined, {
    mode: "ocr",
    languages: ["hin"],
    dpi: 150,
  });
  assert.ok(
    hindiOnly.pageReports[0].uncertainWords > 0,
    "per-word uncertainty must survive a high page average",
  );
});
test("size, language, pages, unreadable files and cancellation produce no workbook; retry works", async () => {
  const bytes = await fixture();
  await assert.rejects(
    extractPdfTables(new File([], "empty.pdf")),
    /non-empty/,
  );
  await assert.rejects(extractPdfTables({ size: 101 * 1024 * 1024 }), /100MB/);
  await assert.rejects(
    extractPdfTables(file(bytes), undefined, { languages: [] }),
    /one to three/,
  );
  await assert.rejects(
    extractPdfTables(file(bytes), undefined, { pages: "4" }),
    /between 1 and 3/,
  );
  await assert.rejects(
    extractPdfTables(file(bytes), undefined, { dpi: 600 }),
    /150 or 300/,
  );
  await assert.rejects(
    extractPdfTables(file(Buffer.from("%PDF-1.7\ninvalid"))),
    /could not be read/,
  );
  const before = new AbortController();
  before.abort();
  await assert.rejects(
    extractPdfTables(file(bytes), undefined, { signal: before.signal }),
    { name: "AbortError" },
  );
  const during = new AbortController();
  await assert.rejects(
    extractPdfTables(file(bytes), () => during.abort(), {
      mode: "text",
      signal: during.signal,
    }),
    { name: "AbortError" },
  );
  const retry = await createExcelFromPdfTables(
    file(bytes),
    "one-sheet",
    undefined,
    { mode: "text", pages: "1" },
  );
  assert.equal(retry.tables.length, 2);
  assert.equal(starts, stops);
});
