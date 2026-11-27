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
let ocrFailure = false;
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
  if (ocrFailure) throw new Error("Synthetic model-load failure");
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
  ocrSlideText,
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
  imageFormat: "png",
};
const entries = async (result) => {
  const zip = unzipSync(new Uint8Array(await result.blob.arrayBuffer()), {
    filter(entry) {
      if (/^ppt\/(slides\/slide\d+\.xml|media\/.+\.(jpeg|png))$/.test(entry.name))
        assert.equal(entry.compression, 8, `${entry.name}: use compressed Office entries for Quick Look`);
      return true;
    },
  });
  if (result.output === "appearance") assertAppearanceLayers(zip);
  return zip;
};
const xml = (zip, path) => strFromU8(zip[path]);
function pageArtwork(zip, number) {
  const relations = xml(zip, `ppt/slides/_rels/slide${number}.xml.rels`);
  const target = relations.match(/Type="[^"]+\/slideLayout" Target="([^"]+)"/)[1];
  const part = path.posix.normalize('ppt/slides/' + target);
  return { part, xml: xml(zip, part), relations: xml(zip, path.posix.dirname(part) + '/_rels/' + path.posix.basename(part) + '.rels') };
}
function assertAppearanceLayers(zip) {
  const layouts = new Set(), imageNames = new Set(), drawingIds = new Set(), imageIds = new Set();
  for (const name of Object.keys(zip).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))) {
    const slide = xml(zip, name), number = Number(name.match(/slide(\d+)/)[1]);
    assert.doesNotMatch(slide, /<p:(sp|pic|grpSp|graphicFrame)>|<a:t>/, `${name}: page artwork belongs to its own layout, text to notes`);
    const artwork = pageArtwork(zip, number);
    assert.ok(!layouts.has(artwork.part), `${name}: each page needs its own picture-bearing layout`);
    layouts.add(artwork.part);
    const layers = [...artwork.xml.matchAll(/<p:(sp|pic|grpSp|graphicFrame)>(.*?)<\/p:\1>/gs)];
    assert.equal(layers.length, 1, `${name}: exactly one rendered page image`);
    assert.equal(layers[0][1], "pic");
    assert.doesNotMatch(artwork.xml, /<a:t>/);
    const imageName = layers[0][2].match(/<p:cNvPr[^>]+name="([^"]+)"/)[1];
    assert.ok(!imageNames.has(imageName)); imageNames.add(imageName);
    const drawingId = layers[0][2].match(/<p:cNvPr id="(\d+)"/)[1];
    assert.ok(!drawingIds.has(drawingId)); drawingIds.add(drawingId);
    const imageId = artwork.xml.match(/<a:blip r:embed="([^"]+)"/)[1];
    assert.ok(!imageIds.has(imageId)); imageIds.add(imageId);
    assert.ok(artwork.relations.includes(`Id="${imageId}"`));
    assert.ok(xml(zip, '[Content_Types].xml').includes(`PartName="/${artwork.part}"`));
    assert.ok(xml(zip, 'ppt/slideMasters/_rels/slideMaster1.xml.rels').includes(`Target="../slideLayouts/${path.posix.basename(artwork.part)}"`));
  }
}

const notes = (zip, page) => xml(zip, `ppt/notesSlides/notesSlide${page}.xml`);

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
  // Use the same OCR fixture glyphs on macOS and font-minimal Linux runners.
  assert.ok(GlobalFonts.registerFromPath(
    path.resolve("public/fonts/NotoSans-Regular.ttf"),
    "PptxLatin",
  ));
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

