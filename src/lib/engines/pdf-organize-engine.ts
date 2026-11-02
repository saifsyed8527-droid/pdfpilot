import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFObjectCopier,
  PDFPage,
  PDFPageLeaf,
  PDFRadioGroup,
  PDFRef,
  PDFSignature,
  PDFStream,
  PDFString,
  degrees,
} from "pdf-lib";
import type { PDFObject } from "pdf-lib";
import {
  ORGANIZE_LIMITS,
  type OrganizeSource,
  type OrganizePage,
  type OrganizeOptions,
} from "./pdf-organize-types";
const name = PDFName.of;
function check(options: OrganizeOptions) {
  if (options.signal?.aborted)
    throw new DOMException("Organizing cancelled.", "AbortError");
}
async function checkpoint(options: OrganizeOptions) {
  await new Promise((resolve) => setTimeout(resolve, 0));
  check(options);
}

function namedDestinations(pdf: PDFDocument) {
  const result = new Map<string, PDFObject>(),
    visited = new Set<PDFDict>();
  const legacy = pdf.catalog.lookupMaybe(name("Dests"), PDFDict);
  for (const [key, value] of legacy?.entries() ?? [])
    result.set(key.decodeText(), value);
  const names = pdf.catalog.lookupMaybe(name("Names"), PDFDict);
  const walk = (node: PDFDict, depth: number) => {
    if (visited.has(node)) return;
    if (depth > 40 || visited.size > 10_000)
      throw new Error("This PDF's navigation tree is too complex to organize.");
    visited.add(node);
    const entries = node.lookupMaybe(name("Names"), PDFArray);
    for (let i = 0; entries && i + 1 < entries.size(); i += 2) {
      const key = pdf.context.lookup(entries.get(i));
      if (key instanceof PDFString || key instanceof PDFHexString)
        result.set(key.decodeText(), entries.get(i + 1));
    }
    for (const child of node.lookupMaybe(name("Kids"), PDFArray)?.asArray() ??
      []) {
      const value = pdf.context.lookup(child);
      if (value instanceof PDFDict) walk(value, depth + 1);
    }
  };
  const root = names?.lookupMaybe(name("Dests"), PDFDict);
  if (root) walk(root, 0);
  return result;
}

/** Resolve names before copying so retained internal links refer to real output
 * pages, and links to removed pages cannot point at orphan page objects. */
function destinationResolver(pdf: PDFDocument, selected: Set<string>) {
  const names = namedDestinations(pdf);
  return (input: PDFObject | undefined): PDFArray | undefined => {
    let value = pdf.context.lookup(input);
    for (let depth = 0; depth < 8; depth++) {
      if (
        value instanceof PDFString ||
        value instanceof PDFHexString ||
        value instanceof PDFName
      ) {
        value = pdf.context.lookup(names.get(value.decodeText()));
        continue;
      }
      if (value instanceof PDFDict) {
        value = pdf.context.lookup(value.get(name("D")));
        continue;
      }
      break;
    }
    if (!(value instanceof PDFArray)) return undefined;
    const target = value.get(0);
    return target instanceof PDFRef && selected.has(target.toString())
      ? value
      : undefined;
  };
}

function prepareLinks(
  pdf: PDFDocument,
  indices: Set<number>,
  resolve: ReturnType<typeof destinationResolver>,
) {
  let removed = 0;
  for (const index of indices) {
    const page = pdf.getPage(index);
    for (const ref of page.node.Annots()?.asArray() ?? []) {
      const annotation = pdf.context.lookup(ref, PDFDict);
      if (annotation.has(name("P"))) annotation.set(name("P"), page.ref);
      if (annotation.has(name("Dest"))) {
        const dest = resolve(annotation.get(name("Dest")));
        if (dest) annotation.set(name("Dest"), dest);
        else {
          annotation.delete(name("Dest"));
          removed++;
        }
      }
      const action = annotation.lookupMaybe(name("A"), PDFDict);
      if (action?.get(name("S")) === name("GoTo")) {
        const dest = resolve(action.get(name("D")));
        if (dest) action.set(name("D"), dest);
        else {
          annotation.delete(name("A"));
          removed++;
        }
      }
    }
  }
  return removed;
}

