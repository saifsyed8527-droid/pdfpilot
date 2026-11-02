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
  PDFArray,
  StandardFonts,
  degrees,
} = require("pdf-lib");
function load(filename) {
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const m = { exports: {} };
  new Function("require", "module", "exports", code)(
    (name) =>
      name.startsWith(".")
        ? load(path.resolve(path.dirname(filename), name + ".ts"))
        : require(name),
    m,
    m.exports,
  );
  return m.exports;
}
const { organizePdfPages } = load("src/lib/engines/pdf-organize-engine.ts");
const n = PDFName.of;
const input = (bytes, label = "source.pdf") =>
  new File([bytes], label, { type: "application/pdf" });
const page = (index, patch = {}) => ({
  id: "p" + index,
  kind: "pdf",
  fileId: "a",
  originalPageIndex: index,
  rotation: 0,
  ...patch,
});
function evidence(name, bytes) {
  if (process.env.ORGANIZE_QA_DIR) {
    fs.mkdirSync(process.env.ORGANIZE_QA_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(process.env.ORGANIZE_QA_DIR, name),
      Buffer.from(bytes),
    );
  }
}
async function fixture(fontName = StandardFonts.Helvetica) {
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(fontName),
    pages = [0, 90, 180].map((angle, i) => {
      const p = pdf.addPage([400, 500]);
      p.setCropBox(20, 30, 360, 440);
      p.setRotation(degrees(angle));
      p.drawText("Source page " + (i + 1), { x: 50, y: 420, size: 16, font });
      return p;
    });
  pdf.setTitle("Preserved title");
  const form = pdf.getForm(),
    text = form.createTextField("shared");
  text.setText("KEEP VALUE");
  for (const i of [0, 2])
    text.addToPage(pages[i], { x: 50, y: 300, width: 180, height: 30, font });
  const check = form.createCheckBox("removed");
  check.addToPage(pages[1], { x: 50, y: 200, width: 20, height: 20 });
  check.check();
  const choice = form.createDropdown("choice");
  choice.setOptions(["One", "Two"]);
  choice.select("Two");
  choice.addToPage(pages[2], { x: 50, y: 200, width: 150, height: 25, font });
  const radio = form.createRadioGroup("radio");
  radio.addOptionToPage("A", pages[0], {
    x: 50,
    y: 150,
    width: 20,
    height: 20,
  });
  radio.addOptionToPage("B", pages[2], {
    x: 50,
    y: 150,
    width: 20,
    height: 20,
  });
  radio.select("B");
  const annotations = pages[0].node.Annots();
  for (const dest of [
    pdf.context.obj([pages[2].ref, n("Fit")]),
    pdf.context.obj([pages[1].ref, n("Fit")]),
    PDFString.of("named-kept"),
  ])
    annotations.push(
      pdf.context.register(
        pdf.context.obj({
          Type: "Annot",
          Subtype: "Link",
          Rect: [50, 80, 150, 100],
          Dest: dest,
        }),
      ),
    );
  annotations.push(
    pdf.context.register(
      pdf.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [50, 50, 150, 70],
        A: { S: "URI", URI: PDFString.of("https://example.com") },
      }),
    ),
  );
  pdf.catalog.set(
    n("Names"),
    pdf.context.obj({
      Dests: { Names: [PDFString.of("named-kept"), [pages[2].ref, n("Fit")]] },
    }),
  );
  form.updateFieldAppearances(font);
  return input(await pdf.save());
}
test("organize preserves interactive values, selected widgets, internal/external links and cropped rotations", async () => {
  const source = await fixture();
  const result = await organizePdfPages(
    [{ id: "a", file: source }],
    [
      page(2, { rotation: 90 }),
      { id: "blank", kind: "blank", width: 612, height: 792, rotation: 0 },
      page(0),
    ],
  );
  const bytes = await result.blob.arrayBuffer(),
    out = await PDFDocument.load(bytes),
    form = out.getForm();
  assert.equal(out.getPageCount(), 3);
  assert.equal(out.getTitle(), "Preserved title");
  assert.equal(out.getPage(0).getRotation().angle, 270);
  assert.deepEqual(out.getPage(0).getCropBox(), {
    x: 20,
    y: 30,
    width: 360,
    height: 440,
  });
  assert.equal(out.getPage(1).getWidth(), 612);
  assert.equal(form.getTextField("shared").getText(), "KEEP VALUE");
  assert.equal(form.getTextField("shared").acroField.getWidgets().length, 2);
  assert.equal(form.getDropdown("choice").getSelected()[0], "Two");
  assert.equal(form.getRadioGroup("radio").getSelected(), "B");
  assert.equal(form.getFields().length, 3);
  assert.equal(result.fieldCount, 3);
  assert.equal(result.removedLinks, 1);
  const annots = out
    .getPage(2)
    .node.Annots()
    .asArray()
    .map((ref) => out.context.lookup(ref, PDFDict));
  const links = annots.filter((a) => a.get(n("Subtype")) === n("Link"));
  const kept = links.filter((a) => a.has(n("Dest")));
  assert.equal(kept.length, 2);
  for (const link of kept)
    assert.equal(
      link.lookup(n("Dest"), PDFArray).get(0).toString(),
      out.getPage(0).ref.toString(),
    );
  assert.equal(
    links
      .find((a) => a.has(n("A")))
      .lookup(n("A"), PDFDict)
      .lookup(n("URI"), PDFString)
      .decodeText(),
    "https://example.com",
  );
  for (const f of form.getFields())
    for (const w of f.acroField.getWidgets())
      assert.ok(
        out.getPages().some((p) => p.ref.toString() === w.P().toString()),
      );
  form.getTextField("shared").setText("EDITABLE AFTER ORGANIZE");
  const again = await PDFDocument.load(await out.save());
  assert.equal(
    again.getForm().getTextField("shared").getText(),
    "EDITABLE AFTER ORGANIZE",
  );
  evidence("source.pdf", await source.arrayBuffer());
  evidence("organized.pdf", bytes);
});
test("multi-file forms with duplicate names retain independent values and aliased resources", async () => {
  const a = await fixture(),
    b = await fixture(StandardFonts.Courier);
  const result = await organizePdfPages(
    [
      { id: "a", file: a },
      { id: "b", file: b },
    ],
    [page(0), page(2, { id: "b2", fileId: "b" })],
  );
  const out = await PDFDocument.load(await result.blob.arrayBuffer()),
    form = out.getForm();
  assert.equal(form.getTextField("File1.shared").getText(), "KEEP VALUE");
  assert.equal(form.getTextField("File2.shared").getText(), "KEEP VALUE");
  assert.equal(
    form.getTextField("File1.shared").acroField.getWidgets().length,
    1,
  );
  assert.equal(
    form.getTextField("File2.shared").acroField.getWidgets().length,
    1,
  );
  assert.deepEqual(form.getRadioGroup("File1.radio").getOptions(), ["A"]);
  assert.equal(form.getRadioGroup("File1.radio").getSelected(), undefined);
  assert.deepEqual(form.getRadioGroup("File2.radio").getOptions(), ["B"]);
  assert.equal(form.getRadioGroup("File2.radio").getSelected(), "B");
  const fonts = form.acroForm.dict
    .lookup(n("DR"), PDFDict)
    .lookup(n("Font"), PDFDict);
  for (const f of form.getFields()) {
    const da = f.acroField.getDefaultAppearance();
    if (da && !da.includes("/dummy__noop 0 Tf")) {
      const key = da.match(/\/([^\s]+)\s+[\d.]+\s+Tf/);
      assert.ok(key);
      assert.ok(fonts.has(n(key[1])), da);
    }
  }
  form.getTextField("File1.shared").setText("FIRST");
  form.getTextField("File2.shared").setText("SECOND");
  const reopened = await PDFDocument.load(await out.save());
  assert.equal(
    reopened.getForm().getTextField("File1.shared").getText(),
    "FIRST",
  );
  assert.equal(
    reopened.getForm().getTextField("File2.shared").getText(),
    "SECOND",
  );
  evidence("multi.pdf", await result.blob.arrayBuffer());
});
test("organize drops widgets on removed pages without losing a retained shared field", async () => {
  const source = await fixture();
  const result = await organizePdfPages([{ id: "a", file: source }], [page(0)]);
  const pdf = await PDFDocument.load(await result.blob.arrayBuffer());
  assert.deepEqual(
    pdf
      .getForm()
      .getFields()
      .map((f) => f.getName())
      .sort(),
    ["radio", "shared"],
  );
  assert.equal(
    pdf.getForm().getTextField("shared").acroField.getWidgets().length,
    1,
  );
  assert.equal(
    pdf.getForm().getRadioGroup("radio").acroField.getWidgets().length,
    1,
  );
});
test("organize rejects invalid geometry, missing or repeated pages, file limits and unsupported forms", async () => {
  const file = await fixture(),
    sources = [{ id: "a", file }];
  await assert.rejects(organizePdfPages(sources, []), /Keep between/);
  await assert.rejects(
    organizePdfPages(sources, [page(8)]),
    /no longer available/,
  );
  await assert.rejects(
    organizePdfPages(sources, [page(0), page(0, { id: "another" })]),
    /second copy/,
  );
  await assert.rejects(
    organizePdfPages(sources, [page(0, { rotation: 25 })]),
    /90-degree/,
  );
  await assert.rejects(
    organizePdfPages(sources, [
      { id: "b", kind: "blank", rotation: 0, width: 0, height: 20 },
    ]),
    /size/,
  );
  const huge = input("x");
  Object.defineProperty(huge, "size", { value: 101 * 1024 * 1024 });
  await assert.rejects(
    organizePdfPages([{ id: "a", file: huge }], [page(0)]),
    /100MB/,
  );
  for (const mode of ["XFA", "Perms"]) {
    const pdf = await PDFDocument.load(await file.arrayBuffer());
    if (mode === "XFA")
      pdf.catalog.AcroForm().set(n("XFA"), PDFString.of("<xfa/>"));
    else pdf.catalog.set(n("Perms"), pdf.context.obj({}));
    await assert.rejects(
      organizePdfPages(
        [
          {
            id: "a",
            file: input(await pdf.save({ updateFieldAppearances: false })),
          },
        ],
        [page(0)],
      ),
      /XFA|unsigned/,
    );
  }
});
test("cancellation before loading and during a long output produces no result", async () => {
  const file = await fixture(),
    controller = new AbortController();
  controller.abort();
  await assert.rejects(
    organizePdfPages([{ id: "a", file }], [page(0)], {
      signal: controller.signal,
    }),
    /cancelled/,
  );
  const next = new AbortController(),
    plan = [
      page(0),
      ...Array.from({ length: 50 }, (_, i) => ({
        id: "b" + i,
        kind: "blank",
        rotation: 0,
      })),
    ];
  await assert.rejects(
    organizePdfPages([{ id: "a", file }], plan, {
      signal: next.signal,
      onProgress: (n) => {
        if (n > 40) next.abort();
      },
    }),
    /cancelled/,
  );
});

