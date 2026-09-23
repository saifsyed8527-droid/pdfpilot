/**
 * PDF Forms engine: extracts existing AcroForm fields (with their real
 * on-page geometry, for Fill mode) and creates/exports new AcroForm fields
 * (for Edit/build mode) - genuine interactive fields via pdf-lib's form
 * API, not decorative boxes.
 *
 * Existing-field geometry extraction has no high-level pdf-lib API (the
 * high-level `PDFField` classes expose values/options but not per-widget
 * page + rect), so it walks each page's raw /Annots array directly - the
 * same low-level technique already proven in pdf-watermark-engine.ts and
 * Edit PDF's pdf-export.ts (Link annotations, Outlines) for reading/
 * writing PDF structures pdf-lib's public API doesn't cover. A field name
 * is resolved by walking /Parent (radio-button widgets typically carry no
 * /T of their own - only their parent field does), and a radio widget's
 * option value is resolved from the parent field's /Opt array (indexed by
 * the widget's position in /Kids, per PDF spec 12.7.4.2.3) when present,
 * falling back to the widget's own /AP /N appearance-state name otherwise.
 * The /Opt path matters because pdf-lib's own createRadioGroup() writes
 * auto-incrementing "0"/"1"/... as the actual appearance-state names while
 * storing the caller's real option label only in /Opt - so reading /AP /N
 * alone would misreport every radio group pdf-lib itself creates
 * (including this app's own exports) as options "0", "1", etc.
 */

export type FieldKind = "text" | "checkbox" | "radio" | "listbox" | "dropdown" | "signature";

export interface FormField {
  id: string;
  kind: FieldKind;
  name: string;
  groupName?: string;
  optionLabel?: string;
  options?: string[];
  pageIndex: number;
  /** Canvas-px at RENDER_SCALE, top-left origin, Y down - same convention as Edit PDF's object model. */
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  readOnly: boolean;
  multiline?: boolean;
  multiSelect?: boolean;
  /** UI-only metadata (see report): the reference's "Include Field Indicator"
   *  has no PDF-standard equivalent, so this drives a small on-canvas
   *  badge in the editor rather than a written PDF flag. */
  includeIndicator?: boolean;
  fontSize: number;
  textColor: string;
  borderColor: string | null;
  borderWidth: number;
  fillColor: string | null;
  defaultValue?: string;
  /** True for a field imported from the source PDF's own AcroForm - kept
   *  distinct from a newly-placed field so export never tries to
   *  "re-create" it (it's filled/edited in place instead). */
  isExisting: boolean;
}

