/**
 * PowerPoint to PDF Engine — reconstructs each slide's real layout instead
 * of extracting plain text. A .pptx is a zip of OOXML parts (verified
 * directly by unzipping a real file); this reads that zip with `fflate`
 * (already a dependency here — `zipSync` builds Excel-to-XML's .xlsx
 * output the same way, this is `unzipSync`, its read-side counterpart)
 * and parses each slide's XML with the browser's built-in `DOMParser` — no
 * new dependency for either step.
 *
 * There is no real client-side PPTX *rasterizer* (the rendering approach
 * PDF to PowerPoint's `renderPageUpright` uses via pdfjs has no equivalent
 * for OOXML), so this takes the other honest path available: read each
 * slide's actual shape tree — text runs, positions, fonts, colors, fills,
 * images — and draw it onto a pdf-lib page at the same coordinates,
 * converting EMU (the OOXML unit; 914400 per inch) to PDF points
 * (12700 EMU per point, since 72pt = 1in). This is a good-faith layout
 * reconstruction, not a pixel-perfect render — see the scope notes on
 * `walkShapeTree` and `drawTextShape` for exactly what is and isn't
 * reproduced, verified against real files, not assumed.
 */

import type { PDFDocument, PDFFont, PDFPage } from "pdf-lib";
import { loadUnicodeFonts, resolveFont, type UnicodeFontSet } from "./unicode-fonts";

const EMU_PER_POINT = 12700;
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_RELS = "http://schemas.openxmlformats.org/package/2006/relationships";

function emuToPt(emu: number): number {
  return emu / EMU_PER_POINT;
}

function hexToRgb01(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").padEnd(6, "0").slice(0, 6);
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  return [r / 255, g / 255, b / 255];
}

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, "application/xml");
}

function firstChildNS(el: Element | Document, ns: string, local: string): Element | undefined {
  for (const child of Array.from(el.children ?? [])) {
    if (child.namespaceURI === ns && child.localName === local) return child;
  }
  return undefined;
}

function childrenNS(el: Element, ns: string, local: string): Element[] {
  return Array.from(el.children).filter((c) => c.namespaceURI === ns && c.localName === local);
}

/** Every direct or indirect shape-tree child, in document order, tagged
 *  with its own local name — used to walk `p:spTree` where children can be
 *  `p:sp`, `p:pic`, `p:grpSp`, `p:graphicFrame`, or `p:cxnSp` in any mix. */
function shapeTreeChildren(spTree: Element): Element[] {
  return Array.from(spTree.children).filter((c) => c.namespaceURI === NS_P);
}

function parseRelsMap(relsXmlText: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!relsXmlText) return map;
  const doc = parseXml(relsXmlText);
  const root = doc.documentElement;
  if (!root) return map;
  for (const rel of Array.from(root.children)) {
    if (rel.namespaceURI !== NS_RELS || rel.localName !== "Relationship") continue;
    const id = rel.getAttribute("Id");
    const target = rel.getAttribute("Target");
    if (id && target) map.set(id, target);
  }
  return map;
}

/** Resolves a zip-relative target path from a slide's own rels (which are
 *  written relative to `ppt/slides/`, e.g. "../media/image1.png") into the
 *  real key used in the unzipped archive (e.g. "ppt/media/image1.png"). */
function resolveZipPath(basePath: string, relativeTarget: string): string {
  if (relativeTarget.startsWith("/")) return relativeTarget.slice(1);
  const baseParts = basePath.split("/").slice(0, -1);
  for (const segment of relativeTarget.split("/")) {
    if (segment === "..") baseParts.pop();
    else if (segment !== ".") baseParts.push(segment);
  }
  return baseParts.join("/");
}

/** Maps the theme's named color slots (dk1/lt1/accent1..6/etc.) to real
 *  hex values, so `a:schemeClr` references - what most PowerPoint
 *  templates actually use for titles, backgrounds, and accents, rather
 *  than direct `a:srgbClr` - resolve to a real color instead of silently
 *  falling back to black on every themed deck. Color transforms
 *  (lumMod/lumOff/shade/tint/alpha) are intentionally not applied - the
 *  base theme color is close in the same family, not an exact match. */
