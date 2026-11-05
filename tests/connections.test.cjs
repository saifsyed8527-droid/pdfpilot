const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { load } = require("../scripts/load-pseo-modules.cjs");
const registry = load("src/lib/connections/registry.ts");
const engine = load("src/lib/connections/engine.ts");
const cloud = load("src/lib/cloud-import.ts");

test("connections enumerate only resolvable pairs and paginate without omissions", () => {
  const paths = [...registry.connectionPaths()];
  assert.equal(new Set(paths).size, paths.length);
  assert.equal(paths.length, registry.connectionCount());
  const chunks = [];
  for (let offset = 0; offset < paths.length; offset += 37) chunks.push(...registry.connectionSlice(offset, 37));
  assert.deepEqual(chunks, paths);
  assert.ok(paths.length > 300);
  assert.ok(paths.every(registry.isConnectionPath));
  for (const invalid of ["/integrations/missing", "/integrations/csv-to-json/jpg-to-pdf", "/integrations/csv-to-json/json-to-csv", "/integrations/rotate-pdf/add-page-numbers", "/integrations/google-drive/missing"]) assert.equal(registry.isConnectionPath(invalid), false, invalid);
});

test("every published executable connection produces a readable file from its input examples", async () => {
  const { PDFDocument } = require("pdf-lib");
  let checked = 0;
  for (const operation of registry.OPERATIONS) {
    const files = operation.samples.map(name => new File([fs.readFileSync("public/task-examples/" + name)], name));
    for (const connection of registry.connectionTargets(operation.slug)) {
      const steps = [];
      const result = await engine.runConnection(connection.source, connection.target, files, engine.DEFAULT_CONNECTION_OPTIONS, new AbortController().signal, step => steps.push(step));
      assert.deepEqual(steps, [1, 2]);
      assert.ok(result.blob.size > 0, result.filename);
      if (connection.next.output === "pdf") {
        const pdf = await PDFDocument.load(await result.blob.arrayBuffer());
        assert.ok(pdf.getPageCount() > 0, result.filename);
        if (connection.next.kind === "extract") assert.equal(pdf.getPageCount(), 1, result.filename);
      } else if (connection.next.output === "xlsx") {
        const xlsx = require("xlsx");
        const workbook = xlsx.read(await result.blob.arrayBuffer(), { type: "array" });
        const text = xlsx.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
        assert.match(text, /A17/, result.filename);
        assert.match(text, /Pens, blue/, result.filename);
      } else {
        const text = await result.blob.text();
        assert.match(text, /A17/, result.filename);
        assert.match(text, /Pens, blue/, result.filename);
        if (connection.next.output === "json") assert.ok(Array.isArray(JSON.parse(text)), result.filename);
      }
      checked++;
    }
  }
  assert.ok(checked > 80);
});

test("connection cancellation, invalid input and subsequent retry retain correct state", async () => {
  const files = [new File([fs.readFileSync("public/task-examples/repeated.csv")], "repeated.csv")];
  const run = (files, signal = new AbortController().signal) => engine.runConnection("duplicate-row-remover", "csv-to-json", files, engine.DEFAULT_CONNECTION_OPTIONS, signal);
  const stopped = new AbortController(); stopped.abort();
  await assert.rejects(run(files, stopped.signal), { name: "AbortError" });
  await assert.rejects(run([new File(["a,a\n1,2"], "bad.csv")]), /unique/);
  await assert.rejects(run([new File(["x".repeat(engine.CONNECTION_FILE_LIMIT + 1)], "large.csv")]), /4 MiB/);
  const result = JSON.parse(await (await run(files)).blob.text());
  assert.equal(result.length, 3);
  assert.equal(result[1].item, "Pens, blue");
});

test("cloud links accept provider file URLs and reject folders, credentials and lookalike hosts", () => {
  const drive = cloud.cloudDownload("https://drive.google.com/file/d/abcdefghijklm/view?resourcekey=key_123", "google-drive");
  assert.equal(new URL(drive.url).hostname, "drive.usercontent.google.com");
  assert.equal(new URL(drive.url).searchParams.get("resourcekey"), "key_123");
  const dropbox = cloud.cloudDownload("https://www.dropbox.com/scl/fi/token/file.pdf?rlkey=keep&dl=0", "dropbox");
  assert.equal(new URL(dropbox.url).searchParams.get("rlkey"), "keep");
  assert.equal(new URL(dropbox.url).searchParams.get("dl"), "1");
  assert.match(cloud.cloudDownload("https://docs.google.com/spreadsheets/d/abcdefghijklm/edit", "google-drive", "xlsx").url, /format=xlsx/);
  for (const link of ["https://drive.google.com.evil.test/file/d/abcdefghijklm/view", "http://drive.google.com/file/d/abcdefghijklm/view", "https://user:secret@drive.google.com/file/d/abcdefghijklm/view", "https://drive.google.com/drive/folders/abcdefghijklm", "https://127.0.0.1/file/d/abcdefghijklm"]) assert.throws(() => cloud.cloudDownload(link, "google-drive"));
  assert.throws(() => cloud.cloudDownload("https://www.dropbox.com/scl/fo/folder", "dropbox"));
  assert.equal(cloud.cloudFileName("attachment; filename*=UTF-8''%D1%84%D0%B0%D0%B9%D0%BB.pdf", "fallback"), "файл.pdf");
  assert.equal(cloud.cloudFileName('attachment; filename="../bad.pdf"', "fallback"), ".._bad.pdf");
});