test("appearance output retains crop, all four rotations, note text and exact raster pixels", async () => {
  const result = await convertPdfToPowerpoint(file(nativePdf), options),
    zip = await entries(result);
  assert.equal(result.reports.length, 4);
  assert.equal(result.sourcePages, 4);
  assert.match(xml(zip, "ppt/presentation.xml"), /cx="4572000" cy="5588000"/);
  const task = (await library()).getDocument({ data: nativePdf.slice() });
  const pdf = await task.promise;
  for (let i = 0; i < 4; i++) {
    const slide = pageArtwork(zip, i + 1).xml;
    assert.match(notes(zip, i + 1), new RegExp("EDITABLE ALPHA " + i * 90));
    assert.doesNotMatch(notes(zip, i + 1), /HIDDEN OUTSIDE/);
    assert.match(slide, /<p:pic>/);
    const rel = pageArtwork(zip, i + 1).relations;
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
  assert.match(pageArtwork(zip, 1).xml, /<p:pic>/);
});

test("strict limits, owned errors and resource cleanup reject malformed/oversized input", async () => {
  for (const change of [
    { pages: "1-0" },
    { pages: "6" },
    { dpi: 999 },
    { imageFormat: "webp" },
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


for (const format of ["png", "jpeg"]) test(`48-page ${format} storyboard preserves every distinct picture, caption and page order`, async () => {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < 48; index++) {
    const page = pdf.addPage(index % 3 === 0 ? [480, 640] : [640, 360]);
    page.drawText(`STORYBOARD PAGE ${index + 1}`, { x: 25, y: page.getHeight() - 35, size: 20 });
    for (let picture = 0; picture < 3; picture++) {
      const canvas = createCanvas(100, 80), context = canvas.getContext("2d");
      context.fillStyle = `hsl(${(index * 37 + picture * 90) % 360}, 75%, 55%)`;
      context.fillRect(0, 0, 100, 80);
      context.fillStyle = "#111";
      context.font = "18px sans-serif";
      context.fillText(`${index + 1}:${picture + 1}`, 10, 45);
      const image = await pdf.embedPng(canvas.toBuffer("image/png"));
      page.drawImage(image, { x: 25 + picture * 140, y: 90, width: 120, height: 96 });
      page.drawText(`Frame ${index + 1}.${picture + 1}`, { x: 25 + picture * 140, y: 65, size: 12 });
    }
  }
  const bytes = await pdf.save();
  evidence("storyboard-48.pdf", bytes);
  const result = await convertPdfToPowerpoint(file(bytes), { ...options, layout: "wide", imageFormat: format });
  const zip = await entries(result);
  assert.equal(result.reports.length, 48);
  assert.deepEqual(result.reports.map(row => row.page), Array.from({ length: 48 }, (_, i) => i + 1));
  const task = (await library()).getDocument({ data: bytes.slice() });
  const source = await task.promise;
  try {
    for (let i = 0; i < 48; i++) {
      const slide = pageArtwork(zip, i + 1).xml;
      assert.match(notes(zip, i + 1), new RegExp(`STORYBOARD PAGE ${i + 1}\\r?\\n`));
      const rel = pageArtwork(zip, i + 1).relations;
      const target = rel.match(/Target="\.\.\/media\/([^"]+)"/)[1];
      const image = await require("@napi-rs/canvas").loadImage(Buffer.from(zip["ppt/media/" + target]));
      const actual = createCanvas(image.width, image.height);
      actual.getContext("2d").drawImage(image, 0, 0);
      const page = await source.getPage(i + 1), view = page.getViewport({ scale: 150 / 72 });
      const expected = createCanvas(Math.ceil(view.width), Math.ceil(view.height));
      await page.render({ canvas: expected, viewport: view, background: "#fff" }).promise;
      assert.equal(image.width, expected.width);
      assert.equal(image.height, expected.height);
      const actualPixels = actual.getContext("2d").getImageData(0, 0, image.width, image.height).data;
      const expectedPixels = expected.getContext("2d").getImageData(0, 0, expected.width, expected.height).data;
      if (format === "png") {
        assert.deepEqual(Buffer.from(actualPixels), Buffer.from(expectedPixels), `page ${i + 1}`);
      } else {
        let error = 0;
        for (let p = 0; p < actualPixels.length; p++) error += Math.abs(actualPixels[p] - expectedPixels[p]);
        assert.ok(error / actualPixels.length < 2, `JPEG page ${i + 1} differs from source: ${error / actualPixels.length}`);
        const expectedJpeg = await require("@napi-rs/canvas").loadImage(expected.toDataURL("image/jpeg", 0.98));
        const encoded = createCanvas(expected.width, expected.height);
        encoded.getContext("2d").drawImage(expectedJpeg, 0, 0);
        assert.deepEqual(Buffer.from(actualPixels), Buffer.from(encoded.getContext("2d").getImageData(0, 0, encoded.width, encoded.height).data), `JPEG page ${i + 1} must match its own source page`);
      }
      page.cleanup();
    }
  } finally { await task.destroy(); }
  evidence(`storyboard-48-${format}.pptx`, await result.blob.arrayBuffer());
});

test("appearance keeps text-heavy pages even when the optional search layer exceeds its limit", async () => {
  const pdf = await PDFDocument.create(), page = pdf.addPage([612, 792]);
  for (let i = 0; i < 10001; i++) {
    page.drawText(String(i), { x: 10 + (i % 100) * 5.8, y: 10 + Math.floor(i / 100) * 7.5, size: 2 });
  }
  const bytes = await pdf.save();
  const result = await convertPdfToPowerpoint(file(bytes), options);
  assert.equal(result.reports.length, 1);
  assert.equal(result.reports[0].textLayerOmitted, true);
  const zip = await entries(result);
  assert.match(pageArtwork(zip, 1).xml, /<p:pic>/);
  assert.equal(result.reports[0].textBoxes, 0);
  await assert.rejects(convertPdfToPowerpoint(file(bytes), { ...options, output: "editable" }), /10,000 editable text boxes/);
});


test("appearance defaults to high-quality JPEG for reliable presentation previews", async () => {
  const result = await convertPdfToPowerpoint(file(nativePdf), {
    output: "appearance", recognition: "text", layout: "source", dpi: 150,
  });
  assert.equal(result.imageFormat, "jpeg");
  const zip = await entries(result);
  for (let i = 1; i <= 4; i++) {
    const rel = pageArtwork(zip, i).relations;
    const target = rel.match(/Target="\.\.\/media\/([^"]+)"/)[1];
    assert.match(target, /\.jpe?g$/);
    assert.equal(zip['ppt/media/' + target][0], 0xff);
    assert.equal(zip['ppt/media/' + target][1], 0xd8);
    const image = await require("@napi-rs/canvas").loadImage(Buffer.from(zip['ppt/media/' + target]));
    assert.ok(image.width > 0 && image.height > 0);
    assert.match(notes(zip, i), new RegExp('EDITABLE ALPHA ' + (i - 1) * 90));
  }
});

test("appearance keeps cropped text in notes without adding anything in slide margins", async () => {
  const pdf = await PDFDocument.create(), page = pdf.addPage([300, 500]);
  page.drawText("CROPPED TITLE OVERFLOW", { x: -25, y: 430, size: 60 });
  page.drawText("KEEP ORIGINAL PAGE", { x: 20, y: 200, size: 16 });
  const bytes = await pdf.save();
  for (const layout of ["source", "wide", "standard"]) {
    const result = await convertPdfToPowerpoint(file(bytes), { ...options, layout, imageFormat: "jpeg" });
    const zip = await entries(result);
    assert.match(notes(zip, 1), /CROPPED/);
    evidence(`viewer-overflow-${layout}.pptx`, await result.blob.arrayBuffer());
  }
  evidence("viewer-overflow.pdf", bytes);
});


test("appearance preserves later pages after the document-wide optional text limit", async () => {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < 6; index++) {
    const page = pdf.addPage([612, 792]);
    for (let i = 0; i < 9000; i++) page.drawText(String(i), {
      x: 10 + (i % 100) * 5.8, y: 10 + Math.floor(i / 100) * 7.5, size: 2,
    });
  }
  const result = await convertPdfToPowerpoint(file(await pdf.save()), options);
  const zip = await entries(result);
  assert.equal(result.reports.length, 6);
  assert.equal(result.reports[5].textLayerOmitted, true);
  assert.equal(result.reports[5].textBoxes, 0);
  assert.ok(result.reports.slice(0, 5).every(page => page.textBoxes > 0 && !page.textLayerOmitted));
  for (let i = 1; i <= 6; i++) assert.match(pageArtwork(zip, i).xml, /<p:pic>/);
});

test("OCR guesses cannot replace or duplicate original text, including rotated text", () => {
  const native = [{ text: "Original 0186", x: 10, y: 20, width: 100, height: 20, fontSize: 16, rotate: 0, rtl: false }];
  const recognized = { text: "Wrong OI86 Hola", confidence: 85, words: [
    { text: "Wrong OI86", bbox: { x0: 12, y0: 22, x1: 100, y1: 38 }, line: 0 },
    { text: "Hola", bbox: { x0: 12, y0: 100, x1: 60, y1: 120 }, line: 1 },
  ] };
  assert.deepEqual(ocrSlideText(recognized, 1, 1, ["spa"], native).map(b => b.text), ["Hola"]);
  const rotated = [{ ...native[0], rotate: 90 }];
  assert.equal(ocrSlideText({ text: "Wrong", confidence: 90, words: [
    { text: "Wrong", bbox: { x0: 55, y0: 0, x1: 65, y1: 60 } },
  ] }, 1, 1, ["eng"], rotated).length, 0);
});

test("unavailable OCR preserves every original page and its native text with a failure report", async () => {
  ocrFailure = true;
  try {
    const result = await convertPdfToPowerpoint(file(mixedPdf), { ...options, recognition: "ocr", languages: ["ara"] });
    const zip = await entries(result);
    assert.equal(result.reports.length, 4);
    assert.match(notes(zip, 1), /EDITABLE ALPHA 90/);
    for (let i = 1; i <= 4; i++) {
      assert.match(pageArtwork(zip, i).xml, /<p:pic>/);
      assert.equal(result.reports[i - 1].ocrFailed, true);
      assert.equal(result.reports[i - 1].ocr, false);
    }
    assert.equal(opened, destroyed);
  } finally { ocrFailure = false; }
});

test("forced OCR keeps native text authoritative and preserves Spanish scan artwork", async () => {
  const pdf = await PDFDocument.create(), page = pdf.addPage([600, 400]);
  page.drawText("NATIVE 0186 O0Il", { x: 40, y: 350, size: 10 });
  const canvas = createCanvas(1200, 400), c = canvas.getContext("2d");
  c.fillStyle = "white"; c.fillRect(0, 0, 1200, 400);
  c.fillStyle = "black"; c.font = "56px PptxLatin";
  c.fillText("Hola mundo", 80, 120);
  c.fillText("Precio 250 euros", 80, 230);
  const image = await pdf.embedPng(canvas.toBuffer("image/png"));
  page.drawImage(image, { x: 0, y: 70, width: 600, height: 200 });
  const bytes = await pdf.save();
  const result = await convertPdfToPowerpoint(file(bytes), { ...options, recognition: "ocr", languages: ["spa", "eng"] });
  const zip = await entries(result), slide = notes(zip, 1);
  assert.match(slide, /NATIVE 0186 O0Il/);
  assert.match(slide, /Hola mundo/);
  assert.match(slide, /Precio 250 euros/);
  assert.equal((slide.match(/NATIVE/g) || []).length, 1);
  assert.match(pageArtwork(zip, 1).xml, /<p:pic>/);
  assert.equal(result.reports[0].ocr, true);
  assert.equal(started, terminated);
  evidence("spanish-captioned-scan.pdf", bytes);
  evidence("spanish-captioned-scan.pptx", await result.blob.arrayBuffer());
});

test("Hindi and Arabic OCR keeps original artwork and original-language notes", async () => {
  const result = await convertPdfToPowerpoint(file(mixedPdf), { ...options, recognition: "auto", languages: ["hin", "ara", "eng"], dpi: 300 });
  const zip = await entries(result);
  assert.match(notes(zip, 2), /नमस्ते दुनिया/);
  assert.match(notes(zip, 3), /مرحبا بالعالم/);
  for (let i = 1; i <= 4; i++) assert.match(pageArtwork(zip, i).xml, /<p:pic>/);
  evidence("appearance-multilingual.pptx", await result.blob.arrayBuffer());
});

test("owner-provided PDF keeps all page images, text and dimensions", { skip: !process.env.PDF_PPTX_SOURCE }, async () => {
  const bytes = fs.readFileSync(process.env.PDF_PPTX_SOURCE);
  const result = await convertPdfToPowerpoint(new File([bytes], path.basename(process.env.PDF_PPTX_SOURCE)), {
    ...options, dpi: Number(process.env.PDF_PPTX_DPI || 300), imageFormat: "jpeg",
  });
  const zip = await entries(result);
  const task = (await library()).getDocument({ data: new Uint8Array(bytes) });
  const source = await task.promise;
  assert.equal(result.reports.length, source.numPages);
  const images = new Set();
  try {
    for (let i = 1; i <= source.numPages; i++) {
      const slide = pageArtwork(zip, i).xml;
      assert.match(slide, /<p:pic>/);
      assert.equal(result.reports[i - 1].ocr, false);
      assert.ok(notes(zip, i).includes(`Source PDF page ${i}.`));
      const rel = pageArtwork(zip, i).relations;
      const target = rel.match(/Target="\.\.\/media\/([^"]+)"/)[1];
      const page = await source.getPage(i), viewport = page.getViewport({ scale: Number(process.env.PDF_PPTX_DPI || 300) / 72 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvas, viewport, background: "#fff" }).promise;
      const expected = Buffer.from(canvas.toDataURL("image/jpeg", 0.98).split(",")[1], "base64");
      assert.deepEqual(Buffer.from(zip["ppt/media/" + target]), expected, `slide ${i} contains its own full source page`);
      const hash = require("node:crypto").createHash("sha256").update(expected).digest("hex");
      images.add(hash);
      page.cleanup();
    }
    const first = (await source.getPage(1)).getViewport({ scale: 1 });
    const size = xml(zip, "ppt/presentation.xml").match(/<p:sldSz cx="(\d+)" cy="(\d+)"/);
    assert.ok(Math.abs(Number(size[1]) / Number(size[2]) - first.width / first.height) < 0.00001);
  } finally { await task.destroy(); }
  evidence(path.basename(process.env.PDF_PPTX_SOURCE, ".pdf") + "-fixed.pptx", await result.blob.arrayBuffer());
  evidence("evlar-page-report.json", JSON.stringify(result.reports, null, 2));
});