function parseThemeColors(themeXmlText: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!themeXmlText) return map;
  const doc = parseXml(themeXmlText);
  const scheme = doc.getElementsByTagNameNS(NS_A, "clrScheme")[0];
  if (!scheme) return map;
  for (const slot of Array.from(scheme.children)) {
    if (slot.namespaceURI !== NS_A) continue;
    const name = slot.localName; // dk1, lt1, dk2, lt2, accent1..6, hlink, folHlink
    const srgb = firstChildNS(slot, NS_A, "srgbClr");
    const sys = firstChildNS(slot, NS_A, "sysClr");
    const hex = srgb?.getAttribute("val") ?? sys?.getAttribute("lastClr");
    if (hex) map.set(name, hex);
  }
  return map;
}

const SCHEME_ALIASES: Record<string, string> = { tx1: "dk1", tx2: "dk2", bg1: "lt1", bg2: "lt2" };

/** Reads a `a:solidFill` (direct child of the given parent element, e.g.
 *  `p:spPr` or `a:rPr`) and resolves it to a real hex color, following
 *  `a:schemeClr` through the theme map. Returns "NONE" for an explicit
 *  `a:noFill` (a real, common case - most text boxes have no background)
 *  and undefined when there's no fill information at all. */
function resolveFill(parent: Element | undefined, themeColors: Map<string, string>): string | "NONE" | undefined {
  if (!parent) return undefined;
  if (firstChildNS(parent, NS_A, "noFill")) return "NONE";
  const solid = firstChildNS(parent, NS_A, "solidFill");
  if (!solid) return undefined;
  const srgb = firstChildNS(solid, NS_A, "srgbClr");
  if (srgb) return srgb.getAttribute("val") ?? undefined;
  const scheme = firstChildNS(solid, NS_A, "schemeClr");
  if (scheme) {
    const raw = scheme.getAttribute("val");
    if (!raw) return undefined;
    const key = SCHEME_ALIASES[raw] ?? raw;
    return themeColors.get(key);
  }
  return undefined;
}

interface TextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  sizePt: number;
  colorHex: string;
}

interface Paragraph {
  runs: TextRun[];
  align: "left" | "center" | "right";
}

/** Parses a `p:txBody`'s paragraphs and runs - the actual visible text of a
 *  shape, with per-run bold/italic/size/color, and per-paragraph
 *  alignment. Runs with no explicit size fall back to 18pt (a common
 *  default body size) rather than trying to resolve PowerPoint's full
 *  placeholder/layout/master style-inheritance chain, which real files
 *  rarely need for the fallback to matter (most runs specify their own
 *  size). `a:br` line breaks inside a paragraph are not preserved as
 *  separate lines - a real, minor scope limit. */
function parseTextBody(txBody: Element, themeColors: Map<string, string>): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  for (const p of childrenNS(txBody, NS_A, "p")) {
    const pPr = firstChildNS(p, NS_A, "pPr");
    const algnRaw = pPr?.getAttribute("algn");
    const align: Paragraph["align"] = algnRaw === "ctr" ? "center" : algnRaw === "r" ? "right" : "left";

    const runs: TextRun[] = [];
    for (const r of childrenNS(p, NS_A, "r")) {
      const t = firstChildNS(r, NS_A, "t");
      const text = t?.textContent ?? "";
      if (!text) continue;
      const rPr = firstChildNS(r, NS_A, "rPr");
      const szAttr = rPr?.getAttribute("sz");
      const sizePt = szAttr ? parseInt(szAttr, 10) / 100 : 18;
      const bold = rPr?.getAttribute("b") === "1";
      const italic = rPr?.getAttribute("i") === "1";
      const fill = resolveFill(rPr, themeColors);
      const colorHex = fill && fill !== "NONE" ? fill : "000000";
      runs.push({ text, bold, italic, sizePt: sizePt > 0 ? sizePt : 18, colorHex });
    }
    if (runs.length > 0) paragraphs.push({ runs, align });
  }
  return paragraphs;
}

interface Box {
  xEmu: number;
  yEmu: number;
  cxEmu: number;
  cyEmu: number;
}

