const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  sharp = require("sharp");
const { PDFDocument, PDFName, PDFRawStream } = require("pdf-lib"),
  { unzipSync } = require("fflate"),
  { createCanvas, loadImage } = require("@napi-rs/canvas");
const { load } = require("../scripts/load-pseo-modules.cjs"),
  { createImagePdf, inspectImagePdfBytes, IMAGE_PDF_LIMITS } = load(
    "src/lib/engines/jpg-to-pdf-engine.ts",
  );
const defaults = {
  orientation: "auto",
  pageSize: "fit",
  margin: "none",
  merge: true,
};
const save = (name, bytes) => {
  if (process.env.IMAGE_PDF_QA_DIR) {
    fs.mkdirSync(process.env.IMAGE_PDF_QA_DIR, { recursive: true });
    fs.writeFileSync(path.join(process.env.IMAGE_PDF_QA_DIR, name), bytes);
  }
};
const file = (bytes, name = "phone.jpg", type = "image/jpeg") =>
  new File([bytes], name, { type });
const input = (
  bytes,
  name = "phone.jpg",
  rotation = 0,
  type = "image/jpeg",
) => ({ file: file(bytes, name, type), rotation });
async function photo(orientation = 1) {
  const raw = Buffer.alloc(160 * 100 * 3);
  for (let y = 0; y < 100; y++)
    for (let x = 0; x < 160; x++) {
      const color =
        y < 50
          ? x < 80
            ? [230, 20, 30]
            : [20, 200, 40]
          : x < 80
            ? [30, 40, 230]
            : [230, 200, 20];
      for (let c = 0; c < 3; c++) raw[(y * 160 + x) * 3 + c] = color[c];
    }
  return sharp(raw, { raw: { width: 160, height: 100, channels: 3 } })
    .withMetadata({ orientation })
    .jpeg({ quality: 98, chromaSubsampling: "4:4:4" })
    .toBuffer();
}
let pdfjs;
async function render(pdf, n, scale = 4 / 3) {
  pdfjs ??= await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(pdf) }),
    doc = await task.promise;
  try {
    const page = await doc.getPage(n),
      viewport = page.getViewport({ scale }),
      canvas = createCanvas(
        Math.round(viewport.width),
        Math.round(viewport.height),
      );
    await page.render({
      canvas,
      canvasContext: canvas.getContext("2d"),
      viewport,
    }).promise;
    return {
      width: canvas.width,
      height: canvas.height,
      data: canvas
        .getContext("2d")
        .getImageData(0, 0, canvas.width, canvas.height).data,
    };
  } finally {
    await task.destroy();
  }
}
function rgb(image, x, y) {
  return [
    ...image.data.slice(
      (y * image.width + x) * 4,
      (y * image.width + x) * 4 + 3,
    ),
  ];
}

test("all eight saved EXIF orientations compose with every clockwise rotation without recompressing JPEGs", async () => {
  const inputs = [],
    expected = [];
  for (let exif = 1; exif <= 8; exif++) {
    const bytes = await photo(exif);
    save(`orientation-${exif}.jpg`, bytes);
    for (const rotation of [0, 90, 180, 270]) {
      inputs.push(input(bytes, `orientation-${exif}.jpg`, rotation));
      expected.push({ bytes, rotation });
    }
  }
  // Two batches also exercise the same 30-image bound used by the public tool.
  for (let start = 0; start < 32; start += 16) {
    const out = await createImagePdf(
        inputs.slice(start, start + 16),
        defaults,
        () => {},
        () => false,
      ),
      bytes = new Uint8Array(await out.blob.arrayBuffer()),
      pdf = await PDFDocument.load(bytes);
    save(`orientation-grid-${start}.pdf`, bytes);
    assert.equal(pdf.getPageCount(), 16);
    for (let i = 0; i < 16; i++) {
      const e = expected[start + i],
        want = await sharp(e.bytes)
          .autoOrient()
          .rotate(e.rotation)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true }),
        actual = await render(bytes, i + 1);
      assert.deepEqual(
        [actual.width, actual.height],
        [want.info.width, want.info.height],
      );
      for (const [fx, fy] of [
        [0.2, 0.2],
        [0.8, 0.2],
        [0.2, 0.8],
        [0.8, 0.8],
      ]) {
        const x = Math.floor(actual.width * fx),
          y = Math.floor(actual.height * fy),
          got = rgb(actual, x, y),
          wanted = [
            ...want.data.slice(
              (y * actual.width + x) * 4,
              (y * actual.width + x) * 4 + 3,
            ),
          ];
        assert.ok(
          got.every((v, c) => Math.abs(v - wanted[c]) <= 3),
          `orientation/rotation ${start + i}: ${got} vs ${wanted}`,
        );
      }
    }
    const dct = pdf.context
      .enumerateIndirectObjects()
      .map(([, v]) => v)
      .filter(
        (v) =>
          v instanceof PDFRawStream &&
          v.dict.get(PDFName.of("Filter")) === PDFName.of("DCTDecode"),
      );
    assert.equal(dct.length, 16);
    for (let i = 0; i < 16; i++)
      assert.deepEqual(
        Buffer.from(dct[i].getContents()),
        expected[start + i].bytes,
      );
  }
});

