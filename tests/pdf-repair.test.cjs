const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const {
  PDFDocument,
  PDFName,
  PDFString,
  PDFDict,
  PDFRawStream,
  degrees,
} = require("pdf-lib");
const {
  createCanvas,
  DOMMatrix,
  ImageData,
  Path2D,
} = require("@napi-rs/canvas");
Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
global.document = {
  createElement(type) {
    assert.equal(type, "canvas");
    const canvas = createCanvas(1, 1);
    canvas.toBlob = (callback) =>
      callback(new Blob([canvas.toBuffer("image/png")], { type: "image/png" }));
    return canvas;
  },
};
let pdfjs;
async function library() {
  pdfjs ??= await import("pdfjs-dist/legacy/build/pdf.mjs");
  return {
    ...pdfjs,
    getDocument(options) {
      const root = path.dirname(require.resolve("pdfjs-dist/package.json"));
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
const mod = { exports: {} };
const code = ts.transpileModule(
  fs.readFileSync("src/lib/engines/pdf-repair-engine.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
new Function("require", "module", "exports", code)(
  (name) => (name === "../pdfjs" ? { loadPdfjs: library } : require(name)),
  mod,
  mod.exports,
);
const { repairPdf, repairPdfStructure, repairDimensions } = mod.exports;
const file = (bytes) =>
  new File([bytes], "damaged.pdf", { type: "application/pdf" });
const n = PDFName.of;
function evidence(name, bytes) {
  if (process.env.REPAIR_QA_DIR) {
    fs.mkdirSync(process.env.REPAIR_QA_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(process.env.REPAIR_QA_DIR, name),
      Buffer.from(bytes),
    );
  }
}
async function fixture() {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Preserve repair title");
  pdf.setAuthor("PDF Pilot");
  pdf.setCreationDate(new Date("2001-02-03T04:05:06Z"));
  const form = pdf.getForm();
  for (let index = 0; index < 4; index++) {
    const page = pdf.addPage([400, 500]);
    page.setCropBox(20, 30, 360, 440);
    page.setRotation(degrees(index * 90));
    page.drawText("Recovery page " + (index + 1), { x: 50, y: 420, size: 20 });
    const field = form.createTextField("value" + index);
    field.setText("KEEP " + (index + 1));
    field.addToPage(page, { x: 50, y: 250, width: 180, height: 30 });
  }
  const link = pdf.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [40, 60, 180, 80],
    Border: [0, 0, 0],
    A: { S: "URI", URI: PDFString.of("https://example.com/") },
  });
  pdf.getPage(0).node.Annots().push(pdf.context.register(link));
  const outlineRoot = pdf.context.obj({ Type: "Outlines", Count: 1 });
  const rootRef = pdf.context.register(outlineRoot);
  const bookmark = pdf.context.register(
    pdf.context.obj({
      Title: PDFString.of("Chapter one"),
      Parent: rootRef,
      Dest: [pdf.getPage(0).ref, "Fit"],
    }),
  );
  outlineRoot.set(n("First"), bookmark);
  outlineRoot.set(n("Last"), bookmark);
  pdf.catalog.set(n("Outlines"), rootRef);
  await pdf.attach(
    new TextEncoder().encode("Attachment survives"),
    "note.txt",
    { mimeType: "text/plain" },
  );
  const bytes = await pdf.save({ useObjectStreams: false });
  evidence("source.pdf", bytes);
  return bytes;
}
async function rendered(bytes) {
  const lib = await library(),
    task = lib.getDocument({ data: new Uint8Array(bytes), stopAtErrors: true }),
    pdf = await task.promise,
    result = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i),
        viewport = page.getViewport({ scale: 1 }),
        canvas = createCanvas(
          Math.ceil(viewport.width),
          Math.ceil(viewport.height),
        );
      await page.render({
        canvas,
        viewport,
        annotationMode: lib.AnnotationMode.ENABLE,
        background: "white",
      }).promise;
      result.push(canvas.toBuffer("image/png"));
      page.cleanup();
    }
    return result;
  } finally {
    await task.destroy();
  }
}
test("repair rebuilds missing cross references without discarding fields, links, metadata, outlines or attachments", async () => {
  const original = await fixture(),
    text = Buffer.from(original).toString("latin1");
  const damaged = Buffer.from(
    text.slice(0, text.lastIndexOf("\nxref\n")) + "\n%%EOF",
    "latin1",
  );
  evidence("missing-xref.pdf", damaged);
  const output = await repairPdf(file(damaged), { mode: "structure" });
  assert.equal(output.pageCount, 4);
  assert.equal(output.sourcePages, 4);
  assert.ok(
    output.pages.every(
      (page) => page.status === "checked" && !page.appearsBlank,
    ),
  );
  const bytes = await output.blob.arrayBuffer();
  evidence("structure.pdf", new Uint8Array(bytes));
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getTitle(), "Preserve repair title");
  assert.equal(pdf.getCreationDate().toISOString(), "2001-02-03T04:05:06.000Z");
  assert.equal(pdf.getForm().getFields().length, 4);
  for (let i = 0; i < 4; i++) {
    assert.equal(
      pdf
        .getForm()
        .getTextField("value" + i)
        .getText(),
      "KEEP " + (i + 1),
    );
    assert.equal(pdf.getPage(i).getRotation().angle, i * 90);
    assert.deepEqual(pdf.getPage(i).getCropBox(), {
      x: 20,
      y: 30,
      width: 360,
      height: 440,
    });
  }
  assert.ok(pdf.catalog.has(n("Outlines")));
  assert.ok(pdf.catalog.lookup(n("Names"), PDFDict).has(n("EmbeddedFiles")));
  assert.equal(pdf.getPage(0).node.Annots().size(), 2);
  assert.deepEqual(
    await rendered(original),
    await rendered(bytes),
    "all page pixels including form appearances must be identical",
  );
});
test("visible recovery explicitly produces cropped, rotated image pages while flattening form appearances", async () => {
  const original = await fixture();
  const output = await repairPdf(file(original), { mode: "visible", dpi: 150 });
  assert.equal(output.pageCount, 4);
  assert.ok(
    output.pages.every(
      (page) => page.status === "recovered" && !page.appearsBlank,
    ),
  );
  const bytes = await output.blob.arrayBuffer();
  evidence("visible.pdf", new Uint8Array(bytes));
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getForm().getFields().length, 0);
  assert.equal(pdf.catalog.has(n("Outlines")), false);
  assert.equal(pdf.catalog.has(n("Names")), false);
  for (let i = 0; i < 4; i++) {
    assert.deepEqual(
      pdf.getPage(i).getSize(),
      i % 2 ? { width: 440, height: 360 } : { width: 360, height: 440 },
    );
    assert.equal(pdf.getPage(i).getRotation().angle, 0);
    assert.equal(pdf.getPage(i).node.Annots()?.size() ?? 0, 0);
  }
  assert.ok(output.preview.startsWith("data:image/png"));
  const lib = await library(),
    task = lib.getDocument({ data: new Uint8Array(bytes) }),
    read = await task.promise;
  try {
    assert.equal(
      (await (await read.getPage(1)).getTextContent()).items.length,
      0,
    );
  } finally {
    await task.destroy();
  }
});
test("a damaged content stream never silently passes; partial recovery lists skipped original page numbers", async () => {
  const pdf = await PDFDocument.load(await fixture());
  const stream = PDFRawStream.of(
    pdf.context.obj({ Filter: "FlateDecode" }),
    new Uint8Array([1, 2, 3, 4, 5]),
  );
  pdf.getPage(1).node.set(n("Contents"), pdf.context.register(stream));
  const broken = await pdf.save({
    useObjectStreams: false,
    updateFieldAppearances: false,
  });
  evidence("broken-page.pdf", broken);
  await assert.rejects(
    repairPdf(file(broken), { mode: "structure" }),
    /Page 2 could not be verified/,
  );
  await assert.rejects(
    repairPdf(file(broken), { mode: "visible" }),
    /Page 2 could not be recovered/,
  );
  const result = await repairPdf(file(broken), {
    mode: "visible",
    skipUnreadable: true,
  });
  assert.equal(result.pageCount, 3);
  assert.equal(result.sourcePages, 4);
  assert.deepEqual(
    result.pages.map((page) => [page.sourcePage, page.outputPage, page.status]),
    [
      [1, 1, "recovered"],
      [2, undefined, "unreadable"],
      [3, 2, "recovered"],
      [4, 3, "recovered"],
    ],
  );
  evidence("partial.pdf", new Uint8Array(await result.blob.arrayBuffer()));
});
test("blank content is kept with an explicit review flag and an unrecoverable document creates no output", async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage([300, 400]);
  const result = await repairPdf(file(await pdf.save()), { mode: "structure" });
  assert.equal(result.pages[0].appearsBlank, true);
  await assert.rejects(
    repairPdf(file(new TextEncoder().encode("not a pdf")), {
      mode: "structure",
    }),
    /PDF header/,
  );
  await assert.rejects(
    repairPdf(file(new TextEncoder().encode("%PDF-1.7\nmissing objects")), {
      mode: "visible",
      skipUnreadable: true,
    }),
    /Not enough readable|recoverable pages/,
  );
});
test("repair validates geometry, size, page count, encryption, signatures and XFA without writing a misleading output", async () => {
  assert.throws(() => repairDimensions(10_000, 10_000, 300), /too large/);
  assert.throws(() => repairDimensions(NaN, 40, 150), /too large/);
  await assert.rejects(
    repairPdf(new File([], "empty.pdf"), { mode: "visible" }),
    /non-empty/,
  );
  await assert.rejects(
    repairPdf({ size: 101 * 1024 * 1024 }, { mode: "structure" }),
    /100MB/,
  );
  for (const kind of ["signature", "certified", "xfa", "encrypted", "many"]) {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    if (kind === "signature")
      pdf.catalog.set(
        n("AcroForm"),
        pdf.context.obj({
          Fields: [
            pdf.context.register(
              pdf.context.obj({ FT: "Sig", T: PDFString.of("signed") }),
            ),
          ],
        }),
      );
    if (kind === "certified") pdf.catalog.set(n("Perms"), pdf.context.obj({}));
    if (kind === "xfa")
      pdf.catalog.set(
        n("AcroForm"),
        pdf.context.obj({ XFA: PDFString.of("xml") }),
      );
    if (kind === "encrypted")
      pdf.context.trailerInfo.Encrypt = pdf.context.register(
        pdf.context.obj({ Filter: "Standard" }),
      );
    if (kind === "many") for (let i = 1; i < 201; i++) pdf.addPage();
    await assert.rejects(
      repairPdfStructure(await pdf.save()),
      /signature|XFA|encrypted|200 pages/,
    );
  }
});
test("cancellation before reading and between rendered pages stops output, then the same file can be retried", async () => {
  const original = await fixture();
  const first = new AbortController();
  first.abort();
  await assert.rejects(
    repairPdf(file(original), { mode: "structure", signal: first.signal }),
    { name: "AbortError" },
  );
  const during = new AbortController();
  await assert.rejects(
    repairPdf(file(original), {
      mode: "visible",
      signal: during.signal,
      onProgress: (value) => {
        if (value > 30) during.abort();
      },
    }),
    { name: "AbortError" },
  );
  const retry = await repairPdf(file(original), { mode: "structure" });
  assert.equal(retry.pageCount, 4);
});