function readXfrmBox(spPr: Element | undefined): Box | undefined {
  const xfrm = spPr && firstChildNS(spPr, NS_A, "xfrm");
  if (!xfrm) return undefined;
  const off = firstChildNS(xfrm, NS_A, "off");
  const ext = firstChildNS(xfrm, NS_A, "ext");
  if (!off || !ext) return undefined;
  const xEmu = Number(off.getAttribute("x"));
  const yEmu = Number(off.getAttribute("y"));
  const cxEmu = Number(ext.getAttribute("cx"));
  const cyEmu = Number(ext.getAttribute("cy"));
  if ([xEmu, yEmu, cxEmu, cyEmu].some((n) => !Number.isFinite(n))) return undefined;
  return { xEmu, yEmu, cxEmu, cyEmu };
}

/** A `p:grpSp`'s own box is where it sits on its PARENT canvas; its
 *  children's boxes are expressed in the group's own child coordinate
 *  space (`a:chOff`/`a:chExt`, which do not have to match the group's own
 *  off/ext). Mapping a child box into parent space is a real, well-defined
 *  affine transform - not skipped, since grouped title/subtitle pairs are
 *  common enough in real decks that dropping all `p:grpSp` content would
 *  be a visible fidelity loss. Composed recursively so nested groups (a
 *  group inside a group) still resolve to correct absolute coordinates. */
function mapChildBox(child: Box, group: Box, chOff: { x: number; y: number }, chExt: { cx: number; cy: number }): Box {
  const scaleX = chExt.cx !== 0 ? group.cxEmu / chExt.cx : 1;
  const scaleY = chExt.cy !== 0 ? group.cyEmu / chExt.cy : 1;
  return {
    xEmu: group.xEmu + (child.xEmu - chOff.x) * scaleX,
    yEmu: group.yEmu + (child.yEmu - chOff.y) * scaleY,
    cxEmu: child.cxEmu * scaleX,
    cyEmu: child.cyEmu * scaleY,
  };
}

type ShapeNode =
  | { kind: "text"; box: Box; fillHex?: string; paragraphs: Paragraph[] }
  | { kind: "image"; box: Box; zipPath: string };

/** Walks a slide's (or group's) shape tree in document order - the same
 *  order PowerPoint stacks shapes front-to-back, so drawing in this order
 *  reproduces the real z-order for free. `p:graphicFrame` (tables/charts)
 *  and `p:cxnSp` (connector lines) are intentionally not rendered - a
 *  real, documented scope limit (see the tool's own FAQ copy), the same
 *  kind of explicit boundary office-engine.ts already draws around
 *  multi-sheet workbooks rather than half-rendering them. Shape rotation
 *  and flip are also not applied - shapes draw axis-aligned at their
 *  unrotated position/size, which is correct for the large majority of
 *  slide content that isn't rotated. */
