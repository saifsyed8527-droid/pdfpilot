import type { WorkBook } from "xlsx";

export const xmlElements = (el: Element | null | undefined) => Array.from(el?.childNodes || []).filter(node => node.nodeType === 1) as Element[];
export const xmlChild = (el: Element | null | undefined, tag: string) => xmlElements(el).find(node => node.localName === tag);
export const xmlChildren = (el: Element | null | undefined, tag: string) => xmlElements(el).filter(node => node.localName === tag);
export const xmlDescendants = (el: Element | null | undefined, tag: string): Element[] => Array.from(el?.getElementsByTagName("*") || []).filter(node => node.localName === tag);
export const xmlValue = (el: Element | null | undefined, tag: string, fallback = "") => xmlChild(el, tag)?.getAttribute("val") || fallback;
export const xmlOn = (el: Element | null | undefined, tag: string, fallback = false) => {
  const node = xmlChild(el, tag);
  return node ? !["0", "false"].includes(node.getAttribute("val") || "1") : fallback;
};
export const relationshipId = (el: Element | null | undefined, attr = "id") => el?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", attr) || el?.getAttributeNS("http://purl.oclc.org/ooxml/officeDocument/relationships", attr) || el?.getAttribute(`r:${attr}`) || "";

export function excelPackage(workbook: WorkBook) {
  const files = (workbook as WorkBook & { files?: Record<string, { content: Uint8Array | string }> }).files || {};
  const bytes = (path: string) => {
    const content = files[path]?.content;
    return typeof content === "string" ? new TextEncoder().encode(content) : content;
  };
  const xml = (path: string) => {
    const content = bytes(path);
    if (!content) return null;
    const text = new TextDecoder().decode(content);
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error("This workbook contains an unsafe XML declaration. Save a new XLSX copy in Excel.");
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw new Error("The workbook contains invalid XML. Open and resave it as XLSX first.");
    return doc.documentElement;
  };
  const relations = (path: string) => {
    const directory = path.slice(0, path.lastIndexOf("/") + 1);
    return new Map(xmlChildren(xml(path.replace(/([^/]+)$/, "_rels/$1.rels")), "Relationship").map(rel => {
      const target = rel.getAttribute("Target") || "", external = rel.getAttribute("TargetMode") === "External";
      const parts: string[] = [];
      if (!external) for (const part of (target.startsWith("/") ? target.slice(1) : directory + target).split("/")) {
        if (part === "..") { if (!parts.length) throw new Error("Invalid workbook relationship path."); parts.pop(); }
        else if (part && part !== ".") parts.push(part);
      }
      return [rel.getAttribute("Id") || "", { path: external ? target : parts.join("/"), external, type: rel.getAttribute("Type") || "" }];
    }));
  };
  const theme = xmlChild(xmlChild(xml("xl/theme/theme1.xml"), "themeElements"), "clrScheme");
  const themeColours = new Map(xmlElements(theme).map(slot => {
    const value = xmlElements(slot)[0];
    return [slot.localName, value?.getAttribute("lastClr") || value?.getAttribute("val") || "000000"];
  }));
  const colour = (container?: Element | null, fallback = "4472C4"): string => {
    const node = xmlElements(container).find(e => /^(srgbClr|schemeClr|sysClr)$/.test(e.localName));
    if (!node) return fallback;
    const name = node.getAttribute("val") || "";
    const aliases: Record<string, string> = { bg1: "lt1", tx1: "dk1", bg2: "lt2", tx2: "dk2" };
    let value = node.localName === "schemeClr" ? themeColours.get(aliases[name] || name) : node.getAttribute("lastClr") || name;
    if (!value || !/^[0-9a-f]{6}$/i.test(value)) value = fallback;
    let channels = value.match(/../g)!.map(v => parseInt(v, 16));
    for (const transform of xmlElements(node)) {
      const factor = Number(transform.getAttribute("val")) / 100000;
      if (transform.localName === "tint") channels = channels.map(v => v + (255 - v) * factor);
      if (transform.localName === "shade" || transform.localName === "lumMod") channels = channels.map(v => v * factor);
      if (transform.localName === "lumOff") channels = channels.map(v => v + 255 * factor);
    }
    return channels.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
  };
  return { bytes, xml, relations, colour, themeColours };
}
export type ExcelPackage = ReturnType<typeof excelPackage>;
