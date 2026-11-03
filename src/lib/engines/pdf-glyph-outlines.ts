import {
  appendBezierCurve,
  closePath,
  concatTransformationMatrix,
  drawObject,
  fill,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  setFillingRgbColor,
  type PDFDocument,
  type PDFName,
  type PDFOperator,
  type PDFPage,
  type PDFRef,
} from "pdf-lib";
import type { Font, GlyphRun } from "fontkit";

/** Reuse each font glyph's vector outline without a shaped-glyph ToUnicode
 * mapping. A separate logical text layer supplies copy/search text. Several
 * Arabic letters share one shaped base glyph, so one CID-to-Unicode mapping
 * cannot represent every occurrence correctly. */
export function createGlyphOutlineWriter(pdf: PDFDocument) {
  const glyphs = new WeakMap<Font, Map<number, PDFRef | null>>();
  const pageNames = new WeakMap<PDFPage, Map<PDFRef, PDFName>>();
  return {
    draw(
      page: PDFPage,
      font: Font,
      run: GlyphRun,
      x: number,
      y: number,
      size: number,
      angle: number,
      color: [number, number, number],
    ) {
      let cache = glyphs.get(font);
      if (!cache) {
        cache = new Map();
        glyphs.set(font, cache);
      }
      let names = pageNames.get(page);
      if (!names) {
        names = new Map();
        pageNames.set(page, names);
      }
      const scale = size / font.unitsPerEm,
        radians = (angle * Math.PI) / 180;
      const cos = Math.cos(radians),
        sin = Math.sin(radians);
      let advance = 0;
      for (const [index, glyph] of run.glyphs.entries()) {
        let ref = cache.get(glyph.id);
        if (ref === undefined) {
          const path = glyph.path,
            box = path.bbox;
          if (
            !path.commands.length ||
            box.maxX <= box.minX ||
            box.maxY <= box.minY
          )
            ref = null;
          else {
            const operators: PDFOperator[] = [];
            let px = 0,
              py = 0,
              startX = 0,
              startY = 0;
            for (const { command, args } of path.commands) {
              if (command === "moveTo") {
                [px, py] = args;
                startX = px;
                startY = py;
                operators.push(moveTo(px, py));
              } else if (command === "lineTo") {
                [px, py] = args;
                operators.push(lineTo(px, py));
              } else if (command === "quadraticCurveTo") {
                const [cx, cy, endX, endY] = args;
                operators.push(
                  appendBezierCurve(
                    px + (2 / 3) * (cx - px),
                    py + (2 / 3) * (cy - py),
                    endX + (2 / 3) * (cx - endX),
                    endY + (2 / 3) * (cy - endY),
                    endX,
                    endY,
                  ),
                );
                px = endX;
                py = endY;
              } else if (command === "bezierCurveTo") {
                operators.push(
                  appendBezierCurve(
                    args[0],
                    args[1],
                    args[2],
                    args[3],
                    args[4],
                    args[5],
                  ),
                );
                px = args[4];
                py = args[5];
              } else if (command === "closePath") {
                operators.push(closePath());
                px = startX;
                py = startY;
              } else throw new Error("Unsupported font outline.");
            }
            operators.push(fill());
            ref = pdf.context.register(
              pdf.context.formXObject(operators, {
                BBox: [box.minX, box.minY, box.maxX, box.maxY],
                Resources: {},
              }),
            );
          }
          cache.set(glyph.id, ref);
        }
        const position = run.positions[index];
        if (ref) {
          let name = names.get(ref);
          if (!name) {
            name = page.node.newXObject("Glyph", ref);
            names.set(ref, name);
          }
          const dx = (advance + position.xOffset) * scale,
            dy = position.yOffset * scale;
          page.pushOperators(
            pushGraphicsState(),
            setFillingRgbColor(...color),
            concatTransformationMatrix(
              cos * scale,
              sin * scale,
              -sin * scale,
              cos * scale,
              x + cos * dx - sin * dy,
              y + sin * dx + cos * dy,
            ),
            drawObject(name),
            popGraphicsState(),
          );
        }
        advance += position.xAdvance;
      }
    },
  };
}
