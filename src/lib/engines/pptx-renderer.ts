/** Browser-only DrawingML renderer. Parse one slide at a time and write compact
 * PDF streams: technical decks can contain hundreds of thousands of paths. */
import type { PDFDocument, PDFFont, PDFImage, PDFPage } from "pdf-lib";
import {
  loadUnicodeFonts,
  resolveFont,
  trackDrawnText,
  patchToUnicodeCmaps,
  type UnicodeFontSet,
} from "./unicode-fonts";
import {
  DRAWING_NS as A,
  POINT,
  IDENTITY,
  child,
  children,
  customPaths,
  presetPath,
  multiply,
  transform,
  number as n,
  type Matrix,
} from "./pptx-geometry";
import { rasterFormat, checkPptxArchiveEntry } from "./pptx-policy";

const P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const MC = "http://schemas.openxmlformats.org/markup-compatibility/2006";
const encoder = new TextEncoder();
const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const cancelCheck = (cancelled?: () => boolean) => {
  if (cancelled?.()) throw new Error("Cancelled");
};
function xml(text: string): Document {
  if (/<!DOCTYPE|<!ENTITY/i.test(text))
    throw new Error(
      "This presentation contains an unsupported XML declaration.",
    );
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length)
    throw new Error("A slide contains invalid XML.");
  return doc;
}
function pathFrom(base: string, target: string): string {
  const parts = target.startsWith("/") ? [] : base.split("/").slice(0, -1);
  for (const part of target.replace(/^\//, "").split("/")) {
    if (part === "..") parts.pop();
    else if (part !== ".") parts.push(part);
  }
  return parts.join("/");
}
const relPath = (path: string) => path.replace(/([^/]+)$/, "_rels/$1.rels");
interface Rel {
  target: string;
  type: string;
  external: boolean;
}
type Rels = Map<string, Rel>;
interface Archive {
  entries: Record<string, Uint8Array>;
  text: (path: string) => string | undefined;
  rels: (path: string) => Rels;
  slides: string[];
  width: number;
  height: number;
}
async function open(
  file: File,
  cancelled?: () => boolean,
  onProgress?: (value: number) => void,
): Promise<Archive> {
  if (file.size > 100 * 1024 * 1024)
    throw new Error("Each presentation must be 100MB or smaller.");
  const { unzip, unzipSync } = await import("fflate");
  const bytes = new Uint8Array(await file.arrayBuffer());
  cancelCheck(cancelled);
  let expanded = 0,
    count = 0;
  const batches: Set<string>[] = [];
  let batch = new Set<string>(),
    batchSize = 0;
  // Validate the central directory before allocating anything. Bounded batches
  // avoid spawning dozens of inflate workers for drawing-heavy presentations.
  unzipSync(bytes, {
    filter(entry) {
      expanded += entry.originalSize;
      count++;
      checkPptxArchiveEntry(entry.name, entry.originalSize, count, expanded);
      if (
        (entry.name.startsWith("ppt/") &&
          !/\/(notesSlides|notesMasters|embeddings)\//.test(entry.name)) ||
        entry.name.startsWith("docProps/thumbnail.")
      ) {
        if (
          batch.size &&
          (batchSize + entry.originalSize > 8 * 1024 * 1024 ||
            batch.size >= 512)
        ) {
          batches.push(batch);
          batch = new Set();
          batchSize = 0;
        }
        batch.add(entry.name);
        batchSize += entry.originalSize;
      }
      return false;
    },
  });
  if (batch.size) batches.push(batch);
  const entries: Record<string, Uint8Array> = {};
  for (const [i, names] of batches.entries()) {
    cancelCheck(cancelled);
    await pause();
    const result = await new Promise<Record<string, Uint8Array>>(
      (resolve, reject) => {
        const terminate = unzip(
          bytes,
          { filter: (entry) => names.has(entry.name) },
          (error, result) => {
            clearInterval(timer);
            if (error) reject(error);
            else resolve(result);
          },
        );
        const timer = setInterval(() => {
          if (cancelled?.()) {
            terminate();
            clearInterval(timer);
            reject(new Error("Cancelled"));
          }
        }, 100);
      },
    );
    Object.assign(entries, result);
    onProgress?.(1 + ((i + 1) / batches.length) * 7);
  }
  cancelCheck(cancelled);
  const decoder = new TextDecoder();
  const text = (path: string) =>
    entries[path] ? decoder.decode(entries[path]) : undefined;
  const rels = (path: string): Rels => {
    const source = text(relPath(path));
    const result: Rels = new Map();
    if (!source) return result;
    for (const e of Array.from(xml(source).documentElement.children))
      result.set(e.getAttribute("Id") ?? "", {
        target: e.getAttribute("Target") ?? "",
        type: e.getAttribute("Type") ?? "",
        external: e.getAttribute("TargetMode") === "External",
      });
    return result;
  };
  const presentation = text("ppt/presentation.xml");
  if (!presentation)
    throw new Error("Please choose a valid PowerPoint .pptx file.");
  const root = xml(presentation).documentElement,
    size = child(root, "sldSz", P);
  const width = Number(size?.getAttribute("cx")) / POINT,
    height = Number(size?.getAttribute("cy")) / POINT;
  if (!(width > 0 && height > 0 && width <= 14400 && height <= 14400))
    throw new Error("This presentation has unsupported slide dimensions.");
  const relations = rels("ppt/presentation.xml");
  const slides = children(child(root, "sldIdLst", P), "sldId", P).map((e) => {
    const rel = relations.get(e.getAttributeNS(R, "id") ?? "");
    if (!rel || rel.external)
      throw new Error("The presentation contains a missing or external slide.");
    const path = pathFrom("ppt/presentation.xml", rel.target);
    if (!entries[path])
      throw new Error("A slide is missing. Please save a fresh PPTX copy.");
    return path;
  });
  if (!slides.length || slides.length > 500)
    throw new Error(
      "Please choose a presentation with between 1 and 500 slides.",
    );
  return { entries, text, rels, slides, width, height };
}
type Color = { hex: string; alpha: number };
export interface PptxInspection {
  slideCount: number;
  thumbnail: string | null;
}
export async function inspectPptxFile(file: File): Promise<PptxInspection> {
  const deck = await open(file);
  const path = Object.keys(deck.entries).find((k) =>
    /^docProps\/thumbnail\.(png|jpe?g)$/i.test(k),
  );
  let thumbnail: string | null = null;
  if (path) {
    const bytes = deck.entries[path],
      format = rasterFormat(bytes);
    if (format)
      thumbnail = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () =>
          reject(new Error("Could not read the presentation thumbnail."));
        reader.readAsDataURL(
          new Blob([bytes as BlobPart], { type: `image/${format}` }),
        );
      });
  }
  return { slideCount: deck.slides.length, thumbnail };
}
interface Theme {
  colors: Map<string, string>;
  major: string;
  minor: string;
}
function themeOf(doc: Document | undefined): Theme {
  const colors = new Map<string, string>();
  const scheme = doc?.getElementsByTagNameNS(A, "clrScheme")[0];
  for (const slot of Array.from(scheme?.children ?? [])) {
    const c = slot.firstElementChild;
    const value = c?.getAttribute("lastClr") ?? c?.getAttribute("val");
    if (value) colors.set(slot.localName, value);
  }
  return {
    colors,
    major:
      child(
        doc?.getElementsByTagNameNS(A, "majorFont")[0],
        "latin",
      )?.getAttribute("typeface") ?? "Arial",
    minor:
      child(
        doc?.getElementsByTagNameNS(A, "minorFont")[0],
        "latin",
      )?.getAttribute("typeface") ?? "Arial",
  };
}
function colorOf(parent: Element | undefined, theme: Theme): Color | undefined {
  if (!parent) return;
  const c = Array.from(parent.children).find((e) =>
    ["srgbClr", "schemeClr", "sysClr", "prstClr"].includes(e.localName),
  );
  if (!c) return;
  const raw = c.getAttribute("val") ?? "";
  const alias: Record<string, string> = {
    tx1: "dk1",
    tx2: "dk2",
    bg1: "lt1",
    bg2: "lt2",
  };
  const presets: Record<string, string> = {
    black: "000000",
    white: "FFFFFF",
    red: "FF0000",
    blue: "0000FF",
    green: "008000",
    yellow: "FFFF00",
    gray: "808080",
  };
  const hex =
    c.localName === "schemeClr"
      ? theme.colors.get(alias[raw] ?? raw)
      : c.localName === "sysClr"
        ? c.getAttribute("lastClr")
        : c.localName === "prstClr"
          ? presets[raw]
          : raw;
  if (!hex || !/^[0-9a-f]{6}$/i.test(hex)) return;
  let channels = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  let alpha = 1;
  for (const e of Array.from(c.children)) {
    const v = Number(e.getAttribute("val")) / 100000;
    if (e.localName === "alpha") alpha = v;
    else if (e.localName === "tint")
      channels = channels.map((x) => x + (1 - x) * v);
    else if (e.localName === "shade" || e.localName === "lumMod")
      channels = channels.map((x) => x * v);
    else if (e.localName === "lumOff") channels = channels.map((x) => x + v);
  }
  return {
    hex: channels
      .map((v) =>
        Math.round(Math.min(1, Math.max(0, v)) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join(""),
    alpha: Math.min(1, Math.max(0, alpha)),
  };
}
const rgb = (c: Color) =>
  [0, 2, 4].map((i) => n(parseInt(c.hex.slice(i, i + 2), 16) / 255)).join(" ");
function fillOf(
  parent: Element | undefined,
  theme: Theme,
): Color | null | undefined {
  if (child(parent, "noFill")) return null;
  if (child(parent, "gradFill") || child(parent, "pattFill"))
    throw new Error(
      "This slide contains a gradient or pattern fill that needs PowerPoint export to preserve its appearance.",
    );
  return colorOf(child(parent, "solidFill"), theme);
}
interface Part {
  path: string;
  root: Element;
  tree?: Element;
  content?: Element;
  rels: Rels;
}
function part(deck: Archive, path: string): Part {
  const source = deck.text(path);
  if (!source) throw new Error("A presentation layout is missing.");
  const root = xml(source).documentElement,
    content = child(root, "cSld", P);
  return {
    path,
    root,
    content,
    tree: child(content, "spTree", P),
    rels: deck.rels(path),
  };
}
function related(part: Part, kind: string): string | undefined {
  const rel = Array.from(part.rels.values()).find(
    (r) => r.type.endsWith(`/${kind}`) && !r.external,
  );
  return rel ? pathFrom(part.path, rel.target) : undefined;
}
function placeholder(shape: Element): Element | undefined {
  return child(child(shape, "nvSpPr", P), "nvPr", P)?.getElementsByTagNameNS(
    P,
    "ph",
  )[0];
}
function inheritedShape(
  shape: Element,
  tree: Element | undefined,
): Element | undefined {
  const ph = placeholder(shape);
  if (!ph || !tree) return;
  const candidates = children(tree, "sp", P).filter((e) => placeholder(e));
  const idx = ph.getAttribute("idx") ?? "0",
    type = ph.getAttribute("type") ?? "body";
  return (
    candidates.find(
      (e) => (placeholder(e)?.getAttribute("idx") ?? "0") === idx,
    ) ??
    candidates.find(
      (e) => (placeholder(e)?.getAttribute("type") ?? "body") === type,
    )
  );
}
interface Context {
  deck: Archive;
  pdf: PDFDocument;
  page: PDFPage;
  theme: Theme;
  fonts: UnicodeFontSet;
  fontCoverage: Map<PDFFont, Set<number>>;
  standard: Map<string, PDFFont>;
  images: Map<string, PDFImage>;
  imageNames: Map<string, string>;
  fontNames: Map<PDFFont, string>;
  alphaNames: Map<string, string>;
  output: string[];
  cancelled?: () => boolean;
  layout?: Part;
  master?: Part;
  count: number;
}
function opacity(ctx: Context, fill: number, stroke: number): string {
  const key = `${n(fill)}:${n(stroke)}`;
  let name = ctx.alphaNames.get(key);
  if (!name) {
    name = ctx.page.node
      .newExtGState(
        "Opacity",
        ctx.pdf.context.obj({ Type: "ExtGState", ca: fill, CA: stroke }),
      )
      .toString();
    ctx.alphaNames.set(key, name);
  }
  return `${name} gs`;
}
const matrixCommand = (m: Matrix) => m.map(n).join(" ") + " cm";
function shapePaint(
  shape: Element,
  properties: Element | undefined,
  ctx: Context,
) {
  const style = child(shape, "style", P),
    ownFill = fillOf(properties, ctx.theme);
  const fill =
    ownFill !== undefined
      ? ownFill
      : colorOf(child(style, "fillRef"), ctx.theme);
  const line = child(properties, "ln"),
    lnRef = child(style, "lnRef");
  const stroke = child(line, "noFill")
    ? null
    : (colorOf(child(line, "solidFill"), ctx.theme) ??
      (lnRef?.getAttribute("idx") !== "0"
        ? colorOf(lnRef, ctx.theme)
        : undefined));
  const width = Number(line?.getAttribute("w") ?? 12700) / POINT,
    dash = child(line, "prstDash")?.getAttribute("val");
  const dashes: Record<string, number[]> = {
    dash: [4, 3],
    dot: [1, 3],
    sysDot: [1, 1],
    sysDash: [3, 1],
    dashDot: [4, 3, 1, 3],
    lgDash: [8, 3],
    lgDashDot: [8, 3, 1, 3],
    lgDashDotDot: [8, 3, 1, 3, 1, 3],
  };
  const lineCap = line?.getAttribute("cap");
  const commands = [
    fill ? `${rgb(fill)} rg` : "",
    stroke ? `${rgb(stroke)} RG ${n(width)} w` : "",
    `${lineCap === "rnd" ? 1 : lineCap === "sq" ? 2 : 0} J`,
    child(line, "round") ? "1 j" : "0 j",
    "10 M",
    dash && dashes[dash]
      ? `[${dashes[dash].map((x) => n(x * width)).join(" ")}] 0 d`
      : "[] 0 d",
    opacity(ctx, fill?.alpha ?? 1, stroke?.alpha ?? 1),
  ].join("\n");
  return { fill, stroke, width, commands, line };
}
function geometry(
  shape: Element,
  pr: Element | undefined,
  w: number,
  h: number,
  ctx: Context,
) {
  const paint = shapePaint(shape, pr, ctx),
    custom = child(pr, "custGeom"),
    preset = child(pr, "prstGeom");
  if ((!custom && !preset) || (!paint.fill && !paint.stroke)) return;
  const paths = custom
    ? customPaths(custom, w, h)
    : [
        {
          data: presetPath(preset!.getAttribute("prst") ?? "rect", w, h),
          fill: true,
          stroke: true,
        },
      ];
  ctx.output.push(paint.commands);
  let pending: string[] = [];
  const flush = () => {
    if (pending.length) {
      ctx.output.push(pending.join("\n"), "S");
      pending = [];
    }
  };
  for (const path of paths) {
    const f = path.fill && paint.fill,
      s = path.stroke && paint.stroke;
    if (!f && !s) continue;
    if (!f && s) {
      pending.push(path.data);
      continue;
    }
    flush();
    ctx.output.push(path.data, f && s ? "B" : f ? "f" : "S");
  }
  flush();
  if (
    preset &&
    /^(line|straightConnector1)$/.test(preset.getAttribute("prst") ?? "") &&
    paint.stroke
  ) {
    for (const [end, reverse] of [
      ["headEnd", true],
      ["tailEnd", false],
    ] as const) {
      const type = child(paint.line, end)?.getAttribute("type");
      if (!type || type === "none") continue;
      const angle = Math.atan2(h, w) + (reverse ? Math.PI : 0),
        x = reverse ? 0 : w,
        y = reverse ? 0 : h,
        s = Math.max(4, paint.width * 4);
      ctx.output.push(
        `${rgb(paint.stroke)} rg`,
        `${n(x)} ${n(y)} m ${n(x - s * Math.cos(angle) + s * 0.45 * Math.sin(angle))} ${n(y - s * Math.sin(angle) - s * 0.45 * Math.cos(angle))} l ${n(x - s * Math.cos(angle) - s * 0.45 * Math.sin(angle))} ${n(y - s * Math.sin(angle) + s * 0.45 * Math.cos(angle))} l h f`,
      );
    }
  }
}
interface Run {
  text: string;
  font: PDFFont;
  size: number;
  spacing: number;
  color: Color;
  underline: boolean;
}
interface TextLine {
  runs: Run[];
  width: number;
  height: number;
  align: string;
  left: number;
  before: number;
  after: number;
}
function fontFor(
  ctx: Context,
  family: string,
  text: string,
  bold: boolean,
  italic: boolean,
): PDFFont {
  const f =
    family === "+mj-lt"
      ? ctx.theme.major
      : family === "+mn-lt"
        ? ctx.theme.minor
        : family;
  const base = /times|cambria|georgia/i.test(f)
    ? "Times"
    : /courier|consolas/i.test(f)
      ? "Courier"
      : /arial|helvetica/i.test(f)
        ? "Helvetica"
        : undefined;
  const standard = ctx.standard.get(base ? `${base}:${bold}:${italic}` : "");
  if (standard) {
    try {
      standard.encodeText(text);
      return standard;
    } catch {
      /* Unicode fallback */
    }
  }
  const font = resolveFont(ctx.fonts, text, bold, italic);
  let coverage = ctx.fontCoverage.get(font);
  if (!coverage) { coverage = new Set(font.getCharacterSet()); ctx.fontCoverage.set(font, coverage); }
  if (Array.from(text).some(c => !coverage!.has(c.codePointAt(0)!) && !/\s/.test(c))) {
    throw new Error("A font needed for this slide's text is unavailable in the browser. Export from PowerPoint to preserve these characters.");
  }
  return font;
}
const runWidth = (run: Run) =>
  run.font.widthOfTextAtSize(run.text, run.size) +
  Array.from(run.text).length * run.spacing;
function renderText(
  shape: Element,
  tx: Element,
  w: number,
  h: number,
  ctx: Context,
  inherited: Element[] = [],
) {
  const body = child(tx, "bodyPr") ?? child(inherited[0], "bodyPr");
  const left = Number(body?.getAttribute("lIns") ?? 91440) / POINT,
    right = Number(body?.getAttribute("rIns") ?? 91440) / POINT,
    top = Number(body?.getAttribute("tIns") ?? 45720) / POINT,
    bottom = Number(body?.getAttribute("bIns") ?? 45720) / POINT;
  const wrap = body?.getAttribute("wrap") !== "none",
    auto = child(body, "normAutofit"),
    fontScale = Number(auto?.getAttribute("fontScale") ?? 100000) / 100000;
  const ph = placeholder(shape),
    kind = ph?.getAttribute("type");
  const masterStyles = child(
    child(ctx.master?.root, "txStyles", P),
    kind === "title" || kind === "ctrTitle"
      ? "titleStyle"
      : kind === "body" || (!kind && ph)
        ? "bodyStyle"
        : "otherStyle",
    P,
  );
  const lines: TextLine[] = [];
  let bulletIndex = 0;
  for (const p of children(tx, "p")) {
    const ownPr = child(p, "pPr"),
      level = Number(ownPr?.getAttribute("lvl") ?? 0);
    const defaults = [
      ownPr,
      child(child(tx, "lstStyle"), `lvl${level + 1}pPr`),
      ...inherited.flatMap((t) => [
        child(child(t, "p"), "pPr"),
        child(child(t, "lstStyle"), `lvl${level + 1}pPr`),
      ]),
      child(masterStyles, `lvl${level + 1}pPr`),
    ];
    const attr = (name: string) =>
      defaults
        .map((p) => p?.getAttribute(name))
        .find((v) => v !== null && v !== undefined);
    const prop = (name: string) =>
      defaults.map((p) => child(p, name)).find(Boolean);
    const align = attr("algn") ?? "l",
      margin = Number(attr("marL") ?? 0) / POINT,
      indent = Number(attr("indent") ?? 0) / POINT;
    const spacing = (name: string, base: number) => {
      const e = prop(name),
        pts = child(e, "spcPts"),
        pct = child(e, "spcPct");
      return pts
        ? Number(pts.getAttribute("val")) / 100
        : pct
          ? (base * Number(pct.getAttribute("val"))) / 100000
          : 0;
    };
    let runs: Run[] = [];
    const breaks: Array<Run | "break"> = [];
    for (const r of Array.from(p.children)) {
      if (r.localName === "br") {
        breaks.push("break");
        continue;
      }
      if (r.localName !== "r" && r.localName !== "fld") continue;
      let text = child(r, "t")?.textContent ?? "";
      if (!text) continue;
      const props = [
        child(r, "rPr"),
        ...defaults.map((p) => child(p, "defRPr")),
        child(p, "endParaRPr"),
      ];
      const ra = (name: string) =>
        props
          .map((p) => p?.getAttribute(name))
          .find((v) => v !== null && v !== undefined);
      const family =
        props
          .map((p) => child(p, "latin")?.getAttribute("typeface"))
          .find(Boolean) ?? "+mn-lt";
      if (family === "Symbol") text = text.replace(/\uf0d3/g, "©");
      const size = (Number(ra("sz") ?? 1800) / 100) * fontScale,
        bold = ra("b") === "1",
        italic = ra("i") === "1";
      const color = props
        .map((p) => colorOf(child(p, "solidFill"), ctx.theme))
        .find(Boolean) ??
        colorOf(child(child(shape, "style", P), "fontRef"), ctx.theme) ?? {
          hex: "000000",
          alpha: 1,
        };
      const runSpacing = Number(ra("spc") ?? 0) / 100;
      for (const token of text.match(/\n|[^\S\n]+|[^\s]+/g) ?? []) {
        if (token === "\n") {
          breaks.push("break");
          continue;
        }
        const value = token.replace(/\t/g, "    "),
          font = fontFor(ctx, family, value, bold, italic);
        trackDrawnText(font, value);
        breaks.push({
          text: value,
          font,
          size,
          spacing: runSpacing,
          color,
          underline: ra("u") !== undefined && ra("u") !== "none",
        });
      }
    }
    const char = prop("buChar")?.getAttribute("char"),
      autoBullet = prop("buAutoNum");
    if (!prop("buNone") && (char || autoBullet) && breaks.length) {
      const sample = breaks.find((r) => r !== "break") as Run | undefined;
      if (sample) {
        bulletIndex = Number(
          autoBullet?.getAttribute("startAt") ?? bulletIndex + 1,
        );
        const text = char ? `${char} ` : `${bulletIndex}. `;
        breaks.unshift({
          ...sample,
          text,
          font: fontFor(ctx, "Arial", text, false, false),
        });
      }
    }
    let width = 0,
      first = true;
    const fallbackSize =
      (breaks.find((r) => r !== "break") as Run | undefined)?.size ?? 18;
    const flush = () => {
      const size = runs.length
          ? Math.max(...runs.map((r) => r.size))
          : fallbackSize,
        ln = spacing("lnSpc", size);
      lines.push({
        runs,
        width,
        height: ln || size * 1.2,
        align,
        left: left + margin + (first ? indent : 0),
        before: first ? spacing("spcBef", size) : 0,
        after: 0,
      });
      runs = [];
      width = 0;
      first = false;
    };
    for (const run of breaks) {
      if (run === "break") {
        flush();
        continue;
      }
      const available = Math.max(
          1,
          w - left - right - margin - (first ? indent : 0),
        ),
        rw = runWidth(run);
      if (
        wrap &&
        runs.length &&
        width + rw > available &&
        !/^\s+$/.test(run.text)
      )
        flush();
      if (!runs.length && !first && /^\s+$/.test(run.text)) continue;
      runs.push(run);
      width += rw;
    }
    flush();
    lines[lines.length - 1].after = spacing("spcAft", fallbackSize);
  }
  const height = lines.reduce((v, l) => v + l.height + l.before + l.after, 0),
    anchor = body?.getAttribute("anchor");
  let y =
    top +
    (anchor === "ctr"
      ? Math.max(0, (h - top - bottom - height) / 2)
      : anchor === "b"
        ? Math.max(0, h - top - bottom - height)
        : 0);
  const vertical = body?.getAttribute("vert");
  if (vertical && !["horz", "vert", "vert270"].includes(vertical))
    throw new Error(
      "This slide contains unsupported vertical text. Export it from PowerPoint to preserve it.",
    );
  if (vertical === "vert") ctx.output.push(`q 0 1 -1 0 ${n(w)} 0 cm`);
  else if (vertical === "vert270") ctx.output.push(`q 0 -1 1 0 0 ${n(h)} cm`);
  for (const line of lines) {
    y += line.before;
    let x = line.left;
    const available = w - right - x;
    if (line.align === "ctr") x += Math.max(0, (available - line.width) / 2);
    else if (line.align === "r") x += Math.max(0, available - line.width);
    const size = line.runs.length
        ? Math.max(...line.runs.map((r) => r.size))
        : 18,
      baseline = y + size * 0.85;
    for (const run of line.runs) {
      let name = ctx.fontNames.get(run.font);
      if (!name) {
        name = ctx.page.node.newFontDictionary("Font", run.font.ref).toString();
        ctx.fontNames.set(run.font, name);
      }
      ctx.output.push(
        `${rgb(run.color)} rg`,
        opacity(ctx, run.color.alpha, 1),
        `BT ${name} ${n(run.size)} Tf ${n(run.spacing)} Tc 1 0 0 -1 ${n(x)} ${n(baseline)} Tm ${run.font.encodeText(run.text).toString()} Tj ET`,
      );
      const width = runWidth(run);
      if (run.underline)
        ctx.output.push(
          `${rgb(run.color)} RG ${n(Math.max(0.4, run.size / 18))} w ${n(x)} ${n(baseline + run.size * 0.12)} m ${n(x + width)} ${n(baseline + run.size * 0.12)} l S`,
        );
      x += width;
    }
    y += line.height + line.after;
  }
  if (vertical === "vert" || vertical === "vert270") ctx.output.push("Q");
}
async function imageFill(
  blipFill: Element,
  w: number,
  h: number,
  owner: Part,
  ctx: Context,
) {
  const blip = child(blipFill, "blip"),
    id = blip?.getAttributeNS(R, "embed") ?? blip?.getAttributeNS(R, "link");
  if (!id)
    throw new Error(
      "An image has no embedded content. Embed linked pictures in PowerPoint first.",
    );
  const rel = owner.rels.get(id);
  if (!rel || rel.external)
    throw new Error(
      "This presentation uses linked images. Embed them in PowerPoint first; files stay in your browser.",
    );
  const path = pathFrom(owner.path, rel.target),
    bytes = ctx.deck.entries[path];
  if (!bytes) throw new Error("An image is missing from this presentation.");
  let embedded = ctx.images.get(path);
  if (!embedded) {
    const format = rasterFormat(bytes);
    if (format === "png") embedded = await ctx.pdf.embedPng(bytes);
    else if (format === "jpeg") embedded = await ctx.pdf.embedJpg(bytes);
    else if (format) {
      const bitmap = await createImageBitmap(new Blob([bytes as BlobPart]));
      if (bitmap.width * bitmap.height > 40_000_000) {
        bitmap.close();
        throw new Error("A slide image is too large for browser conversion.");
      }
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
      bitmap.close();
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) =>
            b
              ? resolve(b)
              : reject(new Error("An image could not be converted.")),
          "image/png",
        ),
      );
      embedded = await ctx.pdf.embedPng(await blob.arrayBuffer());
    } else
      throw new Error(
        `This slide contains a ${path.split(".").pop()?.toUpperCase()} image that needs PowerPoint export. It will not be silently removed.`,
      );
    ctx.images.set(path, embedded);
  }
  let name = ctx.imageNames.get(path);
  if (!name) {
    name = ctx.page.node.newXObject("Image", embedded.ref).toString();
    ctx.imageNames.set(path, name);
  }
  if (child(blipFill, "tile"))
    throw new Error(
      "Tiled picture fills require PowerPoint export to preserve their appearance.",
    );
  const crop = child(blipFill, "srcRect"),
    l = Number(crop?.getAttribute("l") ?? 0) / 100000,
    r = Number(crop?.getAttribute("r") ?? 0) / 100000,
    t = Number(crop?.getAttribute("t") ?? 0) / 100000,
    b = Number(crop?.getAttribute("b") ?? 0) / 100000;
  if (1 - l - r <= 0 || 1 - t - b <= 0)
    throw new Error("A picture has invalid crop dimensions.");
  const iw = w / (1 - l - r),
    ih = h / (1 - t - b);
  ctx.output.push(
    `q 0 0 ${n(w)} ${n(h)} re W n`,
    opacity(ctx, 1, 1),
    `${n(iw)} 0 0 ${n(-ih)} ${n(-l * iw)} ${n(h + t * ih)} cm ${name} Do Q`,
  );
}
function table(
  shape: Element,
  element: Element,
  w: number,
  h: number,
  ctx: Context,
) {
  const cols = children(child(element, "tblGrid"), "gridCol").map(
      (e) => Number(e.getAttribute("w")) / POINT,
    ),
    rows = children(element, "tr");
  const totalW = cols.reduce((a, b) => a + b, 0) || w,
    totalH =
      rows.reduce((s, e) => s + Number(e.getAttribute("h")) / POINT, 0) || h;
  let y = 0;
  for (const row of rows) {
    const rh = ((Number(row.getAttribute("h")) / POINT) * h) / totalH;
    let x = 0;
    for (const [i, cell] of children(row, "tc").entries()) {
      const cw = ((cols[i] ?? 0) * w) / totalW,
        span = Number(cell.getAttribute("gridSpan") ?? 1),
        cellW =
          (cols.slice(i, i + span).reduce((a, b) => a + b, 0) * w) / totalW,
        cp = child(cell, "tcPr");
      if (
        cell.getAttribute("hMerge") === "1" ||
        cell.getAttribute("vMerge") === "1"
      ) {
        x += cw;
        continue;
      }
      const fill = fillOf(cp, ctx.theme);
      ctx.output.push(`q 1 0 0 1 ${n(x)} ${n(y)} cm`);
      if (fill)
        ctx.output.push(
          `${rgb(fill)} rg`,
          opacity(ctx, fill.alpha, 1),
          `0 0 ${n(cellW)} ${n(rh)} re f`,
        );
      for (const [side, coords] of [
        ["lnL", [0, 0, 0, rh]],
        ["lnR", [cellW, 0, cellW, rh]],
        ["lnT", [0, 0, cellW, 0]],
        ["lnB", [0, rh, cellW, rh]],
      ] as const) {
        const line = child(cp, side),
          c = fillOf(line, ctx.theme);
        if (c)
          ctx.output.push(
            `${rgb(c)} RG ${n(Number(line?.getAttribute("w") ?? 12700) / POINT)} w ${n(coords[0])} ${n(coords[1])} m ${n(coords[2])} ${n(coords[3])} l S`,
          );
      }
      const tx = child(cell, "txBody");
      if (tx) renderText(shape, tx, cellW, rh, ctx);
      ctx.output.push("Q");
      x += cw;
    }
    y += rh;
  }
}
async function walk(
  tree: Element | undefined,
  owner: Part,
  ctx: Context,
  parent: Matrix = IDENTITY,
  background = false,
): Promise<void> {
  if (!tree) return;
  for (const shape of Array.from(tree.children)) {
    if (++ctx.count % 200 === 0) {
      cancelCheck(ctx.cancelled);
      await pause();
    }
    if (shape.namespaceURI === MC && shape.localName === "AlternateContent") {
      const fallback = child(shape, "Fallback", MC);
      if (!fallback)
        throw new Error(
          "This slide contains an unsupported Office object without a fallback.",
        );
      await walk(fallback, owner, ctx, parent, background);
      continue;
    }
    if (
      shape.namespaceURI !== P ||
      !["sp", "pic", "cxnSp", "grpSp", "graphicFrame"].includes(shape.localName)
    )
      continue;
    if (
      shape.getElementsByTagNameNS(P, "cNvPr")[0]?.getAttribute("hidden") ===
      "1"
    )
      continue;
    if (background && placeholder(shape)) continue;
    if (shape.localName === "grpSp") {
      const box = transform(child(child(shape, "grpSpPr", P), "xfrm"), true);
      if (!box) throw new Error("A drawing group is missing its placement.");
      await walk(shape, owner, ctx, multiply(parent, box.matrix), background);
      continue;
    }
    const layout = inheritedShape(shape, ctx.layout?.tree),
      master = inheritedShape(layout ?? shape, ctx.master?.tree),
      pr = child(shape, "spPr", P);
    const xfrm =
      shape.localName === "graphicFrame"
        ? child(shape, "xfrm", P)
        : (child(pr, "xfrm") ??
          child(child(layout, "spPr", P), "xfrm") ??
          child(child(master, "spPr", P), "xfrm"));
    const box = transform(xfrm);
    if (!box) {
      if (placeholder(shape)) continue;
      throw new Error(
        "A slide object is missing its position. Save a fresh PPTX copy in PowerPoint.",
      );
    }
    const { width: w, height: h } = box;
    ctx.output.push("q", matrixCommand(multiply(parent, box.matrix)));
    if (shape.localName === "pic") {
      const fill = child(shape, "blipFill", P);
      if (fill) await imageFill(fill, w, h, owner, ctx);
      else throw new Error("A picture is missing its content.");
    } else if (shape.localName === "graphicFrame") {
      const data = child(child(shape, "graphic"), "graphicData"),
        tbl = child(data, "tbl");
      if (tbl) table(shape, tbl, w, h, ctx);
      else
        throw new Error(
          "This slide contains a chart, SmartArt or embedded object that this browser converter cannot reproduce. Export it from PowerPoint to keep every detail.",
        );
    } else {
      geometry(shape, pr, w, h, ctx);
      const fill = child(pr, "blipFill");
      if (fill) await imageFill(fill, w, h, owner, ctx);
      const tx = child(shape, "txBody", P);
      if (tx)
        renderText(
          shape,
          tx,
          w,
          h,
          ctx,
          [child(layout, "txBody", P), child(master, "txBody", P)].filter(
            (e): e is Element => Boolean(e),
          ),
        );
    }
    ctx.output.push("Q");
  }
}
export async function renderPptxToPdf(
  file: File,
  onProgress?: (percent: number) => void,
  isCancelled?: () => boolean,
  fontByteCache?: Map<string, Uint8Array>,
): Promise<Blob> {
  onProgress?.(1);
  await pause();
  const deck = await open(file, isCancelled, onProgress);
  onProgress?.(9);
  // Text-only scan keeps large shape-tree DOMs out of memory until rendering.
  const allText = Object.keys(deck.entries)
    .filter(
      (k) =>
        /\.xml$/.test(k) && /\/(slides|slideMasters|slideLayouts)\//.test(k),
    )
    .map((k) =>
      (deck.text(k)?.match(/<a:t(?:\s[^>]*)?>[^<]*<\/a:t>/g) ?? []).join(" "),
    )
    .join(" ");
  const { PDFDocument, StandardFonts } = await import("pdf-lib"),
    pdf = await PDFDocument.create();
  const fonts = await loadUnicodeFonts(pdf, allText, fontByteCache);
  cancelCheck(isCancelled);
  const standard = new Map<string, PDFFont>();
  for (const family of ["Helvetica", "Times", "Courier"] as const)
    for (const bold of [false, true])
      for (const italic of [false, true]) {
        const name =
          family === "Times"
            ? bold
              ? italic
                ? StandardFonts.TimesRomanBoldItalic
                : StandardFonts.TimesRomanBold
              : italic
                ? StandardFonts.TimesRomanItalic
                : StandardFonts.TimesRoman
            : family === "Helvetica"
              ? bold
                ? italic
                  ? StandardFonts.HelveticaBoldOblique
                  : StandardFonts.HelveticaBold
                : italic
                  ? StandardFonts.HelveticaOblique
                  : StandardFonts.Helvetica
              : bold
                ? italic
                  ? StandardFonts.CourierBoldOblique
                  : StandardFonts.CourierBold
                : italic
                  ? StandardFonts.CourierOblique
                  : StandardFonts.Courier;
        standard.set(
          `${family}:${bold}:${italic}`,
          pdf.embedStandardFont(name),
        );
      }
  const fontCoverage = new Map<PDFFont, Set<number>>();
  const images = new Map<string, PDFImage>(),
    partCache = new Map<string, Part>(),
    themeCache = new Map<string, Theme>();
  const cachedPart = (path: string) => {
    let p = partCache.get(path);
    if (!p) {
      p = part(deck, path);
      partCache.set(path, p);
    }
    return p;
  };
  for (const [i, path] of deck.slides.entries()) {
    cancelCheck(isCancelled);
    await pause();
    try {
      const slide = part(deck, path),
        layoutPath = related(slide, "slideLayout"),
        layout = layoutPath ? cachedPart(layoutPath) : undefined,
        masterPath = layout ? related(layout, "slideMaster") : undefined,
        master = masterPath ? cachedPart(masterPath) : undefined;
      const themePath =
        (master ? related(master, "theme") : undefined) ??
        "ppt/theme/theme1.xml";
      let theme = themeCache.get(themePath);
      if (!theme) {
        const source = deck.text(themePath);
        theme = themeOf(source ? xml(source) : undefined);
        themeCache.set(themePath, theme);
      }
      const page = pdf.addPage([deck.width, deck.height]),
        ctx: Context = {
          deck,
          pdf,
          page,
          theme,
          fonts,
          fontCoverage,
          standard,
          images,
          imageNames: new Map(),
          fontNames: new Map(),
          alphaNames: new Map(),
          output: [`q 1 0 0 -1 0 ${n(deck.height)} cm`],
          cancelled: isCancelled,
          layout,
          master,
          count: 0,
        };
      const owner = [slide, layout, master].find((p) =>
          child(p?.content, "bg", P),
        ),
        bg = child(owner?.content, "bg", P),
        bgPr = child(bg, "bgPr", P),
        background = fillOf(bgPr, theme) ??
          colorOf(child(bg, "bgRef", P), theme) ?? { hex: "FFFFFF", alpha: 1 };
      ctx.output.push(
        `${rgb(background)} rg 0 0 ${n(deck.width)} ${n(deck.height)} re f`,
      );
      const bgImage = child(bgPr, "blipFill");
      if (bgImage && owner)
        await imageFill(bgImage, deck.width, deck.height, owner, ctx);
      if (slide.root.getAttribute("showMasterSp") !== "0") {
        if (master && layout?.root.getAttribute("showMasterSp") !== "0")
          await walk(master.tree, master, ctx, IDENTITY, true);
        if (layout) await walk(layout.tree, layout, ctx, IDENTITY, true);
      }
      await walk(slide.tree, slide, ctx);
      ctx.output.push("Q");
      const stream = pdf.context.flateStream(
        encoder.encode(ctx.output.join("\n")),
      );
      page.node.addContentStream(pdf.context.register(stream));
      onProgress?.(10 + ((i + 1) / deck.slides.length) * 84);
    } catch (error) {
      if (isCancelled?.()) throw new Error("Cancelled");
      throw new Error(
        `Slide ${i + 1}: ${error instanceof Error ? error.message : "Could not render this slide."}`,
        { cause: error },
      );
    }
  }
  cancelCheck(isCancelled);
  onProgress?.(96);
  await pause();
  patchToUnicodeCmaps(fonts);
  pdf.setCreator("PDFPilot browser converter");
  pdf.setTitle(file.name.replace(/\.pptx$/i, ""));
  const bytes = await pdf.save();
  cancelCheck(isCancelled);
  onProgress?.(100);
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}
