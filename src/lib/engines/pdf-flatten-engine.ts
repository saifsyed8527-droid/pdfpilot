import { PDFDocument, PDFName, PDFSignature } from "pdf-lib";

export interface FlattenResult {
  blob: Blob;
  pageCount: number;
  fieldCount: number;
  unchanged: boolean;
}

/** Keep page/text vectors and existing field appearances; never rasterize. */
export async function flattenPdfSafely(file: File): Promise<FlattenResult> {
  if (file.size > 100 * 1024 * 1024) throw new Error("Each PDF must be 100MB or smaller.");
  const bytes = await file.arrayBuffer();
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false }).catch(() => {
    throw new Error("This PDF is damaged or password-protected. Use an unlocked, readable copy.");
  });
  if (pdf.isEncrypted) throw new Error("Unlock this PDF before flattening.");
  const pageCount = pdf.getPageCount();
  if (!pageCount) throw new Error("This PDF has no pages.");
  // Check before getForm(), which otherwise strips XFA automatically.
  if (pdf.catalog.AcroForm()?.has(PDFName.of("XFA"))) throw new Error("XFA forms are not supported. Export a standard PDF form first.");
  const form = pdf.getForm();
  const fields = form.getFields();
  if (fields.some(field => field instanceof PDFSignature)) {
    throw new Error("This file contains signature fields. Flattening could invalidate a digital signature; use an unsigned copy.");
  }
  if (!fields.length) return { blob: new Blob([bytes], { type: "application/pdf" }), pageCount, fieldCount: 0, unchanged: true };
  try {
    // pdf-lib only updates fields with missing/dirty appearances; intact fonts,
    // glyphs and custom drawings remain embedded in their original streams.
    form.updateFieldAppearances();
    form.flatten({ updateFieldAppearances: false });
    const output = await pdf.save({ updateFieldAppearances: false });
    const verified = await PDFDocument.load(output, { updateMetadata: false });
    if (verified.getForm().getFields().length || verified.getPageCount() !== pageCount) throw new Error("Output validation failed");
    return { blob: new Blob([output as BlobPart], { type: "application/pdf" }), pageCount, fieldCount: fields.length, unchanged: false };
  } catch {
    throw new Error("This form's appearance could not be preserved safely. Open and save it in a PDF editor first, then retry. No partial output was downloaded.");
  }
}
