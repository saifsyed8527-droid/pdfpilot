/**
 * Converts Edit PDF's canvas-pixel object model into a real saved PDF via
 * pdf-lib. This is the one place canvas-pixel coordinates become pdf-lib's
 * bottom-left-origin, Y-up, point-based coordinates - verified directly
 * against pdf-lib's actual operator implementations
 * (node_modules/pdf-lib/es/api/operations.js), not assumed.
 *
 * Rotation strategy (one formula, reused for every object type):
 * drawText/drawImage/drawRectangle all do `translate(x, y)` then
 * `rotateRadians(rotate)` THEN draw relative to that local (0,0) - so the
 * (x, y) origin they take is invariant under their own `rotate` option
 * (rotating the point (0,0) around itself is a no-op); `rotate` only
 * reorients what gets drawn *at* that already-placed origin. That means a
 * rotated object's correct pdf-lib origin can be computed by literally
 * rotating the desired local reference point (the corner, or a text
 * line's baseline start) around the box's own center using the exact
 * same `rotatePoint` helper the editor UI uses for its resize/rotate
 * handles - `forwardRotatedOrigin` below - rather than solving a separate
 * inverse formula per draw method. One rotation helper, used for text,
 * images, and (via drawSvgPath, for shapes/lines/strokes) everything
 * else, all verified to agree with the UI's own CSS `rotate()` handles by
 * decoding a saved, rotated PDF back out.
 *
 * Screen rotation is clockwise-positive in a Y-down frame; pdf-lib's
 * `rotate` is counter-clockwise-positive in Y-up. Flipping the Y axis
 * reverses a rotation's apparent handedness, so the pdf-lib angle that
 * reproduces the same *visual* rotation once rendered (also Y-down, like
 * any real PDF viewer) is the negation of the UI's degrees value.
 *
 * drawSvgPath applies a permanent `scale(1, -1)` before drawing the path
 * (confirmed in source: "SVG path Y axis is opposite pdf-lib's") -
 * meaning path coordinates are interpreted Y-down, exactly like this
 * editor's own canvas-pixel points, with no manual flip needed.
 *
 * drawEllipse's (x, y) is documented and typed as the ellipse's CENTER
 * (unlike rectangle/image), so unrotated ellipses need no corner
 * compensation; rotated ellipses go through the same
 * polygon-via-drawSvgPath path as rectangles for consistency (rendered
 * as a 48-point polygon - visually a smooth ellipse at any real stroke
 * width, and it reuses the one verified rotation path instead of trusting
 * a third, separately-verified rotation convention).
 */

import { scaledDrawStrokes } from "./signature";
import type { Attachment, Bookmark, EditorObject, PagesObjects } from "./types";
import { hexToRgb01, rotatePoint } from "./types";
import { createEditorTextWriter, editorPointToPdf, prepareTextReplacements } from "./text-replacement";
import { assertNotCancelled, visualPageGeometry } from "../engines/pdf-visual-page";
import { assertSupportedForm, buildNewFields, type FormField } from "../engines/pdf-forms-engine";

/**
 * Link annotations and document outlines (bookmarks) have no high-level
 * pdf-lib API (only `pdfDoc.attach()` and the AcroForm helpers do) - both
 * are built here as raw PDF dictionaries via `context.obj()`/`context.register()`,
 * the same low-level technique already proven in this codebase's
 * pdf-watermark-engine.ts (`drawBelowOriginalContent`) for manipulating a
 * page's Contents array directly. Verified against the PDF 1.7 spec
 * (12.5.6.5 Link Annotations; 12.3.3 Document Outline) rather than guessed.
 */
async function addLinkAnnotation(
  pdfDoc: import("pdf-lib").PDFDocument,
  page: import("pdf-lib").PDFPage,
  rectPt: [number, number, number, number],
  url: string
) {
  const { PDFName, PDFArray, PDFString } = await import("pdf-lib");
  const context = pdfDoc.context;
  const actionDict = context.obj({
    Type: "Action",
    S: "URI",
    URI: PDFString.of(url),
  });
  const linkDict = context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: rectPt,
    Border: [0, 0, 0],
    A: actionDict,
  });
  const linkRef = context.register(linkDict);

  const existingAnnots = page.node.Annots();
  if (existingAnnots instanceof PDFArray) {
    existingAnnots.push(linkRef);
  } else {
    page.node.set(PDFName.of("Annots"), context.obj([linkRef]));
  }
}

/** Appends flat page bookmarks to an existing outline tree, preserving its
 *  original branches and destinations. New entries use a page-fit target. */
