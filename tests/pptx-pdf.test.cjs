const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { loadTs } = require("./load-ts.cjs");
const g = loadTs("src/lib/engines/pptx-geometry.ts");
const { rasterFormat, checkPptxArchiveEntry } = loadTs(
  "src/lib/engines/pptx-policy.ts",
);
const el = (name, attrs = {}, children = []) => ({
  namespaceURI: g.DRAWING_NS,
  localName: name,
  children,
  getAttribute: (key) => (key in attrs ? String(attrs[key]) : null),
  hasAttribute: (key) => key in attrs,
});
const pt = (x, y) => el("pt", { x, y });
const path = (commands, attrs = {}) => el("path", attrs, commands);
const geom = (paths, guides = []) =>
  el("custGeom", {}, [el("gdLst", {}, guides), el("pathLst", {}, paths)]);
const apply = (m, x, y) => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];
const close = (actual, expected) =>
  actual.forEach((v, i) =>
    assert.ok(Math.abs(v - expected[i]) < 1e-8, `${actual} != ${expected}`),
  );

test("CAD custom paths keep all subpaths, curves, fills and strokes", () => {
  const result = g.customPaths(
    geom([
      path(
        [
          el("moveTo", {}, [pt(0, 0)]),
          el("lnTo", {}, [pt(100, 0)]),
          el("lnTo", {}, [pt(100, 50)]),
          el("close"),
          el("moveTo", {}, [pt(20, 10)]),
          el("cubicBezTo", {}, [pt(25, 5), pt(35, 5), pt(40, 10)]),
        ],
        { w: 100, h: 50, fill: "none" },
      ),
    ]),
    200,
    100,
  );
  assert.equal(
    result[0].data,
    "0 0 m\n200 0 l\n200 100 l\nh\n40 20 m\n50 10 70 10 80 20 c",
  );
  assert.equal(result[0].fill, false);
  assert.equal(result[0].stroke, true);
});

test("zero-width CAD connectors do not evaluate unused invalid connection guides", () => {
  const result = g.customPaths(
    geom(
      [
        path([el("moveTo", {}, [pt(0, 0)]), el("lnTo", {}, [pt(0, 127000)])], {
          w: 0,
          h: 127000,
        }),
      ],
      [el("gd", { name: "csX0", fmla: "*/ 0 w 0" })],
    ),
    0,
    10,
  );
  assert.equal(result[0].data, "0 0 m\n0 10 l");
});

test("required guide formulas resolve dependencies and reject cycles", () => {
  const shape = geom(
    [path([el("moveTo", {}, [pt("half", 0)])])],
    [el("gd", { name: "half", fmla: "*/ w 1 2" })],
  );
  assert.equal(g.customPaths(shape, 200, 100)[0].data, "100 0 m");
  const cycle = geom(
    [path([el("moveTo", {}, [pt("guideA", 0)])])],
    [
      el("gd", { name: "guideA", fmla: "val guideB" }),
      el("gd", { name: "guideB", fmla: "val guideA" }),
    ],
  );
  assert.throws(() => g.customPaths(cycle, 20, 10), /circular/);
});

test("group child origin and scale compose with slide position", () => {
  const t = g.transform(
    el("xfrm", {}, [
      el("off", { x: 127000, y: 254000 }),
      el("ext", { cx: 2540000, cy: 1270000 }),
      el("chOff", { x: 635000, y: 1270000 }),
      el("chExt", { cx: 1270000, cy: 635000 }),
    ]),
    true,
  );
  close(apply(t.matrix, 50, 100), [10, 20]);
  close(apply(t.matrix, 150, 150), [210, 120]);
});

test("rotation and flip preserve the shape centre", () => {
  const t = g.transform(
    el("xfrm", { rot: 5400000, flipH: 1 }, [
      el("off", { x: 127000, y: 254000 }),
      el("ext", { cx: 1270000, cy: 635000 }),
    ]),
  );
  close(apply(t.matrix, 50, 25), [60, 45]);
  close(apply(t.matrix, 0, 0), [85, 95]);
});

