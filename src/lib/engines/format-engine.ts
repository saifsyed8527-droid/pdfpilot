/**
 * Format Engine — JSON/XML/CSV formatting, minifying, and validation, plus
 * CSV cleanup utilities (dedupe, column extraction, split, merge). Uses
 * only the browser's native `JSON`/`DOMParser`/`XMLSerializer` and the
 * existing `parseCsv`/`rowsToCsv` pair (text-engine.ts /
 * data-conversion-engine.ts) — no new dependency needed, since every
 * operation here is either a standard-library round-trip or plain string
 * processing.
 */

import { parseCsv } from "./text-engine";
import { rowsToCsv } from "./data-conversion-engine";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/** Validates JSON via a real `JSON.parse` attempt — the only correct way
 *  to validate JSON, since the grammar is exactly what `JSON.parse`
 *  implements. Returns the parser's own error message, which includes the
 *  position of the syntax error in modern engines. */
export function validateJson(text: string): ValidationResult {
  try {
    JSON.parse(text);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : "Invalid JSON." };
  }
}

/** Pretty-prints JSON with 2-space indentation via `JSON.stringify`'s
 *  native `space` parameter — re-serializing after a real parse also
 *  means malformed input is rejected with a clear error rather than
 *  reformatted incorrectly. */
export function formatJson(text: string): string {
  const result = validateJson(text);
  if (!result.valid) {
    throw new Error(`This isn't valid JSON: ${result.error}`);
  }
  return JSON.stringify(JSON.parse(text), null, 2);
}

/** Removes all non-significant whitespace from JSON by parsing and
 *  re-serializing without the `space` parameter. */
export function minifyJson(text: string): string {
  const result = validateJson(text);
  if (!result.valid) {
    throw new Error(`This isn't valid JSON: ${result.error}`);
  }
  return JSON.stringify(JSON.parse(text));
}

/** Validates XML via `DOMParser`, the same real check `xmlToRows` already
 *  relies on elsewhere in this project — a `<parsererror>` element in the
 *  parsed document is the browser's own signal that the input didn't
 *  parse, and its text content is a real, specific error message. */
export function validateXml(text: string): ValidationResult {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    return { valid: false, error: parserError.textContent?.trim() || "This XML couldn't be parsed." };
  }
  return { valid: true };
}

function indentXmlNode(node: Element, depth: number, lines: string[]): void {
  const children = Array.from(node.children);
  const indent = "  ".repeat(depth);
  if (children.length === 0) {
    const text = (node.textContent ?? "").trim();
    lines.push(`${indent}<${node.tagName}${serializeAttributes(node)}>${escapeXmlText(text)}</${node.tagName}>`);
    return;
  }
  lines.push(`${indent}<${node.tagName}${serializeAttributes(node)}>`);
  for (const child of children) {
    indentXmlNode(child, depth + 1, lines);
  }
  lines.push(`${indent}</${node.tagName}>`);
}

function serializeAttributes(node: Element): string {
  return Array.from(node.attributes)
    .map((attr) => ` ${attr.name}="${attr.value.replace(/"/g, "&quot;")}"`)
    .join("");
}

function escapeXmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Pretty-prints XML with 2-space indentation by walking the parsed DOM
 *  tree and re-serializing it manually (browsers don't expose a built-in
 *  "pretty print" for XMLSerializer — it only round-trips the tree
 *  structure without adding whitespace) — a real, structural reformat,
 *  not a regex-based approximation. */
export function formatXml(text: string): string {
  const result = validateXml(text);
  if (!result.valid) {
    throw new Error(`This isn't valid XML: ${result.error}`);
  }
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];
  indentXmlNode(doc.documentElement, 0, lines);
  return lines.join("\n") + "\n";
}

/** Removes all whitespace between XML tags via the browser's own
 *  `XMLSerializer` — parses the document (validating it in the process),
 *  then serializes the tree back out, which naturally collapses any
 *  formatting whitespace since the DOM tree itself doesn't preserve
 *  inter-tag whitespace as anything but text nodes this walk skips. */
export function minifyXml(text: string): string {
  const result = validateXml(text);
  if (!result.valid) {
    throw new Error(`This isn't valid XML: ${result.error}`);
  }
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const minifyNode = (node: Element): string => {
    const children = Array.from(node.children);
    const attrs = serializeAttributes(node);
    if (children.length === 0) {
      const text = (node.textContent ?? "").trim();
      return `<${node.tagName}${attrs}>${escapeXmlText(text)}</${node.tagName}>`;
    }
    return `<${node.tagName}${attrs}>${children.map(minifyNode).join("")}</${node.tagName}>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?>${minifyNode(doc.documentElement)}`;
}

/** Re-parses and re-serializes CSV with consistent RFC 4180 quoting and
 *  CRLF line endings — the same normalization every other CSV-writing
 *  tool in this project already applies via `rowsToCsv`, exposed here as
 *  its own tool for CSV that came from an inconsistent source (mixed line
 *  endings, unnecessary quoting, stray whitespace in unquoted fields). */
export function formatCsv(text: string): string {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    throw new Error("No CSV data was found in this file.");
  }
  return rowsToCsv(rows);
}

