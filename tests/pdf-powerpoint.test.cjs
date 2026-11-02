const test = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const ts = require("typescript"),
  { createWorker } = require("tesseract.js");
const { PDFDocument, degrees, PDFName, PDFNumber } = require("pdf-lib");
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
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "pdfpilot-pptx-"));
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
        let lineIndex = 0;
        return {
          text: data.text,
          confidence: data.confidence,
          words:
            data.blocks?.flatMap((block) =>
              block.paragraphs.flatMap((para) =>
                para.lines.flatMap((line) => {
                  const number = lineIndex++;
                  return line.words.map(({ text, bbox, confidence }) => ({
                    text,
                    bbox,
                    confidence,
                    line: number,
                  }));
                }),
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
const {
  convertPdfToPowerpoint,
  nativeSlideText,
  slideFit,
  pdfPowerpointError,
} = load("src/lib/engines/pdf-powerpoint-engine.ts");
const file = (bytes) =>
  new File([bytes], "slides-नमस्ते.pdf", { type: "application/pdf" });
const options = {
  output: "appearance",
  recognition: "text",
  layout: "source",
  dpi: 150,
};
const entries = async (result) =>
  unzipSync(new Uint8Array(await result.blob.arrayBuffer()));
const xml = (zip, path) => strFromU8(zip[path]);
function evidence(name, bytes) {
  if (process.env.PPTX_QA_DIR) {
    fs.mkdirSync(process.env.PPTX_QA_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(process.env.PPTX_QA_DIR, name),
      Buffer.from(bytes),
    );
  }
}
let nativePdf, mixedPdf;
test.before(async () => {
  const pdf = await PDFDocument.create();
  for (const rotation of [0, 90, 180, 270]) {
    const page = pdf.addPage([400, 500]);
    page.setCropBox(20, 30, 360, 440);
    page.setRotation(degrees(rotation));
    if (rotation === 180)
      page.node.set(PDFName.of("UserUnit"), PDFNumber.of(2));
    page.drawRectangle({
      x: 35,
      y: 60,
      width: 290,
      height: 330,
      color: require("pdf-lib").rgb(0.8, 0.9, 1),
    });
    page.drawText("EDITABLE ALPHA " + rotation, { x: 45, y: 410, size: 18 });
    page.drawText("HIDDEN OUTSIDE", { x: 25, y: 485, size: 8 });
    page.drawText("Total 250", { x: 55, y: 360, size: 14 });
  }
  nativePdf = await pdf.save();
  evidence("native-rotations.pdf", nativePdf);
  GlobalFonts.registerFromPath(
    path.resolve("public/fonts/NotoSansDevanagari-Regular.ttf"),
    "PptxHindi",
  );
  GlobalFonts.registerFromPath(
    path.resolve("public/fonts/NotoSansArabic-Regular.ttf"),
    "PptxArabic",
  );
  const mixed = await PDFDocument.create();
  const [cover] = await mixed.copyPages(pdf, [1]);
  mixed.addPage(cover);
  for (const language of ["hin", "ara"]) {
    const canvas = createCanvas(1200, 650),
      context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, 1200, 650);
    context.fillStyle = "#111";
    context.font = `48px ${language === "hin" ? "PptxHindi" : "PptxArabic"}`;
    if (language === "ara") {
      context.direction = "rtl";
      context.textAlign = "right";
    }
    context.fillText(
      language === "hin" ? "नमस्ते दुनिया" : "مرحبا بالعالم",
      language === "hin" ? 80 : 1120,
      140,
    );
    context.fillText(
      language === "hin" ? "कुल राशि 250" : "المبلغ 250",
      language === "hin" ? 80 : 1120,
      240,
    );
    const image = await mixed.embedPng(canvas.toBuffer("image/png")),
      page = mixed.addPage([600, 325]);
    page.drawImage(image, { x: 0, y: 0, width: 600, height: 325 });
    evidence(language + ".png", canvas.toBuffer("image/png"));
  }
  mixed.addPage([600, 325]);
  mixedPdf = await mixed.save();
  evidence("mixed-scans.pdf", mixedPdf);
  const long = await PDFDocument.create();
  for (let i = 0; i < 60; i++) {
    const [page] = await long.copyPages(mixed, [1]);
    long.addPage(page);
  }
  evidence("cancel-60.pdf", await long.save());
  evidence("invalid.pdf", Buffer.from("%PDF-1.7\ninvalid test"));
});

test("appearance output retains crop, all four rotations, searchable text and exact raster pixels", async () => {
  const result = await convertPdfToPowerpoint(file(nativePdf), options),
    zip = await entries(result);
  assert.equal(result.reports.length, 4);
  assert.equal(result.sourcePages, 4);
  assert.match(xml(zip, "ppt/presentation.xml"), /cx="4572000" cy="5588000"/);
  const task = (await library()).getDocument({ data: nativePdf.slice() });
  const pdf = await task.promise;
  for (let i = 0; i < 4; i++) {
    const slide = xml(zip, `ppt/slides/slide${i + 1}.xml`);
    assert.match(slide, new RegExp("EDITABLE ALPHA " + i * 90));
    assert.doesNotMatch(slide, /HIDDEN OUTSIDE/);
    assert.match(slide, /<p:pic>/);
    assert.match(slide, /<a:alpha val="0"/);
    if (i) assert.match(slide, new RegExp(`rot="${i * 90 * 60000}"`));
    const rel = xml(zip, `ppt/slides/_rels/slide${i + 1}.xml.rels`);
    const target = rel.match(/Target="\.\.\/media\/([^"]+)"/)[1];
    const actual = await require("@napi-rs/canvas").loadImage(
      Buffer.from(zip["ppt/media/" + target]),
    );
    const page = await pdf.getPage(i + 1),
      view = page.getViewport({ scale: 150 / 72 });
    const canvas = createCanvas(Math.ceil(view.width), Math.ceil(view.height));
    await page.render({ canvas, viewport: view, background: "#fff" }).promise;
    const decoded = createCanvas(actual.width, actual.height);
    decoded.getContext("2d").drawImage(actual, 0, 0);
    assert.deepEqual(
      Buffer.from(
        decoded.getContext("2d").getImageData(0, 0, actual.width, actual.height)
          .data,
      ),
      Buffer.from(
        canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height)
          .data,
      ),
    );
    page.cleanup();
  }
  await task.destroy();
  evidence("appearance.pptx", await result.blob.arrayBuffer());
});

