// DrawingML coordinates are resolved before writing PDF operators. No source
// XML or arbitrary strings are interpolated into a PDF content stream.
export const DRAWING_NS =
  "http://schemas.openxmlformats.org/drawingml/2006/main";
export const POINT = 12700;
export type Matrix = [number, number, number, number, number, number];
export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
export function number(value: number): string {
  if (!Number.isFinite(value) || Math.abs(value) > 1e12)
    throw new Error("Invalid drawing coordinates in this presentation.");
  return String(Math.round(value * 100000) / 100000);
}
export function child(
  el: Element | undefined,
  local: string,
  ns = DRAWING_NS,
): Element | undefined {
  return (
    el &&
    Array.from(el.children).find(
      (e) => e.namespaceURI === ns && e.localName === local,
    )
  );
}
export function children(
  el: Element | undefined,
  local: string,
  ns = DRAWING_NS,
): Element[] {
  return el
    ? Array.from(el.children).filter(
        (e) => e.namespaceURI === ns && e.localName === local,
      )
    : [];
}
export function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
export const translate = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];
export const scale = (x: number, y: number): Matrix => [x, 0, 0, y, 0, 0];
export function transform(
  xfrm: Element | undefined,
  group = false,
): { matrix: Matrix; width: number; height: number } | null {
  const off = child(xfrm, "off"),
    ext = child(xfrm, "ext");
  if (!off || !ext) return null;
  const x = Number(off.getAttribute("x")) / POINT,
    y = Number(off.getAttribute("y")) / POINT;
  const width = Number(ext.getAttribute("cx")) / POINT,
    height = Number(ext.getAttribute("cy")) / POINT;
  const radians =
    ((Number(xfrm?.getAttribute("rot") ?? 0) / 60000) * Math.PI) / 180;
  const rotation: Matrix = [
    Math.cos(radians),
    Math.sin(radians),
    -Math.sin(radians),
    Math.cos(radians),
    0,
    0,
  ];
  const flips = scale(
    xfrm?.getAttribute("flipH") === "1" ? -1 : 1,
    xfrm?.getAttribute("flipV") === "1" ? -1 : 1,
  );
  let matrix = multiply(
    multiply(
      multiply(translate(x + width / 2, y + height / 2), rotation),
      flips,
    ),
    translate(-width / 2, -height / 2),
  );
  if (group) {
    const chOff = child(xfrm, "chOff"),
      chExt = child(xfrm, "chExt");
    const cw = Number(chExt?.getAttribute("cx")) / POINT,
      ch = Number(chExt?.getAttribute("cy")) / POINT;
    if (!chOff || !cw || !ch)
      throw new Error("A drawing group has invalid dimensions.");
    matrix = multiply(
      multiply(matrix, scale(width / cw, height / ch)),
      translate(
        -Number(chOff.getAttribute("x")) / POINT,
        -Number(chOff.getAttribute("y")) / POINT,
      ),
    );
  }
  matrix.forEach(number);
  return { matrix, width, height };
}

