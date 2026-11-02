const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript");
const { DOMParser } = require("@xmldom/xmldom");
const prototype = Object.getPrototypeOf(
  new DOMParser().parseFromString("<root/>", "application/xml").documentElement,
);
if (!Object.getOwnPropertyDescriptor(prototype, "children"))
  Object.defineProperty(prototype, "children", {
    get() {
      return Array.from(this.childNodes).filter((node) => node.nodeType === 1);
    },
  });
const nativeGetAttribute = prototype.getAttribute;
prototype.getAttribute = function (name) {
  return this.hasAttribute(name) ? nativeGetAttribute.call(this, name) : null;
};
global.DOMParser = DOMParser;
const originalFetch = global.fetch;
global.fetch = async (url) => {
  assert.match(String(url), /^\/fonts\/[\w.-]+$/);
  return new Response(fs.readFileSync(path.resolve("public" + url)));
};
test.after(() => {
  global.fetch = originalFetch;
});
let bidiModule;
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
      esModuleInterop: true,
    },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (name) =>
      name.endsWith("bidi.min.mjs")
        ? { __esModule: true, default: bidiModule.default }
        : name.startsWith(".")
          ? load(path.resolve(path.dirname(file), name + ".ts"))
          : require(name),
    module,
    module.exports,
  );
  return module.exports;
}
const {
  PDFDocument,
  PDFName,
  PDFArray,
  decodePDFRawStream,
  PDFRawStream,
  PDFHexString,
} = require("pdf-lib");
const evidence = (name, data) => {
  if (process.env.PPTX_QA_DIR) {
    fs.mkdirSync(process.env.PPTX_QA_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(process.env.PPTX_QA_DIR, name),
      Buffer.from(data),
    );
  }
};
test("PPTX-to-PDF renders logical Arabic in visual word order, preserves numbers and Hindi ActualText", async () => {
  bidiModule = await import("../src/lib/vendor/bidi-js/bidi.min.mjs");
  const PptxGenJS = require("pptxgenjs"),
    pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  const slide = pptx.addSlide();
  slide.addText("مرحبا بالعالم", {
    x: 1,
    y: 1,
    w: 8,
    h: 1,
    fontSize: 32,
    rtlMode: true,
    align: "right",
    fontFace: "Arial",
    margin: 0,
  });
  slide.addText("المبلغ 250", {
    x: 1,
    y: 3,
    w: 8,
    h: 1,
    fontSize: 32,
    rtlMode: true,
    align: "right",
    fontFace: "Arial",
    margin: 0,
  });
  slide.addText("नमस्ते दुनिया", {
    x: 1,
    y: 5,
    w: 8,
    h: 1,
    fontSize: 32,
    fontFace: "Arial",
    margin: 0,
  });
  const pptxBlob = await pptx.write({ outputType: "blob" }),
    file = new File([await pptxBlob.arrayBuffer()], "directions.pptx");
  const { renderPptxToPdf } = load("src/lib/engines/pptx-renderer.ts");
  const blob = await renderPptxToPdf(file),
    bytes = new Uint8Array(await blob.arrayBuffer());
  evidence("directions.pptx", await pptxBlob.arrayBuffer());
  evidence("directions.pdf", bytes);
  const pdf = await PDFDocument.load(bytes),
    page = pdf.getPage(0),
    contents = page.node.lookup(PDFName.of("Contents"));
  const streams =
    contents instanceof PDFArray
      ? contents.asArray().map((ref) => pdf.context.lookup(ref))
      : [contents];
  const text = streams
    .map((stream) =>
      Buffer.from(decodePDFRawStream(stream).decode()).toString(),
    )
    .join("\n");
  const b = bidiModule.default();
  const visual = (value) =>
    PDFHexString.fromText(
      b.getReorderedString(value, b.getEmbeddingLevels(value)),
    ).toString();
  assert.ok(
    text.indexOf(visual("بالعالم")) < text.indexOf(visual("مرحبا")),
    "Arabic visual word order",
  );
  assert.ok(text.includes(visual("المبلغ")));
  assert.ok(
    text.includes(PDFHexString.fromText("नमस्ते दुनिया").toString()),
    "logical Indic line includes space",
  );
  assert.match(text, /<323530> Tj/, "Latin digits keep 250 order");
  // The same actual browser-produced native deck retains its existing rendering.
  if (process.env.PPTX_QA_DIR) {
    const native = path.join(
      process.env.PPTX_QA_DIR,
      "browser-editable-native.pptx",
    );
    if (fs.existsSync(native)) {
      const out = await renderPptxToPdf(
        new File([fs.readFileSync(native)], "native.pptx"),
      );
      evidence("rendered-native-fixed.pdf", await out.arrayBuffer());
    }
    const mixed = path.join(
      process.env.PPTX_QA_DIR,
      "editable-multilingual.pptx",
    );
    if (fs.existsSync(mixed)) {
      const out = await renderPptxToPdf(
        new File([fs.readFileSync(mixed)], "mixed.pptx"),
      );
      evidence("rendered-multilingual-fixed.pdf", await out.arrayBuffer());
    }
  }
});