test("editable slides have visible text objects without image replacements and fit selected rotated pages", async () => {
  const result = await convertPdfToPowerpoint(file(nativePdf), {
      ...options,
      output: "editable",
      layout: "wide",
      pages: "2,4",
    }),
    zip = await entries(result);
  assert.deepEqual(
    result.reports.map((row) => row.page),
    [2, 4],
  );
  assert.equal(result.filename, "slides-नमस्ते.pptx");
  assert.match(xml(zip, "ppt/presentation.xml"), /cx="12192000" cy="6858000"/);
  assert.equal(
    Object.keys(zip).filter(
      (name) => name.startsWith("ppt/media/") && !name.endsWith("/"),
    ).length,
    0,
  );
  for (let i = 0; i < 2; i++) {
    const slide = xml(zip, `ppt/slides/slide${i + 1}.xml`);
    assert.match(slide, new RegExp("EDITABLE ALPHA " + (i ? 270 : 90)));
    assert.doesNotMatch(slide, /<p:pic>|HIDDEN OUTSIDE/);
    assert.doesNotMatch(slide, /<a:alpha/);
    assert.match(slide, new RegExp(`rot="${(i ? 270 : 90) * 60000}"`));
  }
  evidence("editable-native.pptx", await result.blob.arrayBuffer());
});

