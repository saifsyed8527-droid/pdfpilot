/**
 * PDF Engine — the single place PDF tools depend on pdf-lib's PDFDocument
 * API. Every existing tool (merge, split, delete-pages, etc.) inlines its
 * own `await import("pdf-lib"); PDFDocument.load(...)` boilerplate; that
 * pattern is left untouched (it already works, already ships, rewriting 16
 * production tools for no functional gain is not this sprint's job). New
 * Phase 2 PDF tools should depend on this engine instead of repeating that
 * boilerplate a 17th, 18th, ... 300th time — the same "never duplicate
 * business logic" rule the Document Conversion Suite sprint established for
 * shared utilities (see pdf-text-extraction.ts) applied one layer down, to
 * the library itself rather than to one specific conversion's logic.
 *
 * Every export here wraps a pdf-lib capability verified directly against
 * node_modules/pdf-lib/es/api/PDFDocument.d.ts — nothing here is assumed.
 * pdf-lib is still dynamically imported inside each function (not at module
 * top level), preserving the project's established code-splitting pattern.
 */

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
}

async function loadPdfDocument(file: File) {
  const { PDFDocument } = await import("pdf-lib");
  const arrayBuffer = await file.arrayBuffer();
  return PDFDocument.load(arrayBuffer);
}

async function toBlob(pdf: Awaited<ReturnType<typeof loadPdfDocument>>): Promise<Blob> {
  const bytes = await pdf.save();
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}