function walkShapeTree(
  spTree: Element,
  themeColors: Map<string, string>,
  relsMap: Map<string, string>,
  slidePath: string,
  mediaKeys: Set<string>,
  mapBox: (box: Box) => Box
): ShapeNode[] {
  const nodes: ShapeNode[] = [];

  for (const el of shapeTreeChildren(spTree)) {
    if (el.localName === "sp") {
      const spPr = firstChildNS(el, NS_P, "spPr");
      const rawBox = readXfrmBox(spPr);
      if (!rawBox) continue; // no explicit position (placeholder inheriting from layout) - not resolved in v1
      const box = mapBox(rawBox);
      const fill = resolveFill(spPr, themeColors);
      const txBody = firstChildNS(el, NS_P, "txBody");
      const paragraphs = txBody ? parseTextBody(txBody, themeColors) : [];
      if (paragraphs.length === 0 && (!fill || fill === "NONE")) continue;
      nodes.push({ kind: "text", box, fillHex: fill && fill !== "NONE" ? fill : undefined, paragraphs });
    } else if (el.localName === "pic") {
      const spPr = firstChildNS(el, NS_P, "spPr");
      const rawBox = readXfrmBox(spPr);
      if (!rawBox) continue;
      const blipFill = firstChildNS(el, NS_P, "blipFill");
      const blip = blipFill && firstChildNS(blipFill, NS_A, "blip");
      const rId = blip?.getAttributeNS(NS_R, "embed") ?? undefined;
      const target = rId ? relsMap.get(rId) : undefined;
      if (!target) continue;
      const zipPath = resolveZipPath(slidePath, target);
      if (!mediaKeys.has(zipPath)) continue;
      nodes.push({ kind: "image", box: mapBox(rawBox), zipPath });
    } else if (el.localName === "grpSp") {
      const grpSpPr = firstChildNS(el, NS_P, "grpSpPr");
      const xfrm = grpSpPr && firstChildNS(grpSpPr, NS_A, "xfrm");
      const rawGroupBox = readXfrmBox(grpSpPr);
      const chOffEl = xfrm && firstChildNS(xfrm, NS_A, "chOff");
      const chExtEl = xfrm && firstChildNS(xfrm, NS_A, "chExt");
      if (!rawGroupBox || !chOffEl || !chExtEl) continue; // malformed group transform - skip its contents rather than guess
      const groupBox = mapBox(rawGroupBox);
      const chOff = { x: Number(chOffEl.getAttribute("x")) || 0, y: Number(chOffEl.getAttribute("y")) || 0 };
      const chExt = { cx: Number(chExtEl.getAttribute("cx")) || 1, cy: Number(chExtEl.getAttribute("cy")) || 1 };
      const nestedMap = (box: Box) => mapChildBox(box, groupBox, chOff, chExt);
      nodes.push(...walkShapeTree(el, themeColors, relsMap, slidePath, mediaKeys, nestedMap));
    }
    // p:graphicFrame (tables/charts) and p:cxnSp (connectors) intentionally skipped.
  }

  return nodes;
}

function parseSlideBackground(cSld: Element, themeColors: Map<string, string>): string | undefined {
  const bg = firstChildNS(cSld, NS_P, "bg");
  if (!bg) return undefined;
  const bgPr = firstChildNS(bg, NS_P, "bgPr");
  if (bgPr) {
    const fill = resolveFill(bgPr, themeColors);
    return fill && fill !== "NONE" ? fill : undefined;
  }
  const bgRef = firstChildNS(bg, NS_P, "bgRef");
  if (bgRef) {
    const scheme = firstChildNS(bgRef, NS_A, "schemeClr");
    const raw = scheme?.getAttribute("val");
    if (raw) return themeColors.get(SCHEME_ALIASES[raw] ?? raw);
  }
  return undefined;
}

interface Token {
  text: string;
  font: PDFFont;
  size: number;
  colorHex: string;
}

/** Greedy word-wrap that keeps each word's own font/size/color as a
 *  separate token, so a paragraph mixing bold and normal runs still wraps
 *  and renders correctly instead of collapsing to one style per line.
 *  Font is picked per WORD (not per run) via `resolveFont` - a single text
 *  run can genuinely mix scripts (e.g. "Hello नमस्ते World" as one
 *  PowerPoint run), and each word needs the font that actually has its
 *  glyphs (script-specific font, or the symbols-font fallback for things
 *  like → and ✓ that plain Noto Sans doesn't cover). */