test("blank-only output remains available after removing the last source file", async () => {
  const result = await organizePdfPages(
    [],
    [{ id: "blank", kind: "blank", rotation: 90, width: 612, height: 792 }],
  );
  const pdf = await PDFDocument.load(await result.blob.arrayBuffer());
  assert.equal(pdf.getPageCount(), 1);
  assert.equal(pdf.getPage(0).getWidth(), 612);
  assert.equal(pdf.getPage(0).getHeight(), 792);
  assert.equal(pdf.getPage(0).getRotation().angle, 90);
  assert.equal(result.fieldCount, 0);
  await assert.rejects(organizePdfPages([], [page(0)]), /no longer available/);
});

test("merged field/widget dictionaries keep values and editable appearances", async () => {
  const pdf = await PDFDocument.create();
  const p = pdf.addPage([300, 400]);
  const field = pdf.getForm().createTextField("fused");
  field.setText("FUSED VALUE");
  field.addToPage(p, { x: 30, y: 200, width: 200, height: 30 });
  pdf.getForm().updateFieldAppearances();
  const widget = field.acroField.getWidgets()[0];
  for (const [key, value] of widget.dict.entries())
    if (key !== n("Parent")) field.acroField.dict.set(key, value);
  field.acroField.dict.delete(n("Kids"));
  p.node.set(n("Annots"), pdf.context.obj([field.ref]));
  const result = await organizePdfPages(
    [
      {
        id: "a",
        file: input(await pdf.save({ updateFieldAppearances: false })),
      },
    ],
    [page(0)],
  );
  const out = await PDFDocument.load(await result.blob.arrayBuffer());
  const copied = out.getForm().getTextField("fused");
  assert.equal(copied.getText(), "FUSED VALUE");
  assert.equal(copied.acroField.getWidgets().length, 1);
  assert.equal(
    copied.acroField.getWidgets()[0].P().toString(),
    out.getPage(0).ref.toString(),
  );
  copied.setText("STILL EDITABLE");
  const reopened = await PDFDocument.load(await out.save());
  assert.equal(
    reopened.getForm().getTextField("fused").getText(),
    "STILL EDITABLE",
  );
});
