import { getConnection, type FileOperation } from "./registry";
import { parseCsv } from "../engines/text-engine";
import { rowsToCsv, rowsToJson, jsonToRows, rowsToMarkdownTable, jsonToYaml, yamlToJson } from "../engines/data-conversion-engine";
import { cleanCsv, deduplicateCsvRows, formatCsv, formatJson, minifyJson } from "../engines/format-engine";
import { parseWorkflowPages } from "../engines/pdf-workflow-engine";

import { CONNECTION_FILE_LIMIT, type ConnectionOptions } from "./options";
export { DEFAULT_CONNECTION_OPTIONS, CONNECTION_FILE_LIMIT, type ConnectionOptions } from "./options";

function validateTable(rows: string[][]) {
  if (rows.length < 2 || !rows[0].length) throw new Error("Include a header and at least one data row.");
  const headers = rows[0];
  if (headers.some(header => !header.trim()) || new Set(headers).size !== headers.length || headers.some(header => ["__proto__", "constructor", "prototype"].includes(header))) {
    throw new Error("Use unique, nonempty column names without reserved object names.");
  }
  if (rows.some(row => row.length !== headers.length)) throw new Error("Every row must match the number of column headers.");
  return rows;
}
async function dataStep(operation: FileOperation, file: File, options: ConnectionOptions): Promise<Blob> {
  const text = operation.input === "xlsx" ? "" : (await file.text()).replace(/^\uFEFF/, "");
  const transforms: Record<string, (source: string) => string> = { "csv-cleaner": cleanCsv, "duplicate-row-remover": deduplicateCsvRows, "csv-formatter": formatCsv, "json-formatter": formatJson, "json-minifier": minifyJson };
  if (transforms[operation.slug]) return new Blob([transforms[operation.slug](text)], { type: "text/plain" });
  if (operation.slug === "yaml-to-json") return new Blob([await yamlToJson(text)], { type: "application/json" });
  if (operation.slug === "json-to-yaml") return new Blob([await jsonToYaml(text)], { type: "application/yaml" });
  let table: string[][];
  if (operation.input === "xlsx") table = await (await import("../engines/excel-engine")).readSheetAsRows(file, options.sheetName || undefined);
  else if (operation.input === "json") table = jsonToRows(text);
  else if (operation.input === "sql") table = await (await import("../engines/sql-engine")).sqlToRows(text);
  else table = parseCsv(text, operation.input === "tsv" ? "\t" : ",");
  validateTable(table);
  if (operation.output === "xlsx") return (await import("../engines/excel-engine")).rowsToSingleSheetXlsx(table);
  let output: string;
  if (operation.output === "json") output = rowsToJson(table);
  else if (operation.output === "md") output = rowsToMarkdownTable(table);
  else if (operation.output === "sql") {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(options.tableName)) throw new Error("Enter a table name using letters, numbers and underscores, starting with a letter or underscore.");
    output = (await import("../engines/sql-engine")).rowsToSql(table, options.tableName);
  } else output = rowsToCsv(table, operation.output === "tsv" ? "\t" : ",");
  return new Blob([output], { type: "text/plain" });
}

