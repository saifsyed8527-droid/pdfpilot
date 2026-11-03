const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  ts = require("typescript");
const { PDFDocument, PDFName } = require("pdf-lib");
const { createCanvas } = require("@napi-rs/canvas");
const settings = {
  screenSize: "768",
  pageSize: "a4",
  orientation: "portrait",
  oneLongPage: false,
  margin: "small",
  blockAds: false,
  removeOverlays: false,
};
function load(
  renderer = async () => assert.fail("Rendering should not start"),
) {
  const m = { exports: {} };
  const code = ts.transpileModule(
    fs.readFileSync("src/lib/engines/html-to-pdf-engine.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  new Function("require", "module", "exports", code)(
    (n) =>
      n === "html2canvas"
        ? { default: renderer, __esModule: true }
        : require(n),
    m,
    m.exports,
  );
  return m.exports;
}
function documentFixture(width = 1000, height = 4000) {
  const frames = [],
    scrolls = [];
  const doc = {
    fonts: { ready: Promise.resolve() },
    images: [],
    documentElement: { clientWidth: width, scrollHeight: height },
    defaultView: {
      innerWidth: width,
      innerHeight: 720,
      scrollX: 3,
      scrollY: 70,
      scrollTo: (x, y) => scrolls.push([x, y]),
    },
    querySelectorAll: (s) =>
      s === "*"
        ? Array(30).fill({})
        : s === "iframe.html2canvas-container"
          ? frames
          : s === "a[href]"
            ? doc.links
            : [],
    links: [],
    head: { append: () => {} },
    createElement: () => ({}),
  };
  const addFrame = () => {
    const f = {
      remove: () => {
        const i = frames.indexOf(f);
        if (i >= 0) frames.splice(i, 1);
      },
    };
    frames.push(f);
    return f;
  };
  const element = {
    ownerDocument: doc,
    scrollWidth: width,
    scrollHeight: height,
  };
  return { doc, element, frames, scrolls, addFrame };
}
function tile(options) {
  const c = createCanvas(
    Math.ceil(options.width * options.scale),
    Math.ceil(options.height * options.scale),
  );
  const ctx = c.getContext("2d");
  ctx.fillStyle = options.y === 0 ? "#1565c0" : "#f59e0b";
  ctx.fillRect(0, 0, c.width, c.height);
  c.toBlob = (cb) =>
    cb(new Blob([c.toBuffer("image/jpeg")], { type: "image/jpeg" }));
  return c;
}

test("HTML PDF rejects invalid geometry and cancellation before touching the source", async () => {
  const { htmlPdfGeometry, captureHtmlElementToPdfBlob } = load();
  for (const [w, h] of [
    [0, 100],
    [100, 0],
    [NaN, 100],
    [100, Infinity],
  ])
    assert.throws(() => htmlPdfGeometry(w, h, settings), /valid/);
  for (const patch of [
    { pageSize: "bad" },
    { pageSize: "__proto__" },
    { margin: "bad" },
    { orientation: "bad" },
  ])
    assert.throws(
      () => htmlPdfGeometry(100, 100, { ...settings, ...patch }),
      /valid/,
    );
  const c = new AbortController();
  c.abort();
  await assert.rejects(
    () => captureHtmlElementToPdfBlob(null, settings, undefined, c.signal),
    { name: "AbortError" },
  );
});

test("pending HTML fonts and image listeners stop immediately on cancellation", async () => {
  const { waitForHtmlAssets } = load();
  const fonts = new AbortController();
  const pending = waitForHtmlAssets(
    { fonts: { ready: new Promise(() => {}) }, images: [] },
    fonts.signal,
  );
  fonts.abort();
  await assert.rejects(pending, { name: "AbortError" });
  class TestImage extends EventTarget {
    constructor() {
      super();
      this.active = new Map();
      this.complete = false;
      this.naturalWidth = 0;
    }
    getClientRects() {
      return [{}];
    }
    getAttribute() {
      return "fixture.png";
    }
    addEventListener(n, f, o) {
      this.active.set(n, f);
      super.addEventListener(n, f, o);
    }
    removeEventListener(n, f) {
      this.active.delete(n);
      super.removeEventListener(n, f);
    }
    async decode() {}
  }
  const image = new TestImage(),
    c = new AbortController();
  const work = waitForHtmlAssets(
    { fonts: { ready: Promise.resolve() }, images: [image] },
    c.signal,
  );
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(image.active.size, 2);
  c.abort();
  await assert.rejects(work, { name: "AbortError" });
  assert.equal(image.active.size, 0);
  image.complete = true;
  image.naturalWidth = 12;
  await waitForHtmlAssets({
    fonts: { ready: Promise.resolve() },
    images: [image],
  });
  image.naturalWidth = 0;
  await assert.rejects(
    () =>
      waitForHtmlAssets({
        fonts: { ready: Promise.resolve() },
        images: [image],
      }),
    /missing/,
  );
});

test("actual tiled HTML PDF retains paper geometry, safe links, viewport and all image strips", async () => {
  const f = documentFixture(),
    calls = [],
    canvases = [];
  f.addFrame();
  f.doc.links = [
    {
      href: "https://example.org/page",
      getClientRects: () => [
        { left: 10, right: 200, top: 1450, bottom: 1520, height: 70 },
      ],
    },
    {
      href: "javascript:alert(1)",
      getClientRects: () => assert.fail("Unsafe link"),
    },
    {
      href: "https://user:private@example.org/",
      getClientRects: () => assert.fail("Credential link"),
    },
  ];
  const { captureHtmlElementToPdfBlob } = load(async (_, o) => {
    f.addFrame();
    calls.push(o);
    await o.onclone(f.doc);
    const c = tile(o);
    canvases.push(c);
    return c;
  });
  const blob = await captureHtmlElementToPdfBlob(f.element, settings),
    pdf = await PDFDocument.load(await blob.arrayBuffer());
  assert.equal(pdf.getPageCount(), 3);
  assert.equal(f.frames.length, 1);
  assert.deepEqual(f.scrolls.at(-1), [3, 70]);
  assert.equal(
    calls.reduce((s, o) => s + o.height, 0),
    4000,
  );
  for (const c of calls) {
    assert.equal(c.windowWidth, 1000);
    assert.equal(c.windowHeight, 720);
    assert.ok(c.width * c.height * c.scale * c.scale <= 4000001);
  }
  assert.ok(canvases.every((c) => c.width === 1 && c.height === 1));
  let images = 0,
    links = 0;
  for (const page of pdf.getPages()) {
    assert.deepEqual(page.getSize(), { width: 595, height: 842 });
    const xo = page.node.Resources().lookup(PDFName.of("XObject"));
    images += xo.keys().length;
    const anns = page.node.Annots();
    if (anns)
      for (let i = 0; i < anns.size(); i++) {
        const a = pdf.context.lookup(anns.get(i));
        assert.equal(
          a.lookup(PDFName.of("A")).lookup(PDFName.of("URI")).decodeText(),
          "https://example.org/page",
        );
        links++;
      }
  }
  assert.equal(images, calls.length);
  assert.equal(links, 2);
});

test("HTML cancellation after a tile frees canvas and frames, restores scroll, and a fresh retry exports every page", async () => {
  const f = documentFixture(),
    controller = new AbortController(),
    canvases = [];
  let calls = 0;
  const { captureHtmlElementToPdfBlob } = load(async (_, o) => {
    calls++;
    f.addFrame();
    await o.onclone(f.doc);
    const c = tile(o);
    canvases.push(c);
    return c;
  });
  await assert.rejects(
    () =>
      captureHtmlElementToPdfBlob(
        f.element,
        settings,
        () => controller.abort(),
        controller.signal,
      ),
    { name: "AbortError" },
  );
  assert.equal(calls, 1);
  assert.equal(f.frames.length, 0);
  assert.ok(canvases.every((c) => c.width === 1));
  assert.deepEqual(f.scrolls.at(-1), [3, 70]);
  const retry = await captureHtmlElementToPdfBlob(f.element, settings);
  assert.equal(
    (await PDFDocument.load(await retry.arrayBuffer())).getPageCount(),
    3,
  );
});

test("cancellation during canvas work and clone errors leave no temporary frame or partial PDF", async () => {
  for (const mode of ["abort", "clone-error"]) {
    const f = documentFixture(),
      controller = new AbortController();
    let canvas;
    const { captureHtmlElementToPdfBlob } = load(async (_, o) => {
      f.addFrame();
      if (mode === "clone-error") throw new Error("Synthetic clone failure");
      await o.onclone(f.doc);
      canvas = tile(o);
      controller.abort();
      return canvas;
    });
    await assert.rejects(
      () =>
        captureHtmlElementToPdfBlob(
          f.element,
          settings,
          undefined,
          controller.signal,
        ),
      mode === "abort" ? { name: "AbortError" } : /Synthetic clone failure/,
    );
    assert.equal(f.frames.length, 0);
    assert.deepEqual(f.scrolls.at(-1), [3, 70]);
    if (canvas) assert.equal(canvas.width, 1);
  }
});

test("complexity, page count and rendered-pixel bounds stop oversized HTML before creating a canvas", async () => {
  const { captureHtmlElementToPdfBlob } = load();
  const complex = documentFixture();
  complex.doc.querySelectorAll = (s) => (s === "*" ? Array(6001).fill({}) : []);
  await assert.rejects(
    () => captureHtmlElementToPdfBlob(complex.element, settings),
    /too complex/,
  );
  const pages = documentFixture(100, 50000);
  await assert.rejects(
    () => captureHtmlElementToPdfBlob(pages.element, settings),
    /200 PDF pages/,
  );
  const pixels = documentFixture(1200, 25001);
  await assert.rejects(
    () => captureHtmlElementToPdfBlob(pixels.element, settings),
    /image memory/,
  );
});