test("PNG transparency, EXIF rotation and exact A4/Letter margins survive the exported PDF", async () => {
  const png = await sharp({
    create: { width: 160, height: 100, channels: 4, background: "#00000000" },
  })
    .composite([
      {
        input: Buffer.from(
          '<svg width="80" height="50"><rect width="80" height="50" fill="#e6141e"/></svg>',
        ),
        left: 0,
        top: 0,
      },
    ])
    .withMetadata({ orientation: 6 })
    .png()
    .toBuffer();
  save("transparent-rotated.png", png);
  assert.equal(inspectImagePdfBytes(png).orientation, 6);
  for (const [pageSize, w, h] of [
    ["a4", 595.28, 841.89],
    ["letter", 612, 792],
  ])
    for (const margin of ["none", "small", "big"]) {
      const out = await createImagePdf(
          [input(png, "透明.png", 0, "image/png")],
          { ...defaults, orientation: "portrait", pageSize, margin },
          () => {},
          () => false,
        ),
        bytes = new Uint8Array(await out.blob.arrayBuffer()),
        pdf = await PDFDocument.load(bytes);
      assert.deepEqual(
        [pdf.getPage(0).getWidth(), pdf.getPage(0).getHeight()],
        [w, h],
      );
      const streams = pdf.context
        .enumerateIndirectObjects()
        .map(([, v]) => v)
        .filter(
          (v) => v instanceof PDFRawStream && v.dict.has(PDFName.of("SMask")),
        );
      assert.equal(streams.length, 1);
      const image = await render(bytes, 1, 1);
      assert.deepEqual(rgb(image, 2, 2), [255, 255, 255]);
    }
  const out = await createImagePdf(
    [input(png, "transparent.png", 0, "image/png")],
    defaults,
    () => {},
    () => false,
  );
  save("transparent.pdf", new Uint8Array(await out.blob.arrayBuffer()));
  const image = await render(new Uint8Array(await out.blob.arrayBuffer()), 1);
  assert.deepEqual([image.width, image.height], [100, 160]);
  assert.ok(rgb(image, 75, 30)[0] > 200);
  assert.deepEqual(rgb(image, 20, 130), [255, 255, 255]);
});

