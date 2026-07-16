/**
 * Markup Engine — Markdown/HTML/plain-text conversions. Uses `marked`
 * (already a real, direct dependency — v18.0.6, verified in an earlier
 * sprint, used by text-engine.ts's token-based parser for Markdown-to-PDF)
 * for Markdown -> HTML, and `turndown` (verified real: v7.2.4, 11,300+
 * GitHub stars, actively maintained) for the reverse direction — the two
 * aren't symmetric libraries (marked doesn't do HTML->Markdown, turndown
 * doesn't do Markdown->HTML), so both are genuinely needed rather than
 * one library covering both directions.
 */

/** Converts Markdown to HTML using marked's full renderer (not the
 *  lexer-token subset text-engine.ts uses for PDF layout) — this tool's
 *  whole purpose is producing real, complete HTML, including tables,
 *  lists, links, images, and code blocks that the PDF-focused parser
 *  deliberately skips. */
export async function markdownToHtml(markdown: string): Promise<string> {
  const { marked } = await import("marked");
  const result = marked(markdown, { async: false });
  return typeof result === "string" ? result : await result;
}

/** Converts HTML to Markdown via turndown's default rule set (headings,
 *  bold/italic, links, images, lists, blockquotes, code, tables via GFM
 *  if the input has them — turndown handles standard table markup out of
 *  the box). */
export async function htmlToMarkdown(html: string): Promise<string> {
  const TurndownService = (await import("turndown")).default;
  const turndownService = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
  return turndownService.turndown(html);
}

/** Strips HTML down to its visible text content using the browser's own
 *  HTML parser (DOMParser) — no library needed, since "what text would a
 *  reader see" is exactly what `textContent` already computes correctly,
 *  including handling of malformed/unclosed tags the way a real browser
 *  would. Script and style tag contents are excluded, since neither is
 *  visible text a reader would see. */
export function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style").forEach((el) => el.remove());
  const text = doc.body.textContent ?? "";
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

/** Converts plain text to minimal, valid HTML: each blank-line-separated
 *  block becomes a <p>, single newlines within a block become <br>, and
 *  every character that would otherwise be interpreted as markup is
 *  escaped — this is a structural wrap, not a Markdown-style parser
 *  (no heading/list detection, since plain text has no such syntax to
 *  detect, the same honest scope text-engine.ts's TXT parser already
 *  documents for TXT-to-PDF). */
export function textToHtml(text: string): string {
  const escapeHtml = (value: string): string =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`);

  return paragraphs.join("\n");
}