function prepareForm(pdf: PDFDocument, indices: Set<number>) {
  const acro = pdf.catalog.AcroForm();
  if (acro?.has(name("XFA")))
    throw new Error(
      "XFA forms are not supported. Export a standard PDF first.",
    );
  if (pdf.catalog.has(name("Perms")))
    throw new Error(
      "Use an unsigned copy: organizing pages invalidates PDF certification.",
    );
  const form = pdf.getForm(),
    fields = form.getFields();
  if (fields.some((field) => field instanceof PDFSignature))
    throw new Error(
      "Use an unsigned copy: this PDF contains a digital signature field.",
    );
  const widgets = new Map<PDFDict, number>();
  for (const [index, page] of pdf.getPages().entries()) {
    for (const ref of page.node.Annots()?.asArray() ?? []) {
      const widget = pdf.context.lookup(ref, PDFDict);
      if (widget.get(name("Subtype")) === name("Widget")) {
        if (widgets.has(widget))
          throw new Error(
            "This PDF repeats a form widget on multiple pages. Save a repaired copy first.",
          );
        widgets.set(widget, index);
        if (widgets.size > 20_000)
          throw new Error("Use a PDF with fewer than 20,000 form widgets.");
      }
    }
  }
  const known = new Set<PDFDict>();
  for (const field of fields) {
    const original = field.acroField.getWidgets();
    const radioValue =
      field instanceof PDFRadioGroup ? field.getSelected() : undefined;
    for (const widget of original) known.add(widget.dict);
    const keep = original.filter((widget) =>
      indices.has(widgets.get(widget.dict) ?? -1),
    );
    if (!keep.length) {
      form.acroForm.removeField(field.acroField);
      continue;
    }
    if (field.acroField.Kids()) {
      const radioOptions =
        field instanceof PDFRadioGroup
          ? field.acroField.dict.lookupMaybe(name("Opt"), PDFArray)
          : undefined;
      if (radioOptions && radioOptions.size() !== original.length)
        throw new Error(
          "This PDF's radio options do not match their page widgets. Save a repaired copy first.",
        );
      for (let i = original.length - 1; i >= 0; i--)
        if (!keep.includes(original[i])) field.acroField.removeWidget(i);
      if (radioOptions)
        field.acroField.dict.set(
          name("Opt"),
          pdf.context.obj(
            original.flatMap((widget, index) =>
              keep.includes(widget) ? [radioOptions.get(index)] : [],
            ),
          ),
        );
    }
    if (
      field instanceof PDFRadioGroup &&
      radioValue !== undefined &&
      !field.getOptions().includes(radioValue)
    )
      field.clear();
    for (const widget of keep)
      widget.dict.set(name("P"), pdf.getPage(widgets.get(widget.dict)!).ref);
  }
  if (
    [...widgets].some(
      ([widget, index]) => indices.has(index) && !known.has(widget),
    )
  )
    throw new Error(
      "This PDF contains an unsupported form widget. Flatten it before organizing.",
    );
  return form;
}

