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

import type { PagesObjects } from "./types";
import { hexToRgb01, rotatePoint } from "./types";

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
  scale: number
): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb, degrees, LineCapStyle } = await import("pdf-lib");
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);

  const fonts = {
    normal: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique),
  };

  const pages = pdfDoc.getPages();
  const imageCache = new Map<string, Awaited<ReturnType<typeof pdfDoc.embedPng>>>();

  const embedImage = async (dataUrl: string, format: "png" | "jpeg") => {
    const cached = imageCache.get(dataUrl);
    if (cached) return cached;
    const res = await fetch(dataUrl);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const embedded = format === "png" ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
    imageCache.set(dataUrl, embedded);
    return embedded;
  };

  for (const [pageIndexStr, objects] of Object.entries(pagesObjects)) {
    const pageIndex = Number(pageIndexStr);
    const page = pages[pageIndex];
    if (!page || objects.length === 0) continue;

    const { height: pageHeightPts } = page.getSize();
    const toPdfX = (canvasX: number) => canvasX / scale;
    const toPdfY = (canvasY: number) => pageHeightPts - canvasY / scale;
    const toPt = (canvasLength: number) => canvasLength / scale;

    const sorted = [...objects].sort((a, b) => a.zIndex - b.zIndex);

    for (const obj of sorted) {
      if (obj.type === "text") {
        if (!obj.text.trim()) continue;
        const font =
          obj.fontWeight === "bold" && obj.fontStyle === "italic"
            ? fonts.boldItalic
            : obj.fontWeight === "bold"
              ? fonts.bold
              : obj.fontStyle === "italic"
                ? fonts.italic
                : fonts.normal;
        const [r, g, b] = hexToRgb01(obj.color);
        const lineHeight = obj.fontSize * 1.25;
        const lines = obj.text.split("\n");

        lines.forEach((line, i) => {
          if (!line) return;
          // Local baseline-start point for this line, top-left-relative,
          // screen convention (Y down) - independent of rotation.
          const localX = 0;
          const localY = obj.fontSize + i * lineHeight;
          const { x, y, pdfRotateDeg } = forwardRotatedOrigin(
            obj.x,
            obj.y,
            obj.width,
            obj.height,
            localX,
            localY,
            obj.rotation,
            scale,
            pageHeightPts
          );
          page.drawText(line, {
            x,
            y,
            size: obj.fontSize,
            font,
            color: rgb(r, g, b),
            rotate: obj.rotation === 0 ? undefined : degrees(pdfRotateDeg),
          });
        });
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
        const rotated = obj.points.map((p) => rotatePoint(p.x, p.y, cx, cy, obj.rotation));
        const path = polygonPath(rotated, scale, false);
        page.drawSvgPath(path, {
          x: toPdfX(obj.x),
          y: toPdfY(obj.y),
          borderColor: rgb(r, g, b),
          borderWidth: obj.strokeWidth,
          borderLineCap: LineCapStyle.Round,
        });
      } else if (obj.type === "note") {
        const [r, g, b] = hexToRgb01(obj.color);
        page.drawRectangle({
          x: toPdfX(obj.x),
          y: toPdfY(obj.y + obj.height),
          width: toPt(obj.width),
          height: toPt(obj.height),
          color: rgb(r, g, b),
          opacity: 0.95,
        });
        if (obj.text.trim()) {
          const noteFontSize = 9;
          page.drawText(obj.text, {
            x: toPdfX(obj.x) + 4,
            y: toPdfY(obj.y + obj.height) + toPt(obj.height) - noteFontSize - 4,
            size: noteFontSize,
            font: fonts.normal,
            color: rgb(0.1, 0.1, 0.1),
            maxWidth: toPt(obj.width) - 8,
            lineHeight: noteFontSize * 1.3,
          });
        }
      }
    }
  }

  const bytes = await pdfDoc.save();
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}