// Numeric guides used by custom geometry; reject unsupported formulas instead
// of silently dropping a path. Numeric literal paths cover CAD-exported decks.
function guides(geometry: Element, width: number, height: number) {
  const w = width * POINT,
    h = height * POINT,
    ss = Math.min(w, h);
  const values: Record<string, number> = {
    w,
    h,
    l: 0,
    t: 0,
    r: w,
    b: h,
    hc: w / 2,
    vc: h / 2,
    ss,
    ls: Math.max(w, h),
    cd2: 10800000,
    cd4: 5400000,
    cd8: 2700000,
    "3cd4": 16200000,
  };
  for (const d of [2, 3, 4, 5, 6, 8, 10, 12, 16, 32]) {
    values[`wd${d}`] = w / d;
    values[`hd${d}`] = h / d;
    values[`ssd${d}`] = ss / d;
  }
  const formulas = new Map<string, string>();
  const evaluating = new Set<string>();
  for (const list of [child(geometry, "avLst"), child(geometry, "gdLst")])
    for (const gd of children(list, "gd"))
      formulas.set(
        gd.getAttribute("name") ?? "",
        gd.getAttribute("fmla") ?? "",
      );
  const get = (s: string | null): number => {
    if (s && formulas.has(s) && !(s in values)) {
      if (evaluating.has(s))
        throw new Error("A drawing contains circular geometry guides.");
      evaluating.add(s);
      const [op, ...args] = formulas.get(s)!.split(/\s+/);
      const [x = 0, y = 0, z = 0] = args.map(get);
      const rad = (y * Math.PI) / 10800000;
      const v =
        op === "val"
          ? x
          : op === "*/"
            ? (x * y) / z
            : op === "+-"
              ? x + y - z
              : op === "+/"
                ? (x + y) / z
                : op === "?:"
                  ? x > 0
                    ? y
                    : z
                  : op === "abs"
                    ? Math.abs(x)
                    : op === "sqrt"
                      ? Math.sqrt(x)
                      : op === "max"
                        ? Math.max(x, y)
                        : op === "min"
                          ? Math.min(x, y)
                          : op === "pin"
                            ? Math.max(x, Math.min(y, z))
                            : op === "mod"
                              ? Math.hypot(x, y, z)
                              : op === "sin"
                                ? x * Math.sin(rad)
                                : op === "cos"
                                  ? x * Math.cos(rad)
                                  : op === "tan"
                                    ? x * Math.tan(rad)
                                    : op === "at2"
                                      ? (Math.atan2(y, x) * 10800000) / Math.PI
                                      : op === "cat2"
                                        ? x * Math.cos(Math.atan2(z, y))
                                        : op === "sat2"
                                          ? x * Math.sin(Math.atan2(z, y))
                                          : NaN;
      number(v);
      values[s] = v;
      evaluating.delete(s);
    }
    const v = s !== null && s in values ? values[s] : Number(s);
    if (s === null || !Number.isFinite(v))
      throw new Error(
        "This slide uses unsupported drawing geometry. Export it to PDF from PowerPoint to keep every detail.",
      );
    return v;
  };
  return get;
}

export interface DrawingPath {
  data: string;
  fill: boolean;
  stroke: boolean;
}
export function customPaths(
  geometry: Element,
  width: number,
  height: number,
): DrawingPath[] {
  const get = guides(geometry, width, height);
  return children(child(geometry, "pathLst"), "path").map((path) => {
    const pw = path.hasAttribute("w")
      ? get(path.getAttribute("w"))
      : width * POINT;
    const ph = path.hasAttribute("h")
      ? get(path.getAttribute("h"))
      : height * POINT;
    const sx = pw ? width / pw : 1 / POINT,
      sy = ph ? height / ph : 1 / POINT;
    let x = 0,
      y = 0,
      startX = 0,
      startY = 0;
    const output: string[] = [];
    const pt = (e: Element) => [
      get(e.getAttribute("x")) * sx,
      get(e.getAttribute("y")) * sy,
    ];
    for (const command of Array.from(path.children)) {
      const points = children(command, "pt").map(pt);
      if (command.localName === "moveTo" || command.localName === "lnTo") {
        [x, y] = points[0];
        if (command.localName === "moveTo") {
          startX = x;
          startY = y;
        }
        output.push(
          `${number(x)} ${number(y)} ${command.localName === "moveTo" ? "m" : "l"}`,
        );
      } else if (command.localName === "cubicBezTo") {
        output.push(`${points.flat().map(number).join(" ")} c`);
        [x, y] = points[2];
      } else if (command.localName === "quadBezTo") {
        const [[qx, qy], [ex, ey]] = points;
        output.push(
          [
            x + ((qx - x) * 2) / 3,
            y + ((qy - y) * 2) / 3,
            ex + ((qx - ex) * 2) / 3,
            ey + ((qy - ey) * 2) / 3,
            ex,
            ey,
          ]
            .map(number)
            .join(" ") + " c",
        );
        x = ex;
        y = ey;
      } else if (command.localName === "close") {
        output.push("h");
        x = startX;
        y = startY;
      } else if (command.localName === "arcTo") {
        const rx = get(command.getAttribute("wR")) * sx,
          ry = get(command.getAttribute("hR")) * sy;
        const start = (get(command.getAttribute("stAng")) * Math.PI) / 10800000,
          sweep = (get(command.getAttribute("swAng")) * Math.PI) / 10800000;
        const polar = (a: number) =>
          Math.atan2(rx * Math.sin(a), ry * Math.cos(a));
        let a = polar(start);
        let end = polar(start + sweep);
        if (sweep > 0) {
          while (end <= a) end += Math.PI * 2;
        } else {
          while (end >= a) end -= Math.PI * 2;
        }
        if (Math.abs(sweep) < 1e-10) continue;
        const cx = x - rx * Math.cos(a),
          cy = y - ry * Math.sin(a),
          steps = Math.ceil(Math.abs(end - a) / (Math.PI / 2));
        const delta = (end - a) / steps;
        for (let i = 0; i < steps; i++) {
          const b = a + delta,
            k = (4 / 3) * Math.tan(delta / 4),
            ex = cx + rx * Math.cos(b),
            ey = cy + ry * Math.sin(b);
          output.push(
            [
              x - k * rx * Math.sin(a),
              y + k * ry * Math.cos(a),
              ex + k * rx * Math.sin(b),
              ey - k * ry * Math.cos(b),
              ex,
              ey,
            ]
              .map(number)
              .join(" ") + " c",
          );
          x = ex;
          y = ey;
          a = b;
        }
      } else
        throw new Error(
          `Unsupported drawing command: ${command.localName}. Export this presentation from PowerPoint for full fidelity.`,
        );
    }
    return {
      data: output.join("\n"),
      fill: path.getAttribute("fill") !== "none",
      stroke: path.getAttribute("stroke") !== "0",
    };
  });
}

