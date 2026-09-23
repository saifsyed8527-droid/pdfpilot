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

export interface DetectedCandidate {
  id: string;
  kind: "text" | "checkbox";
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Real, honest heuristic detection - not a fake placeholder generator and
 * not an AI model. It looks for two concrete, common visual patterns in a
 * scanned/rasterized form page:
 *   1. Horizontal "write here" lines - a long, thin, mostly-solid run of
 *      dark pixels (an underline), which becomes a text-field candidate
 *      sitting just above it (where handwriting/typing would go).
 *   2. Small hollow squares - a small box whose 4 edges are dark but whose
 *      interior is mostly light, which becomes a checkbox candidate.
 * Both are implemented as direct pixel-darkness scans over the already-
 * rendered page canvas (see PagesCandidateScan below), not a trained
 * model - so it reliably catches classic ruled/underlined forms and
 * simple checkbox grids, and, honestly, will miss stylized, low-contrast,
 * or unconventional form layouts. Every candidate is fully editable
 * (move/resize/delete/retype) before export - it never silently becomes
 * a real field.
 */
export function detectCandidateFields(canvas: HTMLCanvasElement): DetectedCandidate[] {
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);
  const DARK_THRESHOLD = 140; // 0-255 luminance
  const isDark = (xRaw: number, yRaw: number) => {
    // Sample points are frequently fractional (e.g. `x + t * size` for
    // t in [0,1]) - Uint8ClampedArray silently returns `undefined` for a
    // non-integer index, which would make every fractional sample read as
    // "not dark" regardless of the actual pixel, so every coordinate must
    // be rounded to the nearest pixel before indexing.
    const x = Math.round(xRaw);
    const y = Math.round(yRaw);
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const i = (y * width + x) * 4;
    const luminance = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    return luminance < DARK_THRESHOLD;
  };

  const candidates: DetectedCandidate[] = [];

  // --- Horizontal line detection (text field candidates) ---
  const MIN_LINE_WIDTH = Math.max(40, width * 0.06);
  const usedRows = new Set<number>();
  for (let y = 0; y < height; y += 2) {
    if (usedRows.has(y)) continue;
    let runStart = -1;
    let x = 0;
    while (x < width) {
      if (isDark(x, y)) {
        if (runStart === -1) runStart = x;
      } else if (runStart !== -1) {
        const runLength = x - runStart;
        if (runLength >= MIN_LINE_WIDTH) {
          // Confirm this is a thin line (row above/below mostly light) -
          // rejects text (which is dark in a taller band) and table
          // borders that repeat every few rows (checked via a quick look
          // 6px up).
          const isThinLine = !isDark(runStart + runLength / 2, y - 4) && !isDark(runStart + runLength / 2, y + 4);
          if (isThinLine) {
            candidates.push({
              id: nextFieldId("detect_text"),
              kind: "text",
              x: runStart,
              y: y - 22,
              width: runLength,
              height: 22,
            });
            for (let dy = -1; dy <= 1; dy++) usedRows.add(y + dy);
          }
        }
        runStart = -1;
      }
      x += 1;
    }
  }

  // --- Small hollow square detection (checkbox candidates), coarse stride ---
  const SIZE_MIN = 12;
  const SIZE_MAX = 26;
  const STRIDE = 6;
  const usedCenters: { x: number; y: number }[] = [];
  for (let size = SIZE_MIN; size <= SIZE_MAX; size += 4) {
    for (let y = 0; y < height - size; y += STRIDE) {
      for (let x = 0; x < width - size; x += STRIDE) {
        const cx = x + size / 2;
        const cy = y + size / 2;
        if (usedCenters.some((c) => Math.abs(c.x - cx) < size && Math.abs(c.y - cy) < size)) continue;

        const edgeSamples = 6;
        let edgeDark = 0;
        for (let s = 0; s < edgeSamples; s++) {
          const t = s / (edgeSamples - 1);
          if (isDark(x + t * size, y)) edgeDark += 1;
          if (isDark(x + t * size, y + size)) edgeDark += 1;
          if (isDark(x, y + t * size)) edgeDark += 1;
          if (isDark(x + size, y + t * size)) edgeDark += 1;
        }
        const edgeRatio = edgeDark / (edgeSamples * 4);
        if (edgeRatio < 0.75) continue;

        let interiorDark = 0;
        const interiorSamples = 4;
        for (let s = 0; s < interiorSamples; s++) {
          for (let t = 0; t < interiorSamples; t++) {
            const ix = x + size * 0.25 + (size * 0.5 * s) / (interiorSamples - 1);
            const iy = y + size * 0.25 + (size * 0.5 * t) / (interiorSamples - 1);
            if (isDark(ix, iy)) interiorDark += 1;
          }
        }
        const interiorRatio = interiorDark / (interiorSamples * interiorSamples);
        if (interiorRatio > 0.3) continue;

        candidates.push({ id: nextFieldId("detect_check"), kind: "checkbox", x, y, width: size, height: size });
        usedCenters.push({ x: cx, y: cy });
      }
    }
  }

  return candidates;
}
