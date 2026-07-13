/**
 * Template Engine — generates real, fillable PDF templates client-side,
 * the same "runs entirely in your browser" model as every other engine
 * in this project. A template is not a static file shipped in `public/`;
 * it's built on demand with pdf-lib's real form-field API (`getForm()`,
 * `createTextField`, `addToPage`) — the same API `fill-pdf`'s client uses
 * to read an existing form, used here to create one from scratch.
 *
 * One real template this sprint (Invoice), proving the generator, not a
 * batch of speculative ones.
 */

const PAGE_WIDTH = 612; // US Letter, points — matches pdf-text-renderer.ts
const PAGE_HEIGHT = 792;
const MARGIN = 56;

interface TemplateField {
  name: string;
  label: string;
  y: number;
  width?: number;
}

async function buildFillableTemplate(title: string, fields: TemplateField[]): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const form = pdf.getForm();

  page.drawText(title, { x: MARGIN, y: PAGE_HEIGHT - MARGIN, size: 20, font: boldFont, color: rgb(0.1, 0.1, 0.1) });

  for (const field of fields) {
    page.drawText(field.label, { x: MARGIN, y: field.y + 6, size: 10, font, color: rgb(0.35, 0.35, 0.35) });
    const textField = form.createTextField(field.name);
    textField.addToPage(page, {
      x: MARGIN,
      y: field.y - 16,
      width: field.width ?? PAGE_WIDTH - MARGIN * 2,
      height: 20,
      borderWidth: 1,
      borderColor: rgb(0.7, 0.7, 0.7),
    });
  }

  const pdfBytes = await pdf.save();
  return new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
}

/** A genuinely fillable invoice PDF — real form fields a user can type
 *  into in any PDF reader (Acrobat, Preview, browser PDF viewers), not an
 *  image of an invoice. Deliberately minimal: the fields a real invoice
 *  needs structurally, not a fully-designed commercial template. */
export async function generateInvoiceTemplate(): Promise<Blob> {
  return buildFillableTemplate("Invoice", [
    { name: "invoiceNumber", label: "Invoice Number", y: PAGE_HEIGHT - 110, width: 200 },
    { name: "invoiceDate", label: "Date", y: PAGE_HEIGHT - 110 - 50, width: 200 },
    { name: "billTo", label: "Bill To", y: PAGE_HEIGHT - 220 },
    { name: "description", label: "Description of Goods/Services", y: PAGE_HEIGHT - 320 },
    { name: "amount", label: "Amount Due", y: PAGE_HEIGHT - 420, width: 200 },
    { name: "dueDate", label: "Payment Due Date", y: PAGE_HEIGHT - 490, width: 200 },
  ]);
}

export type TemplateGeneratorId = "invoice";

const GENERATORS: Record<TemplateGeneratorId, () => Promise<Blob>> = {
  invoice: generateInvoiceTemplate,
};

export async function generateTemplate(generatorId: TemplateGeneratorId): Promise<Blob> {
  return GENERATORS[generatorId]();
}
