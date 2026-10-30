import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFObject, PDFRawStream, PDFRef, PDFStream, PDFString, decodePDFRawStream } from "pdf-lib";

export const metadataKeys = ["title", "author", "subject", "keywords", "creator", "producer", "created", "modified"] as const;
export type MetadataKey = typeof metadataKeys[number];
export type MetadataValues = Record<MetadataKey, string>;
export const emptyMetadata: MetadataValues = { title: "", author: "", subject: "", keywords: "", creator: "", producer: "", created: "", modified: "" };
export interface MetadataSnapshot { values: MetadataValues; pageCount: number; custom: { name: string; value: string }[]; hasXmp: boolean; warnings: string[]; signed: boolean }
const infoKeys: Record<MetadataKey, string> = { title: "Title", author: "Author", subject: "Subject", keywords: "Keywords", creator: "Creator", producer: "Producer", created: "CreationDate", modified: "ModDate" };
const NS = { rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#", dc: "http://purl.org/dc/elements/1.1/", xmp: "http://ns.adobe.com/xap/1.0/", pdf: "http://ns.adobe.com/pdf/1.3/" };
function check(signal?: AbortSignal) { if (signal?.aborted) throw new Error("Metadata processing cancelled."); }
async function checkpoint(signal?: AbortSignal) { await new Promise(resolve => setTimeout(resolve, 0)); check(signal); }
async function open(file: File, signal?: AbortSignal) {
  check(signal); if (file.size > 100 * 1024 * 1024) throw new Error("Choose a PDF of 100MB or smaller.");
  const bytes = await file.arrayBuffer(); check(signal);
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false }).catch(() => { throw new Error("This PDF is damaged or password-protected. Choose an unlocked, readable copy."); });
  await checkpoint(signal); if (pdf.isEncrypted) throw new Error("Unlock this PDF before editing metadata."); if (!pdf.getPageCount()) throw new Error("This PDF contains no pages."); return pdf;
}
function signed(pdf: PDFDocument) { return pdf.catalog.has(PDFName.of("Perms")) || pdf.context.enumerateIndirectObjects().some(([, o]) => o instanceof PDFDict && (o.get(PDFName.of("Type")) === PDFName.of("Sig") || o.get(PDFName.of("FT")) === PDFName.of("Sig") && !!o.get(PDFName.of("V")))); }
function info(pdf: PDFDocument) { const value = pdf.context.lookup(pdf.context.trailerInfo.Info); return value instanceof PDFDict ? value : undefined; }
function string(value?: PDFObject) { return value instanceof PDFString || value instanceof PDFHexString ? value.decodeText() : ""; }
function xmp(pdf: PDFDocument): string | undefined {
  const object = pdf.context.lookup(pdf.catalog.get(PDFName.of("Metadata"))); if (!object) return;
  if (!(object instanceof PDFRawStream)) throw new Error("Embedded XMP is unreadable.");
  const stream = decodePDFRawStream(object), chunks: number[] = []; let byte = stream.getByte();
  while (byte !== -1) { if (chunks.length >= 2_000_000) throw new Error("Embedded XMP exceeds 2MB."); chunks.push(byte); byte = stream.getByte(); }
  return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(chunks));
}
function parseXml(value: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(value)) throw new Error("Embedded XMP contains unsupported XML declarations.");
  const doc = new DOMParser().parseFromString(value, "application/xml");
  if (doc.getElementsByTagName("parsererror").length || !doc.getElementsByTagNameNS(NS.rdf, "RDF").length) throw new Error("Embedded XMP is unreadable.");
  return doc;
}
function descriptions(doc: Document): Element[] {
  const rdf = doc.getElementsByTagNameNS(NS.rdf, "RDF")[0];
  return Array.from(rdf?.childNodes ?? []).filter(node => node.nodeType === 1 && (node as Element).namespaceURI === NS.rdf && (node as Element).localName === "Description") as Element[];
}
function properties(doc: Document, namespace: string, name: string): Element[] {
  return descriptions(doc).flatMap(desc => Array.from(desc.childNodes).filter(node => node.nodeType === 1 && (node as Element).namespaceURI === namespace && (node as Element).localName === name) as Element[]);
}
function xmpValue(doc: Document, namespace: string, name: string) {
  const values = properties(doc, namespace, name);
  if (values.length) { const defaults = Array.from(values[0].getElementsByTagNameNS(NS.rdf, "li")); return (defaults.find(v => v.getAttributeNS("http://www.w3.org/XML/1998/namespace", "lang") === "x-default") ?? defaults[0] ?? values[0]).textContent ?? ""; }
  for (const desc of descriptions(doc)) if (desc.hasAttributeNS(namespace, name)) return desc.getAttributeNS(namespace, name) ?? "";
  return "";
}
export function utcMetadataDate(value: string) {
  if (!value) return "";
  const date = new Date(value); return Number.isNaN(date.valueOf()) ? "" : date.toISOString().slice(0, 19);
}
export function parseMetadataDate(value: string): Date | undefined {
  if (!value) return;
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?$/.test(value)) throw new Error("Use a valid UTC date and time.");
  const full = value.length === 16 ? value + ":00" : value, date = new Date(full + "Z");
  if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 19) !== full || date.getUTCFullYear() < 1) throw new Error("Use a valid UTC date and time."); return date;
}
export async function inspectPdfMetadata(file: File, signal?: AbortSignal): Promise<MetadataSnapshot> {
  const pdf = await open(file, signal), dictionary = info(pdf), values = { ...emptyMetadata }, warnings: string[] = [], custom: MetadataSnapshot["custom"] = [];
  for (const key of metadataKeys) {
    const raw = string(dictionary?.lookup(PDFName.of(infoKeys[key])));
    if (key === "created" || key === "modified") { try { const date = key === "created" ? pdf.getCreationDate() : pdf.getModificationDate(); values[key] = date ? utcMetadataDate(date.toISOString()) : ""; } catch { warnings.push(`The original ${key === "created" ? "creation" : "modification"} date is invalid. Choose a replacement or leave it blank to remove it.`); } }
    else values[key] = raw;
  }
  const hasXmp = pdf.catalog.has(PDFName.of("Metadata"));
  if (hasXmp) try {
    const doc = parseXml(xmp(pdf)!);
    const fields: [MetadataKey, string, string][] = [["title", NS.dc, "title"], ["author", NS.dc, "creator"], ["subject", NS.dc, "description"], ["keywords", NS.pdf, "Keywords"], ["creator", NS.xmp, "CreatorTool"], ["producer", NS.pdf, "Producer"], ["created", NS.xmp, "CreateDate"], ["modified", NS.xmp, "ModifyDate"]];
    let mismatch = false;
    for (const [key, ns, tag] of fields) { let fallback = xmpValue(doc, ns, tag); if (key === "created" || key === "modified") fallback = utcMetadataDate(fallback); if (!dictionary?.has(PDFName.of(infoKeys[key]))) values[key] = fallback; else if (fallback && values[key] !== fallback) mismatch = true; }
    if (mismatch) warnings.push("The PDF's Info and XMP values differ. Saving synchronizes the displayed fields in both formats.");
  } catch { warnings.push("Embedded XMP could not be read. To save, enable Remove embedded XMP, or remove document metadata."); }
  for (const [key, value] of dictionary?.entries() ?? []) if (!Object.values(infoKeys).includes(key.decodeText())) { const resolved = pdf.context.lookup(value); custom.push({ name: key.decodeText(), value: string(resolved) || resolved?.toString().slice(0, 2000) || "" }); }
  check(signal); return { values, pageCount: pdf.getPageCount(), custom, hasXmp, warnings, signed: signed(pdf) };
}

