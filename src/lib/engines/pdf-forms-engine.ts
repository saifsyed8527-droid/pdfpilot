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

import { assertNotCancelled, visualPageGeometry } from "./pdf-visual-page";
import { createFormFontProvider } from "./pdf-form-fonts";

export type FieldKind = "text" | "checkbox" | "radio" | "listbox" | "dropdown" | "signature";
export type FormValue = string | boolean | string[];
type FormFonts = Awaited<ReturnType<typeof createFormFontProvider>>;

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
  maxLength?: number;
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
  defaultValues?: string[];
  /** Clockwise content rotation within the displayed widget. */
  contentRotation?: number;
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

function pdfColorHex(values: number[]): string | null {
  const channels = values.length === 1 ? [values[0], values[0], values[0]] : values.length === 3 ? values : values.length === 4 ? values.slice(0, 3).map(channel => 1 - Math.min(1, channel + values[3])) : [];
  return channels.length ? "#" + channels.map(channel => Math.round(Math.max(0, Math.min(1, channel)) * 255).toString(16).padStart(2, "0")).join("") : null;
}

export async function assertSupportedForm(pdf: import("pdf-lib").PDFDocument) {
  const { PDFName, PDFDict } = await import("pdf-lib");
  const acro = pdf.catalog.lookup(PDFName.of("AcroForm"));
  if (acro instanceof PDFDict && acro.has(PDFName.of("XFA"))) {
    throw new Error("This PDF uses XFA forms, which this editor cannot preserve. Please export an AcroForm PDF from the original application first.");
  }
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
  await assertSupportedForm(pdfDoc);
  const form = pdfDoc.getForm();
  const acroFields = form.getFields();
  const fieldsByName = new Map(acroFields.map((f) => [f.getName(), f]));
  const results: FormField[] = [];

  pages.forEach((page, pageIndex) => {
    const geometry = visualPageGeometry(page);
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
      const [a, b, c, d, e, f] = geometry.matrix;
      const corners = [[rx1, ry1], [rx1, ry2], [rx2, ry1], [rx2, ry2]].map(([px, py]) => [a * (px - e) + b * (py - f), c * (px - e) + d * (py - f)]);
      const xs = corners.map(p => p[0]), ys = corners.map(p => p[1]);
      const x = Math.min(...xs) * scale;
      const y = (geometry.height - Math.max(...ys)) * scale;
      const width = (Math.max(...xs) - Math.min(...xs)) * scale;
      const height = (Math.max(...ys) - Math.min(...ys)) * scale;
      const mk = dict.lookup(PDFName.of("MK"));
      const widgetRotation = mk instanceof PDFDict ? mk.get(PDFName.of("R")) : undefined;
      const angle = widgetRotation && "asNumber" in widgetRotation ? (widgetRotation as import("pdf-lib").PDFNumber).asNumber() : 0;
      const contentRotation = ((page.getRotation().angle - angle) % 360 + 360) % 360;
      const appearance = acroField.acroField.getDefaultAppearance() ?? "";
      const fontSize = Number(appearance.match(/([\d.]+)\s+Tf/)?.[1]) || 12;
      const colorMatch = [...appearance.matchAll(/((?:\d*\.?\d+\s+){1,4})(rg|g|k)\b/g)].at(-1);
      const textColor = colorMatch ? pdfColorHex(colorMatch[1].trim().split(/\s+/).map(Number)) : null;
      const widgetColor = (key: string) => {
        const array = mk instanceof PDFDict ? mk.lookup(PDFName.of(key)) : undefined;
        return array instanceof PDFArray ? pdfColorHex(array.asArray().map(number => "asNumber" in number ? (number as import("pdf-lib").PDFNumber).asNumber() : 0)) : null;
      };
      const borderStyle = dict.lookup(PDFName.of("BS"));
      const borderSize = borderStyle instanceof PDFDict ? borderStyle.get(PDFName.of("W")) : undefined;

      const base = {
        id: nextFieldId("existing"),
        pageIndex,
        x,
        y,
        width,
        height,
        required: acroField.isRequired?.() ?? false,
        readOnly: acroField.isReadOnly?.() ?? false,
        fontSize,
        contentRotation,
        textColor: textColor ?? "#000000",
        borderColor: widgetColor("BC"),
        borderWidth: borderSize && "asNumber" in borderSize ? (borderSize as import("pdf-lib").PDFNumber).asNumber() : 1,
        fillColor: widgetColor("BG"),
        isExisting: true,
      };

      if (acroField instanceof PDFTextField) {
        results.push({ ...base, kind: "text", name: fieldName, multiline: acroField.isMultiline(), maxLength: acroField.getMaxLength(), defaultValue: acroField.getText() ?? "" });
      } else if (acroField instanceof PDFCheckBox) {
        results.push({ ...base, kind: "checkbox", name: fieldName, defaultValue: acroField.isChecked() ? "true" : "false" });
      } else if (acroField instanceof PDFDropdown) {
        results.push({ ...base, kind: "dropdown", name: fieldName, options: acroField.getOptions(), defaultValue: acroField.getSelected()[0] ?? "" });
      } else if (acroField instanceof PDFOptionList) {
        results.push({ ...base, kind: "listbox", name: fieldName, options: acroField.getOptions(), multiSelect: acroField.isMultiselect(), defaultValues: acroField.getSelected() });
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

/** Apply values after creating new fields so both imported and newly built fields save. */
export async function fillExistingFields(pdfDoc: import("pdf-lib").PDFDocument, values: Record<string, FormValue>, suppliedFonts?: FormFonts, isCancelled?: () => boolean): Promise<void> {
  await assertSupportedForm(pdfDoc);
  const { PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup, PDFOptionList } = await import("pdf-lib");
  const form = pdfDoc.getForm();
  const fonts = suppliedFonts ?? await createFormFontProvider(pdfDoc, form.getFields().map(field => {
    const value = values[field.getName()];
    const options = field instanceof PDFDropdown || field instanceof PDFOptionList ? field.getOptions() : [];
    return [...options, ...(Array.isArray(value) ? value : [String(value ?? "")])].join("\n");
  }).join("\n"));
  for (const field of form.getFields()) {
    assertNotCancelled(isCancelled);
    const name = field.getName();
    if (!(name in values) || field.isReadOnly()) continue;
    const value = values[name];
    try {
      if (field instanceof PDFTextField) {
        const text = String(value ?? "");
        if (text === (field.getText() ?? "")) continue;
        const font = fonts.forText(text, name);
        field.setText(text);
        field.updateAppearances(font);
      } else if (field instanceof PDFCheckBox) {
        if (value === true || value === "true") field.check(); else field.uncheck();
      } else if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
        const selected = Array.isArray(value) ? value : value ? [String(value)] : [];
        const options = field.getOptions();
        if (selected.some(option => !options.includes(option))) throw new Error("Choose one of the available options.");
        if (field instanceof PDFOptionList && !field.isMultiselect() && selected.length > 1) throw new Error("This field allows one selection.");
        if (JSON.stringify(field.getSelected()) === JSON.stringify(selected)) continue;
        const font = fonts.forText([...options, ...selected].join("\n"), name);
        field.clear();
        if (selected.length) field.select(selected);
        field.updateAppearances(font);
      } else if (field instanceof PDFRadioGroup) {
        if (value) field.select(String(value)); else field.clear();
      }
    } catch (error) {
      throw new Error(`Could not save field “${name}”: ${error instanceof Error ? error.message : "Please check its value."}`);
    }
  }
  if (!suppliedFonts) fonts.finish();
}

function fieldPlacement(page: import("pdf-lib").PDFPage, field: FormField, scale: number) {
  const geometry = visualPageGeometry(page);
  const width = field.width / scale, height = field.height / scale;
  const left = field.x / scale, bottom = geometry.height - (field.y + field.height) / scale;
  if (![left, bottom, width, height].every(Number.isFinite) || width <= 0 || height <= 0 || left < -0.01 || bottom < -0.01 || left + width > geometry.width + 0.01 || bottom + height > geometry.height + 0.01) {
    throw new Error(`Move field “${field.name}” fully inside its page before saving.`);
  }
  const [a, b, c, d, e, f] = geometry.matrix;
  const point = (x: number, y: number) => ({ x: a * x + c * y + e, y: b * x + d * y + f });
  const corners = [[left, bottom], [left + width, bottom], [left, bottom + height], [left + width, bottom + height]].map(([x, y]) => point(x, y));
  const border = field.borderColor ? field.borderWidth : 0;
  if (!Number.isFinite(border) || border < 0 || border >= Math.min(width, height)) throw new Error(`Reduce the border width for field “${field.name}”.`);
  // pdf-lib expands the widget rect by half the border on each side.
  const anchor = point(left + border / 2, bottom + border / 2);
  return { ...anchor, width: width - border, height: height - border, borderWidth: border,
    bounds: [Math.min(...corners.map(p => p.x)), Math.min(...corners.map(p => p.y)), Math.max(...corners.map(p => p.x)), Math.max(...corners.map(p => p.y))] };
}

export async function buildNewFields(pdfDoc: import("pdf-lib").PDFDocument, fields: FormField[], scale: number, suppliedFonts?: FormFonts, isCancelled?: () => boolean): Promise<void> {
  await assertSupportedForm(pdfDoc);
  if (!(scale > 0)) throw new Error("Invalid form preview scale.");
  const { rgb, degrees } = await import("pdf-lib");
  const form = pdfDoc.getForm(), pages = pdfDoc.getPages();
  const newFields = fields.filter(field => !field.isExisting);
  if (!newFields.length) return;
  const fonts = suppliedFonts ?? await createFormFontProvider(pdfDoc, newFields.flatMap(field => [...(field.options ?? []), ...(field.defaultValues ?? []), field.defaultValue ?? ""]).join("\n"));
  const radioGroups = new Map<string, ReturnType<typeof form.createRadioGroup>>();
  const listGroups = new Map<string, ReturnType<typeof form.createOptionList>>();
  const usedNames = new Set(form.getFields().map(field => field.getName()));
  for (const field of newFields) {
    assertNotCancelled(isCancelled);
    const name = field.kind === "radio" ? field.groupName || field.name : field.name;
    if (!name.trim()) throw new Error("Every field needs a name before saving.");
    if (usedNames.has(name) && !(field.kind === "radio" && radioGroups.has(name)) && !(field.kind === "listbox" && listGroups.has(name))) throw new Error(`The field name “${name}” is already used. Give this field a unique name.`);
    usedNames.add(name);
    const page = pages[field.pageIndex];
    if (!page) throw new Error(`Field “${name}” refers to a missing page.`);
    const { bounds, ...placement } = fieldPlacement(page, field, scale);
    const rect = { ...placement, rotate: degrees(((page.getRotation().angle % 360) + 360) % 360),
      textColor: rgb(...hexToRgb01(field.textColor)),
      backgroundColor: field.fillColor ? rgb(...hexToRgb01(field.fillColor)) : undefined,
      borderColor: field.borderColor ? rgb(...hexToRgb01(field.borderColor)) : undefined };
    let created: import("pdf-lib").PDFField;
    if (field.kind === "text") {
      const textField = form.createTextField(name);
      const font = fonts.forText(field.defaultValue ?? "", name);
      if (field.multiline) textField.enableMultiline();
      if (field.maxLength !== undefined) textField.setMaxLength(field.maxLength);
      textField.setText(field.defaultValue ?? "");
      textField.addToPage(page, { ...rect, font });
      textField.setFontSize(field.fontSize);
      textField.updateAppearances(font);
      created = textField;
    } else if (field.kind === "checkbox") {
      const checkbox = form.createCheckBox(name);
      checkbox.addToPage(page, rect);
      if (field.defaultValue === "true") checkbox.check();
      created = checkbox;
    } else if (field.kind === "radio") {
      let group = radioGroups.get(name);
      if (!group) { group = form.createRadioGroup(name); radioGroups.set(name, group); }
      const option = field.optionLabel || field.id;
      if (group.getOptions().includes(option)) throw new Error(`Radio group “${name}” needs a different value for each button.`);
      group.addOptionToPage(option, page, rect);
      created = group;
    } else if (field.kind === "dropdown" || field.kind === "listbox") {
      const options = field.options ?? ["Option 1", "Option 2"];
      if (!options.length || options.some(option => !option.trim()) || new Set(options).size !== options.length) throw new Error(`Field “${name}” needs unique, non-empty options.`);
      const previousList = field.kind === "listbox" ? listGroups.get(name) : undefined;
      const choice = field.kind === "dropdown" ? form.createDropdown(name) : previousList ?? form.createOptionList(name);
      if (previousList && JSON.stringify(previousList.getOptions()) !== JSON.stringify(options)) throw new Error(`List boxes named “${name}” must have the same options.`);
      if (!previousList) choice.addOptions(options);
      if (field.kind === "listbox") listGroups.set(name, choice as import("pdf-lib").PDFOptionList);
      if (field.kind === "listbox" && field.multiSelect) (choice as import("pdf-lib").PDFOptionList).enableMultiselect();
      const selected = field.defaultValues ?? (field.defaultValue ? [field.defaultValue] : []);
      if (selected.some(option => !options.includes(option))) throw new Error(`The default selection for “${name}” is not in its options.`);
      const font = fonts.forText(options.join("\n"), name);
      choice.addToPage(page, { ...rect, font });
      choice.setFontSize(field.fontSize);
      if (selected.length) choice.select(selected);
      choice.updateAppearances(font);
      created = choice;
    } else {
      await addSignatureFieldPlaceholder(pdfDoc, page, field, bounds);
      continue;
    }
    if (field.required) created.enableRequired();
    if (field.readOnly) created.enableReadOnly();
  }
  for (const [name, group] of radioGroups) {
    const selected = newFields.find(field => field.kind === "radio" && (field.groupName || field.name) === name && field.defaultValue)?.defaultValue;
    if (selected) group.select(selected);
  }
  if (!suppliedFonts) fonts.finish();
}

/** A genuine unsigned signature placeholder; no certificate signing is implied. */
async function addSignatureFieldPlaceholder(pdfDoc: import("pdf-lib").PDFDocument, page: import("pdf-lib").PDFPage, field: FormField, bounds: number[]) {
  const { PDFName, PDFArray, PDFHexString, PDFDict } = await import("pdf-lib");
  const context = pdfDoc.context;
  const widgetRef = context.register(context.obj({ Type: "Annot", Subtype: "Widget", FT: "Sig", T: PDFHexString.fromText(field.name), Rect: bounds, MK: { R: ((page.getRotation().angle % 360) + 360) % 360 }, P: page.ref, F: 4, Ff: (field.readOnly ? 1 : 0) | (field.required ? 2 : 0) }));
  const acroForm = pdfDoc.catalog.lookup(PDFName.of("AcroForm"), PDFDict);
  acroForm.lookup(PDFName.of("Fields"), PDFArray).push(widgetRef);
  const existingAnnots = page.node.Annots();
  if (existingAnnots) existingAnnots.push(widgetRef);
  else page.node.set(PDFName.of("Annots"), context.obj([widgetRef]));
}

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
  originalFontSizePt?: number;
  originalColor?: string;
  rotation?: number;
  textAngle?: number;
  color: string;
  coverColor: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: "left" | "center" | "right";
  /** Set once the user manually drags a resize handle on the replacement
   *  box; while unset, both the live preview and the export's auto-layout
   *  grow/shrink/wrap the box automatically to fit the current text. */
  manualWidthPt?: number;
}

export function hasFormTextChanges(edit: TextEdit) {
  return edit.newText !== edit.originalText || edit.bold || edit.italic || edit.underline || edit.align !== "left" || edit.manualWidthPt !== undefined || edit.fontSizePt !== (edit.originalFontSizePt ?? edit.fontSizePt) || edit.color !== (edit.originalColor ?? "#000000");
}

/** Uses the same source-text removal as PDF Editor, including its disclosed image fallback. */
export async function applyTextEdits(pdfDoc: import("pdf-lib").PDFDocument, file: File, edits: TextEdit[], isCancelled?: () => boolean, scale = 1.5): Promise<number[]> {
  const changed = edits.filter(hasFormTextChanges);
  if (!changed.length) return [];
  const { StandardFonts, rgb } = await import("pdf-lib");
  const { createEditorTextWriter, prepareTextReplacements } = await import("../editor/text-replacement");
  const { computeAutoTextLayout } = await import("./pdf-content-text");
  const objects: import("../editor/types").PagesObjects = {};
  for (const edit of changed) {
    (objects[edit.pageIndex] ??= []).push({ ...edit, type: "existing-text-edit", rotation: edit.rotation ?? 0, zIndex: 0, source: "native", originalTextAngle: edit.textAngle ?? 0 });
  }
  assertNotCancelled(isCancelled);
  const flattened = await prepareTextReplacements(pdfDoc, file, objects, new Set(changed.map(edit => edit.id)), isCancelled);
  const [normal, bold, italic, boldItalic] = await Promise.all([StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique, StandardFonts.HelveticaBoldOblique].map(name => pdfDoc.embedFont(name)));
  const writer = await createEditorTextWriter(pdfDoc, { normal, bold, italic, boldItalic }, changed.map(edit => edit.newText).join("\n"));
  for (const edit of changed) {
    assertNotCancelled(isCancelled);
    if (!edit.newText.trim()) continue;
    const page = pdfDoc.getPage(edit.pageIndex);
    const availableWidth = edit.manualWidthPt ?? Math.max(edit.originalWidthPt, visualPageGeometry(page).width - edit.x / scale - 24);
    const layout = computeAutoTextLayout(edit.newText, edit.fontSizePt, availableWidth, (text, size) => writer.width(text, size, edit.bold, edit.italic));
    const angle = edit.textAngle ?? 0, radians = angle * Math.PI / 180;
    const boxWidth = edit.manualWidthPt ?? Math.max(edit.originalWidthPt, layout.widthPt);
    for (let i = 0; i < layout.lines.length; i++) {
      const line = layout.lines[i], width = writer.width(line, layout.fontSizePt, edit.bold, edit.italic);
      const shift = edit.align === "center" ? (boxWidth - width) / 2 : edit.align === "right" ? boxWidth - width : 0;
      const down = i * layout.fontSizePt * 1.15;
      const x = edit.originalXPt + Math.cos(radians) * shift + Math.sin(radians) * down;
      const y = edit.originalYPt + Math.sin(radians) * shift - Math.cos(radians) * down;
      await writer.drawLine(page, line, x, y, layout.fontSizePt, angle, edit.color, edit.bold, edit.italic);
      if (edit.underline) {
        const offset = layout.fontSizePt * 0.12;
        const start = { x: x + Math.sin(radians) * offset, y: y - Math.cos(radians) * offset };
        page.drawLine({ start, end: { x: start.x + Math.cos(radians) * width, y: start.y + Math.sin(radians) * width }, thickness: Math.max(0.5, layout.fontSizePt / 16), color: rgb(...hexToRgb01(edit.color)) });
      }
    }
  }
  writer.finish();
  return flattened;
}

export async function exportPdfForm(file: File, options: { fields: FormField[]; values: Record<string, FormValue>; textEdits: TextEdit[]; scale: number; onProgress?: (percent: number) => void; isCancelled?: () => boolean }) {
  const { PDFDocument } = await import("pdf-lib");
  assertNotCancelled(options.isCancelled);
  const pdf = await PDFDocument.load(await file.arrayBuffer());
  await assertSupportedForm(pdf);
  options.onProgress?.(20);
  const flattenedPages = await applyTextEdits(pdf, file, options.textEdits, options.isCancelled, options.scale);
  assertNotCancelled(options.isCancelled);
  options.onProgress?.(45);
  await buildNewFields(pdf, options.fields, options.scale, undefined, options.isCancelled);
  await fillExistingFields(pdf, options.values, undefined, options.isCancelled);
  options.onProgress?.(80);
  assertNotCancelled(options.isCancelled);
  // Explicit appearances above preserve imported fields and embedded Unicode fonts.
  const bytes = await pdf.save({ updateFieldAppearances: false });
  assertNotCancelled(options.isCancelled);
  options.onProgress?.(100);
  return { blob: new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }), flattenedPages };
}
