import { getTool, type Tool } from "./tools";

/**
 * Contextual "what next" relationships for every tool in the registry —
 * each entry answers "what's the most natural next PDF/document action
 * after using this tool," not a generic same-category tool dump. Every
 * slug here is verified against a real route (getCrossSellTools filters
 * out any that ever stop resolving), so a typo or a removed tool degrades
 * silently rather than producing a dead link.
 */
const CROSS_SELL_MAP: Record<string, string[]> = {
  // PDF organize
  "merge-pdf": ["split-pdf", "compress-pdf", "rotate-pdf"],
  "split-pdf": ["merge-pdf", "compress-pdf", "extract-pages"],
  "delete-pages": ["extract-pages", "split-pdf", "merge-pdf"],
  "extract-pages": ["delete-pages", "split-pdf", "merge-pdf"],
  "rearrange-pages": ["rotate-pdf", "delete-pages", "merge-pdf"],
  "duplicate-pages": ["merge-pdf", "rearrange-pages", "delete-pages"],
  "insert-pages": ["merge-pdf", "extract-pages", "delete-pages"],
  "rotate-pdf": ["merge-pdf", "add-page-numbers", "crop-pdf"],

  // PDF edit / security
  "compress-pdf": ["pdf-to-jpg", "merge-pdf", "watermark-pdf"],
  "add-page-numbers": ["rotate-pdf", "watermark-pdf", "merge-pdf"],
  "watermark-pdf": ["edit-pdf", "rotate-pdf", "lock-pdf"],
  "crop-pdf": ["rotate-pdf", "edit-pdf", "watermark-pdf"],
  "edit-pdf": ["watermark-pdf", "fill-pdf", "crop-pdf"],
  "fill-pdf": ["edit-pdf", "flatten-pdf", "watermark-pdf"],
  "flatten-pdf": ["fill-pdf", "lock-pdf", "watermark-pdf"],
  "lock-pdf": ["unlock-pdf", "watermark-pdf", "flatten-pdf"],
  "unlock-pdf": ["lock-pdf", "watermark-pdf", "compress-pdf"],
  "compare-pdf": ["edit-pdf", "merge-pdf", "extract-pages"],
  "pdf-metadata-editor": ["edit-pdf", "compress-pdf", "watermark-pdf"],
  "svg-to-pdf": ["merge-pdf", "compress-pdf", "watermark-pdf"],
  "ocr-pdf": ["pdf-to-word", "summary-generator", "compress-pdf"],
  "summary-generator": ["ocr-pdf", "pdf-to-word", "pdf-metadata-editor"],

  // Document conversion
  "pdf-to-word": ["word-to-pdf", "ocr-pdf", "pdf-to-powerpoint"],
  "word-to-pdf": ["pdf-to-word", "merge-pdf", "compress-pdf"],
  "pdf-to-powerpoint": ["powerpoint-to-pdf", "pdf-to-word", "pdf-to-jpg"],
  "powerpoint-to-pdf": ["pdf-to-powerpoint", "merge-pdf", "compress-pdf"],
  "excel-to-pdf": ["word-to-pdf", "merge-pdf", "compress-pdf"],
  "csv-to-pdf": ["merge-pdf", "compress-pdf", "txt-to-pdf"],
  "txt-to-pdf": ["csv-to-pdf", "markdown-to-pdf", "merge-pdf"],
  "markdown-to-pdf": ["txt-to-pdf", "csv-to-pdf", "merge-pdf"],
  "html-to-markdown": ["markdown-to-html", "html-to-text", "text-to-html"],
  "html-to-text": ["text-to-html", "html-to-markdown", "markdown-to-html"],
  "text-to-html": ["html-to-text", "markdown-to-html", "html-to-markdown"],
  "markdown-to-html": ["html-to-markdown", "markdown-to-pdf", "text-to-html"],

  // Image conversion
  "pdf-to-jpg": ["jpg-to-pdf", "compress-image", "convert-image"],
  "jpg-to-pdf": ["pdf-to-jpg", "merge-pdf", "compress-pdf"],
  "resize-image": ["compress-image", "convert-image", "crop-image"],
  "compress-image": ["resize-image", "convert-image", "image-metadata"],
  "crop-image": ["rotate-image", "resize-image", "convert-image"],
  "rotate-image": ["crop-image", "compress-image", "convert-image"],
  "convert-image": ["compress-image", "resize-image", "pdf-to-jpg"],
  "image-metadata": ["compress-image", "resize-image", "convert-image"],
  "image-watermark": ["crop-image", "resize-image", "compress-image"],
  "heic-to-jpg": ["heic-to-png", "jpg-to-pdf", "compress-image"],
  "heic-to-png": ["heic-to-jpg", "compress-image", "convert-image"],
  "ocr-image": ["ocr-pdf", "convert-image", "compress-image"],

  // Data conversion — CSV / Excel / TSV
  "csv-to-excel": ["excel-to-csv", "csv-to-json", "csv-cleaner"],
  "excel-to-csv": ["csv-to-excel", "excel-to-json", "excel-sheet-extractor"],
  "csv-to-json": ["json-to-csv", "csv-to-excel", "csv-formatter"],
  "json-to-csv": ["csv-to-json", "json-formatter", "json-to-excel"],
  "csv-to-xml": ["xml-to-csv", "csv-to-json", "csv-formatter"],
  "xml-to-csv": ["csv-to-xml", "xml-formatter", "xml-to-json"],
  "excel-to-xml": ["xml-to-excel", "excel-to-csv", "excel-to-json"],
  "xml-to-excel": ["excel-to-xml", "xml-to-csv", "xml-formatter"],
  "excel-to-json": ["json-to-excel", "excel-to-csv", "excel-to-xml"],
  "json-to-excel": ["excel-to-json", "json-to-csv", "json-formatter"],
  "csv-to-tsv": ["tsv-to-csv", "csv-to-excel", "csv-formatter"],
  "tsv-to-csv": ["csv-to-tsv", "tsv-to-excel", "csv-formatter"],
  "excel-to-tsv": ["tsv-to-excel", "excel-to-csv", "excel-sheet-extractor"],
  "tsv-to-excel": ["excel-to-tsv", "tsv-to-csv", "csv-to-excel"],
  "csv-to-markdown-table": ["markdown-table-to-csv", "csv-formatter", "csv-to-excel"],
  "markdown-table-to-csv": ["csv-to-markdown-table", "csv-to-excel", "csv-formatter"],
  "excel-sheet-extractor": ["excel-sheet-merger", "excel-to-csv", "excel-to-json"],
  "excel-sheet-merger": ["excel-sheet-extractor", "excel-to-csv", "docx-merge"],
  "docx-merge": ["word-to-pdf", "pdf-to-word", "excel-sheet-merger"],

  // Data conversion — JSON / XML / YAML / SQL
  "json-to-xml": ["xml-to-json", "json-formatter", "json-to-csv"],
  "xml-to-json": ["json-to-xml", "xml-formatter", "json-formatter"],
  "yaml-to-json": ["json-to-yaml", "json-formatter", "yaml-to-xml"],
  "json-to-yaml": ["yaml-to-json", "json-formatter", "json-to-xml"],
  "yaml-to-xml": ["xml-to-yaml", "yaml-to-json", "xml-formatter"],
  "xml-to-yaml": ["yaml-to-xml", "xml-formatter", "yaml-to-json"],
  "sql-to-csv": ["csv-to-sql", "sql-to-json", "csv-formatter"],
  "csv-to-sql": ["sql-to-csv", "csv-to-excel", "json-to-sql"],
  "sql-to-json": ["json-to-sql", "sql-to-csv", "json-formatter"],
  "json-to-sql": ["sql-to-json", "csv-to-sql", "json-formatter"],

  // Formatters / validators / cleaners
  "json-formatter": ["json-minifier", "json-validator", "json-to-csv"],
  "json-minifier": ["json-formatter", "json-validator", "json-to-csv"],
  "json-validator": ["json-formatter", "json-minifier", "json-diff"],
  "json-diff": ["json-formatter", "json-validator", "json-minifier"],
  "xml-formatter": ["xml-minifier", "xml-validator", "xml-to-json"],
  "xml-minifier": ["xml-formatter", "xml-validator", "xml-to-json"],
  "xml-validator": ["xml-formatter", "xml-minifier", "xml-to-json"],
  "csv-formatter": ["csv-cleaner", "duplicate-row-remover", "csv-to-excel"],
  "csv-cleaner": ["duplicate-row-remover", "csv-formatter", "csv-splitter"],
  "duplicate-row-remover": ["csv-cleaner", "csv-formatter", "csv-splitter"],
  "csv-splitter": ["csv-merger", "csv-cleaner", "column-extractor"],
  "csv-merger": ["csv-splitter", "csv-cleaner", "column-extractor"],
  "column-extractor": ["csv-splitter", "csv-cleaner", "csv-formatter"],

  // Encode / decode
  "base64-encode": ["base64-decode", "url-encode", "jwt-decode"],
  "base64-decode": ["base64-encode", "url-decode", "jwt-decode"],
  "url-encode": ["url-decode", "base64-encode", "jwt-decode"],
  "url-decode": ["url-encode", "base64-decode", "jwt-decode"],
  "jwt-decode": ["base64-decode", "url-decode", "json-formatter"],
};

export function getCrossSellTools(currentSlug: string): Tool[] {
  const ids = CROSS_SELL_MAP[currentSlug];
  if (!ids) return [];
  return ids
    .map((slug) => getTool(`/${slug}`))
    .filter((t): t is Tool => t !== undefined);
}

export function getNextBestTool(currentSlug: string): Tool | undefined {
  const cross = getCrossSellTools(currentSlug);
  return cross[0];
}
