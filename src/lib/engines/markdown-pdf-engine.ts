import type { Token, Tokens } from "marked";
import { createEditorTextWriter } from "../editor/text-replacement";
import { safeWordLink } from "./word-pdf-policy";

export interface MarkdownPdfOptions {
  pageSize?: "a4" | "letter";
  orientation?: "portrait" | "landscape";
  fontSize?: number;
  onProgress?: (percent: number) => void;
  isCancelled?: () => boolean;
}
type Run = { text: string; bold?: boolean; italic?: boolean; code?: boolean; strike?: boolean; href?: string };
function decodeEntities(text: string) {
  const names: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (original, entity: string) => {
    if (entity[0] !== "#") return names[entity.toLowerCase()] ?? original;
    const point = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : original;
  });
}
function inline(tokens: Token[] | undefined, text = "", style: Omit<Run, "text"> = {}): Run[] {
  if (!tokens?.length) return [{ ...style, text: decodeEntities(text) }];
  return tokens.flatMap((token): Run[] => {
    if (token.type === "strong") return inline(token.tokens, token.text, { ...style, bold: true });
    if (token.type === "em") return inline(token.tokens, token.text, { ...style, italic: true });
    if (token.type === "del") return inline(token.tokens, token.text, { ...style, strike: true });
    if (token.type === "link") return inline(token.tokens, token.text, { ...style, href: safeWordLink(token.href) ?? undefined });
    if (token.type === "codespan") return [{ ...style, text: token.text, code: true }];
    if (token.type === "br") return [{ ...style, text: "\n" }];
    if (token.type === "image") return [{ ...style, text: `[Image: ${token.text || "untitled"}]`, href: safeWordLink(token.href) ?? undefined }];
    if (token.type === "text" || token.type === "escape") return 'tokens' in token && token.tokens ? inline(token.tokens, token.text, style) : [{ ...style, text: decodeEntities(token.text) }];
    return [{ ...style, text: decodeEntities('text' in token ? String(token.text) : token.raw) }];
  });
}