test("free multilingual scan OCR creates editable Hindi and logical Arabic text with RTL and blank-page report", async () => {
  const result = await convertPdfToPowerpoint(file(mixedPdf), {
      ...options,
      output: "editable",
      recognition: "auto",
      languages: ["hin", "ara", "eng"],
      dpi: 300,
    }),
    zip = await entries(result);
  assert.match(xml(zip, "ppt/slides/slide1.xml"), /EDITABLE ALPHA 90/);
  assert.match(xml(zip, "ppt/slides/slide2.xml"), /नमस्ते दुनिया/);
  assert.match(xml(zip, "ppt/slides/slide2.xml"), /कुल राशि 250/);
  assert.match(xml(zip, "ppt/slides/slide3.xml"), /مرحبا بالعالم/);
  assert.match(xml(zip, "ppt/slides/slide3.xml"), /المبلغ 250/);
  assert.match(xml(zip, "ppt/slides/slide3.xml"), /rtl="1"/);
  assert.deepEqual(
    result.reports.map((row) => row.ocr),
    [false, true, true, true],
  );
  assert.equal(result.reports[3].textBoxes, 0);
  assert.equal(
    Object.keys(zip).filter(
      (name) => name.startsWith("ppt/media/") && !name.endsWith("/"),
    ).length,
    0,
  );
  assert.equal(started, terminated);
  evidence("editable-multilingual.pptx", await result.blob.arrayBuffer());
  evidence("report.json", JSON.stringify(result.reports, null, 2));
});

test("No OCR fails recoverably for editable scans; appearance still retains the page image", async () => {
  await assert.rejects(
    convertPdfToPowerpoint(file(mixedPdf), {
      ...options,
      output: "editable",
      pages: "2",
    }),
    /No selectable text on page 2/,
  );
  const result = await convertPdfToPowerpoint(file(mixedPdf), {
    ...options,
    pages: "2",
  });
  assert.equal(result.reports[0].textBoxes, 0);
  assert.equal(result.reports[0].imageTextNotRecognized, true);
  const zip = await entries(result);
  assert.match(xml(zip, "ppt/slides/slide1.xml"), /<p:pic>/);
});

test("strict limits, owned errors and resource cleanup reject malformed/oversized input", async () => {
  for (const change of [
    { pages: "1-0" },
    { pages: "6" },
    { dpi: 999 },
    { recognition: "fake" },
    { output: "fake" },
    { layout: "fake" },
    { recognition: "ocr", languages: [] },
  ])
    await assert.rejects(
      convertPdfToPowerpoint(file(nativePdf), { ...options, ...change }),
    );
  await assert.rejects(
    convertPdfToPowerpoint(new File([""], "empty.pdf"), options),
    /non-empty/,
  );
  const big = await PDFDocument.create();
  big.addPage([10000, 10000]);
  await assert.rejects(
    convertPdfToPowerpoint(file(await big.save()), {
      ...options,
      layout: "wide",
    }),
    /16-megapixel/,
  );
  const bad = file(Buffer.from("%PDF-1.7 invalid"));
  try {
    await convertPdfToPowerpoint(bad, options);
    assert.fail("expected rejection");
  } catch (error) {
    assert.match(pdfPowerpointError(error), /corrupted|Couldn't read/);
  }
  assert.equal(opened, destroyed);
});

test("active OCR cancellation closes workers/documents and a selected-page retry succeeds", async () => {
  const controller = new AbortController();
  await assert.rejects(
    convertPdfToPowerpoint(file(mixedPdf), {
      ...options,
      output: "editable",
      recognition: "ocr",
      languages: ["hin"],
      signal: controller.signal,
      onProgress: () => {
        controller.abort();
      },
    }),
    (error) => error.name === "AbortError",
  );
  const result = await convertPdfToPowerpoint(file(nativePdf), {
    ...options,
    output: "editable",
    pages: "1",
  });
  assert.equal(result.reports.length, 1);
  assert.equal(opened, destroyed);
  assert.equal(started, terminated);
});