async function writeOutlines(pdfDoc: import("pdf-lib").PDFDocument, bookmarks: Bookmark[]) {
  if (bookmarks.length === 0) return;
  const { PDFName, PDFHexString, PDFNumber, PDFDict, PDFRef } = await import("pdf-lib");
  const context = pdfDoc.context, pages = pdfDoc.getPages();
  const existingRef = pdfDoc.catalog.get(PDFName.of("Outlines"));
  const existing = existingRef ? context.lookup(existingRef) : undefined;
  if (existingRef && (!(existingRef instanceof PDFRef) || !(existing instanceof PDFDict))) throw new Error("This PDF has an unsupported bookmark structure. Save without adding new bookmarks.");
  const root = existing instanceof PDFDict ? existing : context.obj({ Type: "Outlines", Count: 0 });
  const rootRef = existingRef instanceof PDFRef ? existingRef : context.register(root);
  const previousLastRef = root.get(PDFName.of("Last"));
  const previousLast = previousLastRef ? context.lookup(previousLastRef) : undefined;
  if (previousLastRef && (!(previousLastRef instanceof PDFRef) || !(previousLast instanceof PDFDict))) throw new Error("This PDF's bookmark list cannot be extended safely.");
  const itemRefs = bookmarks.map(() => context.nextRef());
  bookmarks.forEach((bookmark, i) => {
    const page = pages[bookmark.pageIndex];
    if (!page) throw new Error("A bookmark points to a missing page.");
    context.assign(itemRefs[i], context.obj({
      Title: PDFHexString.fromText(bookmark.title || `Bookmark ${i + 1}`), Parent: rootRef,
      Dest: [page.ref, PDFName.of("Fit")],
      ...(i > 0 ? { Prev: itemRefs[i - 1] } : previousLastRef ? { Prev: previousLastRef } : {}),
      ...(i < bookmarks.length - 1 ? { Next: itemRefs[i + 1] } : {}),
    }));
  });
  if (previousLast instanceof PDFDict) previousLast.set(PDFName.of("Next"), itemRefs[0]);
  else root.set(PDFName.of("First"), itemRefs[0]);
  root.set(PDFName.of("Last"), itemRefs[itemRefs.length - 1]);
  const count = root.lookup(PDFName.of("Count"));
  root.set(PDFName.of("Count"), PDFNumber.of((count instanceof PDFNumber ? Math.max(0, count.asNumber()) : 0) + bookmarks.length));
  pdfDoc.catalog.set(PDFName.of("Outlines"), rootRef);
}

/** Rotates a local reference point (e.g. a bounding box corner, or a text
 *  line's baseline start) around the box's own center by `rotationDeg`
 *  (screen, clockwise), then converts the result to a PDF-point origin
 *  plus the pdf-lib rotation angle that should accompany it. */
function forwardRotatedOrigin(
  objX: number,
  objY: number,
  width: number,
  height: number,
  localX: number,
  localY: number,
  rotationDeg: number,
  scale: number,
  pageHeightPts: number
): { x: number; y: number; pdfRotateDeg: number } {
  const rotatedLocal = rotatePoint(localX, localY, width / 2, height / 2, rotationDeg);
  const worldCanvasX = objX + rotatedLocal.x;
  const worldCanvasY = objY + rotatedLocal.y;
  return {
    x: worldCanvasX / scale,
    y: pageHeightPts - worldCanvasY / scale,
    pdfRotateDeg: -rotationDeg,
  };
}

/** Builds an SVG polygon/polyline path string from points already in the
 *  object's local top-left-relative canvas-pixel space, rotated around
 *  the box's own center, then scaled to PDF points. drawSvgPath treats
 *  path coordinates as Y-down (see file header), so no sign flip is
 *  needed here - only the canvas-px-to-pt scale factor. */
function polygonPath(points: { x: number; y: number }[], scale: number, close: boolean): string {
  const scaled = points.map((p) => `${(p.x / scale).toFixed(2)},${(p.y / scale).toFixed(2)}`);
  return `M ${scaled[0]} ` + scaled.slice(1).map((p) => `L ${p}`).join(" ") + (close ? " Z" : "");
}

/** Link URLs are typed freely in the property panel; a bare `example.com`
 *  is a common, reasonable thing to type but is not a valid URI action
 *  target, so it's normalized to `https://example.com` the same way a
 *  browser address bar would treat it. */