/** Trims leading/trailing whitespace from every cell and drops fully-empty
 *  rows — the two most common "messy CSV" problems from manually-edited
 *  or badly-exported spreadsheets. Does not touch cell values otherwise
 *  (no type coercion, no case normalization) — this is whitespace/empty-row
 *  cleanup, not data transformation. */
export function cleanCsv(text: string): string {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    throw new Error("No CSV data was found in this file.");
  }
  const cleaned = rows
    .map((row) => row.map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell !== ""));
  return rowsToCsv(cleaned);
}

/** Removes duplicate rows, keeping the first occurrence — the header row
 *  (row 0) is always kept regardless of whether it duplicates another row's
 *  values, since a header is structural, not data. Comparison is exact
 *  (case-sensitive, whitespace-sensitive) — this tool doesn't guess at
 *  "close enough" duplicates. */
export function deduplicateCsvRows(text: string): string {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    throw new Error("No CSV data was found in this file.");
  }
  const [header, ...body] = rows;
  const seen = new Set<string>();
  const deduped: string[][] = [];
  for (const row of body) {
    const key = JSON.stringify(row);
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(row);
    }
  }
  return rowsToCsv([header, ...deduped]);
}

/** Keeps only the given column indices (0-based, in the order supplied),
 *  from every row including the header — the real "select these columns,
 *  drop the rest, in this order" operation, not just a filter that
 *  preserves original column order. */
export function extractCsvColumns(text: string, columnIndices: number[]): string {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    throw new Error("No CSV data was found in this file.");
  }
  if (columnIndices.length === 0) {
    throw new Error("Select at least one column to extract.");
  }
  const extracted = rows.map((row) => columnIndices.map((i) => row[i] ?? ""));
  return rowsToCsv(extracted);
}

/** Splits CSV data into multiple files of at most `rowsPerFile` data rows
 *  each, every file repeating the original header row so each output
 *  remains a valid, independently-openable CSV. Returns each chunk's CSV
 *  text paired with a suggested filename; zipping them into one download
 *  is the caller's job (matches how every other multi-file-output tool in
 *  this project — e.g. Split PDF — hands back multiple named parts). */
export function splitCsv(text: string, rowsPerFile: number): { filename: string; content: string }[] {
  if (rowsPerFile < 1) {
    throw new Error("Rows per file must be at least 1.");
  }
  const rows = parseCsv(text);
  if (rows.length === 0) {
    throw new Error("No CSV data was found in this file.");
  }
  const [header, ...body] = rows;
  if (body.length === 0) {
    throw new Error("This CSV has a header row but no data rows to split.");
  }

  const chunks: { filename: string; content: string }[] = [];
  for (let i = 0; i < body.length; i += rowsPerFile) {
    const chunkRows = body.slice(i, i + rowsPerFile);
    const partNumber = Math.floor(i / rowsPerFile) + 1;
    chunks.push({
      filename: `split-part-${partNumber}.csv`,
      content: rowsToCsv([header, ...chunkRows]),
    });
  }
  return chunks;
}

/** Merges multiple CSV files into one, requiring every file's header row
 *  to match exactly (same columns, same order) — merging files with
 *  different schemas would silently misalign data under the wrong column
 *  names, so this throws a specific, actionable error naming the
 *  mismatched file instead of guessing. */
export function mergeCsvFiles(files: { filename: string; text: string }[]): string {
  if (files.length < 2) {
    throw new Error("Upload at least two CSV files to merge.");
  }
  const parsed = files.map((f) => ({ filename: f.filename, rows: parseCsv(f.text) }));
  const [first, ...rest] = parsed;
  if (first.rows.length === 0) {
    throw new Error(`"${first.filename}" has no data.`);
  }
  const header = first.rows[0];
  const merged: string[][] = [header, ...first.rows.slice(1)];

  for (const file of rest) {
    if (file.rows.length === 0) {
      throw new Error(`"${file.filename}" has no data.`);
    }
    const otherHeader = file.rows[0];
    if (JSON.stringify(otherHeader) !== JSON.stringify(header)) {
      throw new Error(
        `"${file.filename}" has different columns than the first file — merging requires every file to have the exact same header row.`
      );
    }
    merged.push(...file.rows.slice(1));
  }

  return rowsToCsv(merged);
}