export function presetPath(name: string, w: number, h: number): string {
  const n = number;
  if (name === "rect") return `0 0 ${n(w)} ${n(h)} re`;
  if (name === "line" || name === "straightConnector1")
    return `0 0 m ${n(w)} ${n(h)} l`;
  if (name === "ellipse") {
    const k = 0.552284749831,
      rx = w / 2,
      ry = h / 2;
    return `${n(w)} ${n(ry)} m ${[w, ry + k * ry, rx + k * rx, h, rx, h].map(n).join(" ")} c ${[rx - k * rx, h, 0, ry + k * ry, 0, ry].map(n).join(" ")} c ${[0, ry - k * ry, rx - k * rx, 0, rx, 0].map(n).join(" ")} c ${[rx + k * rx, 0, w, ry - k * ry, w, ry].map(n).join(" ")} c h`;
  }
  if (name === "roundRect") {
    const r = Math.min(w, h) * 0.16667,
      k = 0.552284749831;
    return `${n(r)} 0 m ${n(w - r)} 0 l ${[w - r + k * r, 0, w, r - k * r, w, r].map(n).join(" ")} c ${n(w)} ${n(h - r)} l ${[w, h - r + k * r, w - r + k * r, h, w - r, h].map(n).join(" ")} c ${n(r)} ${n(h)} l ${[r - k * r, h, 0, h - r + k * r, 0, h - r].map(n).join(" ")} c 0 ${n(r)} l ${[0, r - k * r, r - k * r, 0, r, 0].map(n).join(" ")} c h`;
  }
  const points: Record<string, number[][]> = {
    triangle: [
      [w / 2, 0],
      [w, h],
      [0, h],
    ],
    rtTriangle: [
      [0, 0],
      [w, h],
      [0, h],
    ],
    diamond: [
      [w / 2, 0],
      [w, h / 2],
      [w / 2, h],
      [0, h / 2],
    ],
    parallelogram: [
      [w * 0.25, 0],
      [w, 0],
      [w * 0.75, h],
      [0, h],
    ],
    trapezoid: [
      [w * 0.25, 0],
      [w * 0.75, 0],
      [w, h],
      [0, h],
    ],
    rightArrow: [
      [0, h * 0.25],
      [w * 0.6, h * 0.25],
      [w * 0.6, 0],
      [w, h / 2],
      [w * 0.6, h],
      [w * 0.6, h * 0.75],
      [0, h * 0.75],
    ],
  };
  if (points[name])
    return (
      points[name]
        .map((p, i) => `${p.map(n).join(" ")} ${i ? "l" : "m"}`)
        .join("\n") + " h"
    );
  throw new Error(
    `The slide contains a ${name} shape that this browser converter cannot reproduce yet. Export from PowerPoint to preserve it.`,
  );
}

export function officePdfFilename(name: string): string {
  const base = name
    .replace(/\.(pptx?|xlsx?|docx?)$/i, "")
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")
    .replace(/[.\s]+$/g, "")
    .trim();
  return `${base || "document"}.pdf`;
}