function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try { parsed = new URL(candidate); } catch { throw new Error("Enter a valid web, email or telephone link before saving."); }
  if (!["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol)) throw new Error("PDF links must use http, https, mailto or tel.");
  return parsed.href;
}

/** Axis-aligned annotation bounds around the actually rotated on-page object. */
function annotationBounds(page: import("pdf-lib").PDFPage, obj: EditorObject, scale: number): [number, number, number, number] {
  const points = [[0, 0], [obj.width, 0], [obj.width, obj.height], [0, obj.height]].map(([x, y]) => {
    const rotated = rotatePoint(x, y, obj.width / 2, obj.height / 2, obj.rotation);
    return editorPointToPdf(page, obj.x + rotated.x, obj.y + rotated.y, scale);
  });
  return [Math.min(...points.map(p => p.x)), Math.min(...points.map(p => p.y)), Math.max(...points.map(p => p.x)), Math.max(...points.map(p => p.y))];
}

function ellipseLocalPoints(width: number, height: number, segments = 48): { x: number; y: number }[] {
  const rx = width / 2;
  const ry = height / 2;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    points.push({ x: rx + rx * Math.cos(t), y: ry + ry * Math.sin(t) });
  }
  return points;
}

export async function exportEditedPdf(
  file: File,
  pagesObjects: PagesObjects,
  scale: number,
  bookmarks: Bookmark[] = [],
  attachments: Attachment[] = [],
  onTextExport?: (flattenedPages: number[]) => void,
  isCancelled?: () => boolean
): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb, degrees, LineCapStyle, pushGraphicsState, popGraphicsState, concatTransformationMatrix } = await import("pdf-lib");
  assertNotCancelled(isCancelled);
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  await assertSupportedForm(pdfDoc);

  const fonts = {
    normal: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique),
  };
  const flattenedPages = await prepareTextReplacements(pdfDoc, file, pagesObjects, undefined, isCancelled);
  const replacementText = Object.values(pagesObjects).flat().flatMap(obj => obj.type === "existing-text-edit" ? [obj.newText] : obj.type === "text" || obj.type === "note" ? [obj.text] : []).join("\n");
  const textWriter = await createEditorTextWriter(pdfDoc, fonts, replacementText);

  const pages = pdfDoc.getPages();
  const imageCache = new Map<string, Awaited<ReturnType<typeof pdfDoc.embedPng>>>();
  const newFields: FormField[] = [];

  const embedImage = async (dataUrl: string, format: "png" | "jpeg") => {
    const cached = imageCache.get(dataUrl);
    if (cached) return cached;
    // pdf-lib accepts local data URIs directly. Fetching them is blocked by
    // the site's connect-src policy, and adds an unnecessary network API.
    const embedded = format === "png" ? await pdfDoc.embedPng(dataUrl) : await pdfDoc.embedJpg(dataUrl);
    imageCache.set(dataUrl, embedded);
    return embedded;
  };

  for (const [pageIndexStr, objects] of Object.entries(pagesObjects)) {
    const pageIndex = Number(pageIndexStr);
    const page = pages[pageIndex];
    if (!page || objects.length === 0) continue;

    assertNotCancelled(isCancelled);
    const geometry = visualPageGeometry(page);
    const pageHeightPts = geometry.height;
    const toPdfX = (canvasX: number) => canvasX / scale;
    const toPdfY = (canvasY: number) => pageHeightPts - canvasY / scale;
    const toPt = (canvasLength: number) => canvasLength / scale;

    const sorted = [...objects].sort((a, b) => a.zIndex - b.zIndex);

    for (const obj of sorted) {
      assertNotCancelled(isCancelled);
      // Page content is drawn in the same visible coordinate system as the
      // preview. Annotations and native text use explicit PDF coordinates.
      const visual = !["text", "existing-text-edit", "link", "form-field"].includes(obj.type);
      if (visual) page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...geometry.matrix));
      try {
      if (obj.type === "text") {
        if (!obj.text.trim()) continue;
        const bold = obj.fontWeight === "bold", italic = obj.fontStyle === "italic";
        const [r, g, b] = hexToRgb01(obj.color);
        const lineHeight = obj.fontSize * 1.25;
        const lines = textWriter.wrap(obj.text, Math.max(8, obj.width / scale), obj.fontSize, bold, italic);
        const textPoint = (localX: number, localY: number) => {
          const point = rotatePoint(localX * scale, localY * scale, obj.width / 2, obj.height / 2, obj.rotation);
          return editorPointToPdf(page, obj.x + point.x, obj.y + point.y, scale);
        };

        for (const [i, line] of lines.entries()) {
          if (!line) continue;
          const lineWidth = textWriter.width(line, obj.fontSize, bold, italic);
          // Local baseline-start point for this line, top-left-relative,
          // screen convention (Y down) - independent of rotation.
          const localX = obj.align === "center" ? (obj.width / scale - lineWidth) / 2 : obj.align === "right" ? obj.width / scale - lineWidth : 0;
          const localY = obj.fontSize + i * lineHeight;
          const { x, y } = textPoint(localX, localY);
          await textWriter.drawLine(page, line, x, y, obj.fontSize, page.getRotation().angle - obj.rotation, obj.color, bold, italic);

          const decorationOffsets: number[] = [];
          if (obj.underline) decorationOffsets.push(obj.fontSize * 0.12);
          if (obj.strikethrough) decorationOffsets.push(-obj.fontSize * 0.3);
          for (const offset of decorationOffsets) {
            const startPt = textPoint(localX, localY + offset);
            const endPt = textPoint(localX + lineWidth, localY + offset);
            page.drawLine({
              start: { x: startPt.x, y: startPt.y },
              end: { x: endPt.x, y: endPt.y },
              thickness: Math.max(0.5, obj.fontSize / 16),
              color: rgb(r, g, b),
            });
          }
        }

        if (obj.linkUrl && obj.linkUrl.trim()) {
          await addLinkAnnotation(
            pdfDoc,
            page,
            annotationBounds(page, obj, scale),
            normalizeUrl(obj.linkUrl)
          );
        }
      } else if (obj.type === "rectangle" || obj.type === "ellipse") {
        const [r, g, b] = obj.fillColor ? hexToRgb01(obj.fillColor) : [0, 0, 0];
        const [br, bg, bb] = obj.strokeColor ? hexToRgb01(obj.strokeColor) : [0, 0, 0];

        if (obj.rotation === 0 && obj.type === "rectangle") {
          page.drawRectangle({
            x: toPdfX(obj.x),
            y: toPdfY(obj.y + obj.height),
            width: toPt(obj.width),
            height: toPt(obj.height),
            color: obj.fillColor ? rgb(r, g, b) : undefined,
            opacity: obj.opacity,
            borderColor: obj.strokeColor ? rgb(br, bg, bb) : undefined,
            borderWidth: obj.strokeColor ? obj.strokeWidth : undefined,
            borderOpacity: obj.opacity,
          });
        } else if (obj.rotation === 0 && obj.type === "ellipse") {
          page.drawEllipse({
            x: toPdfX(obj.x + obj.width / 2),
            y: toPdfY(obj.y + obj.height / 2),
            xScale: toPt(obj.width / 2),
            yScale: toPt(obj.height / 2),
            color: obj.fillColor ? rgb(r, g, b) : undefined,
            opacity: obj.opacity,
            borderColor: obj.strokeColor ? rgb(br, bg, bb) : undefined,
            borderWidth: obj.strokeColor ? obj.strokeWidth : undefined,
            borderOpacity: obj.opacity,
          });
        } else {
          const localPoints =
            obj.type === "rectangle"
              ? [
                  { x: 0, y: 0 },
                  { x: obj.width, y: 0 },
                  { x: obj.width, y: obj.height },
                  { x: 0, y: obj.height },
                ]
              : ellipseLocalPoints(obj.width, obj.height);
          const cx = obj.width / 2;
          const cy = obj.height / 2;
          const rotated = localPoints.map((p) => rotatePoint(p.x, p.y, cx, cy, obj.rotation));
          const path = polygonPath(rotated, scale, true);
          page.drawSvgPath(path, {
            x: toPdfX(obj.x),
            y: toPdfY(obj.y),
            color: obj.fillColor ? rgb(r, g, b) : undefined,
            opacity: obj.opacity,
            borderColor: obj.strokeColor ? rgb(br, bg, bb) : undefined,
            borderWidth: obj.strokeColor ? obj.strokeWidth : undefined,
            borderOpacity: obj.opacity,
          });
        }
      } else if (obj.type === "line") {
        const [r, g, b] = hexToRgb01(obj.strokeColor);
        const cx = obj.width / 2;
        const cy = obj.height / 2;
        const start = rotatePoint(0, cy, cx, cy, obj.rotation);
        const end = rotatePoint(obj.width, cy, cx, cy, obj.rotation);
        page.drawLine({
          start: { x: toPdfX(obj.x + start.x), y: toPdfY(obj.y + start.y) },
          end: { x: toPdfX(obj.x + end.x), y: toPdfY(obj.y + end.y) },
          thickness: obj.strokeWidth,
          color: rgb(r, g, b),
        });
      } else if (obj.type === "image") {
        const embedded = await embedImage(obj.dataUrl, obj.format);
        if (obj.rotation === 0) {
          page.drawImage(embedded, {
            x: toPdfX(obj.x),
            y: toPdfY(obj.y + obj.height),
            width: toPt(obj.width),
            height: toPt(obj.height),
          });
        } else {
          const { x, y, pdfRotateDeg } = forwardRotatedOrigin(
            obj.x,
            obj.y,
            obj.width,
            obj.height,
            0,
            obj.height,
            obj.rotation,
            scale,
            pageHeightPts
          );
          page.drawImage(embedded, {
            x,
            y,
            width: toPt(obj.width),
            height: toPt(obj.height),
            rotate: degrees(pdfRotateDeg),
          });
        }
      } else if (obj.type === "draw") {
        if (obj.points.length < 2) continue;
        const [r, g, b] = hexToRgb01(obj.strokeColor);
        const cx = obj.width / 2;
        const cy = obj.height / 2;
        const path = scaledDrawStrokes(obj).map(stroke => polygonPath(stroke.map(p => rotatePoint(p.x, p.y, cx, cy, obj.rotation)), scale, false)).join(" ");
        page.drawSvgPath(path, {
          x: toPdfX(obj.x),
          y: toPdfY(obj.y),
          borderColor: rgb(r, g, b),
          borderWidth: obj.strokeWidth,
          borderLineCap: LineCapStyle.Round,
        });
      } else if (obj.type === "note") {
        const [r, g, b] = hexToRgb01(obj.color);
        const corners = [[0, 0], [obj.width, 0], [obj.width, obj.height], [0, obj.height]].map(([x, y]) => rotatePoint(x, y, obj.width / 2, obj.height / 2, obj.rotation));
        page.drawSvgPath(polygonPath(corners, scale, true), { x: toPdfX(obj.x), y: toPdfY(obj.y), color: rgb(r, g, b), opacity: 0.95 });
        if (obj.text.trim()) {
          const noteFontSize = 9, lineHeight = noteFontSize * 1.3;
          const lines = textWriter.wrap(obj.text, Math.max(8, toPt(obj.width) - 8), noteFontSize, false, false);
          const availableRows = Math.floor((toPt(obj.height) - 8) / lineHeight);
          if (lines.length > availableRows) throw new Error("A note's text does not fit. Enlarge the note before saving.");
          for (const [index, line] of lines.entries()) {
            const origin = forwardRotatedOrigin(obj.x, obj.y, obj.width, obj.height, 4 * scale, (noteFontSize + 4 + index * lineHeight) * scale, obj.rotation, scale, pageHeightPts);
            await textWriter.drawLine(page, line, origin.x, origin.y, noteFontSize, origin.pdfRotateDeg, "#1a1a1a");
          }
        }
      } else if (obj.type === "link") {
        await addLinkAnnotation(
          pdfDoc,
          page,
          annotationBounds(page, obj, scale),
          normalizeUrl(obj.url)
        );
      } else if (obj.type === "form-field") {
        newFields.push({ id: obj.id, kind: obj.fieldType, name: obj.name, groupName: obj.groupName, optionLabel: obj.optionLabel, options: obj.options?.map(option => option.trim()).filter(Boolean), pageIndex,
          x: obj.x, y: obj.y, width: obj.width, height: obj.height, rotation: obj.rotation, required: obj.required, readOnly: false,
          fontSize: obj.fontSize, textColor: "#000000", borderColor: "#94a3b8", borderWidth: 1, fillColor: null, isExisting: false });
      } else if (obj.type === "existing-text-edit") {
        await textWriter.drawReplacement(page, obj, scale);
      }
      } finally { if (visual) page.pushOperators(popGraphicsState()); }
    }
  }

  assertNotCancelled(isCancelled);
  await buildNewFields(pdfDoc, newFields, scale, undefined, isCancelled);
  await writeOutlines(pdfDoc, bookmarks);

  for (const attachment of attachments) {
    assertNotCancelled(isCancelled);
    const bytes = new Uint8Array(await attachment.file.arrayBuffer());
    await pdfDoc.attach(bytes, attachment.name, {
      mimeType: attachment.file.type || "application/octet-stream",
      creationDate: new Date(),
      modificationDate: new Date(attachment.file.lastModified),
    });
  }

  textWriter.finish();
  assertNotCancelled(isCancelled);
  const bytes = await pdfDoc.save({ updateFieldAppearances: false });
  assertNotCancelled(isCancelled);
  onTextExport?.(flattenedPages);
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}