function copyForm(
  source: PDFDocument,
  output: PDFDocument,
  copier: PDFObjectCopier,
  prefix: string,
  multiple: boolean,
) {
  const form = source.getForm(),
    fields = form.acroForm.getAllFields();
  if (!fields.length) return 0;
  const outForm = output.getForm();
  let outResources = outForm.acroForm.dict.lookupMaybe(name("DR"), PDFDict);
  if (!outResources) {
    outResources = output.context.obj({});
    outForm.acroForm.dict.set(name("DR"), outResources);
  }
  const resources = form.acroForm.dict.lookupMaybe(name("DR"), PDFDict),
    aliases = new Map<string, string>();
  for (const [kind, object] of resources?.entries() ?? []) {
    const dictionary = source.context.lookup(object);
    if (!(dictionary instanceof PDFDict)) continue;
    let target = outResources.lookupMaybe(kind, PDFDict);
    if (!target) {
      target = output.context.obj({});
      outResources.set(kind, target);
    }
    for (const [key, value] of dictionary.entries()) {
      const alias = `${prefix}_${key.decodeText()}`;
      aliases.set(key.decodeText(), name(alias).toString());
      target.set(name(alias), copier.copy(value));
    }
  }
  const rewrite = (value: string, names: Map<string, string>) =>
    value.replace(
      /\/[^\s()[\]<>/%]+/g,
      (token) =>
        names.get(
          token
            .slice(1)
            .replace(/#([\da-f]{2})/gi, (_, hex: string) =>
              String.fromCharCode(parseInt(hex, 16)),
            ),
        ) ?? token,
    );
  // Copy inherited defaults onto terminal fields before placing their roots
  // into the shared output AcroForm. Resource aliases avoid font collisions.
  const rootDA = form.acroForm.dict.get(name("DA"));
  const defaults = new Map(
    fields.map(([field]) => [
      field.dict,
      field.getDefaultAppearance() ??
        (rootDA instanceof PDFString || rootDA instanceof PDFHexString
          ? rootDA.decodeText()
          : undefined),
    ]),
  );
  const terminals = new Map(
    form.getFields().map((field) => [field.acroField.dict, field]),
  );
  for (const [index, [field]] of fields.entries()) {
    const fieldAliases = new Map(aliases);
    // Some valid forms define the DA font only inside their saved appearance.
    // Promote those fonts to AcroForm DR under field-specific names so editing
    // the merged form still finds the correct font, including colliding names.
    for (const widget of terminals.get(field.dict)?.acroField.getWidgets() ??
      []) {
      const normal = source.context.lookup(widget.AP()?.get(name("N")));
      const appearances =
        normal instanceof PDFStream
          ? [normal]
          : normal instanceof PDFDict
            ? normal
                .values()
                .map((value) => source.context.lookup(value))
                .filter(
                  (value): value is PDFStream => value instanceof PDFStream,
                )
            : [];
      for (const appearance of appearances) {
        const fontResources = appearance.dict
          .lookupMaybe(name("Resources"), PDFDict)
          ?.lookupMaybe(name("Font"), PDFDict);
        for (const [key, value] of fontResources?.entries() ?? []) {
          let fonts = outResources.lookupMaybe(name("Font"), PDFDict);
          if (!fonts) {
            fonts = output.context.obj({});
            outResources.set(name("Font"), fonts);
          }
          const alias = `${prefix}_Field${index}_${key.decodeText()}`;
          fonts.set(name(alias), copier.copy(value));
          fieldAliases.set(key.decodeText(), name(alias).toString());
        }
      }
    }
    const inherited = defaults.get(field.dict);
    if (inherited) field.setDefaultAppearance(rewrite(inherited, fieldAliases));
    for (const widget of terminals.get(field.dict)?.acroField.getWidgets() ??
      []) {
      const own = widget.dict.get(name("DA"));
      if (own instanceof PDFString || own instanceof PDFHexString)
        widget.dict.set(
          name("DA"),
          PDFString.of(rewrite(own.decodeText(), fieldAliases)),
        );
    }
    const rootQ = form.acroForm.dict.get(name("Q"));
    if (rootQ && !field.getInheritableAttribute(name("Q")))
      field.dict.set(name("Q"), rootQ);
  }
  const roots = form.acroForm.getFields().map(([, ref]) => copier.copy(ref));
  if (multiple) {
    const wrapper = output.context.obj({
      T: PDFHexString.fromText(prefix),
      Kids: roots,
    });
    const wrapperRef = output.context.register(wrapper);
    for (const ref of roots)
      output.context.lookup(ref, PDFDict).set(name("Parent"), wrapperRef);
    outForm.acroForm.addField(wrapperRef);
  } else for (const ref of roots) outForm.acroForm.addField(ref);
  if (form.acroForm.dict.get(name("NeedAppearances"))?.toString() === "true")
    outForm.acroForm.dict.set(
      name("NeedAppearances"),
      output.context.obj(true),
    );
  const sourceOrder = form.acroForm.dict.lookupMaybe(name("CO"), PDFArray);
  if (sourceOrder) {
    const kept = new Set(fields.map(([, ref]) => ref.toString()));
    const order =
      outForm.acroForm.dict.lookupMaybe(name("CO"), PDFArray) ??
      output.context.obj([]);
    for (const ref of sourceOrder.asArray())
      if (ref instanceof PDFRef && kept.has(ref.toString()))
        order.push(copier.copy(ref));
    if (order.size()) outForm.acroForm.dict.set(name("CO"), order);
  }
  return form.getFields().length;
}