/** Remove only orphaned objects belonging to replaced metadata, preserving shared page resources. */
function discardMetadataObjects(pdf: PDFDocument, roots: (PDFObject | undefined)[]) {
  const refsIn = (value: PDFObject | undefined, refs: Set<string>, seen = new Set<PDFObject>()) => {
    if (!value || seen.has(value)) return; seen.add(value);
    if (value instanceof PDFRef) refs.add(value.toString());
    else if (value instanceof PDFArray) value.asArray().forEach(child => refsIn(child, refs, seen));
    else if (value instanceof PDFDict) value.entries().forEach(([, child]) => refsIn(child, refs, seen));
    else if (value instanceof PDFStream) refsIn(value.dict, refs, seen);
  };
  const objects = new Map(pdf.context.enumerateIndirectObjects().map(([ref, value]) => [ref.toString(), { ref, value }])), candidates = new Set<string>();
  roots.forEach(value => refsIn(value, candidates));
  const queue = [...candidates]; for (let i = 0; i < queue.length; i++) { const children = new Set<string>(); refsIn(objects.get(queue[i])?.value, children); for (const key of children) if (!candidates.has(key)) { candidates.add(key); queue.push(key); } }
  const keep = new Set<string>(); for (const [key, { value }] of objects) if (!candidates.has(key)) refsIn(value, keep);
  for (const value of Object.values(pdf.context.trailerInfo)) refsIn(value, keep);
  const retained = [...keep]; for (let i = 0; i < retained.length; i++) if (candidates.has(retained[i])) { const children = new Set<string>(); refsIn(objects.get(retained[i])?.value, children); for (const key of children) if (!keep.has(key)) { keep.add(key); retained.push(key); } }
  for (const key of candidates) if (!keep.has(key) && objects.has(key)) pdf.context.delete(objects.get(key)!.ref);
}
function syncXmp(previous: string | undefined, values: MetadataValues) {
  const doc = parseXml(previous ?? `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="${NS.rdf}"><rdf:Description rdf:about=""/></rdf:RDF></x:xmpmeta>`);
  const rdf = doc.getElementsByTagNameNS(NS.rdf, "RDF")[0];
  let target = descriptions(doc)[0];
  if (!target) { target = doc.createElementNS(NS.rdf, "rdf:Description"); target.setAttributeNS(NS.rdf, "rdf:about", ""); rdf.appendChild(target); }
  const replace = (prefix: "dc" | "xmp" | "pdf", name: string, value: string, sequence?: "Alt" | "Seq" | "Bag") => {
    const ns = NS[prefix]; for (const node of properties(doc, ns, name)) node.parentNode?.removeChild(node);
    for (const desc of descriptions(doc)) desc.removeAttributeNS(ns, name);
    if (!value) return;
    const element = doc.createElementNS(ns, `${prefix}:${name}`);
    if (sequence) { const list = doc.createElementNS(NS.rdf, `rdf:${sequence}`), entries = sequence === "Bag" ? value.split(",").map(v => v.trim()).filter(Boolean) : [value]; for (const entry of entries) { const li = doc.createElementNS(NS.rdf, "rdf:li"); if (sequence === "Alt") li.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:lang", "x-default"); li.textContent = entry; list.appendChild(li); } element.appendChild(list); }
    else element.textContent = value;
    target.appendChild(element);
  };
  replace("dc", "title", values.title, "Alt"); replace("dc", "creator", values.author, "Seq"); replace("dc", "description", values.subject, "Alt"); replace("dc", "subject", values.keywords, "Bag"); replace("pdf", "Keywords", values.keywords); replace("pdf", "Producer", values.producer); replace("xmp", "CreatorTool", values.creator);
  replace("xmp", "CreateDate", values.created ? parseMetadataDate(values.created)!.toISOString() : ""); replace("xmp", "ModifyDate", values.modified ? parseMetadataDate(values.modified)!.toISOString() : "");
  return new XMLSerializer().serializeToString(doc);
}
export async function savePdfMetadata(file: File, values: MetadataValues, options: { removeXmp?: boolean; signal?: AbortSignal } = {}) {
  for (const key of metadataKeys) if (typeof values[key] !== "string" || values[key].length > 8000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(values[key])) throw new Error("Each metadata field must contain at most 8,000 characters and no invalid control characters.");
  const dates = { created: parseMetadataDate(values.created), modified: parseMetadataDate(values.modified) }, pdf = await open(file, options.signal);
  if (signed(pdf)) throw new Error("Editing metadata invalidates digital signatures. Choose an unsigned copy.");
  const previous = options.removeXmp ? undefined : xmp(pdf), oldXmp = pdf.catalog.get(PDFName.of("Metadata"));
  const xml = options.removeXmp ? undefined : syncXmp(previous, values);
  let dictionary = info(pdf); if (!dictionary) { dictionary = pdf.context.obj({}); pdf.context.trailerInfo.Info = pdf.context.register(dictionary); }
  const oldValues: (PDFObject | undefined)[] = [];
  for (const key of metadataKeys) {
    const name = PDFName.of(infoKeys[key]); oldValues.push(dictionary.get(name)); dictionary.delete(name);
    if (key === "created" || key === "modified") { if (dates[key]) dictionary.set(name, PDFString.fromDate(dates[key]!)); }
    else if (values[key]) dictionary.set(name, PDFHexString.fromText(values[key]));
  }
  pdf.catalog.delete(PDFName.of("Metadata"));
  if (xml) pdf.catalog.set(PDFName.of("Metadata"), pdf.context.register(pdf.context.stream(new TextEncoder().encode(xml), { Type: "Metadata", Subtype: "XML" })));
  discardMetadataObjects(pdf, [oldXmp, ...oldValues]); await checkpoint(options.signal);
  const bytes = await pdf.save({ updateFieldAppearances: false, addDefaultPage: false }); check(options.signal); return new Blob([new Uint8Array(bytes).buffer], { type: "application/pdf" });
}
export async function removePdfDocumentMetadata(file: File, signal?: AbortSignal) {
  const pdf = await open(file, signal); if (signed(pdf)) throw new Error("Removing metadata invalidates digital signatures. Choose an unsigned copy.");
  const removed: (PDFObject | undefined)[] = [pdf.context.trailerInfo.Info]; pdf.context.trailerInfo.Info = undefined;
  // Document/page/object metadata streams are separate from visible content and attachments.
  for (const [, object] of pdf.context.enumerateIndirectObjects()) { const dictionary = object instanceof PDFDict ? object : object instanceof PDFStream ? object.dict : undefined; if (dictionary?.has(PDFName.of("Metadata"))) { removed.push(dictionary.get(PDFName.of("Metadata"))); dictionary.delete(PDFName.of("Metadata")); } }
  discardMetadataObjects(pdf, removed); await checkpoint(signal);
  const bytes = await pdf.save({ updateFieldAppearances: false, addDefaultPage: false }); check(signal); return new Blob([new Uint8Array(bytes).buffer], { type: "application/pdf" });
}