test("headers, formats, geometry and selection limits reject damaged or excessive files before embedding", async () => {
  const jpeg = await photo(),
    valid = input(jpeg);
  assert.equal(inspectImagePdfBytes(jpeg).format, "jpeg");
  for (const bad of [
    jpeg.subarray(0, jpeg.length - 8),
    Buffer.from("not an image"),
    Buffer.from("<svg/>"),
  ])
    await assert.rejects(
      createImagePdf(
        [input(bad)],
        defaults,
        () => {},
        () => false,
      ),
    );
  await assert.rejects(
    createImagePdf(
      [],
      defaults,
      () => {},
      () => false,
    ),
    /1 and 30/,
  );
  await assert.rejects(
    createImagePdf(
      Array(31).fill(valid),
      defaults,
      () => {},
      () => false,
    ),
    /1 and 30/,
  );
  await assert.rejects(
    createImagePdf(
      [valid],
      { ...defaults, pageSize: "huge" },
      () => {},
      () => false,
    ),
    /valid page/,
  );
  const oversized = input(jpeg);
  Object.defineProperty(oversized.file, "size", {
    value: IMAGE_PDF_LIMITS.fileBytes + 1,
  });
  await assert.rejects(
    createImagePdf(
      [oversized],
      defaults,
      () => {},
      () => false,
    ),
    /100MB/,
  );
  await assert.rejects(
    createImagePdf(
      Array(3).fill(oversized),
      defaults,
      () => {},
      () => false,
    ),
    /200MB/,
  );
  const png = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  const bomb = Buffer.from(png);
  bomb.writeUInt32BE(1_000_000, 16);
  bomb.writeUInt32BE(require("node:zlib").crc32(bomb.subarray(12, 29)), 29);
  assert.throws(() => inspectImagePdfBytes(bomb), /40 megapixels/);
  save("oversized.png", bomb);
  save("damaged.jpg", jpeg.subarray(0, jpeg.length - 8));
  const renamed = await createImagePdf(
    [input(png, "actually-png.jpg", 0, "image/jpeg")],
    defaults,
    () => {},
    () => false,
  );
  assert.equal(
    (await PDFDocument.load(await renamed.blob.arrayBuffer())).getPageCount(),
    1,
  );
});

test("separate PDFs retain Unicode names and collision-safe entries without changing order", async () => {
  const jpeg = await photo(6),
    names = ["चित्र.jpg", "चित्र.jpg", "चित्र-2.jpg", "PHONE.jpg", "phone.jpg"];
  const out = await createImagePdf(
      names.map((name) => input(jpeg, name)),
      { ...defaults, merge: false },
      () => {},
      () => false,
    ),
    entries = unzipSync(new Uint8Array(await out.blob.arrayBuffer()));
  assert.equal(Object.keys(entries).length, 5);
  assert.ok(Object.keys(entries).includes("चित्र.pdf"));
  assert.equal(
    new Set(Object.keys(entries).map((x) => x.toLowerCase())).size,
    5,
  );
  for (const bytes of Object.values(entries)) {
    const pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(), 1);
    assert.deepEqual(
      [pdf.getPage(0).getWidth(), pdf.getPage(0).getHeight()],
      [75, 120],
    );
  }
  save("separate.zip", new Uint8Array(await out.blob.arrayBuffer()));
});

test("cancellation during reading, after a page and after serialization discards stale output and permits retry", async () => {
  const jpeg = await photo(),
    valid = input(jpeg);
  let cancelled = false;
  const delayed = input(jpeg);
  delayed.file.arrayBuffer = async () => {
    cancelled = true;
    return jpeg.buffer.slice(
      jpeg.byteOffset,
      jpeg.byteOffset + jpeg.byteLength,
    );
  };
  assert.equal(
    await createImagePdf(
      [delayed],
      defaults,
      () => {},
      () => cancelled,
    ),
    null,
  );
  for (const threshold of [30, 90, 100]) {
    cancelled = false;
    assert.equal(
      await createImagePdf(
        [valid, valid, valid],
        defaults,
        (n) => {
          if (n >= threshold) cancelled = true;
        },
        () => cancelled,
      ),
      null,
    );
  }
  assert.ok(
    await createImagePdf(
      [valid],
      defaults,
      () => {},
      () => false,
    ),
  );
});

test("PNG checksum validation rejects damaged pixel data and validation bitmaps are released", async () => {
  const previous = global.createImageBitmap;
  let closed = 0;
  global.createImageBitmap = async (blob) => {
    const bitmap = await loadImage(Buffer.from(await blob.arrayBuffer()));
    bitmap.close = () => closed++;
    return bitmap;
  };
  try {
    const jpeg = await photo();
    assert.ok(
      await createImagePdf(
        [input(jpeg)],
        defaults,
        () => {},
        () => false,
      ),
    );
    assert.equal(closed, 1);
    const corrupt = await sharp({
      create: { width: 20, height: 20, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    const idat = corrupt.indexOf(Buffer.from("IDAT"));
    corrupt[idat + 4] = 0;
    await assert.rejects(
      createImagePdf(
        [input(corrupt, "bad.png", 0, "image/png")],
        defaults,
        () => {},
        () => false,
      ),
    );
  } finally {
    if (previous === undefined) delete global.createImageBitmap;
    else global.createImageBitmap = previous;
  }
});
