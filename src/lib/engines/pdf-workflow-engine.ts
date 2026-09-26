import type { PdfWorkflow } from "../content/pdf-workflows";

export interface WorkflowOptions { range?: string; watermark?: string; firstNumber?: number; allowRasterCompression?: boolean; }
export interface WorkflowResult { blob: Blob; pages: number; beforeBytes: number; afterBytes: number; keptOriginal: boolean; }
export function parseWorkflowPages(source: string, total: number): number[] {
  if (!source.trim()) throw new Error("Enter the pages to extract, for example 1, 3-5.");
  const pages = new Set<number>();
  for (const part of source.split(",")) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error("Use page numbers and ranges separated by commas, for example 1, 3-5.");
    const first = Number(match[1]), last = Number(match[2] ?? match[1]);
    if (first < 1 || last < first || last > total || !Number.isSafeInteger(first) || !Number.isSafeInteger(last)) throw new Error(`Choose page numbers from 1 to ${total}, with ranges in ascending order.`);
    for (let number = first; number <= last; number++) pages.add(number - 1);
  }
  return [...pages];
}
export function validateWorkflowFiles(workflow: PdfWorkflow, files: readonly File[]) {
  const maxFiles = workflow.minFiles === 1 ? 1 : 20;
  if (files.length < workflow.minFiles || files.length > maxFiles) throw new Error(workflow.minFiles === 1 ? "Choose exactly one file for this workflow." : "Choose between 2 and 20 files for this workflow.");
  if (files.some(file => !file.name.toLowerCase().endsWith(`.${workflow.input}`))) throw new Error(`This workflow accepts ${workflow.input.toUpperCase()} files only.`);
  if (files.some(file => file.size === 0 || file.size > 50 * 1024 * 1024)) throw new Error("Each file must contain data and be no larger than 50 MB.");
  if (files.reduce((sum, f) => sum + f.size, 0) > 100 * 1024 * 1024) throw new Error("Choose files totalling no more than 100 MB.");
}

export async function runPdfWorkflow(workflow: PdfWorkflow, files: readonly File[], options: WorkflowOptions, progress: (value: number, label: string) => void, isCancelled: () => boolean): Promise<WorkflowResult> {
  validateWorkflowFiles(workflow, files);
  const check = () => { if (isCancelled()) throw new Error("Workflow cancelled."); };
  check();
  if (workflow.kind.endsWith("compress") && !options.allowRasterCompression) throw new Error("Confirm the compression trade-off before continuing.");
  const { PDFDocument } = await import("pdf-lib");
  let combined = await PDFDocument.create();
  let prepared: Uint8Array | undefined;
  for (let i = 0; i < files.length; i++) {
    check(); progress(Math.round(i / files.length * 55), workflow.steps[0]);
    let buffer: ArrayBuffer;
    if (workflow.input === "docx") {
      const { convertWordToPdf } = await import("./word-pdf-engine");
      const converted = await convertWordToPdf(files[i], { isCancelled, onProgress: percent => { check(); progress(Math.round((i + percent / 100) / files.length * 55), "Converting Word document…"); } });
      buffer = await converted.arrayBuffer();
    } else buffer = await files[i].arrayBuffer();
    check();
    let input: import("pdf-lib").PDFDocument;
    try { input = await PDFDocument.load(buffer); }
    catch { throw new Error("A PDF could not be opened. Use a readable, unencrypted PDF and try again."); }
    if (input.getPageCount() > 300 || input.getPageCount() + combined.getPageCount() > 300) throw new Error("This workflow supports up to 300 pages in total. Choose a smaller document set.");
    if (workflow.kind === "word-compress") { prepared = new Uint8Array(buffer); break; }
    if (input.getForm().getFields().length) input.getForm().flatten();
    const indices = workflow.kind === "extract-compress" ? parseWorkflowPages(options.range ?? "1", input.getPageCount()) : input.getPageIndices();
    for (const page of await combined.copyPages(input, indices)) combined.addPage(page);
  }
  check(); progress(58, workflow.steps[1]);
  if (!prepared) prepared = await combined.save();
  const beforeBytes = prepared.byteLength;
  const file = new File([prepared as unknown as BlobPart], "prepared.pdf", { type: "application/pdf" });
  let blob = new Blob([prepared as unknown as BlobPart], { type: "application/pdf" });
  let keptOriginal = false;
  if (workflow.kind.endsWith("compress")) {
    const { compressPdfPagesWithGuard } = await import("./pdf-compress-engine");
    const result = await compressPdfPagesWithGuard(await blob.arrayBuffer(), 1.5, 0.8, (done, total) => { check(); progress(60 + Math.round(done / total * 35), "Compressing PDF pages…"); });
    check(); keptOriginal = result.keptOriginal;
    blob = new Blob([result.bytes as unknown as BlobPart], { type: "application/pdf" });
  } else if (workflow.kind === "merge-number") {
    if (!Number.isInteger(options.firstNumber) || options.firstNumber! < 1 || options.firstNumber! > 9999) throw new Error("Choose a starting number from 1 to 9999.");
    if (combined.getPages().some(page => page.getRotation().angle % 360 !== 0)) throw new Error("This numbering preset needs pages without rotation. Use Merge PDF and the separate page-number tool to review rotated pages.");
    const { addPageNumbersToPdf } = await import("./pdf-page-numbers-engine");
    blob = (await addPageNumbersToPdf(file, { pageMode: "single", firstPageCover: false, position: 7, margin: "recommended", firstNumber: options.firstNumber!, fromPage: 1, toPage: combined.getPageCount(), textFormat: "number", customText: "", fontFamily: "helvetica", fontSize: 11, bold: false, italic: false, underline: false, color: "#333333" }, p => { check(); progress(60 + Math.round(p * 0.35), "Adding page numbers…"); })).blob;
  } else if (workflow.kind === "merge-watermark") {
    const text = (options.watermark ?? "").trim();
    if (!text || text.length > 40) throw new Error("Enter a watermark from 1 to 40 characters.");
    if (!/^[\x20-\x7e]+$/.test(text)) throw new Error("Use plain Latin letters, numbers and punctuation for the watermark.");
    const { addWatermarkToPdf } = await import("./pdf-watermark-engine");
    blob = (await addWatermarkToPdf(file, { mode: "text", text, fontFamily: "helvetica", fontSize: Math.min(42, 420 / text.length), bold: true, italic: false, underline: false, color: "#777777", position: 4, mosaic: false, transparency: 25, rotation: 45, fromPage: 1, toPage: combined.getPageCount(), layer: "over" }, null, p => { check(); progress(60 + Math.round(p * 0.35), "Adding watermark…"); })).blob;
  }
  check(); combined = await PDFDocument.load(await blob.arrayBuffer());
  if (!combined.getPageCount()) throw new Error("The workflow produced no pages. Check the input and try again.");
  progress(100, "Your PDF is ready");
  return { blob, pages: combined.getPageCount(), beforeBytes, afterBytes: blob.size, keptOriginal };
}