function layoutParagraph(paragraph: Paragraph, fonts: UnicodeFontSet, maxWidthPt: number): Token[][] {
  const words: Token[] = [];
  for (const run of paragraph.runs) {
    for (const word of run.text.split(/\s+/)) {
      if (!word) continue;
      const font = resolveFont(fonts, word, run.bold, run.italic);
      words.push({ text: word, font, size: run.sizePt, colorHex: run.colorHex });
    }
  }
  if (words.length === 0) return [[]];

  const lines: Token[][] = [];
  let current: Token[] = [];
  let currentWidth = 0;
  for (const word of words) {
    const wordWidth = word.font.widthOfTextAtSize(word.text, word.size);
    const sepWidth = current.length > 0 ? word.font.widthOfTextAtSize(" ", word.size) : 0;
    if (current.length > 0 && currentWidth + sepWidth + wordWidth > Math.max(maxWidthPt, 1)) {
      lines.push(current);
      current = [word];
      currentWidth = wordWidth;
    } else {
      current.push(word);
      currentWidth += sepWidth + wordWidth;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

/** Draws one paragraph's already-wrapped lines top-down starting at
 *  `topY` (the y of the top of the first line's em-box, PDF points,
 *  Y-up), returns the y to continue at for the next paragraph. Baseline
 *  is approximated at 80% of the line's max font size below its top -
 *  a standard ascent ratio for Helvetica, not measured per-glyph. */
function drawParagraph(
  page: PDFPage,
  rgbFn: (r: number, g: number, b: number) => ReturnType<typeof import("pdf-lib").rgb>,
  lines: Token[][],
  xPt: number,
  topY: number,
  maxWidthPt: number,
  align: Paragraph["align"]
): number {
  let cursorTopY = topY;
  for (const line of lines) {
    const maxSize = line.length ? Math.max(...line.map((t) => t.size)) : 12;
    const baselineY = cursorTopY - maxSize * 0.8;
    if (line.length > 0) {
      const lineWidth = line.reduce(
        (sum, t, i) => sum + t.font.widthOfTextAtSize(t.text, t.size) + (i > 0 ? t.font.widthOfTextAtSize(" ", t.size) : 0),
        0
      );
      let x = xPt;
      if (align === "center") x += Math.max(0, (maxWidthPt - lineWidth) / 2);
      else if (align === "right") x += Math.max(0, maxWidthPt - lineWidth);
      for (const token of line) {
        const [r, g, b] = hexToRgb01(token.colorHex);
        page.drawText(token.text, { x, y: baselineY, size: token.size, font: token.font, color: rgbFn(r, g, b) });
        x += token.font.widthOfTextAtSize(token.text, token.size) + token.font.widthOfTextAtSize(" ", token.size);
      }
    }
    cursorTopY -= maxSize * 1.2;
  }
  return cursorTopY;
}

const TEXT_INNER_PADDING_PT = 4;

/** Converts a .pptx File into a real, laid-out PDF: each slide becomes one
 *  page at the presentation's own dimensions, with real text (position,
 *  wrapping, bold/italic, size, color), shape fills, and images placed at
 *  their true coordinates - not a linear text dump. */
export async function convertPptxToPdf(
  file: File,
  onProgress?: (percent: number) => void,
  isCancelled?: () => boolean
): Promise<Blob> {
  const { unzipSync } = await import("fflate");
  const arrayBuffer = await file.arrayBuffer();

  let archive: ReturnType<typeof unzipSync>;
  try {
    archive = unzipSync(new Uint8Array(arrayBuffer));
  } catch (error) {
    throw new Error(`"${file.name}" couldn't be opened. It may be corrupted or not a real .pptx file.`, { cause: error });
  }

  const decoder = new TextDecoder();
  const readText = (path: string): string | undefined => {
    const bytes = archive[path];
    return bytes ? decoder.decode(bytes) : undefined;
  };

  const presentationXml = readText("ppt/presentation.xml");
  if (!presentationXml) {
    throw new Error(`"${file.name}" doesn't look like a valid PowerPoint (.pptx) file.`);
  }

  const presDoc = parseXml(presentationXml);
  const sldSz = presDoc.getElementsByTagNameNS(NS_P, "sldSz")[0];
  const pageWidthPt = sldSz?.getAttribute("cx") ? emuToPt(Number(sldSz.getAttribute("cx"))) : emuToPt(12192000);
  const pageHeightPt = sldSz?.getAttribute("cy") ? emuToPt(Number(sldSz.getAttribute("cy"))) : emuToPt(6858000);

  const presRels = parseRelsMap(readText("ppt/_rels/presentation.xml.rels"));
  const sldIdLst = presDoc.getElementsByTagNameNS(NS_P, "sldIdLst")[0];
  const slidePaths: string[] = [];
  if (sldIdLst) {
    for (const sldId of Array.from(sldIdLst.children)) {
      const rId = sldId.getAttributeNS(NS_R, "id");
      const target = rId ? presRels.get(rId) : undefined;
      if (target) slidePaths.push(resolveZipPath("ppt/presentation.xml", target));
    }
  }
  if (slidePaths.length === 0) {
    throw new Error("No slides were found in this presentation.");
  }

  const themeColors = parseThemeColors(readText("ppt/theme/theme1.xml"));
  const mediaKeys = new Set(Object.keys(archive).filter((k) => k.startsWith("ppt/media/")));

  const { PDFDocument, rgb } = await import("pdf-lib");
  const pdfDoc: PDFDocument = await PDFDocument.create();
  // Real Unicode fonts (Noto Sans + Devanagari + Arabic, via fontkit) instead
  // of pdf-lib's built-in StandardFonts - those are WinAnsi-only and used to
  // throw ("WinAnsi cannot encode ...") on anything outside Windows-1252:
  // bullets, arrows, Hindi, Arabic, most real-world symbols. See
  // unicode-fonts.ts for the full root-cause writeup.
  const fonts = await loadUnicodeFonts(pdfDoc);
  const imageCache = new Map<string, Awaited<ReturnType<typeof pdfDoc.embedPng>>>();

  for (let i = 0; i < slidePaths.length; i++) {
    if (isCancelled?.()) break;
    const slidePath = slidePaths[i];
    const slideXml = readText(slidePath);
    if (!slideXml) continue; // referenced in presentation.xml but missing from the archive - skip rather than fail the whole file

    const slideDoc = parseXml(slideXml);
    const sld = slideDoc.documentElement;
    const cSld = firstChildNS(sld, NS_P, "cSld");
    const spTree = cSld && firstChildNS(cSld, NS_P, "spTree");

    const relsPathParts = slidePath.split("/");
    const relsPath = `${relsPathParts.slice(0, -1).join("/")}/_rels/${relsPathParts[relsPathParts.length - 1]}.rels`;
    const relsMap = parseRelsMap(readText(relsPath));

    const page = pdfDoc.addPage([pageWidthPt, pageHeightPt]);

    const backgroundHex = cSld ? parseSlideBackground(cSld, themeColors) : undefined;
    if (backgroundHex) {
      const [r, g, b] = hexToRgb01(backgroundHex);
      page.drawRectangle({ x: 0, y: 0, width: pageWidthPt, height: pageHeightPt, color: rgb(r, g, b) });
    }

    const shapes = spTree
      ? walkShapeTree(spTree, themeColors, relsMap, slidePath, mediaKeys, (box) => box)
      : [];

    for (const shape of shapes) {
      const xPt = emuToPt(shape.box.xEmu);
      const yPt = emuToPt(shape.box.yEmu);
      const wPt = Math.max(emuToPt(shape.box.cxEmu), 0);
      const hPt = Math.max(emuToPt(shape.box.cyEmu), 0);
      const topY = pageHeightPt - yPt;

      if (shape.kind === "image") {
        let embedded = imageCache.get(shape.zipPath);
        if (!embedded) {
          const bytes = archive[shape.zipPath];
          const isJpeg = /\.(jpe?g)$/i.test(shape.zipPath);
          const isPng = /\.png$/i.test(shape.zipPath);
          if (!bytes || (!isJpeg && !isPng)) continue; // gif/bmp/emf/wmf/tiff not supported by pdf-lib's embedder - documented scope limit
          try {
            embedded = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
          } catch {
            continue; // a genuinely corrupt embedded image shouldn't fail the whole conversion
          }
          imageCache.set(shape.zipPath, embedded);
        }
        page.drawImage(embedded, { x: xPt, y: topY - hPt, width: wPt, height: hPt });
        continue;
      }

      if (shape.fillHex) {
        const [r, g, b] = hexToRgb01(shape.fillHex);
        page.drawRectangle({ x: xPt, y: topY - hPt, width: wPt, height: hPt, color: rgb(r, g, b) });
      }

      let cursorTopY = topY - TEXT_INNER_PADDING_PT;
      const innerWidth = Math.max(wPt - TEXT_INNER_PADDING_PT * 2, 1);
      for (const paragraph of shape.paragraphs) {
        const lines = layoutParagraph(paragraph, fonts, innerWidth);
        cursorTopY = drawParagraph(page, rgb, lines, xPt + TEXT_INNER_PADDING_PT, cursorTopY, innerWidth, paragraph.align);
        cursorTopY -= 2;
      }
    }

    onProgress?.(((i + 1) / slidePaths.length) * 100);
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
}
