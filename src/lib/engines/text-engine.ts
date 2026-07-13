/**
 * Text Engine — parses plain text, Markdown, and CSV into the shapes the
 * PDF renderer understands. Markdown parsing uses `marked` (verified real:
 * v18.0.6, actively maintained, the de facto standard JS Markdown parser)
 * via its documented `lexer()` API, which returns typed tokens directly —
 * no HTML round-trip needed, unlike the DOCX path (mammoth only offers
 * HTML/Markdown output, not tokens).
 */

import type { PdfTextBlock } from "./pdf-text-renderer";

/** Splits plain text into paragraph blocks on blank lines — the same
 *  "honest, structural, not stylistic" scope as every other text-to-PDF
 *  tool in this project. No heading detection: plain text has no heading
 *  syntax to detect. */
export function parseTxtToBlocks(text: string): PdfTextBlock[] {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((text) => ({ type: "paragraph" as const, text }));
}

/** Converts Markdown headings (#/##/###+) and paragraphs into typed
 *  blocks. Deliberately ignores everything else Markdown supports (lists,
 *  tables, links, images, code blocks) — the same honest "text and
 *  structure, not full layout" scope as the DOCX and PDF text extractors
 *  already established. Uses marked's real `lexer()` token API, not a
 *  hand-rolled regex parser. */
export async function parseMarkdownToBlocks(markdown: string): Promise<PdfTextBlock[]> {
  const { lexer } = await import("marked");
  const tokens = lexer(markdown);
  const blocks: PdfTextBlock[] = [];

  for (const token of tokens) {
    if (token.type === "heading") {
      const text = token.text.trim();
      if (!text) continue;
      blocks.push({
        type: token.depth === 1 ? "heading1" : token.depth === 2 ? "heading2" : "heading3",
        text,
      });
    } else if (token.type === "paragraph") {
      const text = token.text.trim();
      if (text) blocks.push({ type: "paragraph", text });
    }
  }

  return blocks;
}

/** Parses CSV text into a 2D array of cell strings. Handles quoted fields
 *  (including embedded commas and escaped double-quotes, the RFC 4180
 *  cases real spreadsheet exports actually produce) with a small hand-
 *  written parser — CSV's quoting rules are simple enough that pulling in
 *  a dependency for it would be exactly the "premature abstraction" this
 *  project avoids elsewhere. */
export function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (inQuotes) {
      if (char === '"') {
        if (csv[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && csv[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((cell) => cell !== "")) rows.push(row);

  return rows;
}