/** Structured text output; no HTML execution or remote asset requests. */
export async function markdownToPdf(markdown: string, options: MarkdownPdfOptions = {}): Promise<Blob> {
  if (markdown.length > 2_000_000) throw new Error("This Markdown file is too large. Convert a section smaller than 2 million characters.");
  if (!markdown.trim()) throw new Error("This Markdown file is empty.");
  const [{ lexer }, { PDFDocument, StandardFonts, PDFString, rgb }] = await Promise.all([import("marked"), import("pdf-lib")]);
  const tokens = lexer(markdown, { gfm: true });
  const pdf = await PDFDocument.create();
  const standard = { normal: await pdf.embedFont(StandardFonts.Helvetica), bold: await pdf.embedFont(StandardFonts.HelveticaBold), italic: await pdf.embedFont(StandardFonts.HelveticaOblique), boldItalic: await pdf.embedFont(StandardFonts.HelveticaBoldOblique) };
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const writer = await createEditorTextWriter(pdf, standard, markdown);
  const codeWriter = await createEditorTextWriter(pdf, { normal: mono, bold: mono, italic: mono, boldItalic: mono }, markdown);
  const size = options.fontSize ?? 11;
  if (!Number.isFinite(size) || size < 8 || size > 20) throw new Error("Choose a font size between 8 and 20 points.");
  const dimensions = options.pageSize === "letter" ? [612, 792] : [595.28, 841.89];
  const [pageWidth, pageHeight] = options.orientation === "landscape" ? dimensions.reverse() : dimensions;
  const margin = 46, usableWidth = pageWidth - margin * 2;
  let page = pdf.addPage([pageWidth, pageHeight]), y = pageHeight - margin;
  const checkpoint = () => { if (options.isCancelled?.()) throw new Error("Conversion cancelled."); };
  const nextPage = () => { checkpoint(); if (pdf.getPageCount() >= 1000) throw new Error("This document exceeds 1,000 PDF pages. Convert it in smaller sections."); page = pdf.addPage([pageWidth, pageHeight]); y = pageHeight - margin; };
  const ensure = (height: number) => { if (y - height < margin) nextPage(); };
  const measure = (run: Run, pointSize: number) => (run.code ? codeWriter : writer).width(run.text, pointSize, !!run.bold, !!run.italic);
  function wrap(runs: Run[], width: number, pointSize: number, keepWhitespace = false) {
    const lines: Run[][] = []; let line: Run[] = [], used = 0;
    const finish = () => { lines.push(line); line = []; used = 0; };
    const append = (run: Run) => {
      if (!keepWhitespace && !line.length && /^ +$/.test(run.text)) return;
      const previous = line.at(-1);
      if (previous && previous.bold === run.bold && previous.italic === run.italic && previous.code === run.code && previous.href === run.href && previous.strike === run.strike) previous.text += run.text;
      else line.push({ ...run });
      used += measure(run, pointSize);
    };
    for (const run of runs) {
      for (const text of run.text.replace(/\r/g, "").replace(/\t/g, "    ").split(/(\n|[^\S\n]+)/).filter(Boolean)) {
        if (text === "\n") { finish(); continue; }
        const atom = { ...run, text }, widthOfAtom = measure(atom, pointSize);
        if (used + widthOfAtom > width && line.length) finish();
        if (widthOfAtom <= width) { append(atom); continue; }
        for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)) {
          const piece = { ...run, text: segment };
          if (used + measure(piece, pointSize) > width && line.length) finish();
          append(piece);
        }
      }
    }
    if (line.length || !lines.length) lines.push(line);
    return lines;
  }
  async function draw(runs: Run[], x: number, baseline: number, pointSize: number) {
    for (const run of runs) {
      const w = measure(run, pointSize), renderer = run.code ? codeWriter : writer;
      if (run.text.trim()) {
        await renderer.drawLine(page, run.text, x, baseline, pointSize, 0, run.href ? "#1d4ed8" : "#172033", !!run.bold, !!run.italic);
        if (run.strike) page.drawLine({ start: { x, y: baseline + pointSize * 0.3 }, end: { x: x + w, y: baseline + pointSize * 0.3 }, thickness: 0.6 });
        if (run.href && !run.href.startsWith("#")) {
          page.node.addAnnot(pdf.context.register(pdf.context.obj({ Type: "Annot", Subtype: "Link", Rect: [x, baseline - 2, x + w, baseline + pointSize], Border: [0, 0, 0], A: { Type: "Action", S: "URI", URI: PDFString.of(run.href) } })));
        }
      }
      x += w;
    }
  }
  async function paragraph(runs: Run[], indent = 0, pointSize = size, code = false, quote = false) {
    const width = usableWidth - indent - (code || quote ? 16 : 0), lineHeight = pointSize * 1.45;
    for (const line of wrap(runs, width, pointSize, code)) {
      ensure(lineHeight + 3);
      if (code) page.drawRectangle({ x: margin + indent, y: y - lineHeight, width: usableWidth - indent, height: lineHeight + 1, color: rgb(0.95, 0.96, 0.97) });
      if (quote) page.drawLine({ start: { x: margin + indent, y }, end: { x: margin + indent, y: y - lineHeight }, thickness: 2, color: rgb(0.65, 0.7, 0.8) });
      await draw(line, margin + indent + (code || quote ? 8 : 0), y - pointSize, pointSize); y -= lineHeight;
    }
    y -= 7;
  }
  async function table(token: Tokens.Table, indent: number) {
    const count = token.header.length;
    if (!count) return;
    const width = (usableWidth - indent) / count, pointSize = Math.max(8, size - 1), lineHeight = pointSize * 1.4;
    if (width < 24) throw new Error("This table has too many columns for the page. Choose landscape or split it into narrower tables.");
    const rows = [token.header, ...token.rows].map((row, index) => row.map(cell => wrap(inline(cell.tokens, cell.text, index === 0 ? { bold: true } : {}), Math.max(5, width - 12), pointSize)));
    const headerLines = Math.max(...rows[0].map(cell => cell.length));
    const headerFits = headerLines * lineHeight + 12 < (pageHeight - margin * 2) / 3;
    async function drawRows(cells: Run[][][], header: boolean, repeatHeader = true) {
      const total = Math.max(1, ...cells.map(cell => cell.length)); let offset = 0;
      while (offset < total) {
        if (y - (lineHeight + 12) < margin) { nextPage(); if (!header && repeatHeader && headerFits) await drawRows(rows[0], true, false); }
        const length = Math.min(total - offset, Math.max(1, Math.floor((y - margin - 12) / lineHeight)));
        const height = length * lineHeight + 12;
        for (let col = 0; col < count; col++) {
          const x = margin + indent + col * width;
          page.drawRectangle({ x, y: y - height, width, height, borderColor: rgb(0.78, 0.81, 0.85), borderWidth: 0.5, ...(header ? { color: rgb(0.93, 0.95, 0.98) } : {}) });
          for (let n = 0; n < length; n++) {
            const line = (cells[col]?.[offset + n] ?? []).map(run => header ? { ...run, bold: true } : run);
            const used = line.reduce((sum, run) => sum + measure(run, pointSize), 0);
            const align = token.align[col], dx = align === "right" ? width - 6 - used : align === "center" ? (width - used) / 2 : 6;
            await draw(line, x + Math.max(3, dx), y - 6 - pointSize - n * lineHeight, pointSize);
          }
        }
        y -= height; offset += length;
      }
    }
    for (let i = 0; i < rows.length; i++) { checkpoint(); await drawRows(rows[i], i === 0); if (i % 12 === 0) await new Promise(resolve => setTimeout(resolve, 0)); }
    y -= 10;
  }
  async function image(token: Tokens.Image, indent: number) {
    if (!/^data:image\/(png|jpe?g);base64,/i.test(token.href)) {
      await paragraph([{ text: `[Image: ${token.text || "untitled"}]`, italic: true, href: safeWordLink(token.href) ?? undefined }], indent);
      return;
    }
    if (token.href.length > 14_000_000) throw new Error("An embedded Markdown image exceeds 10 MB. Resize it before converting.");
    const value = token.href.split(",")[1];
    const bytes = Uint8Array.from(atob(value), char => char.charCodeAt(0));
    const picture = token.href.startsWith("data:image/png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const scale = Math.min(1, (usableWidth - indent) / picture.width, (pageHeight - margin * 2 - 10) / picture.height);
    const width = picture.width * scale, height = picture.height * scale;
    ensure(height + 8); page.drawImage(picture, { x: margin + indent, y: y - height, width, height }); y -= height + 8;
  }
  async function render(items: Token[], indent = 0, quote = false) {
    for (const token of items) {
      checkpoint();
      if (token.type === "heading") { const headingSize = size + Math.max(1, 16 - token.depth * 3); ensure(headingSize * 1.5 + size * 1.45); await paragraph(inline(token.tokens, token.text, { bold: true }), indent, headingSize); }
      else if (token.type === "paragraph" || token.type === "text") {
        const nested = token.tokens as Token[] | undefined;
        if (nested?.some(item => item.type === "image")) {
          let pending: Token[] = [];
          for (const item of nested) { if (item.type === "image") { if (pending.length) await paragraph(inline(pending), indent, size, false, quote); pending = []; await image(item as Tokens.Image, indent); } else pending.push(item); }
          if (pending.length) await paragraph(inline(pending), indent, size, false, quote);
        } else await paragraph(inline(nested, token.text), indent, size, false, quote);
      } else if (token.type === "list") {
        for (let i = 0; i < token.items.length; i++) {
          const item = token.items[i], prefix = item.task ? (item.checked ? "[x] " : "[ ] ") : token.ordered ? `${Number(token.start) + i}. ` : "• ";
          const children = item.tokens.slice();
          const first = children[0];
          if (first && (first.type === "text" || first.type === "paragraph")) { await paragraph([{ text: prefix }, ...inline(first.tokens as Token[], first.text)], indent); children.shift(); }
          else await paragraph([{ text: prefix }], indent);
          if (children.length) await render(children, Math.min(indent + 18, usableWidth / 2), quote);
        }
      } else if (token.type === "table") await table(token as Tokens.Table, indent);
      else if (token.type === "blockquote") await render(token.tokens ?? [], Math.min(indent + 12, usableWidth / 2), true);
      else if (token.type === "code") await paragraph([{ text: token.text, code: true }], indent, Math.max(8, size - 1), true);
      else if (token.type === "hr") { ensure(15); page.drawLine({ start: { x: margin + indent, y: y - 6 }, end: { x: pageWidth - margin, y: y - 6 }, color: rgb(0.7, 0.73, 0.8), thickness: 0.6 }); y -= 15; }
      else if (token.type === "html") await paragraph([{ text: token.text, code: true }], indent);
      // Spaces and reference definitions have no visible content.
    }
  }
  for (let i = 0; i < tokens.length; i++) { await render([tokens[i]]); options.onProgress?.(10 + (i + 1) / tokens.length * 85); if (i % 12 === 0) await new Promise(resolve => setTimeout(resolve, 0)); }
  checkpoint(); writer.finish(); codeWriter.finish();
  const bytes = await pdf.save(); checkpoint(); options.onProgress?.(100);
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}
