export const OFFICE_BATCH_LIMITS = {
  files: 20,
  fileBytes: 100 * 1024 * 1024,
  totalBytes: 200 * 1024 * 1024,
  outputBytes: 200 * 1024 * 1024,
};
export interface OfficeBatchItem {
  id: string;
  file: File;
  rotation: number;
  selectedSheets?: string[];
}
export interface OfficeConvertedDocument {
  blob: Blob;
  pagePreviews?: string[];
}
export interface OfficeBatchOutput extends OfficeConvertedDocument {
  key: string;
  name: string;
}
export function officeItemKey(item: OfficeBatchItem) {
  return JSON.stringify([item.rotation, item.selectedSheets ?? null]);
}
export function officeOutputName(name: string) {
  const cleaned = name
    .replace(/\.[^.]+$/, "")
    .normalize("NFC")
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")
    .replace(/^[.\s]+|[.\s]+$/g, "");
  const base = Array.from(cleaned).slice(0, 160).join("");
  return `${base || "document"}.pdf`;
}
export function validateOfficeBatch(items: OfficeBatchItem[]) {
  if (!items.length || items.length > OFFICE_BATCH_LIMITS.files)
    throw new Error("Choose between 1 and 20 documents.");
  if (
    items.some(
      (i) => !i.file.size || i.file.size > OFFICE_BATCH_LIMITS.fileBytes,
    )
  )
    throw new Error("Choose nonempty documents up to 100MB each.");
  if (
    items.reduce((s, i) => s + i.file.size, 0) > OFFICE_BATCH_LIMITS.totalBytes
  )
    throw new Error("Keep combined input below 200MB.");
  if (new Set(items.map((i) => i.id)).size !== items.length)
    throw new Error("The file selection changed. Add the files again.");
}
export async function runOfficeBatch<T extends OfficeBatchItem>(
  items: T[],
  completed: Record<string, OfficeBatchOutput>,
  convert: (
    item: T,
    progress: (n: number, label?: string) => void,
    cancelled: () => boolean,
  ) => Promise<OfficeConvertedDocument>,
  options: {
    cancelled: () => boolean;
    progress: (n: number, label: string) => void;
    ready: (item: T, output: OfficeBatchOutput) => void;
    failed: (item: T, message: string) => void;
  },
) {
  validateOfficeBatch(items);
  const outputs: Record<string, OfficeBatchOutput> = Object.create(null);
  for (const item of items)
    if (completed[item.id]?.key === officeItemKey(item))
      outputs[item.id] = completed[item.id];
  let total = Object.values(outputs).reduce((s, o) => s + o.blob.size, 0);
  if (total > OFFICE_BATCH_LIMITS.outputBytes)
    throw new Error("Ready PDFs exceed the 200MB batch limit.");
  const pending = items.filter((i) => !outputs[i.id]);
  for (let index = 0; index < pending.length; index++) {
    if (options.cancelled()) break;
    const item = pending[index],
      deadline = Date.now() + 180_000;
    const stopped = () => options.cancelled() || Date.now() > deadline;
    try {
      const output = await convert(
        item,
        (n, label) => {
          if (!options.cancelled())
            options.progress(
              ((index + Math.max(0, Math.min(100, n)) / 100) / pending.length) *
                95,
              `File ${index + 1} of ${pending.length}: ${label || "Converting…"}`,
            );
        },
        stopped,
      );
      if (options.cancelled()) break;
      if (stopped())
        throw new Error(
          "This file took too long. Split it into a smaller document and try again.",
        );
      if (
        !output.blob.size ||
        output.blob.size + total > OFFICE_BATCH_LIMITS.outputBytes
      )
        throw new Error(
          "The completed PDFs would exceed 200MB. Download the ready files and convert this document separately.",
        );
      const bytes = new Uint8Array(await output.blob.arrayBuffer());
      if (options.cancelled()) break;
      const { PDFDocument } = await import("pdf-lib");
      if (options.cancelled()) break;
      const check = await PDFDocument.load(bytes, { updateMetadata: false });
      if (!check.getPageCount())
        throw new Error("The converter produced no pages.");
      if (options.cancelled()) break;
      if (stopped())
        throw new Error(
          "This file took too long. Split it into a smaller document and try again.",
        );
      const ready = {
        ...output,
        key: officeItemKey(item),
        name: officeOutputName(item.file.name),
      };
      outputs[item.id] = ready;
      total += output.blob.size;
      options.ready(item, ready);
    } catch (error) {
      if (options.cancelled()) break;
      options.failed(
        item,
        stopped()
          ? "This file took too long. Split it into a smaller document and try again."
          : error instanceof Error
            ? error.message
            : "This file could not be converted.",
      );
    }
    await new Promise<void>((r) => setTimeout(r, 0));
  }
  return outputs;
}
export async function packageOfficePdfs(
  outputs: OfficeBatchOutput[],
  filename: string,
  cancelled: () => boolean = () => false,
) {
  if (cancelled()) return null;
  if (!outputs.length)
    throw new Error("There are no completed PDFs to download.");
  if (
    outputs.reduce((s, o) => s + o.blob.size, 0) >
    OFFICE_BATCH_LIMITS.outputBytes
  )
    throw new Error("The download exceeds 200MB. Download PDFs individually.");
  if (outputs.length === 1)
    return {
      blob: outputs[0].blob,
      filename: outputs[0].name,
      count: 1,
      pagePreviews: outputs[0].pagePreviews,
    };
  const entries: Record<string, Uint8Array> = Object.create(null),
    used = new Set<string>();
  for (const output of outputs) {
    let name = output.name,
      suffix = 2;
    while (used.has(name.toLowerCase()))
      name = output.name.replace(/\.pdf$/i, `-${suffix++}.pdf`);
    used.add(name.toLowerCase());
    entries[name] = new Uint8Array(await output.blob.arrayBuffer());
    if (cancelled()) return null;
  }
  const { zipSync } = await import("fflate");
  if (cancelled()) return null;
  const zip = zipSync(entries, { level: 0 });
  await new Promise<void>((r) => setTimeout(r, 0));
  if (cancelled()) return null;
  if (zip.byteLength > OFFICE_BATCH_LIMITS.outputBytes)
    throw new Error("The archive exceeds 200MB. Download PDFs individually.");
  return {
    blob: new Blob([zip as BlobPart], { type: "application/zip" }),
    filename,
    count: outputs.length,
  };
}
