const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript");
const { Worker: NodeWorker } = require("node:worker_threads");
const { PDFDocument, PDFName, PDFString, degrees, rgb } = require("pdf-lib");
const {
  createCanvas,
  DOMMatrix,
  ImageData,
  Path2D,
} = require("@napi-rs/canvas");
Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const core = require("../public/qpdf/password-core.js"),
  createCore = require("../public/qpdf/qpdf-core.js"),
  wasm = fs.readFileSync("public/qpdf/qpdf-core.wasm");
const n = PDFName.of,
  run = (bytes, options = {}) =>
    core.transform(createCore, wasm, new Uint8Array(bytes), {
      operation: "compress",
      quality: "medium",
      ...options,
    });
const file = (bytes) =>
  new File([bytes], "native.pdf", { type: "application/pdf" });
const save = (name, bytes) => {
  if (process.env.OPTIMIZE_QA_DIR) {
    fs.mkdirSync(process.env.OPTIMIZE_QA_DIR, { recursive: true });
    fs.writeFileSync(path.join(process.env.OPTIMIZE_QA_DIR, name), bytes);
  }
};
let pdfjs;
async function library() {
  pdfjs ??= await import("pdfjs-dist/legacy/build/pdf.mjs");
  const root = path.dirname(require.resolve("pdfjs-dist/package.json"));
  return {
    ...pdfjs,
    getDocument: (options) =>
      pdfjs.getDocument({
        ...options,
        standardFontDataUrl: root + "/standard_fonts/",
        cMapUrl: root + "/cmaps/",
        wasmUrl: root + "/wasm/",
        useSystemFonts: false,
      }),
  };
}
global.document = {
  createElement(type) {
    assert.equal(type, "canvas");
    const c = createCanvas(1, 1);
    c.toBlob = (cb, type, quality) =>
      cb(
        new Blob([c.toBuffer("image/jpeg", Math.round(quality * 100))], {
          type: "image/jpeg",
        }),
      );
    return c;
  },
};
let stopped = 0;
class BrowserWorkerAdapter {
  constructor() {
    const root = path.resolve("public/qpdf");
    this.worker = new NodeWorker(
      `const {parentPort,workerData}=require('node:worker_threads'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');globalThis.module=undefined;globalThis.exports=undefined;globalThis.self=globalThis;globalThis.WorkerGlobalScope={};self.location={href:'https://pdfpilot.test/qpdf/worker.js'};globalThis.importScripts=(...files)=>{for(const file of files)vm.runInThisContext(fs.readFileSync(path.join(workerData,file),'utf8'))};globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>{const b=fs.readFileSync(path.join(workerData,'qpdf-core.wasm'));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)}});self.postMessage=(m,t)=>parentPort.postMessage(m,t);vm.runInThisContext(fs.readFileSync(path.join(workerData,'worker.js'),'utf8'));parentPort.on('message',data=>self.onmessage({data}));`,
      { eval: true, workerData: root },
    );
    this.worker.on("message", (data) => this.onmessage?.({ data }));
    this.worker.on("error", (e) => this.onerror?.(e));
  }
  postMessage(m, t) {
    this.worker.postMessage(m, t);
  }
  terminate() {
    stopped++;
    void this.worker.terminate();
  }
}
globalThis.Worker = BrowserWorkerAdapter;
function load(file) {
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    m = { exports: {} };
  new Function("require", "module", "exports", code)(
    (name) =>
      name === "../pdfjs"
        ? { loadPdfjs: library }
        : name.startsWith(".")
          ? load(path.resolve(path.dirname(file), name + ".ts"))
          : require(name),
    m,
    m.exports,
  );
  return m.exports;
}
const { optimizePdf, optimizationPreview } = load(
  "src/lib/engines/pdf-optimize-engine.ts",
);
async function fixture() {
  const doc = await PDFDocument.create();
  const c = createCanvas(640, 480),
    ctx = c.getContext("2d"),
    pixels = ctx.createImageData(640, 480);
  let seed = 12345;
  for (let y = 0; y < 480; y++)
    for (let x = 0; x < 640; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = (seed >>> 24) % 80;
      const p = (y * 640 + x) * 4;
      pixels.data.set(
        [
          Math.min(255, x / 3 + noise),
          Math.min(255, y / 3 + noise),
          Math.min(255, 90 + noise),
          255,
        ],
        p,
      );
    }
  ctx.putImageData(pixels, 0, 0);
  const image = await doc.embedPng(c.toBuffer("image/png"));
  for (let i = 0; i < 4; i++) {
    const p = doc.addPage([400, 500]);
    p.setCropBox(20, 30, 360, 440);
    p.setRotation(degrees(i * 90));
    if (i === 2) p.node.set(n("UserUnit"), doc.context.obj(2));
    p.drawImage(image, { x: 30, y: 40, width: 330, height: 240 });
    p.drawText("Searchable page " + (i + 1), { x: 45, y: 430, size: 20 });
    p.drawRectangle({
      x: 45,
      y: 390,
      width: 220,
      height: 10,
      color: rgb(0.1, 0.5, 0.8),
    });
    const f = doc.getForm().createTextField("field" + i);
    f.setText("KEEP " + (i + 1));
    f.addToPage(p, { x: 45, y: 320, width: 180, height: 30 });
    p.node.addAnnot(
      doc.context.register(
        doc.context.obj({
          Type: "Annot",
          Subtype: "Link",
          Rect: [45, 430, 220, 450],
          Border: [0, 0, 0],
          A: { S: "URI", URI: PDFString.of("https://pdfpilot.net/") },
        }),
      ),
    );
  }
  doc.setTitle("नमस्ते · مرحبا");
  doc.setCreationDate(new Date("2001-02-03T00:00:00Z"));
  await doc.attach(new TextEncoder().encode("KEEP ATTACHMENT"), "fixture.txt");
  const outline = doc.context.register(
    doc.context.obj({ Type: "Outlines", Count: 1 }),
  );
  const item = doc.context.register(
    doc.context.obj({
      Title: PDFString.of("Page two"),
      Parent: outline,
      Dest: [doc.getPage(1).ref, "Fit"],
    }),
  );
  doc.context.lookup(outline).set(n("First"), item);
  doc.context.lookup(outline).set(n("Last"), item);
  doc.catalog.set(n("Outlines"), outline);
  const bytes = await doc.save({ useObjectStreams: false });
  save("source.pdf", bytes);
  return bytes;
}
let sourcePromise;
const source = () => (sourcePromise ??= fixture());
async function snapshot(bytes, extraRotation = 0) {
  const lib = await library(),
    task = lib.getDocument({ data: new Uint8Array(bytes) });
  try {
    const doc = await task.promise,
      pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const p = await doc.getPage(i),
        v = p.getViewport({
          scale: 0.35,
          rotation: (p.rotate + extraRotation) % 360,
        }),
        c = createCanvas(Math.ceil(v.width), Math.ceil(v.height));
      await p.render({ canvas: c, viewport: v }).promise;
      pages.push({
        pixels: Buffer.from(
          c.getContext("2d").getImageData(0, 0, c.width, c.height).data,
        ),
        size: [v.width, v.height],
        text: (await p.getTextContent()).items.map((x) => x.str).join("|"),
        links: (await p.getAnnotations())
          .filter((x) => x.url)
          .map((x) => x.url),
      });
      p.cleanup();
    }
    return {
      pages,
      fields: await doc.getFieldObjects(),
      attachments: await doc.getAttachments(),
      outline: await doc.getOutline(),
    };
  } finally {
    await task.destroy();
  }
}
test("lossless optimization reduces structure without changing pixels, text, native geometry, forms, links, attachment or metadata", async () => {
  const input = await source(),
    out = await run(input, { quality: "lossless" });
  save("lossless.pdf", out.bytes);
  assert(out.bytes.length < input.length);
  assert.equal(out.fieldCount, 4);
  assert.equal(out.pageCount, 4);
  const a = await snapshot(input),
    b = await snapshot(out.bytes);
  assert.deepEqual(b.pages, a.pages);
  assert.deepEqual(b.attachments, a.attachments);
  assert.deepEqual(Object.keys(b.fields), Object.keys(a.fields));
  assert.equal(b.outline[0].title, "Page two");
  const pdf = await PDFDocument.load(out.bytes, { updateMetadata: false });
  assert.equal(pdf.getTitle(), "नमस्ते · مرحبا");
  assert.equal(pdf.getCreationDate().toISOString(), "2001-02-03T00:00:00.000Z");
  assert.equal(pdf.getForm().getTextField("field3").getText(), "KEEP 4");
});
test("three JPEG quality levels reduce real image data while preserving native text and fields", async () => {
  const input = await source(),
    sizes = [],
    original = await snapshot(input);
  for (const quality of ["low", "medium", "high"]) {
    const out = await run(input, { quality });
    save(quality + ".pdf", out.bytes);
    sizes.push(out.bytes.length);
    assert(out.bytes.length < input.length);
    const result = await snapshot(out.bytes);
    assert.deepEqual(
      result.pages.map((p) => [p.text, p.size, p.links]),
      original.pages.map((p) => [p.text, p.size, p.links]),
    );
    assert.deepEqual(Object.keys(result.fields), Object.keys(original.fields));
  }
  assert(sizes[0] < sizes[1] && sizes[1] < sizes[2]);
});
test("rotation applies to every native page; already optimized files return unchanged when no rotation is requested", async () => {
  const input = await source(),
    rotated = await run(input, { quality: "lossless", rotation: 90 });
  save("rotated.pdf", rotated.bytes);
  const a = await snapshot(input, 90),
    b = await snapshot(rotated.bytes);
  assert.deepEqual(b.pages, a.pages);
  const doc = await PDFDocument.create();
  doc.addPage([100, 100]).drawText("Tiny", { size: 10 });
  const first = await run(await doc.save(), { quality: "lossless" });
  const again = await run(first.bytes, { quality: "lossless" });
  assert.equal(again.unchanged, true);
  assert.deepEqual(again.bytes, first.bytes);
  save("already-small.pdf", again.bytes);
});
test("existing JPEGs are recompressed and transparent-image masks remain intact", async () => {
  const c = createCanvas(400, 300),
    ctx = c.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 400, 300);
  gradient.addColorStop(0, "#b01588");
  gradient.addColorStop(1, "#28c260");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 400, 300);
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = i % 2 ? "#ffffff" : "#333333";
    ctx.fillRect(i, (i * 13) % 300, 1, 30);
  }
  const jpg = await PDFDocument.create(),
    image = await jpg.embedJpg(c.toBuffer("image/jpeg", 100));
  jpg
    .addPage([400, 300])
    .drawImage(image, { x: 0, y: 0, width: 400, height: 300 });
  const original = await jpg.save(),
    reduced = await run(original, { quality: "low" });
  assert(reduced.bytes.length < original.length * 0.7);
  save("jpeg-source.pdf", original);
  save("jpeg-compressed.pdf", reduced.bytes);
  ctx.clearRect(0, 0, 400, 300);
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(200, 150, 120, 0, Math.PI * 2);
  ctx.fill();
  const png = await PDFDocument.create(),
    alpha = await png.embedPng(c.toBuffer("image/png"));
  const page = png.addPage([400, 300]);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    color: rgb(0.2, 0.3, 0.7),
  });
  page.drawImage(alpha, { x: 0, y: 0, width: 400, height: 300 });
  const source = await png.save(),
    output = await run(source, { quality: "medium" });
  const before = await snapshot(source),
    after = await snapshot(output.bytes);
  assert.deepEqual(
    after.pages.map((p) => p.size),
    before.pages.map((p) => p.size),
  );
  // The transparent corner must continue to show the original vector background.
  assert.deepEqual(
    after.pages[0].pixels.subarray(0, 40),
    before.pages[0].pixels.subarray(0, 40),
  );
  const decoded = await PDFDocument.load(output.bytes),
    streams = decoded.context
      .enumerateIndirectObjects()
      .filter(([, o]) => o.dict?.get(n("Subtype"))?.toString() === "/Image");
  assert(streams.some(([, o]) => o.dict.has(n("SMask"))));
});
test("invalid, encrypted, signed, XFA and excessive-page PDFs fail without a success file", async () => {
  await assert.rejects(
    run(new TextEncoder().encode("not pdf")),
    /readable PDF/,
  );
  await assert.rejects(run(await source(), { quality: "wrong" }), /supported/);
  const locked = await core.transform(
    createCore,
    wasm,
    new Uint8Array(await source()),
    { operation: "lock", openPassword: "Synthetic-test-72!" },
  );
  save("encrypted.pdf", locked.bytes);
  await assert.rejects(run(locked.bytes), /password|encrypted/);
  for (const kind of ["signature", "xfa", "damaged-stream"]) {
    const d = await PDFDocument.create();
    d.addPage([100, 100]);
    if (kind === "signature")
      d.catalog.set(
        n("AcroForm"),
        d.context.obj({
          Fields: [
            d.context.register(
              d.context.obj({
                FT: "Sig",
                T: PDFString.of("InvisibleSignature"),
              }),
            ),
          ],
        }),
      );
    if (kind === "xfa")
      d.catalog.set(
        n("AcroForm"),
        d.context.obj({ Fields: [], XFA: PDFString.of("xfa") }),
      );
    if (kind === "damaged-stream")
      d.getPage(0).node.set(
        n("Contents"),
        d.context.register(
          d.context.stream(new TextEncoder().encode("bad"), {
            Filter: "FlateDecode",
          }),
        ),
      );
    const bytes = await d.save();
    save(kind + ".pdf", bytes);
    await assert.rejects(
      run(bytes),
      kind === "signature"
        ? /signature/
        : kind === "xfa"
          ? /XFA/
          : /processed cleanly/,
    );
  }
  const many = await PDFDocument.create();
  for (let i = 0; i < 1001; i++) many.addPage([100, 100]);
  await assert.rejects(run(await many.save()), /1–1,000/);
});
test("image-only mode retains visible page geometry and returns explicit flattening; native mode keeps fields", async () => {
  const input = await source(),
    result = await optimizePdf(file(input), {
      mode: "flatten",
      quality: "low",
      rotation: 90,
    });
  assert(result.blob.size < input.length);
  assert(result.flattened);
  assert.equal(result.fieldCount, 0);
  save("flattened.pdf", new Uint8Array(await result.blob.arrayBuffer()));
  const decoded = await snapshot(await result.blob.arrayBuffer()),
    before = await snapshot(input, 90);
  assert.deepEqual(
    decoded.pages.map((p) => p.size),
    before.pages.map((p) => p.size),
  );
  assert(decoded.pages.every((p) => !p.text && !p.links.length));
  assert.equal(decoded.fields, null);
  for (const p of decoded.pages) assert(p.pixels.some((v) => v < 200));
  const native = await optimizePdf(file(input), {
    mode: "native",
    quality: "medium",
  });
  assert.equal(native.flattened, false);
  assert.equal(native.fieldCount, 4);
});
test("native and image-only cancellation stop real work and both can retry", async () => {
  const input = await source(),
    abort = new AbortController();
  let active = false;
  const previous = stopped;
  await assert.rejects(
    optimizePdf(file(input), {
      mode: "native",
      quality: "medium",
      signal: abort.signal,
      onProgress: (p) => {
        if (p >= 12) {
          active = true;
          abort.abort();
        }
      },
    }),
    (e) => e.name === "AbortError",
  );
  assert(active);
  assert.equal(stopped, previous + 1);
  assert.equal(
    (await optimizePdf(file(input), { mode: "native", quality: "medium" }))
      .pageCount,
    4,
  );
  const cancel = new AbortController();
  let rendered = false;
  await assert.rejects(
    optimizePdf(file(input), {
      mode: "flatten",
      quality: "low",
      signal: cancel.signal,
      onProgress: (p) => {
        if (p > 15) {
          rendered = true;
          cancel.abort();
        }
      },
    }),
    (e) => e.name === "AbortError",
  );
  assert(rendered);
  assert.equal(
    (await optimizePdf(file(input), { mode: "flatten", quality: "low" }))
      .pageCount,
    4,
  );
});
test("preview is bounded, malformed inputs fail and cancelled previews can be retried", async () => {
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(
    optimizationPreview(file(await source()), abort.signal),
    (e) => e.name === "AbortError",
  );
  const preview = await optimizationPreview(
    file(await source()),
    new AbortController().signal,
  );
  assert.equal(preview.pageCount, 4);
  const meta = await require("sharp")(
    Buffer.from(preview.thumbnail.split(",")[1], "base64"),
  ).metadata();
  assert(meta.width <= 230 && meta.height <= 280);
  await assert.rejects(
    optimizationPreview(
      file(new TextEncoder().encode("invalid")),
      new AbortController().signal,
    ),
  );
  const huge = await PDFDocument.create();
  huge.addPage([1000000, 1000000]);
  const bounded = await optimizationPreview(
    file(await huge.save()),
    new AbortController().signal,
  );
  const m = await require("sharp")(
    Buffer.from(bounded.thumbnail.split(",")[1], "base64"),
  ).metadata();
  assert(m.width <= 230 && m.height <= 280);
});