async function pdfStep(operation: FileOperation, files: File[], options: ConnectionOptions, signal: AbortSignal): Promise<Blob> {
  const { PDFDocument } = await import("pdf-lib");
  const file = files[0];
  const document = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  const pages = document.getPageCount();
  if (!pages || pages > 300) throw new Error("Choose a PDF containing 1 to 300 pages.");
  signal.throwIfAborted();
  if (operation.kind === "flatten") return (await (await import("../engines/pdf-flatten-engine")).flattenPdfSafely(file, { signal })).blob;
  if (operation.kind === "rotate") {
    if (![90, 180, 270].includes(options.rotation)) throw new Error("Choose a rotation of 90, 180 or 270 degrees.");
    const result = await (await import("../engines/pdf-engine")).rotatePdfPages(file, Object.fromEntries(document.getPageIndices().map(index => [index, options.rotation])), undefined, () => signal.aborted);
    if (!result) throw new DOMException("Cancelled", "AbortError");
    return result;
  }
  if (operation.kind === "duplicate") return (await import("../engines/pdf-engine")).duplicatePdfPages(file, parseWorkflowPages(options.range, pages));
  if (operation.kind === "number") {
    if (!Number.isInteger(options.firstNumber) || options.firstNumber < 1 || options.firstNumber > 9999) throw new Error("Choose a starting number from 1 to 9999.");
    if (document.getPages().some(page => page.getRotation().angle % 360 !== 0)) throw new Error("This numbering preset needs unrotated pages. Use the individual page-number tool for rotated PDFs.");
    return (await (await import("../engines/pdf-page-numbers-engine")).addPageNumbersToPdf(file, { pageMode: "single", firstPageCover: false, position: 7, margin: "recommended", firstNumber: options.firstNumber, fromPage: 1, toPage: pages, textFormat: "number", customText: "", fontFamily: "helvetica", fontSize: 11, bold: false, italic: false, underline: false, color: "#333333" }, () => signal.throwIfAborted())).blob;
  }
  if (operation.kind === "watermark") {
    if (!/^[\x20-\x7e]{1,40}$/.test(options.watermark)) throw new Error("Use 1 to 40 Latin letters, numbers or punctuation for this watermark preset.");
    return (await (await import("../engines/pdf-watermark-engine")).addWatermarkToPdf(file, { mode: "text", text: options.watermark, fontFamily: "helvetica", fontSize: Math.min(42, 420 / options.watermark.length), bold: true, italic: false, underline: false, color: "#777777", position: 4, mosaic: false, transparency: 25, rotation: 45, fromPage: 1, toPage: pages, layer: "over" }, null, () => signal.throwIfAborted())).blob;
  }
  const output = await PDFDocument.create();
  for (const input of files) {
    signal.throwIfAborted();
    const source = await PDFDocument.load(await input.arrayBuffer(), { updateMetadata: false });
    const indices = operation.kind === "extract" ? parseWorkflowPages(options.range, source.getPageCount()) : source.getPageIndices();
    if (output.getPageCount() + indices.length > 300) throw new Error("The combined PDF exceeds 300 pages.");
    if (source.getForm().getFields().length) throw new Error("Flatten interactive forms before this merge or extract workflow to preserve their appearance.");
    for (const page of await output.copyPages(source, indices)) output.addPage(page);
  }
  return new Blob([await output.save() as BlobPart], { type: "application/pdf" });
}

export async function runConnection(source: string, target: string, files: File[], options: ConnectionOptions, signal: AbortSignal, onStep: (step: number) => void = () => {}) {
  const connection = getConnection(source, target);
  if (!connection || connection.cloud) throw new Error("Choose a supported connection.");
  const minFiles = connection.first.kind === "merge" ? 2 : 1;
  const maxFiles = minFiles === 2 ? 20 : 1;
  if (files.length < minFiles || files.length > maxFiles) throw new Error(`Choose ${minFiles === 2 ? "2 to 20" : "one"} input file${minFiles === 2 ? "s" : ""}.`);
  if (files.some(file => !file.size || file.size > CONNECTION_FILE_LIMIT || !file.name.toLowerCase().endsWith("." + connection.first.input))) throw new Error(`Choose nonempty .${connection.first.input} files of up to 4 MiB each.`);
  let inputs = files;
  let result: Blob = files[0];
  for (const [index, operation] of [connection.first, connection.next].entries()) {
    signal.throwIfAborted();
    onStep(index + 1);
    result = operation.input === "pdf" ? await pdfStep(operation, inputs, options, signal) : await dataStep(operation, inputs[0], options);
    signal.throwIfAborted();
    if (!result.size || result.size > 20 * 1024 * 1024) throw new Error("The generated file is empty or exceeds the 20 MiB output limit.");
    inputs = [new File([result], "step-" + (index + 1) + "." + operation.output, { type: result.type })];
  }
  return { blob: result, filename: `${source}-${target}.${connection.next.output}` };
}