test("quadratic curves and circular arcs become cubic PDF paths", () => {
  const q = g.customPaths(
    geom([
      path(
        [
          el("moveTo", {}, [pt(0, 0)]),
          el("quadBezTo", {}, [pt(50, 100), pt(100, 0)]),
        ],
        { w: 100, h: 100 },
      ),
    ]),
    100,
    100,
  )[0];
  assert.match(q.data, /33.33333 66.66667 66.66667 66.66667 100 0 c/);
  const arc = g.customPaths(
    geom([
      path(
        [
          el("moveTo", {}, [pt(100, 50)]),
          el("arcTo", { wR: 50, hR: 50, stAng: 0, swAng: 5400000 }),
        ],
        { w: 100, h: 100 },
      ),
    ]),
    100,
    100,
  )[0];
  assert.match(arc.data, /50 100 c$/);
});

test("unsupported geometry fails explicitly and coordinates cannot inject PDF operators", () => {
  assert.throws(() => g.presetPath("unknownShape", 10, 10), /cannot reproduce/);
  assert.throws(() => g.number(Infinity), /Invalid/);
  assert.throws(() => g.number(NaN), /Invalid/);
  assert.throws(
    () =>
      g.customPaths(
        geom([path([el("moveTo", {}, [pt("1 0 cm", 0)])])]),
        10,
        10,
      ),
    /unsupported drawing geometry/,
  );
});

test("Office PDF names preserve long titles without repeated extensions or dots", () => {
  assert.equal(
    g.officePdfFilename("tender drawings..pptx"),
    "tender drawings.pdf",
  );
  assert.equal(g.officePdfFilename("REPORT.PPTX"), "REPORT.pdf");
  assert.equal(g.officePdfFilename("a/b:report.xlsx"), "a_b_report.pdf");
  assert.equal(
    g.officePdfFilename("a".repeat(120) + ".pptx"),
    "a".repeat(120) + ".pdf",
  );
});

test("embedded raster images are recognized by bytes even when named .tmp", () => {
  assert.equal(
    rasterFormat(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "png",
  );
  assert.equal(rasterFormat(Uint8Array.from([255, 216, 255, 224])), "jpeg");
  assert.equal(rasterFormat(new TextEncoder().encode("<svg>")), null);
  assert.equal(rasterFormat(new Uint8Array()), null);
});

test("archive safety rejects traversal and expansion bombs before worker allocation", () => {
  assert.doesNotThrow(() =>
    checkPptxArchiveEntry("ppt/slides/slide1.xml", 1024, 20, 4000),
  );
  for (const args of [
    ["../bad", 1, 1, 1],
    ["/bad", 1, 1, 1],
    ["ppt/media/image.png", 65 * 1024 * 1024, 1, 1],
    ["ppt/a", 1, 25001, 1],
    ["ppt/a", 1, 1, 385 * 1024 * 1024],
  ])
    assert.throws(() => checkPptxArchiveEntry(...args));
});

test("result links follow the theme, progress is exposed accessibly, and conversion uses real progress", () => {
  const related = fs.readFileSync(
    "src/components/tool/RelatedTools.tsx",
    "utf8",
  );
  assert.ok(related.includes("bg-card text-card-foreground"));
  assert.ok(!related.includes("bg-white"));
  const progress = fs.readFileSync("src/components/ui/progress.tsx", "utf8");
  assert.ok(progress.includes("value={indeterminate ? null : value}"));
  const office = fs.readFileSync(
    "src/components/tool/OfficeToPdfWorkspace.tsx",
    "utf8",
  );
  assert.match(office, /await convert\(\s*item\.file,\s*\(value\)/);
  assert.ok(!office.includes("()=>undefined"));
});
