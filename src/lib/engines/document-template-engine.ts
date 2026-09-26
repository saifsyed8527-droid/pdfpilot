import type { DocumentTemplate } from "../content/document-templates";

export type TemplatePaper = "a4" | "letter";
export async function createDocumentTemplate(
  template: DocumentTemplate,
  values: Record<string, string> = {},
  paper: TemplatePaper = "a4",
): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [width, height] = paper === "letter" ? [612, 792] : [595.28, 841.89];
  const page = pdf.addPage([width, height]);
  const form = pdf.getForm();
  const margin = 40, usable = width - margin * 2;
  const ink = rgb(0.12, 0.17, 0.24), border = rgb(0.78, 0.82, 0.86);
  const allowed = new Set(["notes", ...template.fields.map(f => f.key), ...Array.from({ length: template.rows }, (_, i) => template.columns.map((_, j) => `row-${i}-${j}`)).flat()]);
  for (const [key, value] of Object.entries(values)) {
    if (!allowed.has(key)) throw new Error("An unknown form field was supplied.");
    if (value.length > (key === "notes" ? 400 : 80)) throw new Error("One of your entries is too long. Shorten it before downloading.");
    try { font.encodeText(value.replaceAll("\n", " ")); }
    catch { throw new Error("This PDF template supports Latin characters. Remove unsupported characters or emoji before downloading."); }
  }
  pdf.setTitle(`${template.name} template`);
  pdf.setCreator("PDFPilot");
  page.drawText(template.name, { x: margin, y: height - 59, size: 24, font: bold, color: ink });
  page.drawLine({ start: { x: margin, y: height - 74 }, end: { x: width - margin, y: height - 74 }, thickness: 2, color: rgb(0.18, 0.40, 0.57) });

  const addField = (key: string, x: number, y: number, w: number, h: number, size = 10) => {
    const value = values[key] ?? "";
    const fits = (fontSize: number) => {
      let lines = 0;
      for (const paragraph of value.split("\n")) {
        let current = "";
        lines++;
        for (const word of paragraph.split(/\s+/)) {
          if (font.widthOfTextAtSize(word, fontSize) > w - 5) return false;
          const candidate = current ? `${current} ${word}` : word;
          if (font.widthOfTextAtSize(candidate, fontSize) > w - 5) { lines++; current = word; }
          else current = candidate;
        }
      }
      return lines * fontSize * 1.2 <= h - 4;
    };
    while (size > 7 && !fits(size)) size -= 0.5;
    if (!fits(size)) throw new Error(`The entry in ${key.startsWith("row-") ? "table row " + (Number(key.split("-")[1]) + 1) : template.fields.find(f => f.key === key)?.label ?? "notes"} is too long for this layout. Shorten it before downloading.`);
    const field = form.createTextField(key);
    field.enableMultiline();
    field.setMaxLength(key === "notes" ? 400 : 80);
    field.setText(value);
    field.addToPage(page, { x, y, width: w, height: h, borderColor: border, borderWidth: 0.5, backgroundColor: rgb(1, 1, 1), textColor: ink, font });
    field.setFontSize(size);
  };
  let y = height - 95;
  for (const f of template.fields) {
    page.drawText(f.label, { x: margin, y, size: 9, font: bold, color: ink });
    addField(f.key, margin, y - 29, usable, 24);
    y -= 48;
  }
  y -= 3;
  const totalWeight = template.columns.reduce((sum, c) => sum + c.weight, 0);
  const widths = template.columns.map(c => usable * c.weight / totalWeight);
  const rowHeight = Math.min(30, (y - 173) / template.rows);
  let x = margin;
  template.columns.forEach((col, j) => {
    page.drawRectangle({ x, y: y - 23, width: widths[j], height: 23, color: rgb(0.92, 0.95, 0.97) });
    page.drawText(col.label, { x: x + 5, y: y - 15, size: template.columns.length > 5 ? 8 : 9, font: bold, color: ink });
    x += widths[j];
  });
  y -= 23;
  for (let i = 0; i < template.rows; i++) {
    x = margin;
    template.columns.forEach((_, j) => {
      addField(`row-${i}-${j}`, x, y - rowHeight, widths[j], rowHeight, 8);
      x += widths[j];
    });
    y -= rowHeight;
  }
  y -= 25;
  page.drawText(template.notesLabel, { x: margin, y, size: 9, font: bold, color: ink });
  addField("notes", margin, y - 76, usable, 68, 9);
  form.updateFieldAppearances(font);
  const bytes = await pdf.save();
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}
