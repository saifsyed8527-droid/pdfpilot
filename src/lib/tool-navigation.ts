import { TOOLS, type Tool } from "./tools";

export interface ToolNavGroup {
  group: string;
  tools: Tool[];
}

export interface ToolNavCategory {
  navCategory: string;
  groups: ToolNavGroup[];
}

/** Functional groups shared by desktop and mobile. Homepage order is separate. */
export const TOOL_NAV_GROUPS = [
  { name: "Convert to PDF", slugs: ["jpg-to-pdf", "word-to-pdf", "powerpoint-to-pdf", "excel-to-pdf", "html-to-pdf", "txt-to-pdf", "markdown-to-pdf", "csv-to-pdf", "svg-to-pdf"] },
  { name: "Convert from PDF", slugs: ["pdf-to-jpg", "pdf-to-word", "pdf-to-powerpoint", "pdf-to-excel", "pdf-to-pdfa"] },
  { name: "Organize PDF", slugs: ["merge-pdf", "split-pdf", "delete-pages", "extract-pages", "organize-pdf", "rotate-pdf", "rearrange-pages", "duplicate-pages", "insert-pages"] },
  { name: "Optimize & scan", slugs: ["compress-pdf", "repair-pdf", "ocr-pdf", "scan-pdf"] },
  { name: "Edit PDF", slugs: ["edit-pdf", "fill-pdf", "add-page-numbers", "watermark-pdf", "crop-pdf", "flatten-pdf", "pdf-metadata-editor", "compare-pdf", "summary-generator"] },
  { name: "PDF security", slugs: ["lock-pdf", "unlock-pdf", "redact-pdf"] },
  { name: "Image tools", slugs: ["convert-image", "resize-image", "crop-image", "rotate-image", "compress-image", "image-watermark", "heic-to-jpg", "heic-to-png", "image-metadata", "ocr-image"] },
  { name: "Spreadsheet tools", slugs: ["excel-to-xml", "xml-to-excel", "json-to-excel", "excel-to-json", "tsv-to-excel", "excel-to-tsv", "csv-to-excel", "excel-to-csv", "excel-sheet-extractor", "excel-sheet-merger"] },
  { name: "Data converters", slugs: ["csv-to-xml", "xml-to-csv", "json-to-csv", "csv-to-json", "tsv-to-csv", "csv-to-tsv", "yaml-to-json", "json-to-yaml", "sql-to-csv", "csv-to-sql", "sql-to-json", "json-to-sql", "json-to-xml", "xml-to-json", "yaml-to-xml", "xml-to-yaml"] },
  { name: "Clean & organize data", slugs: ["csv-formatter", "csv-cleaner", "duplicate-row-remover", "column-extractor", "csv-splitter", "csv-merger"] },
  { name: "Text & documents", slugs: ["docx-merge", "markdown-to-html", "html-to-markdown", "html-to-text", "text-to-html", "csv-to-markdown-table", "markdown-table-to-csv"] },
  { name: "Format & validate", slugs: ["json-formatter", "json-minifier", "json-validator", "json-diff", "xml-formatter", "xml-minifier", "xml-validator"] },
  { name: "Encoding tools", slugs: ["base64-encode", "base64-decode", "url-encode", "url-decode", "jwt-decode"] },
] as const;

export function getToolNavigation(): ToolNavCategory[] {
  return TOOL_NAV_GROUPS.map(({ name, slugs }) => ({
    navCategory: name,
    groups: [{ group: name, tools: slugs.flatMap((slug) => TOOLS.filter((tool) => tool.slug === slug)) }],
  }));
}