export async function organizePdfPages(
  sources: OrganizeSource[],
  plan: OrganizePage[],
  options: OrganizeOptions = {},
) {
  check(options);
  if (sources.length > ORGANIZE_LIMITS.files)
    throw new Error("Choose up to 20 PDF files.");
  if (!plan.length || plan.length > ORGANIZE_LIMITS.pages)
    throw new Error("Keep between 1 and 1,000 output pages.");
  if (
    new Set(sources.map((s) => s.id)).size !== sources.length ||
    new Set(plan.map((p) => p.id)).size !== plan.length
  )
    throw new Error(
      "The page list contains duplicate identifiers. Reload the files.",
    );
  if (
    sources.some((s) => s.file.size > ORGANIZE_LIMITS.fileBytes) ||
    sources.reduce((sum, s) => sum + s.file.size, 0) >
      ORGANIZE_LIMITS.totalBytes
  )
    throw new Error("Use PDFs up to 100MB each and 200MB in total.");
  const output = await PDFDocument.create(),
    docs = new Map<string, { pdf: PDFDocument; copier: PDFObjectCopier }>();
  let fields = 0,
    removedLinks = 0,
    sourcePages = 0;
  for (const [index, source] of sources.entries()) {
    await checkpoint(options);
    const entries = plan.filter(
      (item) => item.kind === "pdf" && item.fileId === source.id,
    );
    if (!entries.length) continue;
    const pdf = await PDFDocument.load(await source.file.arrayBuffer(), {
      updateMetadata: false,
    }).catch(() => {
      throw new Error(`${source.file.name}: use an unlocked, readable PDF.`);
    });
    sourcePages += pdf.getPageCount();
    if (sourcePages > ORGANIZE_LIMITS.pages)
      throw new Error("The workspace supports up to 1,000 source pages.");
    const indices = new Set<number>();
    for (const entry of entries) {
      const page = entry.originalPageIndex;
      if (
        page === undefined ||
        !Number.isInteger(page) ||
        page < 0 ||
        page >= pdf.getPageCount()
      )
        throw new Error("A selected source page is no longer available.");
      if (indices.has(page))
        throw new Error(
          "Add a second copy of the PDF to repeat one of its pages.",
        );
      indices.add(page);
    }
    prepareForm(pdf, indices);
    const selected = new Set(
      [...indices].map((i) => pdf.getPage(i).ref.toString()),
    );
    removedLinks += prepareLinks(
      pdf,
      indices,
      destinationResolver(pdf, selected),
    );
    const copier = PDFObjectCopier.for(pdf.context, output.context);
    fields += copyForm(
      pdf,
      output,
      copier,
      `File${index + 1}`,
      sources.length > 1,
    );
    docs.set(source.id, { pdf, copier });
    if (sources.length === 1) {
      if (pdf.context.trailerInfo.Info)
        output.context.trailerInfo.Info = copier.copy(
          pdf.context.trailerInfo.Info,
        );
      const metadata = pdf.catalog.get(name("Metadata"));
      if (metadata) output.catalog.set(name("Metadata"), copier.copy(metadata));
    }
    options.onProgress?.(5 + (20 * (index + 1)) / sources.length);
  }
  for (const [index, item] of plan.entries()) {
    if (index % 10 === 0) await checkpoint(options);
    if (!Number.isFinite(item.rotation) || item.rotation % 90)
      throw new Error("Rotate pages in 90-degree steps.");
    if (item.kind === "blank") {
      const width = item.width ?? 595.28,
        height = item.height ?? 841.89;
      if (
        ![width, height].every(
          (n) => Number.isFinite(n) && n >= 14 && n <= 14400,
        )
      )
        throw new Error("The blank page size is not supported.");
      output
        .addPage([width, height])
        .setRotation(degrees(((item.rotation % 360) + 360) % 360));
    } else {
      const source = item.fileId && docs.get(item.fileId);
      if (!source || item.originalPageIndex === undefined)
        throw new Error("A source PDF is no longer available.");
      const ref = source.copier.copy(
        source.pdf.getPage(item.originalPageIndex).ref,
      );
      const leaf = output.context.lookup(ref);
      if (!(leaf instanceof PDFPageLeaf))
        throw new Error("A source page could not be copied safely.");
      const page = PDFPage.of(leaf, ref, output);
      page.setRotation(
        degrees(
          (((page.getRotation().angle + item.rotation) % 360) + 360) % 360,
        ),
      );
      output.addPage(page);
    }
    options.onProgress?.(25 + (65 * (index + 1)) / plan.length);
  }
  await checkpoint(options);
  const bytes = await output.save({
    addDefaultPage: false,
    updateFieldAppearances: false,
  });
  check(options);
  if (bytes.byteLength > ORGANIZE_LIMITS.totalBytes)
    throw new Error(
      "The organized PDF exceeds 200MB. Use fewer pages or files.",
    );
  options.onProgress?.(100);
  return {
    blob: new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }),
    pageCount: plan.length,
    fieldCount: fields,
    removedLinks,
  };
}
