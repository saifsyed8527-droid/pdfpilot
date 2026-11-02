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
      return Array.from(this.childNodes).filter((n) => n.nodeType === 1);
    },
  });
// Node adapter for native DOMParser's parsererror document on malformed input.
global.DOMParser = class {
  parseFromString(text, type) {
    let bad = false;
    const doc = new DOMParser({
      errorHandler: {
        warning() {
          bad = true;
        },
        error() {
          bad = true;
        },
        fatalError() {
          bad = true;
        },
      },
    }).parseFromString(text, type);
    return bad
      ? new DOMParser().parseFromString(
          '<parsererror xmlns="http://www.mozilla.org/newlayout/xml/parsererror.xml"/>',
          "application/xml",
        )
      : doc;
  }
};
require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    filename,
  );
const {
  inspectXml,
  xmlTable,
  parseDelimited,
  tableXml,
  exportTable,
  readTableFile,
} = require("../src/lib/engines/xml-table-engine.ts");
const XLSX = require("xlsx");
const qa = process.env.XML_TABLE_QA_DIR;
const save = (name, bytes) => {
  if (qa) {
    fs.mkdirSync(qa, { recursive: true });
    fs.writeFileSync(path.join(qa, name), bytes);
  }
};
const source = `<?xml version="1.0" encoding="UTF-8"?>
<catalog xmlns="urn:catalog" batch="2026"><company>PDF Pilot</company><order id="0012"><name>नमस्ते &amp; مرحبا</name><code>00004567890123456789</code><note>  keep spaces  </note><formula>=1+1</formula><created>1704067200</created><items><item sku="A"><name>One</name><qty>2</qty></item><item sku="B"><name>Two</name></item></items></order><order id="0013"><name>Second</name><late>Only in second record</late><created>1704153600000</created></order></catalog>`;
save("nested.xml", source);
save("invalid.xml", "<root><item></root>");
const opts = (extra) => ({
  layout: "table",
  recordPath: "/catalog/order",
  ...extra,
});
const values = (table, index = 1) =>
  Object.fromEntries(
    table.rows[0].map((name, i) => [name, table.rows[index][i]]),
  );