let counter = 0;
export function nextFieldId(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter}_${Date.now().toString(36)}`;
}

function hexToRgb01(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [r, g, b];
}

/** Extracts every existing AcroForm field's real per-widget geometry, type,
 *  current value, and options - one FormField per widget (so a radio
 *  group with 3 widgets yields 3 FormFields sharing a groupName). */
export async function extractExistingFields(
  pdfDoc: import("pdf-lib").PDFDocument,
  scale: number
): Promise<FormField[]> {
  const { PDFName, PDFArray, PDFDict, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup, PDFOptionList } = await import("pdf-lib");
  const pages = pdfDoc.getPages();
  const form = pdfDoc.getForm();
  const acroFields = form.getFields();
  const fieldsByName = new Map(acroFields.map((f) => [f.getName(), f]));
  const results: FormField[] = [];

  pages.forEach((page, pageIndex) => {
    const { height: pageHeightPt } = page.getSize();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- PDFPageLeaf's raw dict accessors aren't part of the narrow public PDFPage type
    const annots = (page.node as any).Annots();
    if (!(annots instanceof PDFArray)) return;

    for (let i = 0; i < annots.size(); i++) {
      const ref = annots.get(i);
      const dict = pdfDoc.context.lookup(ref);
      if (!(dict instanceof PDFDict)) continue;
      if (dict.get(PDFName.of("Subtype"))?.toString() !== "/Widget") continue;

      // Resolve the fully-qualified field name by walking /Parent - a
      // radio-button widget usually has no /T of its own.
      const nameParts: string[] = [];
      let cursor: import("pdf-lib").PDFDict | undefined = dict;
      let guard = 0;
      while (cursor && guard < 10) {
        guard += 1;
        const t = cursor.get(PDFName.of("T"));
        if (t) {
          const text = "decodeText" in t && typeof t.decodeText === "function" ? t.decodeText() : t.toString();
          nameParts.unshift(text);
        }
        const parentRef = cursor.get(PDFName.of("Parent"));
        cursor = parentRef ? (pdfDoc.context.lookup(parentRef) as import("pdf-lib").PDFDict | undefined) : undefined;
      }
      const fieldName = nameParts.join(".");
      const acroField = fieldsByName.get(fieldName);
      if (!acroField) continue;

      const rect = dict.get(PDFName.of("Rect"));
      if (!(rect instanceof PDFArray) || rect.size() !== 4) continue;
      const [rx1, ry1, rx2, ry2] = [0, 1, 2, 3].map((idx) => {
        const n = rect.get(idx);
        return "asNumber" in n && typeof n.asNumber === "function" ? n.asNumber() : 0;
      });
      const xPt = Math.min(rx1, rx2);
      const yPt = Math.min(ry1, ry2);
      const widthPt = Math.abs(rx2 - rx1);
      const heightPt = Math.abs(ry2 - ry1);
      // pdf points -> canvas px: same origin flip used throughout this
      // app's editors (PDF Y-up -> canvas Y-down).
      const x = xPt * scale;
      const y = (pageHeightPt - yPt - heightPt) * scale;
      const width = widthPt * scale;
      const height = heightPt * scale;

      const base = {
        id: nextFieldId("existing"),
        pageIndex,
        x,
        y,
        width,
        height,
        required: acroField.isRequired?.() ?? false,
        readOnly: acroField.isReadOnly?.() ?? false,
        fontSize: 12,
        textColor: "#000000",
        borderColor: "#94a3b8",
        borderWidth: 1,
        fillColor: null,
        isExisting: true,
      };

      if (acroField instanceof PDFTextField) {
        results.push({ ...base, kind: "text", name: fieldName, multiline: acroField.isMultiline(), defaultValue: acroField.getText() ?? "" });
      } else if (acroField instanceof PDFCheckBox) {
        results.push({ ...base, kind: "checkbox", name: fieldName, defaultValue: acroField.isChecked() ? "true" : "false" });
      } else if (acroField instanceof PDFDropdown) {
        results.push({ ...base, kind: "dropdown", name: fieldName, options: acroField.getOptions(), defaultValue: acroField.getSelected()[0] ?? "" });
      } else if (acroField instanceof PDFOptionList) {
        results.push({ ...base, kind: "listbox", name: fieldName, options: acroField.getOptions(), multiSelect: acroField.isMultiselect?.() ?? false, defaultValue: (acroField.getSelected() ?? [])[0] ?? "" });
      } else if (acroField instanceof PDFRadioGroup) {
        // This widget's own /AS-derived appearance-state name (e.g. "Yes",
        // or pdf-lib's auto-assigned "0"/"1") is a safe fallback, but it is
        // NOT the same as the field's meaningful export value whenever the
        // parent field carries an /Opt array (per PDF spec 12.7.4.2.3,
        // Opt[i] is the friendly export value for the widget at position i
        // of /Kids) - which is exactly what pdf-lib's own
        // createRadioGroup()/addOptionToPage() writes, using "0"/"1"/...
        // as the actual appearance-state names while storing the caller's
        // real option label in Opt. Without resolving via Opt, a radio
        // group built by pdf-lib (including PDFPilot's own exports) would
        // read back as option "0"/"1" and never match getSelected().
        const ap = dict.get(PDFName.of("AP"));
        let optionLabel = "";
        if (ap instanceof PDFDict) {
          const n = ap.get(PDFName.of("N"));
          if (n instanceof PDFDict) {
            const keys = n.keys().map((k) => k.decodeText?.() ?? k.toString());
            optionLabel = keys.find((k) => k !== "Off") ?? "";
          }
        }
        const parentDict = pdfDoc.context.lookup(dict.get(PDFName.of("Parent"))) ?? dict;
        if (parentDict instanceof PDFDict) {
          const opt = parentDict.get(PDFName.of("Opt"));
          const kids = parentDict.get(PDFName.of("Kids"));
          if (opt instanceof PDFArray && kids instanceof PDFArray) {
            const widgetIndex = Array.from({ length: kids.size() }, (_, k) => kids.get(k)).findIndex((k) => k.toString() === ref.toString());
            if (widgetIndex !== -1) {
              const optEntry = opt.get(widgetIndex);
              if (optEntry && "decodeText" in optEntry && typeof optEntry.decodeText === "function") {
                optionLabel = optEntry.decodeText();
              }
            }
          }
        }
        results.push({ ...base, kind: "radio", name: `${fieldName}__${optionLabel || i}`, groupName: fieldName, optionLabel, defaultValue: acroField.getSelected() === optionLabel ? optionLabel : "" });
      } else {
        // Signature or other unsupported field kind: still surfaced (read-only) so it's visible and honestly labeled, not silently dropped.
        results.push({ ...base, kind: "signature", name: fieldName, readOnly: true });
      }
    }
  });

  return results;
}

/** Applies Fill-mode values onto a document's EXISTING AcroForm fields
 *  only (does not touch newly-placed fields - see exportBuiltFields). */
export async function fillExistingFields(pdfDoc: import("pdf-lib").PDFDocument, values: Record<string, string | boolean>): Promise<void> {
  const form = pdfDoc.getForm();
  for (const field of form.getFields()) {
    const name = field.getName();
    if (!(name in values)) continue;
    const value = values[name];
    try {
      const { PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup, PDFOptionList } = await import("pdf-lib");
      if (field instanceof PDFTextField) field.setText(String(value ?? ""));
      else if (field instanceof PDFCheckBox) { if (value) field.check(); else field.uncheck(); }
      else if (field instanceof PDFDropdown && value) field.select(String(value));
      else if (field instanceof PDFOptionList && value) field.select(String(value));
      else if (field instanceof PDFRadioGroup && value) field.select(String(value));
    } catch (error) {
      console.error(`Error filling field "${name}":`, error);
    }
  }
}

/** Creates real, new AcroForm fields for every non-existing FormField -
 *  mirrors the verified-working creation logic from Edit PDF's
 *  pdf-export.ts (including addToPage-before-setFontSize, discovered
 *  there as a real pdf-lib ordering requirement). */
export async function buildNewFields(
  pdfDoc: import("pdf-lib").PDFDocument,
  fields: FormField[],
  scale: number
): Promise<void> {
  const { rgb } = await import("pdf-lib");
  const form = pdfDoc.getForm();
  const pages = pdfDoc.getPages();
  const radioGroups = new Map<string, ReturnType<typeof form.createRadioGroup>>();
  const listGroups = new Map<string, ReturnType<typeof form.createOptionList>>();

  for (const field of fields) {
    if (field.isExisting) continue;
    const page = pages[field.pageIndex];
    if (!page) continue;
    const { height: pageHeightPt } = page.getSize();
    const toPdfX = (px: number) => px / scale;
    const toPdfY = (px: number) => pageHeightPt - px / scale;
    const toPt = (px: number) => px / scale;

    const rect = {
      x: toPdfX(field.x),
      y: toPdfY(field.y + field.height),
      width: toPt(field.width),
      height: toPt(field.height),
      textColor: field.textColor ? rgb(...hexToRgb01(field.textColor)) : undefined,
      backgroundColor: field.fillColor ? rgb(...hexToRgb01(field.fillColor)) : undefined,
      borderColor: field.borderColor ? rgb(...hexToRgb01(field.borderColor)) : undefined,
      borderWidth: field.borderColor ? field.borderWidth : 0,
    };

    if (field.kind === "text") {
      const textField = form.createTextField(field.name);
      if (field.multiline) textField.enableMultiline();
      if (field.defaultValue) textField.setText(field.defaultValue);
      // addToPage first: it's what gives the widget its /DA (default
      // appearance) entry - calling setFontSize before that throws
      // pdf-lib's MissingDAEntryError (found and fixed the same issue in
      // Edit PDF's form-field export).
      textField.addToPage(page, rect);
      textField.setFontSize(field.fontSize);
      if (field.required) textField.enableRequired();
      if (field.readOnly) textField.enableReadOnly();
    } else if (field.kind === "checkbox") {
      const checkBox = form.createCheckBox(field.name);
      checkBox.addToPage(page, rect);
      if (field.defaultValue === "true") checkBox.check();
      if (field.required) checkBox.enableRequired();
      if (field.readOnly) checkBox.enableReadOnly();
    } else if (field.kind === "radio") {
      const groupName = field.groupName || field.name;
      let group = radioGroups.get(groupName);
      if (!group) {
        group = form.createRadioGroup(groupName);
        radioGroups.set(groupName, group);
      }
      group.addOptionToPage(field.optionLabel || field.id, page, rect);
      if (field.required) group.enableRequired();
      if (field.readOnly) group.enableReadOnly();
    } else if (field.kind === "dropdown") {
      const dropdown = form.createDropdown(field.name);
      dropdown.addOptions(field.options ?? ["Option 1", "Option 2"]);
      dropdown.addToPage(page, rect);
      if (field.defaultValue) dropdown.select(field.defaultValue);
      if (field.required) dropdown.enableRequired();
      if (field.readOnly) dropdown.enableReadOnly();
    } else if (field.kind === "listbox") {
      const groupName = field.name;
      let list = listGroups.get(groupName);
      if (!list) {
        list = form.createOptionList(groupName);
        list.addOptions(field.options ?? ["Option 1", "Option 2"]);
        if (field.multiSelect) list.enableMultiselect();
        listGroups.set(groupName, list);
      }
      list.addToPage(page, rect);
      if (field.required) list.enableRequired();
      if (field.readOnly) list.enableReadOnly();
    } else if (field.kind === "signature") {
      await addSignatureFieldPlaceholder(pdfDoc, page, field, scale);
    }
  }
}

/** pdf-lib's form API can only READ an existing signature field
 *  (`form.getSignature`), not create one - there is no cryptographic
 *  signing capability here or anywhere client-side without a private key
 *  the user supplies out-of-band. What this builds is a genuine,
 *  standards-compliant `/FT /Sig` field placeholder (a real AcroForm
 *  field + widget annotation, addable to /Fields, that any PDF viewer
 *  will recognize as "this document has a place to sign") - constructed
 *  via the same low-level PDFDict/PDFArray technique used for Link
 *  annotations and Outlines, since pdf-lib's high-level API doesn't cover
 *  it. It is explicitly NOT a signed or fillable-by-typing field, and the
 *  editor/report both say so rather than implying real e-signing. */
async function addSignatureFieldPlaceholder(pdfDoc: import("pdf-lib").PDFDocument, page: import("pdf-lib").PDFPage, field: FormField, scale: number) {
  const { PDFName, PDFArray, PDFString } = await import("pdf-lib");
  const context = pdfDoc.context;
  const { height: pageHeightPt } = page.getSize();
  const xPt = field.x / scale;
  const yPt = pageHeightPt - field.y / scale - field.height / scale;
  const widthPt = field.width / scale;
  const heightPt = field.height / scale;

  // AcroForm field-flag bits (PDF spec table 221): bit 1 (value 1) = ReadOnly,
  // bit 2 (value 2) = Required. pdf-lib's high-level enableReadOnly()/
  // enableRequired() aren't available here since this field is built by hand
  // (no createSignature API exists), so the /Ff bitmask is written directly -
  // the same requirement applies to every other field kind, and skipping it
  // here would silently drop these flags for signature fields only.
  let fieldFlags = 0;
  if (field.readOnly) fieldFlags |= 1;
  if (field.required) fieldFlags |= 2;

  const widgetDict = context.obj({
    Type: "Annot",
    Subtype: "Widget",
    FT: "Sig",
    T: PDFString.of(field.name),
    Rect: [xPt, yPt, xPt + widthPt, yPt + heightPt],
    F: 4,
    Ff: fieldFlags,
  });
  const widgetRef = context.register(widgetDict);

  const acroForm = pdfDoc.catalog.lookup(PDFName.of("AcroForm"));
  if (acroForm && "get" in acroForm) {
    const fieldsArr = (acroForm as import("pdf-lib").PDFDict).get(PDFName.of("Fields"));
    if (fieldsArr instanceof PDFArray) fieldsArr.push(widgetRef);
  }

  const existingAnnots = page.node.Annots();
  if (existingAnnots instanceof PDFArray) existingAnnots.push(widgetRef);
  else page.node.set(PDFName.of("Annots"), context.obj([widgetRef]));
}

// ---------------------------------------------------------------------------
// Edit Text: in-place editing of a text-based PDF's own native text. There
// is no reliable, general way to rewrite an arbitrary PDF's existing
// content-stream text operators client-side (no pdf-lib API for it, and no
// client-side library parses/rewrites arbitrary content streams safely
// across the full range of real-world PDF producers) - so, like Edit PDF's
// Advanced Edit mode, this uses the same disclosed, real strategy: cover the
// original run with a rectangle sampled from the actual page background
// color, then redraw the replacement text at the run's own PDF-space
// coordinates. `extractPageTextRuns` (from the Edit PDF codebase, reused
// as-is here since it's a page-agnostic pdfjs utility) already does the
// hard part - matrix-combining pdfjs's text transform with the render
// viewport to get both the canvas-px click target and the PDF-point
// coordinates in one pass.
// ---------------------------------------------------------------------------
export interface TextEdit {
  id: string;
  runId: string;
  pageIndex: number;
  /** Canvas-px overlay box for the click target / live preview, same
   *  scale/origin convention as FormField. */
  x: number;
  y: number;
  width: number;
  height: number;
  originalText: string;
  newText: string;
  originalXPt: number;
  originalYPt: number;
  originalWidthPt: number;
  originalHeightPt: number;
  fontSizePt: number;
  color: string;
  coverColor: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: "left" | "center" | "right";
}

/** Applies every touched TextEdit (newText !== originalText) to the
 *  document: cover the original run, redraw the replacement at the same
 *  PDF-space coordinates. Untouched runs are skipped entirely - the
 *  original content stream is left byte-for-byte alone unless the user
 *  actually changed that specific run's text, exactly like Edit PDF's
 *  existing-text-edit export path. */
export async function applyTextEdits(pdfDoc: import("pdf-lib").PDFDocument, edits: TextEdit[]): Promise<void> {
  const { StandardFonts, rgb } = await import("pdf-lib");
  const pages = pdfDoc.getPages();
  const fontCache = new Map<string, Awaited<ReturnType<typeof pdfDoc.embedFont>>>();
  const getFont = async (bold: boolean, italic: boolean) => {
    const key = `${bold}-${italic}`;
    const cached = fontCache.get(key);
    if (cached) return cached;
    const std =
      bold && italic
        ? StandardFonts.HelveticaBoldOblique
        : bold
          ? StandardFonts.HelveticaBold
          : italic
            ? StandardFonts.HelveticaOblique
            : StandardFonts.Helvetica;
    const font = await pdfDoc.embedFont(std);
    fontCache.set(key, font);
    return font;
  };

  for (const edit of edits) {
    if (edit.newText === edit.originalText) continue;
    const page = pages[edit.pageIndex];
    if (!page) continue;

    const [cr, cg, cb] = hexToRgb01(edit.coverColor);
    page.drawRectangle({
      x: edit.originalXPt - 1,
      y: edit.originalYPt - edit.fontSizePt * 0.25,
      width: edit.originalWidthPt + 2,
      height: edit.originalHeightPt,
      color: rgb(cr, cg, cb),
    });

    if (!edit.newText.trim()) continue;
    const font = await getFont(edit.bold, edit.italic);
    const [r, g, b] = hexToRgb01(edit.color);
    const textWidth = font.widthOfTextAtSize(edit.newText, edit.fontSizePt);
    let x = edit.originalXPt;
    if (edit.align === "center") x = edit.originalXPt + (edit.originalWidthPt - textWidth) / 2;
    else if (edit.align === "right") x = edit.originalXPt + (edit.originalWidthPt - textWidth);

    page.drawText(edit.newText, { x, y: edit.originalYPt, size: edit.fontSizePt, font, color: rgb(r, g, b) });

    if (edit.underline) {
      const offset = edit.fontSizePt * 0.12;
      page.drawLine({
        start: { x, y: edit.originalYPt - offset },
        end: { x: x + textWidth, y: edit.originalYPt - offset },
        thickness: Math.max(0.5, edit.fontSizePt / 16),
        color: rgb(r, g, b),
      });
    }
  }
}
