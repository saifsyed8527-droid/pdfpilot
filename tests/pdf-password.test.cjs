const test = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  ts = require("typescript");
const { Worker: NodeWorker } = require("node:worker_threads");
const {
  PDFDocument,
  PDFName,
  PDFString,
  PDFHexString,
  PDFDict,
  PDFArray,
  degrees,
  rgb,
} = require("pdf-lib");
const {
  createCanvas,
  DOMMatrix,
  ImageData,
  Path2D,
} = require("@napi-rs/canvas");
Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const createCore = require("../public/qpdf/qpdf-core.js"),
  core = require("../public/qpdf/password-core.js");
const wasm = fs.readFileSync("public/qpdf/qpdf-core.wasm"),
  n = PDFName.of;
const OPEN = "PDFPilot-test-72!",
  OWNER = "Owner-test-distinct-83!";
const run = (bytes, options) =>
  core.transform(createCore, wasm, new Uint8Array(bytes), options);
function save(name, bytes) {
  if (process.env.PASSWORD_QA_DIR) {
    fs.mkdirSync(process.env.PASSWORD_QA_DIR, { recursive: true });
    fs.writeFileSync(path.join(process.env.PASSWORD_QA_DIR, name), bytes);
  }
}
async function fixture() {
  const doc = await PDFDocument.create();
  for (const [i, angle] of [0, 90, 180, 270].entries()) {
    const page = doc.addPage([400, 500]);
    page.setCropBox(20, 30, 360, 440);
    page.setRotation(degrees(angle));
    if (i === 2) page.node.set(n("UserUnit"), doc.context.obj(2));
    page.drawRectangle({
      x: 40,
      y: 350,
      width: 250,
      height: 80,
      color: rgb(0.1, 0.6, 0.8),
    });
    page.drawText("Preserve page " + (i + 1), { x: 50, y: 450, size: 18 });
  }
  const form = doc.getForm(),
    text = form.createTextField("name");
  text.setText("KEEP EDITABLE");
  text.addToPage(doc.getPage(0), { x: 50, y: 250, width: 200, height: 30 });
  const checkbox = form.createCheckBox("checked");
  checkbox.addToPage(doc.getPage(1), { x: 50, y: 200, width: 20, height: 20 });
  checkbox.check();
  const choice = form.createDropdown("choice");
  choice.setOptions(["One", "Two"]);
  choice.select("Two");
  choice.addToPage(doc.getPage(2), { x: 50, y: 180, width: 100, height: 25 });
  const link = doc.context.register(
    doc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [50, 80, 200, 100],
      Border: [0, 0, 0],
      A: { S: "URI", URI: PDFString.of("https://pdfpilot.net/") },
    }),
  );
  doc.getPage(3).node.set(n("Annots"), doc.context.obj([link]));
  doc.setTitle("नमस्ते & مرحبا");
  doc.setAuthor("PDFPilot QA");
  doc.setCreationDate(new Date("2002-01-01T00:00:00Z"));
  await doc.attach(
    new TextEncoder().encode("attachment content"),
    "fixture.txt",
    { mimeType: "text/plain", description: "Preserved attachment" },
  );
  const outline = doc.context.register(
    doc.context.obj({ Type: "Outlines", Count: 1 }),
  );
  const item = doc.context.register(
    doc.context.obj({
      Title: PDFHexString.fromText("Page two"),
      Parent: outline,
      Dest: [doc.getPage(1).ref, "Fit"],
    }),
  );
  doc.context.lookup(outline, PDFDict).set(n("First"), item);
  doc.context.lookup(outline, PDFDict).set(n("Last"), item);
  doc.catalog.set(n("Outlines"), outline);
  const bytes = await doc.save();
  save("source.pdf", bytes);
  return bytes;
}
let sourcePromise;
const source = () => (sourcePromise ??= fixture());
async function reader(bytes, password) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const root = path.dirname(require.resolve("pdfjs-dist/package.json"));
  return pdfjs.getDocument({
    data: new Uint8Array(bytes),
    password,
    useSystemFonts: false,
    standardFontDataUrl: root + "/standard_fonts/",
    cMapUrl: root + "/cmaps/",
    wasmUrl: root + "/wasm/",
  });
}
async function mustRejectPassword(bytes, password) {
  const task = await reader(bytes, password);
  try {
    await assert.rejects(task.promise, (e) => e.name === "PasswordException");
  } finally {
    await task.destroy();
  }
}
async function snapshot(bytes, password) {
  const task = await reader(bytes, password);
  try {
    const pdf = await task.promise,
      pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i),
        viewport = page.getViewport({ scale: 0.4 }),
        canvas = createCanvas(
          Math.ceil(viewport.width),
          Math.ceil(viewport.height),
        );
      await page.render({ canvas, viewport }).promise;
      pages.push({
        text: (await page.getTextContent()).items.map((i) => i.str).join("|"),
        rect: [viewport.width, viewport.height],
        pixels: Buffer.from(
          canvas
            .getContext("2d")
            .getImageData(0, 0, canvas.width, canvas.height).data,
        ),
        annotations: (await page.getAnnotations()).map((a) => ({
          subtype: a.subtype,
          fieldName: a.fieldName,
          fieldValue: a.fieldValue,
          url: a.url,
        })),
      });
      page.cleanup();
    }
    return {
      pages,
      fields: await pdf.getFieldObjects(),
      attachments: await pdf.getAttachments(),
      outline: await pdf.getOutline(),
      permissions: await pdf.getPermissions(),
    };
  } finally {
    await task.destroy();
  }
}
test("vendored qpdf core matches pinned hashes and retains upstream licenses", () => {
  const manifest = JSON.parse(fs.readFileSync("public/qpdf/manifest.json"));
  assert.equal(manifest.upstream.version, "12.4.2");
  for (const f of ["qpdf-core.js", "qpdf-core.wasm"])
    assert.equal(
      crypto
        .createHash("sha256")
        .update(fs.readFileSync("public/qpdf/" + f))
        .digest("hex"),
      manifest.files[f].sha256,
    );
  assert.match(
    fs.readFileSync("public/qpdf/LICENSES/QPDF-LICENSE.txt", "utf8"),
    /Apache/,
  );
});
test("AES-256 requires a password and native unlock preserves text, page geometry, form fields, links and appearance", async () => {
  const input = await source(),
    locked = await run(input, { operation: "lock", openPassword: OPEN });
  save("protected.pdf", locked.bytes);
  assert.equal(locked.encryption, "AES-256");
  assert.equal(locked.pageCount, 4);
  assert.equal(locked.fieldCount, 3);
  await mustRejectPassword(locked.bytes);
  await mustRejectPassword(locked.bytes, "wrong");
  const original = await snapshot(input),
    secured = await snapshot(locked.bytes, OPEN);
  assert.deepEqual(secured.pages, original.pages);
  assert.deepEqual(Object.keys(secured.fields), Object.keys(original.fields));
  const plain = await run(locked.bytes, {
    operation: "unlock",
    currentPassword: OPEN,
  });
  save("unlocked.pdf", plain.bytes);
  assert.equal(plain.encryption, "none");
  const read = await snapshot(plain.bytes);
  assert.deepEqual(read.pages, original.pages);
  assert.deepEqual(read.attachments, original.attachments);
  assert.deepEqual(
    read.outline.map((x) => x.title),
    ["Page two"],
  );
  const pdf = await PDFDocument.load(plain.bytes, { updateMetadata: false });
  assert.equal(pdf.isEncrypted, false);
  assert.equal(pdf.getTitle(), "नमस्ते & مرحبا");
  assert.equal(pdf.getCreationDate().toISOString(), "2002-01-01T00:00:00.000Z");
  assert.equal(pdf.getForm().getTextField("name").getText(), "KEEP EDITABLE");
  assert.equal(pdf.getForm().getCheckBox("checked").isChecked(), true);
  assert.deepEqual(pdf.getForm().getDropdown("choice").getSelected(), ["Two"]);
});
test("separate owner passwords, permission flags and re-protection work through independent PDF.js decoding", async () => {
  const locked = await run(await source(), {
    operation: "lock",
    openPassword: OPEN,
    ownerPassword: OWNER,
    print: "none",
    copy: false,
    modify: "none",
  });
  save("restricted.pdf", locked.bytes);
  const view = await snapshot(locked.bytes, OPEN),
    pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  assert(!view.permissions.includes(pdfjs.PermissionFlag.PRINT));
  assert(!view.permissions.includes(pdfjs.PermissionFlag.COPY));
  assert(!view.permissions.includes(pdfjs.PermissionFlag.MODIFY_CONTENTS));
  const ownerPlain = await run(locked.bytes, {
    operation: "unlock",
    currentPassword: OWNER,
  });
  assert.equal(ownerPlain.pageCount, 4);
  const changed = await run(locked.bytes, {
    operation: "lock",
    currentPassword: OWNER,
    openPassword: "New-PDFPilot-99!",
  });
  await mustRejectPassword(changed.bytes, OPEN);
  const newRead = await snapshot(changed.bytes, "New-PDFPilot-99!");
  assert.equal(newRead.pages.length, 4);
});
test("Unicode and leading option-like passwords work without truncation or argument interpretation", async () => {
  for (const password of [
    "नमस्ते-مرحبا-72!",
    "--@PDFPilot-72!",
    "文書🔒-72!",
  ]) {
    const locked = await run(await source(), {
      operation: "lock",
      openPassword: password,
    });
    const doc = await snapshot(locked.bytes, password);
    assert.equal(doc.pages.length, 4);
    const plain = await run(locked.bytes, {
      operation: "unlock",
      currentPassword: password,
    });
    assert.equal(plain.pageCount, 4);
  }
  await assert.rejects(
    run(await source(), { operation: "lock", openPassword: "字".repeat(43) }),
    /127 UTF-8/,
  );
  await assert.rejects(
    run(await source(), { operation: "lock", openPassword: "x\u0000y" }),
    /null/,
  );
  await assert.rejects(
    run(await source(), {
      operation: "lock",
      openPassword: OPEN,
      ownerPassword: OPEN,
    }),
    /different owner/,
  );
});
test("unencrypted PDFs return byte-for-byte unchanged and malformed or incorrect passwords can be retried", async () => {
  const input = await source(),
    plain = await run(input, { operation: "unlock" });
  assert.equal(plain.unchanged, true);
  assert.deepEqual(plain.bytes, new Uint8Array(input));
  await assert.rejects(
    run(new TextEncoder().encode("not a PDF"), { operation: "unlock" }),
    /readable PDF/,
  );
  await assert.rejects(
    run(new TextEncoder().encode("%PDF-1.7\nbroken"), { operation: "unlock" }),
    /processed cleanly/,
  );
  save("invalid.pdf", Buffer.from("%PDF-1.7\nbroken"));
  const damaged = await PDFDocument.create();
  const badStream = damaged.context.stream(
    new TextEncoder().encode("invalid compressed stream"),
    { Filter: "FlateDecode" },
  );
  damaged
    .addPage()
    .node.set(n("Contents"), damaged.context.register(badStream));
  await assert.rejects(
    run(await damaged.save(), { operation: "unlock" }),
    /processed cleanly/,
  );
  const encrypted = await run(input, { operation: "lock", openPassword: OPEN });
  await assert.rejects(
    run(encrypted.bytes, { operation: "unlock", currentPassword: "bad" }),
    /missing or incorrect/,
  );
  assert.equal(
    (await run(encrypted.bytes, { operation: "unlock", currentPassword: OPEN }))
      .pageCount,
    4,
  );
});
test("legacy RC4/AES-128 and password-free restriction documents decrypt without rasterization", async () => {
  for (const mode of ["rc4", "aes128", "owner-only"]) {
    const q = await createCore({
      wasmBinary: wasm,
      print: () => {},
      printErr: () => {},
    });
    q.FS.writeFile("/input.pdf", await source());
    const args = [
      "/input.pdf",
      "/out.pdf",
      ...(mode === "rc4" ? ["--allow-weak-crypto"] : []),
      "--encrypt",
      `--user-password=${mode === "owner-only" ? "" : OPEN}`,
      `--owner-password=${OWNER}`,
      `--bits=${mode === "owner-only" ? 256 : 128}`,
      ...(mode === "aes128" ? ["--use-aes=y"] : []),
      "--print=none",
      "--extract=n",
      "--",
    ];
    assert.equal(q.callMain(args), 0);
    const bytes = q.FS.readFile("/out.pdf");
    save(mode + ".pdf", bytes);
    const plain = await run(bytes, {
      operation: "unlock",
      currentPassword: mode === "owner-only" ? "" : OPEN,
    });
    assert.deepEqual(
      (await snapshot(plain.bytes)).pages,
      (await snapshot(await source())).pages,
    );
  }
});
test("signature fields, certification, XFA and page limits are rejected before creating output", async () => {
  for (const mode of ["signature", "certified", "xfa"]) {
    const pdf = await PDFDocument.load(await source());
    if (mode === "signature") {
      const field = pdf.context.register(
        pdf.context.obj({
          FT: "Sig",
          T: PDFString.of("Signature"),
          Type: "Annot",
          Subtype: "Widget",
          Rect: [0, 0, 10, 10],
          P: pdf.getPage(0).ref,
        }),
      );
      pdf.catalog.AcroForm().lookup(n("Fields"), PDFArray).push(field);
    }
    if (mode === "certified")
      pdf.catalog.set(
        n("Perms"),
        pdf.context.obj({
          DocMDP: pdf.context.register(pdf.context.obj({ Type: "Sig" })),
        }),
      );
    if (mode === "xfa")
      pdf.catalog.AcroForm().set(n("XFA"), PDFString.of("fixture"));
    const bytes = await pdf.save({ updateFieldAppearances: false });
    save(mode + ".pdf", bytes);
    await assert.rejects(
      run(bytes, { operation: "lock", openPassword: OPEN }),
      mode === "xfa" ? /XFA/ : /signature|certification/,
    );
  }
  const many = await PDFDocument.create();
  for (let i = 0; i < 1001; i++) many.addPage([100, 100]);
  await assert.rejects(
    run(await many.save(), { operation: "unlock" }),
    /1–1,000/,
  );
});
let stopped = 0;
class BrowserWorkerAdapter {
  constructor() {
    const root = path.resolve("public/qpdf");
    this.worker = new NodeWorker(
      `const {parentPort,workerData}=require('node:worker_threads'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');globalThis.module=undefined;globalThis.exports=undefined;globalThis.self=globalThis;globalThis.WorkerGlobalScope={};self.location={href:'https://pdfpilot.test/qpdf/worker.js'};globalThis.importScripts=(...files)=>{for(const file of files)vm.runInThisContext(fs.readFileSync(path.join(workerData,file),'utf8'))};globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>{const b=fs.readFileSync(path.join(workerData,'qpdf-core.wasm'));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)}});self.postMessage=(message,transfers)=>parentPort.postMessage(message,transfers);vm.runInThisContext(fs.readFileSync(path.join(workerData,'worker.js'),'utf8'));parentPort.on('message',data=>self.onmessage({data}));`,
      { eval: true, workerData: root },
    );
    this.worker.on("message", (data) => this.onmessage?.({ data }));
    this.worker.on("error", (error) => this.onerror?.(error));
  }
  postMessage(message, transfers) {
    this.worker.postMessage(message, transfers);
  }
  terminate() {
    stopped++;
    void this.worker.terminate();
  }
}
function load(file) {
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const m = { exports: {} };
  new Function("require", "module", "exports", code)(
    (name) =>
      name.startsWith(".")
        ? load(path.resolve(path.dirname(file), name + ".ts"))
        : require(name),
    m,
    m.exports,
  );
  return m.exports;
}
test("real worker protocol is cancellable and retry produces a readable PDF", async () => {
  globalThis.Worker = BrowserWorkerAdapter;
  const { processPdfPassword, passwordZip } = load(
    "src/lib/engines/pdf-password-engine.ts",
  );
  const controller = new AbortController();
  let active = false;
  await assert.rejects(
    processPdfPassword(new File([await source()], "source.pdf"), {
      operation: "lock",
      openPassword: OPEN,
      signal: controller.signal,
      onProgress: (p) => {
        if (p >= 12) {
          active = true;
          controller.abort();
        }
      },
    }),
    (e) => e.name === "AbortError",
  );
  assert(active);
  assert.equal(stopped, 1);
  const retry = await processPdfPassword(
    new File([await source()], "source.pdf"),
    { operation: "lock", openPassword: OPEN },
  );
  assert.equal(stopped, 2);
  assert.equal(
    (await snapshot(new Uint8Array(await retry.blob.arrayBuffer()), OPEN)).pages
      .length,
    4,
  );
  const zipped = await passwordZip([
    { name: "same-protected.pdf", blob: retry.blob },
    { name: "same-protected.pdf", blob: retry.blob },
  ]);
  const files = require("fflate").unzipSync(
    new Uint8Array(await zipped.arrayBuffer()),
  );
  assert.deepEqual(Object.keys(files), [
    "1_same-protected.pdf",
    "2_same-protected.pdf",
  ]);
  assert.deepEqual(
    files["1_same-protected.pdf"],
    files["2_same-protected.pdf"],
  );
});
