const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const { PDFDocument } = require("pdf-lib");
const { unzipSync } = require("fflate");
const m = { exports: {} };
new Function(
  "require",
  "module",
  "exports",
  ts.transpileModule(
    fs.readFileSync("src/lib/engines/office-batch.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
)(require, m, m.exports);
const {
  runOfficeBatch,
  packageOfficePdfs,
  officeItemKey,
  officeOutputName,
  validateOfficeBatch,
  OFFICE_BATCH_LIMITS,
} = m.exports;
const item = (id, extra = {}) => ({
  id,
  file: new File(["synthetic Office fixture"], `${id}.docx`),
  rotation: 0,
  ...extra,
});
async function pdf(label = "sample") {
  const p = await PDFDocument.create();
  p.setTitle(label);
  p.addPage([200, 300]).drawText(label);
  return new Blob([await p.save()], { type: "application/pdf" });
}
const options = (extra = {}) => ({
  cancelled: () => false,
  progress: () => {},
  ready: () => {},
  failed: () => {},
  ...extra,
});

test("Office batch keeps valid PDFs before and after a failed file and runs only one converter at a time", async () => {
  const items = [item("first"), item("broken"), item("last")],
    seen = [],
    ready = [],
    errors = [],
    progress = [];
  let active = 0,
    maximum = 0;
  const result = await runOfficeBatch(
    items,
    {},
    async (i, report) => {
      active++;
      maximum = Math.max(maximum, active);
      seen.push(i.id);
      try {
        await new Promise((r) => setTimeout(r, 2));
        report(50, "Rendering page");
        if (i.id === "broken") throw new Error("Damaged archive");
        return { blob: await pdf(i.id) };
      } finally {
        active--;
      }
    },
    options({
      ready: (i) => ready.push(i.id),
      failed: (i, error) => errors.push([i.id, error]),
      progress: (n) => progress.push(n),
    }),
  );
  assert.deepEqual(seen, ["first", "broken", "last"]);
  assert.equal(maximum, 1);
  assert.deepEqual(ready, ["first", "last"]);
  assert.deepEqual(errors, [["broken", "Damaged archive"]]);
  assert.deepEqual(Object.keys(result), ["first", "last"]);
  assert.ok(
    progress.every(
      (n, i) =>
        Number.isFinite(n) && n >= 0 && n <= 95 && (!i || n >= progress[i - 1]),
    ),
  );
  for (const id of ready) {
    const doc = await PDFDocument.load(await result[id].blob.arrayBuffer());
    assert.equal(doc.getTitle(), id);
    assert.equal(doc.getPageCount(), 1);
  }
});

test("cancel waits for converter cleanup, preserves completed files, and retry converts only unfinished files", async () => {
  const items = [item("first"), item("second"), item("third")],
    ready = [],
    seen = [];
  let cancelled = false,
    cleaned = false;
  const result = await runOfficeBatch(
    items,
    {},
    async (i, progress, stopped) => {
      seen.push(i.id);
      if (i.id === "second") {
        cancelled = true;
        try {
          assert.equal(stopped(), true);
          await new Promise((r) => setTimeout(r, 2));
          throw new Error("Cancelled");
        } finally {
          cleaned = true;
        }
      }
      return { blob: await pdf(i.id) };
    },
    options({
      cancelled: () => cancelled,
      ready: (i) => ready.push(i.id),
      failed: () => assert.fail("Cancellation is not a file failure"),
    }),
  );
  assert.equal(cleaned, true);
  assert.deepEqual(seen, ["first", "second"]);
  assert.deepEqual(ready, ["first"]);
  assert.deepEqual(Object.keys(result), ["first"]);
  const retry = [];
  const final = await runOfficeBatch(
    items,
    result,
    async (i) => {
      retry.push(i.id);
      return { blob: await pdf(i.id) };
    },
    options(),
  );
  assert.deepEqual(retry, ["second", "third"]);
  assert.equal(final.first.blob, result.first.blob);
  assert.equal(Object.keys(final).length, 3);
});

test("changing rotation or selected sheets invalidates only the affected PDF; reordering preserves cached files", async () => {
  const items = [
    item("rotated"),
    item("workbook", { selectedSheets: ["Summary", "Details"] }),
    item("unchanged"),
  ];
  const initial = await runOfficeBatch(
    items,
    {},
    async (i) => ({ blob: await pdf(i.id) }),
    options(),
  );
  const changed = [
      items[2],
      { ...items[1], selectedSheets: ["Details"] },
      { ...items[0], rotation: 90 },
    ],
    converted = [];
  const result = await runOfficeBatch(
    changed,
    initial,
    async (i) => {
      converted.push(i.id);
      return { blob: await pdf(i.id + " updated") };
    },
    options(),
  );
  assert.deepEqual(converted, ["workbook", "rotated"]);
  assert.equal(result.unchanged.blob, initial.unchanged.blob);
  assert.notEqual(result.workbook.key, initial.workbook.key);
  assert.notEqual(result.rotated.key, initial.rotated.key);
  await runOfficeBatch(
    [...changed].reverse(),
    result,
    async () => assert.fail("Reordering should not render again"),
    options(),
  );
});

test("invalid or empty converter output is rejected without losing later valid PDFs, and deadlines report a retryable error", async () => {
  const items = [item("bad"), item("empty"), item("slow"), item("valid")],
    errors = [],
    originalNow = Date.now;
  const empty = await PDFDocument.create();
  const emptyBytes = await empty.save({ addDefaultPage: false });
  let now = 1000;
  Date.now = () => now;
  try {
    const result = await runOfficeBatch(
      items,
      {},
      async (i) => {
        if (i.id === "bad") return { blob: new Blob(["not a PDF"]) };
        if (i.id === "empty") return { blob: new Blob([emptyBytes]) };
        if (i.id === "slow") now += 180001;
        return { blob: await pdf(i.id) };
      },
      options({ failed: (i, e) => errors.push([i.id, e]) }),
    );
    assert.deepEqual(Object.keys(result), ["valid"]);
    assert.deepEqual(
      errors.map((e) => e[0]),
      ["bad", "empty", "slow"],
    );
    assert.match(errors[1][1], /no pages/);
    assert.match(errors[2][1], /too long/);
  } finally {
    Date.now = originalNow;
  }
});

test("Office file and output limits reject oversized batches before conversion or packaging", async () => {
  assert.throws(() => validateOfficeBatch([]), /1 and 20/);
  assert.throws(
    () =>
      validateOfficeBatch(Array.from({ length: 21 }, (_, i) => item("" + i))),
    /1 and 20/,
  );
  assert.throws(
    () => validateOfficeBatch([item("a"), item("a")]),
    /selection changed/,
  );
  assert.throws(
    () =>
      validateOfficeBatch([
        item("empty", { file: new File([], "empty.xlsx") }),
      ]),
    /nonempty/,
  );
  const fake = (size) => ({ name: "synthetic.xlsx", size });
  assert.throws(
    () =>
      validateOfficeBatch([
        item("large", { file: fake(OFFICE_BATCH_LIMITS.fileBytes + 1) }),
      ]),
    /100MB/,
  );
  assert.throws(
    () =>
      validateOfficeBatch(
        [0, 1, 2].map((n) => item("" + n, { file: fake(80 * 1024 * 1024) })),
      ),
    /200MB/,
  );
  const tooBig = {
    blob: {
      size: OFFICE_BATCH_LIMITS.outputBytes + 1,
      arrayBuffer: () => assert.fail("Never allocate oversized output"),
    },
    name: "large.pdf",
    key: officeItemKey(item("a")),
  };
  await assert.rejects(
    () => packageOfficePdfs([tooBig], "result.zip"),
    /200MB/,
  );
  const failures = [];
  await runOfficeBatch(
    [item("a")],
    {},
    async () => tooBig,
    options({ failed: (_, error) => failures.push(error) }),
  );
  assert.match(failures[0], /exceed 200MB/);
});

test("ZIP preserves Unicode and every PDF when generated suffixes collide; single PDF retains exact bytes and previews", async () => {
  const names = [
      "Report.docx",
      "report.DOCX",
      "report-2.docx",
      "हिन्दी.docx",
      "تقرير.xlsx",
      "e\u0301.pptx",
    ],
    outputs = [];
  for (let n = 0; n < names.length; n++)
    outputs.push({
      blob: await pdf("file" + n),
      key: "test",
      name: officeOutputName(names[n]),
    });
  const packed = await packageOfficePdfs(outputs, "documents.zip"),
    entries = unzipSync(new Uint8Array(await packed.blob.arrayBuffer()));
  assert.equal(packed.count, 6);
  assert.deepEqual(Object.keys(entries), [
    "Report.pdf",
    "report-2.pdf",
    "report-2-2.pdf",
    "हिन्दी.pdf",
    "تقرير.pdf",
    "é.pdf",
  ]);
  let n = 0;
  for (const bytes of Object.values(entries))
    assert.equal((await PDFDocument.load(bytes)).getTitle(), "file" + n++);
  assert.equal(
    officeOutputName("folder/name:report.docx"),
    "folder_name_report.pdf",
  );
  assert.equal(
    officeOutputName("😀".repeat(161) + ".docx"),
    "😀".repeat(160) + ".pdf",
  );
  outputs[0].pagePreviews = ["data:image/png;base64,test"];
  const single = await packageOfficePdfs([outputs[0]], "unused.zip");
  assert.equal(single.blob, outputs[0].blob);
  assert.equal(single.filename, "Report.pdf");
  assert.deepEqual(single.pagePreviews, outputs[0].pagePreviews);
});

test("cancelled packaging produces no download, including cancellation while reading a ready PDF", async () => {
  assert.equal(await packageOfficePdfs([], "none.zip", () => true), null);
  let cancelled = false;
  const blob = await pdf();
  const delayed = {
    size: blob.size,
    arrayBuffer: async () => {
      cancelled = true;
      return blob.arrayBuffer();
    },
  };
  const packed = await packageOfficePdfs(
    [
      { name: "first.pdf", blob: delayed },
      { name: "second.pdf", blob },
    ],
    "files.zip",
    () => cancelled,
  );
  assert.equal(packed, null);
});