test("XML tables retain later fields, attributes, repeated-item positions, Unicode and exact identifiers", async () => {
  const inspection = await inspectXml(source);
  assert.equal(inspection.suggestedPath, "/catalog/order");
  const table = await xmlTable(inspection, opts());
  assert.equal(table.rows.length, 3);
  assert.equal(values(table)["@id"], "0012");
  assert.equal(values(table).code, "00004567890123456789");
  assert.equal(values(table).note, "  keep spaces  ");
  assert.equal(values(table).name, "नमस्ते & مرحبا");
  assert.equal(values(table)["items/item[1]/@sku"], "A");
  assert.equal(values(table)["items/item[2]/name"], "Two");
  assert.equal(values(table, 2).late, "Only in second record");
  assert.equal(values(table).late, "");
  const copy = await xmlTable(inspection, opts({ parents: true }));
  assert.equal(values(copy)["../catalog/@batch"], "2026");
  assert.equal(values(copy)["../catalog/company"], "PDF Pilot");
  const json = await xmlTable(inspection, opts({ repeated: "json" }));
  assert.deepEqual(JSON.parse(values(json)["items/item"]), [
    { "@sku": "A", name: "One", qty: "2" },
    { "@sku": "B", name: "Two" },
  ]);
  const sorted = await xmlTable(inspection, opts({ alphabetical: true }));
  assert.deepEqual(
    sorted.rows[0],
    [...sorted.rows[0]].sort((a, b) => a.localeCompare(b)),
  );
});
test("path layouts preserve all elements, attributes, empty values and namespaces", async () => {
  const i = await inspectXml(source);
  const kv = await xmlTable(i, { layout: "key-value" });
  assert.ok(
    kv.rows.some(([p, v]) => p === "/catalog/order[1]/@id" && v === "0012"),
  );
  assert.ok(
    kv.rows.some(([p, v]) => p === "/catalog/@xmlns" && v === "urn:catalog"),
  );
  const elements = await xmlTable(i, { layout: "elements" });
  assert.equal(elements.rows.length, i.nodes.length + 1);
  assert.deepEqual(JSON.parse(elements.rows[1][2]), {
    xmlns: "urn:catalog",
    batch: "2026",
  });
  const levels = await xmlTable(i, { layout: "levels" });
  assert.equal(levels.rows.length, i.nodes.length + 1);
  assert.ok(
    levels.rows.some(
      (row) =>
        row[0] === "catalog" &&
        row[1] === "order[1]" &&
        row[2] === "items" &&
        row[3] === "item[2]" &&
        row[4] === "name" &&
        row[5] === "Two",
    ),
  );
  const empty = await xmlTable(
    await inspectXml(
      "<rows><row><blank/></row><row><new>value</new></row></rows>",
    ),
    { layout: "table" },
  );
  assert.equal(values(empty).blank, "");
  assert.equal(values(empty, 2).new, "value");
});
test("actual XLSX and XLS exports preserve string cells, identifiers, whitespace and formula-like values", async () => {
  const table = await xmlTable(
    await inspectXml(source),
    opts({ parents: true }),
  );
  for (const format of ["xlsx", "xls"]) {
    const output = await exportTable(table, { format, name: "records.xml" }),
      bytes = Buffer.from(await output.blob.arrayBuffer());
    save("records." + format, bytes);
    const wb = XLSX.read(bytes, { type: "buffer" }),
      sheet = wb.Sheets[wb.SheetNames[0]],
      rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: true,
        defval: "",
      });
    assert.deepEqual(rows, table.rows);
    for (const name of ["@id", "code", "formula", "created"]) {
      const cell =
        sheet[XLSX.utils.encode_cell({ r: 1, c: table.rows[0].indexOf(name) })];
      assert.equal(cell.t, "s");
      assert.equal(cell.f, undefined);
    }
  }
  const dates = await xmlTable(
    await inspectXml(source),
    opts({ epochDates: true }),
  );
  assert.equal(values(dates).created, "2024-01-01");
  assert.equal(values(dates, 2).created, "2024-01-02");
  assert.equal(dates.convertedDates, 2);
});
test("CSV quoting, delimiters, BOM and spreadsheet-safe export preserve complete values", async () => {
  const table = {
    rows: [
      ["ID", "Name", "Value", "Lines"],
      ["0012", 'नमस्ते; "world"', "=1+1", "one\ntwo"],
      ["0009", "مرحبا", "-12", ""],
    ],
    warnings: [],
    convertedDates: 0,
  };
  for (const delimiter of [",", ";", "\t", "|"]) {
    const output = await exportTable(table, {
      format: "csv",
      name: "data.xml",
      delimiter,
    });
    const text = await output.blob.text();
    assert.equal(output.protectedCells, 1);
    const parsed = await parseDelimited(text, delimiter);
    assert.deepEqual(parsed, [
      table.rows[0],
      [...table.rows[1].slice(0, 2), "'=1+1", "one\ntwo"],
      table.rows[2],
    ]);
  }
  const exact = await exportTable(table, {
    format: "csv",
    name: "data.xml",
    bom: false,
    protectFormulas: false,
  });
  assert.deepEqual(
    await parseDelimited(await exact.blob.text(), ","),
    table.rows,
  );
  save("records.csv", await exact.blob.text());
  assert.deepEqual(await parseDelimited('A,B\r\n"",\r\n\r\n""\r\n', ","), [
    ["A", "B"],
    ["", ""],
    [""],
  ]);
  await assert.rejects(parseDelimited('A,B\n"not closed,2', ","), /not closed/);
  await assert.rejects(parseDelimited('A\n"x"oops', ","), /quoting/);
  const formulaCases = ["-1+1", "-12", "-1e+3", "-.5", " -2*3", "\n=1+1"];
  const safe = await exportTable(
    {
      rows: [["Value"], ...formulaCases.map((v) => [v])],
      warnings: [],
      convertedDates: 0,
    },
    { format: "csv", name: "safe.xml" },
  );
  assert.equal(safe.protectedCells, 3);
  assert.deepEqual(
    (await parseDelimited(await safe.blob.text(), ","))
      .slice(1)
      .map((r) => r[0]),
    ["'-1+1", "-12", "-1e+3", "-.5", "' -2*3", "'\n=1+1"],
  );
});
test("CSV-to-XML preserves duplicate, invalid and Unicode headings, multiline fields and extra columns", async () => {
  const csv =
    'Name,Name,नाम,123,,A&B\r\n"A, B",Second,नमस्ते,0012,"two\nlines",x & y,extra\r\nshort\r\n';
  save("source.csv", csv);
  const rows = await parseDelimited(csv, ","),
    output = await tableXml(rows, {
      header: true,
      root: "records",
      row: "entry",
    });
  assert.equal(new Set(output.mapping.map((m) => m.name)).size, 7);
  assert.equal(output.mapping[1].name, "Name_2");
  assert.equal(output.mapping[2].name, "नाम");
  assert.equal(output.rows, 2);
  assert.match(output.text, /column="A&amp;B"/);
  const parsed = await inspectXml(output.text),
    table = await xmlTable(parsed, { layout: "table" });
  assert.equal(values(table).Name, "A, B");
  assert.equal(values(table).Name_2, "Second");
  assert.equal(values(table)["नाम"], "नमस्ते");
  assert.equal(values(table).column_4, "0012");
  assert.equal(values(table).column_5, "two\nlines");
  assert.equal(values(table).column_7, "extra");
  save("converted.xml", output.text);
  const headerless = await tableXml([["first", "second"], ["third"]], {
    header: false,
    root: "rows",
    row: "row",
  });
  assert.equal(headerless.rows, 2);
  assert.match(headerless.text, /<column_1>first/);
  await assert.rejects(
    tableXml(
      Array.from({ length: 50001 }, () => ["x"]),
      { header: false, root: "rows", row: "row" },
    ),
    /50,000/,
  );
  await assert.rejects(
    tableXml([["A"]], { header: true, root: "rows", row: "row" }),
    /only a header/,
  );
  await assert.rejects(
    tableXml(rows, { header: true, root: "bad:name", row: "row" }),
    /XML names/,
  );
});
test("strict XML, encodings, dimensions and output limits fail clearly", async () => {
  await assert.rejects(inspectXml("<root><item></root>"), /not well formed/);
  await assert.rejects(
    inspectXml('<!DOCTYPE r [<!ENTITY x "a">]><r>&x;</r>'),
    /DOCTYPE/,
  );
  await assert.rejects(
    inspectXml("<r>".repeat(65) + "x" + "</r>".repeat(65)),
    /64 nested/,
  );
  await assert.rejects(
    inspectXml("<r>" + "<x/>".repeat(100_001) + "</r>"),
    /100,000/,
  );
  await assert.rejects(inspectXml("a".repeat(8 * 1024 * 1024 + 1)), /8MB/);
  await assert.rejects(parseDelimited("A\n\u0001", ","), /characters/);
  const utf16 = Buffer.concat([
    Buffer.from([255, 254]),
    Buffer.from("<rows><row><name>नमस्ते</name></row></rows>", "utf16le"),
  ]);
  save("utf16.xml", utf16);
  assert.match(await readTableFile(new File([utf16], "utf16.xml")), /नमस्ते/);
  const table = {
    rows: [Array(257).fill("a"), Array(257).fill("b")],
    warnings: [],
    convertedDates: 0,
  };
  await assert.rejects(
    exportTable(table, { format: "xls", name: "x.xml" }),
    /256 columns/,
  );
  await assert.rejects(
    exportTable(
      { rows: [["A"], ["x".repeat(32768)]], warnings: [], convertedDates: 0 },
      { format: "xlsx", name: "x.xml" },
    ),
    /32,767/,
  );
});
test("conversion cancellation stops a large XML walk and allows an immediate retry", async () => {
  const controller = new AbortController(),
    large =
      "<rows>" +
      Array.from(
        { length: 20_000 },
        (_, i) => `<row><id>${i}</id><value>data</value></row>`,
      ).join("") +
      "</rows>";
  save("large.xml", large);
  const promise = inspectXml(large, controller.signal);
  setTimeout(() => controller.abort(), 5);
  await assert.rejects(promise, { name: "AbortError" });
  const retry = await xmlTable(await inspectXml(source), opts());
  assert.equal(retry.rows.length, 3);
  const c = new AbortController();
  c.abort();
  await assert.rejects(
    exportTable(retry, { format: "csv", name: "x", signal: c.signal }),
    { name: "AbortError" },
  );
});

test("XML expansion limits stop repeated parent text before export allocation", async () => {
  const xml =
    "<rows><shared>" +
    "x".repeat(50_000) +
    "</shared>" +
    "<row><id>001</id></row>".repeat(400) +
    "</rows>";
  const inspection = await inspectXml(xml);
  await assert.rejects(
    xmlTable(inspection, { layout: "table", parents: true }),
    /expanded table/,
  );
  const safe = await xmlTable(inspection, { layout: "table" });
  assert.equal(safe.rows.length, 401);
  const named = await xmlTable(
    await inspectXml("<parsererror>ordinary data</parsererror>"),
    { layout: "table" },
  );
  assert.equal(named.rows[1][0], "ordinary data");
});
