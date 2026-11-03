const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript");
const { PDFDocument } = require("pdf-lib"),
  { unzipSync, strFromU8 } = require("fflate");
function load(filename, cache = new Map()) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const m = { exports: {} };
  cache.set(filename, m);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (n) =>
      n.endsWith(".mjs")
        ? require(path.resolve(path.dirname(filename), n))
        : n.startsWith(".")
          ? load(path.resolve(path.dirname(filename), n + ".ts"), cache)
          : require(n),
    m,
    m.exports,
  );
  return m.exports;
}
const {
  translationChunks,
  translationPair,
  translatePages,
  translatedText,
  translatedWordPages,
  TranslationInputError,
} = load("src/lib/engines/pdf-translation.ts");
const page = (pageNumber, text) => ({
  pageNumber,
  paragraphs: text,
  paragraphStyles: text.map(() => "body"),
});
test("translated PDFs keep complete logical Unicode across complex scripts without duplicate visible-glyph text", async () => {
  const oldFetch = global.fetch;
  global.fetch = (url) =>
    typeof url === "string" &&
    (url.startsWith("/fonts/") || url === "/tesseract/pdf.ttf")
      ? Promise.resolve(
          new Response(
            fs.readFileSync(path.join(process.cwd(), "public", url)),
          ),
        )
      : oldFetch(url);
  try {
    const values = [
      "ऑर्डर 0012 की लागत 125 डॉलर है।",
      "يرجى الاحتفاظ بالإيصال الأصلي 125",
      "নমস্কার বিশ্ব 125",
      "สวัสดีชาวโลก 125",
      "日本語の文書です。合計125円。",
      "שלום עולם 125",
    ];
    const pages = values.map((value, i) => ({
      pageNumber: i + 1,
      original: [],
      translated: [value],
      paragraphStyles: ["body"],
    }));
    const { createTranslatedPdf } = load("src/lib/engines/translated-pdf.ts");
    const blob = await createTranslatedPdf(pages);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (process.env.TRANSLATION_QA_DIR)
      fs.writeFileSync(
        path.join(process.env.TRANSLATION_QA_DIR, "outline-scripts.pdf"),
        bytes,
      );
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = pdfjs.getDocument({
      data: bytes,
      standardFontDataUrl:
        path.resolve("node_modules/pdfjs-dist/standard_fonts") + "/",
    });
    try {
      const doc = await task.promise;
      assert.equal(doc.numPages, values.length);
      for (let i = 0; i < values.length; i++) {
        const items = (await (await doc.getPage(i + 1)).getTextContent()).items;
        const actual = items
          .map((item) => item.str || "")
          .join(" ")
          .replace(/\s/g, "")
          .normalize("NFC");
        assert.equal(
          actual,
          (`Source page ${i + 1}` + values[i])
            .replace(/\s/g, "")
            .normalize("NFC"),
        );
      }
    } finally {
      await task.destroy();
    }
  } finally {
    global.fetch = oldFetch;
  }
});
const options = { sourceLanguage: "en", targetLanguage: "hi" };
test("translation chunks preserve every Unicode source character and sentence order within the model limit", () => {
  for (const [language, text] of [
    ["en", "First sentence. " + "Long unbroken text ".repeat(400)],
    ["hi", "हिन्दी में यह नमूना पाठ है। ".repeat(180)],
    ["ar", "مرحبا بالعالم. ".repeat(400)],
    ["zh", "这是中文文本。".repeat(400)],
    ["en", "👨‍👩‍👧‍👦".repeat(200)],
  ]) {
    const chunks = translationChunks(text, language);
    assert.equal(chunks.join(""), text);
    assert.ok(chunks.every((c) => c.length <= 1500));
    assert.ok(
      chunks.every((c) => !/[\ud800-\udbff]$/.test(c) && !/^\p{M}/u.test(c)),
    );
  }
  assert.throws(() => translationChunks("a", "en", 0), /Invalid/);
  assert.throws(() => translationChunks("a".repeat(200001), "en"), /too long/);
  assert.throws(() => translationPair("en", "en"), /different/);
  assert.throws(() => translationPair("invented", "hi"), /supported/);
});
test("translation processes every paragraph sequentially, preserves source page numbers and marks blank pages", async () => {
  const calls = [];
  let inFlight = 0;
  const translator = {
    async translate(text) {
      assert.equal(inFlight++, 0);
      calls.push(text);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      return "अनुवाद " + text;
    },
    destroy() {},
  };
  const result = await translatePages(
    [
      page(2, ["Hello.", "A second paragraph."]),
      page(5, []),
      page(7, ["Last page."]),
    ],
    translator,
    options,
  );
  assert.deepEqual(calls, ["Hello.", "A second paragraph.", "Last page."]);
  assert.deepEqual(
    result.map((p) => p.pageNumber),
    [2, 5, 7],
  );
  assert.equal(result[2].translated[0], "अनुवाद Last page.");
  assert.match(translatedText(result), /Source page 5\n\n\[No readable text/);
  assert.match(translatedText(result, true), /Original\nHello/);
  assert.equal(result[0].original[0], "Hello.");
});
test("cancelled translations return no partial document, suppress further work, and can retry", async () => {
  const controller = new AbortController();
  let calls = 0;
  const translator = {
    async translate() {
      calls++;
      controller.abort();
      return "पहला";
    },
    destroy() {},
  };
  await assert.rejects(
    translatePages([page(1, ["first", "second"])], translator, {
      ...options,
      signal: controller.signal,
    }),
    { name: "AbortError" },
  );
  assert.equal(calls, 1);
  const retry = await translatePages(
    [page(1, ["first", "second"])],
    {
      async translate(v) {
        return "नया " + v;
      },
      destroy() {},
    },
    options,
  );
  assert.equal(retry[0].translated.length, 2);
  await assert.rejects(
    translatePages([page(1, ["first"])], translator, {
      ...options,
      signal: controller.signal,
    }),
    { name: "AbortError" },
  );
  assert.equal(calls, 1);
});
test("excessive input, missing output and excessive model output stop rather than silently dropping content", async () => {
  let calls = 0;
  const translator = {
    async translate() {
      calls++;
      return "";
    },
    destroy() {},
  };
  for (const pages of [
    [],
    Array.from({ length: 51 }, (_, i) => page(i + 1, ["a"])),
    [page(1, ["a".repeat(200001)])],
    [page(1, [])],
  ])
    await assert.rejects(
      translatePages(pages, translator, options),
      TranslationInputError,
    );
  assert.equal(calls, 0);
  await assert.rejects(
    translatePages([page(1, ["Hello"])], translator, options),
    /no text/,
  );
  await assert.rejects(
    translatePages(
      [page(1, ["Hello"])],
      {
        async translate() {
          return "x".repeat(1000001);
        },
        destroy() {},
      },
      options,
    ),
    /too large/,
  );
});
test("actual Word and PDF exports keep Hindi/Arabic text, source page boundaries and optional original text", async () => {
  const oldFetch = global.fetch;
  global.fetch = (url) =>
    typeof url === "string" &&
    (url.startsWith("/fonts/") || url === "/tesseract/pdf.ttf")
      ? Promise.resolve(
          new Response(
            fs.readFileSync(path.join(process.cwd(), "public", url)),
          ),
        )
      : oldFetch(url);
  try {
    const pages = [
      {
        pageNumber: 2,
        original: ["Hello"],
        translated: [
          "नमस्ते। ऑर्डर 0012 की लागत 125 डॉलर है। कृपया मूल रसीद रखें।",
        ],
        paragraphStyles: ["body"],
      },
      {
        pageNumber: 7,
        original: [
          "Good morning",
          "Please keep the original receipt.",
          "Sample document - page 51",
        ],
        translated: [
          "مرحبا بالعالم 125",
          "الطلب 0012 يكلف 125 دولار. يرجى الاحتفاظ بالإيصال الأصلي.",
          "نموذج الوثيقة - الصفحة 51",
        ],
        paragraphStyles: ["body", "body", "heading2"],
      },
    ];
    const { createWordFromPages } = load("src/lib/engines/pdf-word-engine.ts"),
      { createTranslatedPdf } = load("src/lib/engines/translated-pdf.ts");
    const word = await createWordFromPages(translatedWordPages(pages, true));
    const xml = strFromU8(
      unzipSync(new Uint8Array(await word.arrayBuffer()))["word/document.xml"],
    );
    assert.match(xml, /नमस्ते/);
    assert.match(xml, /مرحبا بالعالم 125/);
    assert.match(xml, /Hello/);
    assert.match(xml, /w:bidi/);
    assert.equal((xml.match(/w:type="page"/g) || []).length, 1);
    const blob = await createTranslatedPdf(pages, { bilingual: true });
    if (process.env.TRANSLATION_QA_DIR)
      fs.writeFileSync(
        path.join(process.env.TRANSLATION_QA_DIR, "outline-regression.pdf"),
        Buffer.from(await blob.arrayBuffer()),
      );
    const pdf = await PDFDocument.load(await blob.arrayBuffer());
    assert.equal(pdf.getPageCount(), 2);
    assert.ok(
      pdf.getPages().every((p) => Math.abs(p.getWidth() - 595.28) < 0.01),
    );
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = pdfjs.getDocument({
      data: new Uint8Array(await blob.arrayBuffer()),
      standardFontDataUrl:
        path.resolve("node_modules/pdfjs-dist/standard_fonts") + "/",
    });
    const doc = await task.promise;
    try {
      const first = (await (await doc.getPage(1)).getTextContent()).items
        .map((i) => i.str || "")
        .join(" ");
      const second = (await (await doc.getPage(2)).getTextContent()).items
        .map((i) => i.str || "")
        .join(" ");
      assert.match(first, /Source page 2/);
      assert.match(first, /Hello/);
      assert.match(first, /नमस्ते/);
      assert.ok(first.includes(pages[0].translated[0]), first);
      assert.match(second, /Source page 7/);
      assert.match(second, /125/);
      for (const paragraph of pages[1].translated)
        assert.ok(second.includes(paragraph), second);
    } finally {
      await task.destroy();
    }
    const ctrl = new AbortController();
    ctrl.abort();
    await assert.rejects(createTranslatedPdf(pages, { signal: ctrl.signal }), {
      name: "AbortError",
    });
  } finally {
    global.fetch = oldFetch;
  }
});