/** Apply quarter-turn deltas to selected zero-based pages without rasterizing. */
export async function rotatePdfPages(
  file: File,
  rotations: Record<number, number>,
  onProgress?: (done: number, total: number) => void,
  isCancelled: () => boolean = () => false
): Promise<Blob | null> {
  if (isCancelled()) return null;
  const { PDFDocument, degrees } = await import("pdf-lib");
  const bytes = await file.arrayBuffer();
  if (isCancelled()) return null;
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  if (isCancelled()) return null;
  const pages = pdf.getPages();
  if (pages.length === 0) throw new Error("This PDF does not contain any pages.");
  for (const [key, angle] of Object.entries(rotations)) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index >= pages.length) {
      throw new Error("Select pages that exist in this PDF.");
    }
    if (!Number.isFinite(angle) || angle % 90 !== 0) {
      throw new Error("Page rotation must be a multiple of 90 degrees.");
    }
  }
  for (let index = 0; index < pages.length; index++) {
    if (isCancelled()) return null;
    const angle = pages[index].getRotation().angle + (rotations[index] ?? 0);
    pages[index].setRotation(degrees(((angle % 360) + 360) % 360));
    onProgress?.(index + 1, pages.length);
    // Let cancel events run during long documents, as well as during save.
    if ((index + 1) % 25 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (isCancelled()) return null;
  const output = await pdf.save({ addDefaultPage: false });
  if (isCancelled()) return null;
  return new Blob([output as unknown as BlobPart], { type: "application/pdf" });
}

/** Keep original page objects and their native forms/local destinations together.
 * This operates on a fresh load for each output and never flattens a field. */
export async function retainPdfPages(
  pdf: Awaited<ReturnType<typeof loadPdfDocument>>,
  pageIndices: number[],
  onProgress?: (done: number, total: number) => void,
  isCancelled: () => boolean = () => false
): Promise<Uint8Array | null> {
  const { PDFArray, PDFDict, PDFName, PDFNumber, PDFRef, PDFStream, PDFString, PDFHexString } = await import("pdf-lib");
  const key = PDFName.of;
  const pages = pdf.getPages();
  const keep = new Set(pageIndices);
  if (!keep.size || keep.size !== pageIndices.length || pageIndices.some((index) => !Number.isInteger(index) || index < 0 || index >= pages.length)) {
    throw new Error("Select distinct pages that exist in this PDF.");
  }
  const keptRefs = new Set(pageIndices.map((index) => pages[index].ref));
  const widgetPages = new Map<import("pdf-lib").PDFDict, number>();
  for (let index = 0; index < pages.length; index++) {
    for (const entry of pages[index].node.Annots()?.asArray() ?? []) {
      const annotation = pdf.context.lookup(entry);
      if (annotation instanceof PDFDict && annotation.get(key("Subtype")) === key("Widget")) widgetPages.set(annotation, index);
    }
  }
  const acroForm = pdf.catalog.lookupMaybe(key("AcroForm"), PDFDict);
  if (acroForm?.has(key("XFA"))) throw new Error("This PDF uses XFA forms, which cannot be preserved by this page operation.");
  const removedFields = new Set<import("pdf-lib").PDFRef>();
  const pruneField = (entry: import("pdf-lib").PDFObject): boolean => {
    const field = pdf.context.lookup(entry);
    if (!(field instanceof PDFDict)) return true;
    const owner = widgetPages.get(field);
    let retained = owner === undefined || keep.has(owner);
    if (owner !== undefined && retained) field.set(key("P"), pages[owner].ref);
    const kids = field.lookupMaybe(key("Kids"), PDFArray);
    if (kids) {
      const options = field.lookupMaybe(key("Opt"), PDFArray);
      const alignedOptions = field.get(key("FT")) === key("Btn") && options?.size() === kids.size();
      for (let index = kids.size() - 1; index >= 0; index--) {
        if (!pruneField(kids.get(index))) {
          kids.remove(index);
          if (alignedOptions) options?.remove(index);
        }
      }
      if (!kids.size()) retained = false;
      const value = field.get(key("V"));
      if (retained && field.get(key("FT")) === key("Btn") && value instanceof PDFName && value !== key("Off")) {
        const available = kids.asArray().some((entry) => {
          const widget = pdf.context.lookup(entry);
          const appearance = widget instanceof PDFDict ? widget.lookupMaybe(key("AP"), PDFDict)?.lookupMaybe(key("N"), PDFDict) : undefined;
          return appearance?.has(value);
        });
        if (!available) field.set(key("V"), key("Off"));
      }
    }
    if (!retained && entry instanceof PDFRef) removedFields.add(entry);
    return retained;
  };
  const fields = acroForm?.lookupMaybe(key("Fields"), PDFArray);
  if (fields) for (let index = fields.size() - 1; index >= 0; index--) if (!pruneField(fields.get(index))) fields.remove(index);
  const calculations = acroForm?.lookupMaybe(key("CO"), PDFArray);
  if (calculations) for (let index = calculations.size() - 1; index >= 0; index--) if (removedFields.has(calculations.get(index) as import("pdf-lib").PDFRef)) calculations.remove(index);

  const removedNames = new Set<string>();
  const destinationInvalid = (entry: import("pdf-lib").PDFObject | undefined): boolean => {
    const destination = pdf.context.lookup(entry);
    if (destination instanceof PDFString || destination instanceof PDFHexString || destination instanceof PDFName) return removedNames.has(destination.decodeText());
    if (destination instanceof PDFDict) return destinationInvalid(destination.get(key("D")));
    if (!(destination instanceof PDFArray) || !destination.size()) return false;
    const target = destination.get(0);
    if (target instanceof PDFRef) return !keptRefs.has(target);
    if (target instanceof PDFNumber) {
      const page = pages[target.asNumber()];
      if (!page || !keptRefs.has(page.ref)) return true;
      destination.set(0, page.ref);
    }
    return false;
  };
  const oldDestinations = pdf.catalog.lookupMaybe(key("Dests"), PDFDict);
  if (oldDestinations) for (const [name, value] of oldDestinations.entries()) {
    if (destinationInvalid(value)) { removedNames.add(name.decodeText()); oldDestinations.delete(name); }
  }
  const pruneNameTree = (tree: import("pdf-lib").PDFDict) => {
    const names = tree.lookupMaybe(key("Names"), PDFArray);
    if (names) for (let index = names.size() - 2; index >= 0; index -= 2) {
      if (destinationInvalid(names.get(index + 1))) {
        const name = pdf.context.lookup(names.get(index));
        if (name instanceof PDFString || name instanceof PDFHexString) removedNames.add(name.decodeText());
        names.remove(index + 1); names.remove(index);
      }
    }
    for (const kid of tree.lookupMaybe(key("Kids"), PDFArray)?.asArray() ?? []) {
      const child = pdf.context.lookup(kid); if (child instanceof PDFDict) pruneNameTree(child);
    }
  };
  const names = pdf.catalog.lookupMaybe(key("Names"), PDFDict);
  const destinationTree = names?.lookupMaybe(key("Dests"), PDFDict);
  if (destinationTree) pruneNameTree(destinationTree);
  const invalidAction = (entry: import("pdf-lib").PDFObject | undefined) => {
    const action = pdf.context.lookup(entry);
    return action instanceof PDFDict && action.get(key("S")) === key("GoTo") && destinationInvalid(action.get(key("D")));
  };
  // Drop dead link annotations; preserve URI actions and links to retained pages.
  for (const index of pageIndices) {
    const annots = pages[index].node.Annots();
    if (!annots) continue;
    for (let position = annots.size() - 1; position >= 0; position--) {
      const annotation = pdf.context.lookup(annots.get(position));
      if (annotation instanceof PDFDict && annotation.get(key("Subtype")) === key("Link") &&
          (destinationInvalid(annotation.get(key("Dest"))) || invalidAction(annotation.get(key("A"))))) annots.remove(position);
    }
  }
  const visited = new Set<import("pdf-lib").PDFObject>();
  const pruneDestinations = (entry: import("pdf-lib").PDFObject | undefined) => {
    const value = pdf.context.lookup(entry);
    if (!value || visited.has(value)) return;
    visited.add(value);
    if (value instanceof PDFStream) { pruneDestinations(value.dict); return; }
    if (value instanceof PDFArray) { value.asArray().forEach(pruneDestinations); return; }
    if (!(value instanceof PDFDict)) return;
    if (destinationInvalid(value.get(key("Dest")))) value.delete(key("Dest"));
    if (invalidAction(value.get(key("A")))) value.delete(key("A"));
    if (destinationInvalid(value.get(key("OpenAction"))) || invalidAction(value.get(key("OpenAction")))) value.delete(key("OpenAction"));
    if (value.get(key("S")) === key("GoTo") && destinationInvalid(value.get(key("D")))) { value.delete(key("D")); value.delete(key("S")); }
    value.values().forEach(pruneDestinations);
  };
  pruneDestinations(pdf.catalog);
  if (isCancelled()) return null;
  // Preserve inherited geometry/resources before reparenting retained pages.
  for (const index of pageIndices) for (const name of ["Resources", "MediaBox", "CropBox", "Rotate"]) {
    const value = pages[index].node.getInheritableAttribute(key(name));
    if (value) pages[index].node.set(key(name), value);
  }
  for (let index = pages.length - 1; index >= 0; index--) pdf.removePage(index);
  for (let index = 0; index < pageIndices.length; index++) {
    pdf.addPage(pages[pageIndices[index]]);
    onProgress?.(index + 1, pageIndices.length);
    if ((index + 1) % 25 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    if (isCancelled()) return null;
  }
  // Do not serialize detached pages/widgets merely because pdf-lib loaded them.
  const reachable = new Set<import("pdf-lib").PDFRef>();
  const scanned = new Set<import("pdf-lib").PDFObject>();
  const visit = (entry: import("pdf-lib").PDFObject | undefined) => {
    if (!entry) return;
    if (entry instanceof PDFRef) { if (reachable.has(entry)) return; reachable.add(entry); }
    const value = pdf.context.lookup(entry);
    if (!value || scanned.has(value)) return;
    scanned.add(value);
    if (value instanceof PDFStream) visit(value.dict);
    else if (value instanceof PDFDict) value.values().forEach(visit);
    else if (value instanceof PDFArray) value.asArray().forEach(visit);
  };
  Object.values(pdf.context.trailerInfo).forEach(visit);
  for (const [ref] of pdf.context.enumerateIndirectObjects()) if (!reachable.has(ref)) pdf.context.delete(ref);
  const output = await pdf.save({ addDefaultPage: false, updateFieldAppearances: false });
  return isCancelled() ? null : output;
}

/** Remove selected zero-based pages without rasterizing their page contents. */
export async function removePdfPages(
  file: File,
  selectedPages: Iterable<number>,
  onProgress?: (done: number, total: number) => void,
  isCancelled: () => boolean = () => false
): Promise<Blob | null> {
  if (isCancelled()) return null;
  const { PDFDocument } = await import("pdf-lib");
  const bytes = await file.arrayBuffer();
  if (isCancelled()) return null;
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  if (isCancelled()) return null;
  const totalPages = pdf.getPageCount();
  if (!totalPages) throw new Error("This PDF does not contain any pages.");
  const selected = new Set(selectedPages);
  if (!selected.size) throw new Error("Select at least one page to remove.");
  if ([...selected].some((index) => !Number.isInteger(index) || index < 0 || index >= totalPages)) {
    throw new Error("Select pages that exist in this PDF.");
  }
  const kept = pdf.getPageIndices().filter((index) => !selected.has(index));
  if (!kept.length) throw new Error("A PDF needs at least one page. Keep one page out of removal.");
  const saved = await retainPdfPages(pdf, kept, onProgress, isCancelled);
  if (!saved || isCancelled()) return null;
  return new Blob([saved as unknown as BlobPart], { type: "application/pdf" });
}

export interface PdfRepairResult {
  blob: Blob;
  pageCount: number;
  method: "rebuilt" | "resaved";
}

export async function repairPdf(
  file: File,
  setProgress: (value: number) => void,
  isCancelled: () => boolean
): Promise<PdfRepairResult | null> {
  const { PDFDocument } = await import("pdf-lib");
  const bytes = await file.arrayBuffer();
  setProgress(20);
  if (isCancelled()) return null;

  let source: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    source = await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
  } catch {
    throw new Error("We could not read enough of this PDF to repair it. Try another copy of the file if you have one.");
  }

  if (source.isEncrypted) {
    throw new Error("This PDF is encrypted. Unlock it first, then try repairing it.");
  }

  const pageCount = source.getPageCount();
  if (pageCount === 0) {
    throw new Error("This PDF does not contain any recoverable pages.");
  }

  setProgress(45);
  if (isCancelled()) return null;

  try {
    const rebuilt = await PDFDocument.create();
    const copiedPages = await rebuilt.copyPages(source, source.getPageIndices());
    copiedPages.forEach((page) => rebuilt.addPage(page));
    setProgress(82);
    if (isCancelled()) return null;
    const repairedBytes = await rebuilt.save({
      addDefaultPage: false,
      useObjectStreams: false,
    });
    setProgress(100);
    return {
      blob: new Blob([repairedBytes as unknown as BlobPart], { type: "application/pdf" }),
      pageCount,
      method: "rebuilt",
    };
  } catch {
    const repairedBytes = await source.save({
      addDefaultPage: false,
      useObjectStreams: false,
    });
    setProgress(100);
    return {
      blob: new Blob([repairedBytes as unknown as BlobPart], { type: "application/pdf" }),
      pageCount,
      method: "resaved",
    };
  }
}

/** Opens a PDF and returns its page count — the most common "just tell me
 *  how many pages" need every page-manipulating tool has on file select. */
export async function getPdfPageCount(file: File): Promise<number> {
  const pdf = await loadPdfDocument(file);
  return pdf.getPageCount();
}

export interface PdfBasicInfo {
  pageCount: number;
  /** Real dimensions of page 1 (verified real API: PDFPage.getSize()) —
   *  used to flag documents with meaningfully different physical page
   *  sizes when several files are being combined, not to compare
   *  orientation (a rotated Letter page is not "a different size"). */
  firstPageSize: { width: number; height: number };
}

/** Single-load combination of page count + first-page size, for callers
 *  that need both (e.g. Merge PDF's pre-merge validation) - loading once
 *  and reading two fields off the same PDFDocument instead of parsing the
 *  file twice via two separate calls. */
export async function getPdfBasicInfo(file: File): Promise<PdfBasicInfo> {
  const pdf = await loadPdfDocument(file);
  const { width, height } = pdf.getPage(0).getSize();
  return { pageCount: pdf.getPageCount(), firstPageSize: { width, height } };
}

/** Reads every metadata field pdf-lib exposes (verified real API: getTitle,
 *  getAuthor, getSubject, getKeywords, getCreator, getProducer,
 *  getCreationDate, getModificationDate). */
export async function readPdfMetadata(file: File): Promise<PdfMetadata> {
  const pdf = await loadPdfDocument(file);
  return {
    title: pdf.getTitle(),
    author: pdf.getAuthor(),
    subject: pdf.getSubject(),
    keywords: pdf.getKeywords()?.split(",").map((k) => k.trim()).filter(Boolean),
    creator: pdf.getCreator(),
    producer: pdf.getProducer(),
    creationDate: pdf.getCreationDate(),
    modificationDate: pdf.getModificationDate(),
  };
}

/** Writes metadata fields and returns the re-saved PDF as a Blob. Only the
 *  fields present in `updates` are changed; omitted fields are left as-is
 *  (undefined means "don't touch", not "clear the field"). */
export async function writePdfMetadata(file: File, updates: PdfMetadata): Promise<Blob> {
  const pdf = await loadPdfDocument(file);
  if (updates.title !== undefined) pdf.setTitle(updates.title);
  if (updates.author !== undefined) pdf.setAuthor(updates.author);
  if (updates.subject !== undefined) pdf.setSubject(updates.subject);
  if (updates.keywords !== undefined) pdf.setKeywords(updates.keywords);
  if (updates.creator !== undefined) pdf.setCreator(updates.creator);
  if (updates.producer !== undefined) pdf.setProducer(updates.producer);
  if (updates.creationDate !== undefined) pdf.setCreationDate(updates.creationDate);
  if (updates.modificationDate !== undefined) pdf.setModificationDate(updates.modificationDate);
  return toBlob(pdf);
}

/** Duplicates each page index in `pageIndices` (0-based), inserting each
 *  copy immediately after its source page. Uses pdf-lib's verified real
 *  `copyPages`/`insertPage` pair — copying pages from a document into
 *  itself is the same documented pattern pdf-lib uses for cross-document
 *  copies. */
export async function duplicatePdfPages(file: File, pageIndices: number[]): Promise<Blob> {
  const pdf = await loadPdfDocument(file);
  const sorted = [...pageIndices].sort((a, b) => b - a);
  for (const index of sorted) {
    const [copy] = await pdf.copyPages(pdf, [index]);
    pdf.insertPage(index + 1, copy);
  }
  return toBlob(pdf);
}

/** Flattens every form field in a PDF into static page content — verified
 *  real via `PDFForm.flatten()` (node_modules/pdf-lib/es/api/form/PDFForm.d.ts).
 *  Distinct from Fill PDF: that tool fills and flattens a form in one flow;
 *  this locks in whatever values a form already has (e.g. filled in another
 *  app) without requiring the user to re-type anything. */
export async function flattenPdfForm(file: File): Promise<Blob> {
  const pdf = await loadPdfDocument(file);
  const form = pdf.getForm();
  form.flatten();
  return toBlob(pdf);
}

/** Inserts every page of `sourceFile` into `targetFile` starting at
 *  `atIndex` (0-based). Distinct from Merge (which appends whole documents
 *  in sequence) — this slots pages from one PDF into the middle of another
 *  at a chosen position, using the same verified `copyPages`/`insertPage`
 *  pair as duplicatePdfPages. Combined with the existing Delete Pages tool,
 *  this also covers "replace a page": delete the old page, then insert the
 *  new one at that position — covering the "replace pages" family request
 *  without a near-duplicate third tool built on the same two primitives. */
export async function insertPdfPages(targetFile: File, sourceFile: File, atIndex: number): Promise<Blob> {
  const target = await loadPdfDocument(targetFile);
  const source = await loadPdfDocument(sourceFile);
  const sourcePageCount = source.getPageCount();
  const copiedPages = await target.copyPages(source, [...Array(sourcePageCount).keys()]);
  copiedPages.forEach((page, i) => target.insertPage(atIndex + i, page));
  return toBlob(target);
}

/** Clears every metadata field pdf-lib can write, in one call — the
 *  one-click "remove metadata" action, built on the same writePdfMetadata
 *  path as the Metadata Editor rather than a separate implementation. */
export async function clearPdfMetadata(file: File): Promise<Blob> {
  return writePdfMetadata(file, {
    title: "",
    author: "",
    subject: "",
    keywords: [],
    creator: "",
    producer: "",
  });
}

/** Converts an SVG file into a single-page PDF by rasterizing it onto a
 *  canvas, then embedding that raster as a full-page PNG. This is
 *  deliberately NOT a vector conversion: pdf.js's real page-to-SVG/SVG-to-PDF
 *  vector path (`SVGGraphics`) was removed from pdfjs-dist years ago, and no
 *  other real, maintained library does vector SVG→PDF in the browser —
 *  verified this sprint, not assumed. Rasterizing at 2x the SVG's intrinsic
 *  size keeps output reasonably crisp for a raster result while being honest
 *  that text/paths in the output are pixels, not selectable vector content.
 */
export async function convertSvgToPdf(file: File): Promise<Blob> {
  const svgText = await file.text();
  const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
  const objectUrl = URL.createObjectURL(svgBlob);

  // Loaded via an <img> element rather than createImageBitmap: tried
  // createImageBitmap(svgBlob) first and it threw "The source image could
  // not be decoded" — confirmed live that this browser's createImageBitmap
  // doesn't reliably decode SVG, while the <img> element route does (its
  // blob: URL is covered by this site's `img-src` CSP, unlike the
  // `connect-src`-gated fetch() route tried and rejected before this).
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The source image could not be decoded."));
      image.src = objectUrl;
    });

    const scale = 2;
    const width = (image.naturalWidth || 300) * scale;
    const height = (image.naturalHeight || 150) * scale;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser doesn't support 2D canvas rendering.");
    ctx.drawImage(image, 0, 0, width, height);

    const pngBlob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to rasterize SVG."))), "image/png");
    });

    const { PDFDocument } = await import("pdf-lib");
    const pdfDoc = await PDFDocument.create();
    const pngImage = await pdfDoc.embedPng(await pngBlob.arrayBuffer());
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(pngImage, { x: 0, y: 0, width, height });
    return toBlob(pdfDoc);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
