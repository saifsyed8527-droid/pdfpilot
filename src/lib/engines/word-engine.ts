/**
 * Word Engine — reads .docx content via mammoth and writes .docx files via
 * the `docx` library. Extracted from word-to-pdf-client.tsx now that a
 * second real consumer (DOCX Merge) needs the same "read a .docx into
 * typed blocks" logic — the same "extract once two real consumers exist"
 * rule pdf-text-extraction.ts and pdf-render-engine.ts already followed.
 *
 * Uses mammoth's convertToHtml (documented, fully-typed) rather than the
 * tempting convertToMarkdown (undocumented, and verified in an earlier
 * sprint to throw an internal xmldom parse error on some real-world .docx
 * files) — see the git history on word-to-pdf-client.tsx for the full
 * verification record of that decision.
 */

export type WordBlockType = "heading1" | "heading2" | "heading3" | "paragraph";

export interface WordBlock {
  type: WordBlockType;
  text: string;
}

function parseHtmlBlocks(html: string): WordBlock[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks: WordBlock[] = [];
  for (const element of Array.from(doc.body.children)) {
    const text = element.textContent?.trim();
    if (!text) continue;
    const type: WordBlockType | null =
      element.tagName === "H1"
        ? "heading1"
        : element.tagName === "H2"
          ? "heading2"
          : element.tagName === "H3" || element.tagName === "H4" || element.tagName === "H5" || element.tagName === "H6"
            ? "heading3"
            : element.tagName === "P"
              ? "paragraph"
              : null;
    if (type) blocks.push({ type, text });
  }
  return blocks;
}

/** Extracts headings + paragraphs from a .docx file. Throws a clear,
 *  actionable error (rather than mammoth's raw internal exception) for the
 *  narrow class of otherwise-valid .docx files whose browser-bundled XML
 *  parser chokes on empty-but-present comments/footnotes parts. */
export async function extractDocxBlocks(file: File): Promise<WordBlock[]> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  let conversion;
  try {
    conversion = await mammoth.convertToHtml({ arrayBuffer });
  } catch {
    throw new Error(
      `"${file.name}" couldn't be read. It may use a feature (such as comments or footnotes) that this converter doesn't support — try removing them and saving again.`
    );
  }
  return parseHtmlBlocks(conversion.value);
}

/** Builds a new .docx from typed blocks — the inverse of extractDocxBlocks,
 *  using the same verified real `docx` API (Document/Paragraph/HeadingLevel/
 *  Packer.toBlob) already in production use for PDF to Word. */
export async function buildDocxFromBlocks(blocks: WordBlock[]): Promise<Blob> {
  const { Document, Packer, Paragraph, HeadingLevel } = await import("docx");
  const HEADING_LEVEL: Record<WordBlockType, (typeof HeadingLevel)[keyof typeof HeadingLevel] | undefined> = {
    heading1: HeadingLevel.HEADING_1,
    heading2: HeadingLevel.HEADING_2,
    heading3: HeadingLevel.HEADING_3,
    paragraph: undefined,
  };
  const paragraphs = blocks.map(
    (block) =>
      new Paragraph({
        text: block.text,
        heading: HEADING_LEVEL[block.type],
      })
  );
  const doc = new Document({ sections: [{ children: paragraphs }] });
  return Packer.toBlob(doc);
}
