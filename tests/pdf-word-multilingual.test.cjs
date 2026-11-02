const test = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const ts = require("typescript"),
  { createWorker } = require("tesseract.js");
const { PDFDocument, degrees } = require("pdf-lib");
const {
  createCanvas,
  GlobalFonts,
  DOMMatrix,
  ImageData,
  Path2D,
} = require("@napi-rs/canvas");
const { unzipSync, strFromU8 } = require("fflate");
Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
global.document = {
  createElement(type) {
    assert.equal(type, "canvas");
    return createCanvas(1, 1);
  },
};
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "pdfpilot-word-"));
test.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
let pdfjs,
  started = 0,
  terminated = 0,
  opened = 0,
  destroyed = 0;
async function library() {
  pdfjs ??= await import("pdfjs-dist/legacy/build/pdf.mjs");
  return {
    ...pdfjs,
    getDocument(options) {
      const root = path.dirname(require.resolve("pdfjs-dist/package.json"));
      const task = pdfjs.getDocument({
        ...options,
        standardFontDataUrl: root + "/standard_fonts/",
        cMapUrl: root + "/cmaps/",
        wasmUrl: root + "/wasm/",
        useSystemFonts: false,
      });
      opened++;
      const destroy = task.destroy.bind(task);
      let closed = false;
      task.destroy = async () => {
        if (!closed) {
          closed = true;
          destroyed++;
        }
        return destroy();
      };
      return task;
    },
  };
}
async function createOcrWorker(signal, { languages, segmentation }) {
  let report;
  const worker = await createWorker(languages, 1, {
    langPath: path.resolve("public/tesseract/lang-v1"),
    cachePath: scratch,
    logger(message) {
      if (message.status === "recognizing text")
        report?.(message.progress * 100);
    },
  });
  started++;
  if (segmentation === "sparse")
    await worker.setParameters({
      tessedit_pageseg_mode: require("tesseract.js").PSM.SPARSE_TEXT,
    });
  let closed = false;
  const terminate = async () => {
    if (!closed) {
      closed = true;
      terminated++;
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
    async recognize(canvas, progress) {
      report = progress;
      const operation = worker.recognize(
        canvas.toBuffer("image/png"),
        {},
        { text: true, blocks: true },
      );
      let rejectAbort;
      const aborted = new Promise((_, reject) => {
        rejectAbort = () => reject(new DOMException("Cancelled", "AbortError"));
        signal?.addEventListener("abort", rejectAbort, { once: true });
      });
      try {
        const { data } = await Promise.race([operation, aborted]);
        return {
          text: data.text,
          confidence: data.confidence,
          words:
            data.blocks?.flatMap((block) =>
              block.paragraphs.flatMap((para) =>
                para.lines.flatMap((line) =>
                  line.words.map(({ text, bbox, confidence }) => ({
                    text,
                    bbox,
                    confidence,
                  })),
                ),
              ),
            ) ?? [],
        };
      } finally {
        signal?.removeEventListener("abort", rejectAbort);
      }
    },
  };
}
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  new Function("require", "module", "exports", source)(
    (name) =>
      name === "../pdfjs" || name === "./pdfjs"
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
const { convertPdfToWord, createWordFromPages } = load(
  "src/lib/engines/pdf-word-engine.ts",
);
const { extractPdfText } = load("src/lib/pdf-text-extraction.ts");
const { pdfDocumentInputError } = load(
  "src/lib/engines/conversion-input-errors.ts",
);
const file = (bytes) =>
  new File([bytes], "multilingual.pdf", { type: "application/pdf" });
function evidence(name, bytes) {
  if (process.env.WORD_QA_DIR) {
    fs.mkdirSync(process.env.WORD_QA_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(process.env.WORD_QA_DIR, name),
      Buffer.from(bytes),
    );
  }
}
async function xml(blob, name) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (name) evidence(name, bytes);
  const entries = unzipSync(bytes);
  assert.equal(
    Object.keys(entries).some((key) => key.startsWith("word/media/")),
    false,
  );
  return strFromU8(entries["word/document.xml"]);
}
async function fixture() {
  GlobalFonts.registerFromPath(
    path.resolve("public/fonts/NotoSansDevanagari-Regular.ttf"),
    "WordHindi",
  );
  GlobalFonts.registerFromPath(
    path.resolve("public/fonts/NotoSansArabic-Regular.ttf"),
    "WordArabic",
  );
  const pdf = await PDFDocument.create(),
    first = pdf.addPage([612, 792]);
  first.setCropBox(20, 30, 560, 730);
  first.setRotation(degrees(90));
  first.drawText("SELECTABLE COVER ALPHA", { x: 40, y: 650, size: 24 });
  first.drawText("HIDDEN OUTSIDE CROP", { x: 590, y: 775, size: 10 });
  const scans = [];
  for (const language of ["hin", "ara"]) {
    const canvas = createCanvas(1200, 650),
      context = canvas.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0, 0, 1200, 650);
    context.fillStyle = "black";
    context.font = `48px ${language === "hin" ? "WordHindi" : "WordArabic"}`;
    if (language === "ara") {
      context.direction = "rtl";
      context.textAlign = "right";
      context.fillText("مرحبا بالعالم", 1120, 150);
      context.fillText("المبلغ 250", 1120, 260);
    } else {
      context.fillText("नमस्ते दुनिया", 60, 150);
      context.fillText("कुल राशि 250", 60, 260);
    }
    const png = canvas.toBuffer("image/png"),
      image = await pdf.embedPng(png);
    scans.push(image);
    pdf
      .addPage([600, 325])
      .drawImage(image, { x: 0, y: 0, width: 600, height: 325 });
    evidence(language + ".png", png);
  }
  const caption = pdf.addPage([600, 350]);
  caption.drawImage(scans[0], { x: 0, y: 25, width: 600, height: 325 });
  caption.drawText("SELECTABLE CAPTION", { x: 30, y: 5, size: 10 });
  pdf.addPage([600, 350]);
  const bytes = await pdf.save();
  evidence("source.pdf", bytes);
  return bytes;
}
test("actual native extraction respects crop, native rotation and selected pages, then closes its PDF document", async () => {
  const pages = await extractPdfText(file(await fixture()), { pages: "1,4" });
  assert.deepEqual(
    pages.map((page) => page.pageNumber),
    [1, 4],
  );
  assert.equal(pages[0].sourcePages, 5);
  assert.match(pages[0].paragraphs.join(" "), /SELECTABLE COVER ALPHA/);
  assert.doesNotMatch(pages[0].paragraphs.join(" "), /HIDDEN/);
  assert.equal(pages[1].containsImages, true);
  assert.equal(opened, destroyed);
});
test("English/Hindi/Arabic Auto exports real editable text, page order, RTL paragraphs, caption-image warning and blank-page report", async () => {
  const result = await convertPdfToWord(file(await fixture()), {
    mode: "auto",
    languages: ["hin", "ara", "eng"],
    dpi: 300,
  });
  const document = await xml(result.blob, "auto.docx");
  evidence("auto-document.xml", document);
  evidence("auto-report.json", JSON.stringify(result.pageReports, null, 2));
  assert.match(document, /नमस्ते दुनिया/);
  assert.match(document, /कुल राशि 250/);
  assert.match(document, /مرحبا بالعالم/);
  assert.match(document, /المبلغ 250/);
  assert.ok(
    document.indexOf("SELECTABLE COVER ALPHA") < document.indexOf("नमस्ते"),
  );
  assert.ok(document.indexOf("नमस्ते") < document.indexOf("مرحبا"));
  assert.equal((document.match(/w:type="page"/g) ?? []).length, 4);
  const arabicParagraph = document.match(
    /<w:p>[^]*?مرحبا بالعالم[^]*?<\/w:p>/,
  )?.[0];
  assert.match(arabicParagraph, /<w:bidi\/>/);
  assert.match(arabicParagraph, /<w:rtl\/>/);
  assert.deepEqual(result.processedPages, [1, 2, 3, 4, 5]);
  assert.deepEqual(result.unrecognizedPages, [5]);
  assert.equal(result.sourcePages, 5);
  assert.equal(
    result.pageReports.find((page) => page.page === 4).imagesNotTranscribed,
    true,
  );
  assert.equal(started, terminated);
  assert.equal(opened, destroyed);
});
test("forced OCR recovers the captioned scan while selected-page DOCX has only the requested page", async () => {
  const result = await convertPdfToWord(file(await fixture()), {
    mode: "ocr",
    languages: ["hin", "eng"],
    pages: "4",
    dpi: 300,
  });
  const document = await xml(result.blob, "caption-ocr.docx");
  assert.match(document, /नमस्ते दुनिया/);
  assert.match(document, /SELECTABLE CAPTION/);
  assert.equal((document.match(/w:type="page"/g) ?? []).length, 0);
  assert.deepEqual(result.processedPages, [4]);
  assert.equal(result.sourcePages, 5);
  assert.equal(result.pageReports[0].imagesNotTranscribed, false);
});
test("No OCR, strict selection/language/size/geometry limits and unreadable PDFs fail clearly without an output", async () => {
  const bytes = await fixture();
  await assert.rejects(
    convertPdfToWord(file(bytes), { mode: "text", pages: "2" }),
    /No selectable text on page 2/,
  );
  for (const options of [
    { mode: "auto", pages: "6" },
    { mode: "ocr", languages: [] },
    { mode: "ocr", languages: ["eng", "hin", "ara", "fra"] },
    { mode: "ocr", dpi: 600 },
  ]) {
    await assert.rejects(convertPdfToWord(file(bytes), options), (error) => {
      assert.equal(pdfDocumentInputError(error), error.message);
      return true;
    });
  }
  await assert.rejects(
    convertPdfToWord(new File([], "empty.pdf"), { mode: "text" }),
    /non-empty/,
  );
  await assert.rejects(
    convertPdfToWord({ size: 101 * 1024 * 1024 }, { mode: "auto" }),
    /100MB/,
  );
  const big = await PDFDocument.create();
  big.addPage([5000, 5000]);
  await assert.rejects(
    convertPdfToWord(file(await big.save()), { mode: "ocr" }),
    /16-megapixel/,
  );
  const many = await PDFDocument.create();
  for (let i = 0; i < 201; i++)
    many.addPage([300, 400]).drawText("Page " + (i + 1));
  await assert.rejects(
    convertPdfToWord(file(await many.save()), { mode: "text" }),
    /200 pages/,
  );
  const last = await convertPdfToWord(file(await many.save()), {
    mode: "text",
    pages: "201",
  });
  assert.match(await xml(last.blob), /Page 201/);
  assert.equal(last.sourcePages, 201);
  await assert.rejects(
    convertPdfToWord(file(Buffer.from("%PDF-1.7\ninvalid")), { mode: "auto" }),
  );
  assert.equal(opened, destroyed);
  assert.equal(started, terminated);
});
test("abort during actual native extraction and OCR suppresses output, releases resources and permits a clean retry", async () => {
  const bytes = await fixture(),
    native = new AbortController();
  await assert.rejects(
    extractPdfText(file(bytes), {
      signal: native.signal,
      onProgress: () => native.abort(),
    }),
    { name: "AbortError" },
  );
  const recognition = new AbortController();
  const result = await convertPdfToWord(file(bytes), {
    mode: "ocr",
    pages: "2-3",
    languages: ["hin", "ara", "eng"],
    signal: recognition.signal,
    onProgress: (value) => {
      if (value > 24) recognition.abort();
    },
  });
  assert.equal(result, null);
  assert.equal(started, terminated);
  assert.equal(opened, destroyed);
  const retry = await convertPdfToWord(file(bytes), {
    mode: "text",
    pages: "1",
  });
  assert.match(await xml(retry.blob, "retry.docx"), /SELECTABLE COVER ALPHA/);
});
test("logical Hebrew/Arabic and mixed digits receive Word RTL properties while Latin paragraphs remain LTR", async () => {
  const document = await xml(
    await createWordFromPages([
      {
        pageNumber: 1,
        paragraphs: ["שלום עולם 125", "مرحبا بالعالم 250", "Latin 0012"],
        paragraphStyles: ["heading1", "body", "body"],
      },
    ]),
  );
  const paragraphs = document.match(/<w:p>[^]*?<\/w:p>/g);
  assert.match(paragraphs[0], /<w:bidi\/>/);
  assert.match(paragraphs[1], /<w:rtl\/>/);
  assert.match(paragraphs[2], /<w:bidi w:val="false"\/>/);
  assert.match(document, /שלום עולם 125/);
  assert.match(document, /مرحبا بالعالم 250/);
  assert.match(document, /Latin 0012/);
});
