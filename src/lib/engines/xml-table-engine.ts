import { safeBaseName } from "./pdf-split-engine";
export const tableBaseName = (name: string) =>
  safeBaseName(name.replace(/\.(xml|csv|tsv|txt)$/i, ""));

export const XML_TABLE_LIMITS = {
  bytes: 8 * 1024 * 1024,
  nodes: 100_000,
  depth: 64,
  rows: 50_000,
  columns: 512,
  cells: 1_000_000,
  output: 64 * 1024 * 1024,
  expandedCharacters: 16 * 1024 * 1024,
};
export type XmlLayout = "table" | "key-value" | "elements" | "levels";
export interface XmlTableOptions {
  layout: XmlLayout;
  recordPath?: string;
  parents?: boolean;
  repeated?: "columns" | "json";
  alphabetical?: boolean;
  epochDates?: boolean;
  signal?: AbortSignal;
}
export interface XmlNode {
  name: string;
  text: string;
  attributes: [string, string][];
  children: XmlNode[];
  path: string;
  indexedPath: string;
  parent?: XmlNode;
}
export interface XmlInspection {
  root: XmlNode;
  nodes: XmlNode[];
  paths: { path: string; count: number }[];
  suggestedPath: string;
}
export interface TableData {
  rows: string[][];
  warnings: string[];
  recordPath?: string;
  convertedDates: number;
}
const check = (signal?: AbortSignal) => {
  if (signal?.aborted)
    throw new DOMException("Conversion cancelled", "AbortError");
};
const pause = async (signal?: AbortSignal) => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  check(signal);
};
const invalidCharacters =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
function inputSize(text: string) {
  if (!text.trim()) throw new Error("Add a non-empty XML or CSV document.");
  if (
    text.length > XML_TABLE_LIMITS.bytes ||
    new TextEncoder().encode(text).length > XML_TABLE_LIMITS.bytes
  )
    throw new Error("Choose a document up to 8MB.");
  if (invalidCharacters.test(text))
    throw new Error(
      "The document contains characters that XML cannot store. Remove invalid control characters and try again.",
    );
}
export async function readTableFile(file: File, signal?: AbortSignal) {
  if (!file.size || file.size > XML_TABLE_LIMITS.bytes)
    throw new Error("Choose a non-empty document up to 8MB.");
  const data = new Uint8Array(await file.arrayBuffer());
  check(signal);
  let encoding =
    data[0] === 0xff && data[1] === 0xfe
      ? "utf-16le"
      : data[0] === 0xfe && data[1] === 0xff
        ? "utf-16be"
        : data[0] === 0x3c && data[1] === 0
          ? "utf-16le"
          : data[0] === 0 && data[1] === 0x3c
            ? "utf-16be"
            : "utf-8";
  if (encoding === "utf-8") {
    const declaration = new TextDecoder()
      .decode(data.subarray(0, 200))
      .match(/^\s*<\?xml[^?]*encoding\s*=\s*["']([^"']+)/i);
    if (declaration) encoding = declaration[1];
  }
  try {
    const text = new TextDecoder(encoding, { fatal: true }).decode(data);
    inputSize(text);
    return text;
  } catch (error) {
    if (error instanceof TypeError)
      throw new Error(
        "This file could not be decoded. Save it as UTF-8 CSV or XML and try again.",
      );
    throw error;
  }
}
/** The browser parser supplies XML well-formedness and namespaces. Bound input
 * before parsing; then build a limited tree with cooperative cancellation. */
export async function inspectXml(
  text: string,
  signal?: AbortSignal,
): Promise<XmlInspection> {
  inputSize(text);
  check(signal);
  if (
    /<!DOCTYPE\b|<!ENTITY\b/i.test(
      text.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g, ""),
    )
  )
    throw new Error(
      "XML with a DOCTYPE or custom entities is not supported. Export a plain XML file first.",
    );
  await pause(signal);
  const parser = new DOMParser();
  // Chromium/WebKit and Firefox use different namespaces for parser errors.
  // Probe this parser instead of assuming Firefox's namespace, while allowing
  // ordinary user data whose element happens to be named "parsererror".
  const marker = parser
    .parseFromString("<", "application/xml")
    .getElementsByTagName("parsererror")[0];
  const doc = parser.parseFromString(text, "application/xml");
  if (
    !doc.documentElement ||
    Array.from(doc.getElementsByTagName("parsererror")).some(
      (node) => !marker || node.namespaceURI === marker.namespaceURI,
    )
  )
    throw new Error(
      "This XML is not well formed. Check matching tags, quotes and escaped ampersands, then try again.",
    );
  const nodes: XmlNode[] = [],
    groups = new Map<string, XmlNode[]>();
  let root!: XmlNode;
  let pathCharacters = 0;
  const stack: {
    element: Element;
    parent?: XmlNode;
    indexed: string;
    depth: number;
  }[] = [
    {
      element: doc.documentElement,
      indexed: "/" + doc.documentElement.tagName,
      depth: 1,
    },
  ];
  while (stack.length) {
    const { element, parent, indexed, depth } = stack.pop()!;
    if (depth > XML_TABLE_LIMITS.depth)
      throw new Error(
        "XML exceeds 64 nested levels. Choose a shallower document.",
      );
    if (nodes.length >= XML_TABLE_LIMITS.nodes)
      throw new Error(
        "XML exceeds 100,000 elements. Split the file into smaller documents.",
      );
    const name = element.tagName,
      path = (parent?.path ?? "") + "/" + name;
    pathCharacters += path.length + indexed.length;
    if (
      path.length > 1024 ||
      pathCharacters > XML_TABLE_LIMITS.expandedCharacters
    )
      throw new Error(
        "XML paths are too long or repeated too widely. Choose a smaller record document.",
      );
    const rawText = Array.from(element.childNodes)
      .filter((n) => n.nodeType === 3 || n.nodeType === 4)
      .map((n) => n.nodeValue ?? "")
      .join("");
    const own = element.children.length ? rawText.trim() : rawText;
    const node: XmlNode = {
      name,
      text: own,
      attributes: Array.from(element.attributes).map((a) => [a.name, a.value]),
      children: [],
      path,
      indexedPath: indexed,
      parent,
    };
    if (parent) parent.children.push(node);
    else root = node;
    nodes.push(node);
    const group = groups.get(path) ?? [];
    group.push(node);
    groups.set(path, group);
    const children = Array.from(element.children),
      counts = new Map<string, number>(),
      seen = new Map<string, number>();
    if (children.length + nodes.length > XML_TABLE_LIMITS.nodes)
      throw new Error(
        "XML exceeds 100,000 elements. Split the file into smaller documents.",
      );
    for (const child of children)
      counts.set(child.tagName, (counts.get(child.tagName) ?? 0) + 1);
    const jobs = children.map((child) => {
      const index = (seen.get(child.tagName) ?? 0) + 1;
      seen.set(child.tagName, index);
      return {
        element: child,
        parent: node,
        depth: depth + 1,
        indexed:
          indexed +
          "/" +
          child.tagName +
          ((counts.get(child.tagName) ?? 0) > 1 ? `[${index}]` : ""),
      };
    });
    for (let i = jobs.length - 1; i >= 0; i--) stack.push(jobs[i]);
    if (nodes.length % 500 === 0) await pause(signal);
  }
  check(signal);
  const paths = [...groups]
    .filter(
      ([, list]) =>
        list.some((n) => n.children.length || n.attributes.length) ||
        list.length > 1 ||
        list[0] === root,
    )
    .map(([path, list]) => ({ path, count: list.length }));
  if (paths.length > 1000)
    throw new Error(
      "XML has more than 1,000 record paths. Choose a smaller part of the document.",
    );
  const repeated = paths
    .filter((p) => p.count > 1)
    .sort((a, b) => a.path.split("/").length - b.path.split("/").length);
  return { root, nodes, paths, suggestedPath: repeated[0]?.path ?? root.path };
}

function fields(
  node: XmlNode,
  repeated: "columns" | "json",
  prefix = "",
  out = new Map<string, string>(),
) {
  for (const [name, value] of node.attributes)
    out.set(prefix + "@" + name, value);
  if (!node.children.length || node.text)
    out.set(
      prefix
        ? prefix.replace(/\/$/, "") + (node.children.length ? "/#text" : "")
        : "#text",
      node.text,
    );
  const counts = new Map<string, number>(),
    seen = new Map<string, number>();
  for (const child of node.children)
    counts.set(child.name, (counts.get(child.name) ?? 0) + 1);
  for (const child of node.children) {
    const index = (seen.get(child.name) ?? 0) + 1;
    seen.set(child.name, index);
    const many = (counts.get(child.name) ?? 0) > 1;
    if (many && repeated === "json") {
      if (index === 1)
        out.set(
          prefix + child.name,
          JSON.stringify(
            node.children
              .filter((n) => n.name === child.name)
              .map((n) =>
                [...fields(n, "columns")].reduce<Record<string, string>>(
                  (o, [k, v]) => {
                    Object.defineProperty(o, k, { value: v, enumerable: true });
                    return o;
                  },
                  {},
                ),
              ),
          ),
        );
    } else
      fields(
        child,
        repeated,
        prefix + child.name + (many ? `[${index}]` : "") + "/",
        out,
      );
    if (out.size > XML_TABLE_LIMITS.columns)
      throw new Error(
        "This layout exceeds 512 columns. Choose Key / Value, one row per element, or keep repeated items in one cell.",
      );
  }
  return out;
}
type ParentCache = Map<XmlNode, Map<string, Map<string, string>>>;
function parentFields(node: XmlNode, cache: ParentCache) {
  const out = new Map<string, string>();
  let branch = node,
    parent = node.parent;
  while (parent) {
    let variants = cache.get(parent);
    if (!variants) {
      variants = new Map();
      cache.set(parent, variants);
    }
    let values = variants.get(branch.name);
    if (!values) {
      values = new Map();
      const prefix = ".." + parent.path + "/";
      for (const [name, value] of parent.attributes)
        values.set(prefix + "@" + name, value);
      if (parent.text) values.set(prefix + "#text", parent.text);
      const counts = new Map<string, number>(),
        seen = new Map<string, number>();
      for (const sibling of parent.children)
        counts.set(sibling.name, (counts.get(sibling.name) ?? 0) + 1);
      for (const sibling of parent.children) {
        const index = (seen.get(sibling.name) ?? 0) + 1;
        seen.set(sibling.name, index);
        if (sibling.name !== branch.name && !sibling.children.length)
          values.set(
            prefix +
              sibling.name +
              ((counts.get(sibling.name) ?? 0) > 1 ? `[${index}]` : ""),
            sibling.text,
          );
      }
      variants.set(branch.name, values);
    }
    for (const [key, value] of values) out.set(key, value);
    branch = parent;
    parent = parent.parent;
  }
  return out;
}
function checkTable(rows: string[][]) {
  if (rows.length > XML_TABLE_LIMITS.rows + 1)
    throw new Error(
      "This output exceeds 50,000 rows. Select a smaller record group.",
    );
  let cells = 0,
    characters = 0;
  for (const row of rows) {
    if (row.length > XML_TABLE_LIMITS.columns)
      throw new Error(
        "This output exceeds 512 columns. Choose a different layout.",
      );
    cells += row.length;
    for (const value of row) characters += value.length;
    if (characters > XML_TABLE_LIMITS.expandedCharacters)
      throw new Error(
        "The expanded table exceeds 16 million text characters. Turn off parent values or choose fewer records.",
      );
  }
  if (cells > XML_TABLE_LIMITS.cells)
    throw new Error(
      "This output exceeds one million cells. Select fewer records or another layout.",
    );
}
export async function xmlTable(
  inspection: XmlInspection,
  options: XmlTableOptions,
): Promise<TableData> {
  check(options.signal);
  if (!["table", "key-value", "elements", "levels"].includes(options.layout))
    throw new Error("Choose a supported table layout.");
  let rows: string[][] = [],
    recordPath: string | undefined;
  const warnings = [
    "Values and leaf whitespace are kept as text. Comments, processing instructions and mixed-content formatting are not rebuilt.",
  ];
  if (options.layout === "table") {
    recordPath = options.recordPath || inspection.suggestedPath;
    const selected = inspection.nodes.filter((n) => n.path === recordPath);
    if (!selected.length)
      throw new Error("Select a record path found in this document.");
    if (selected.length > XML_TABLE_LIMITS.rows)
      throw new Error(
        "This record group exceeds 50,000 rows. Choose a smaller group.",
      );
    const parentCache: ParentCache = new Map();
    let expandedCharacters = 0;
    const records: Map<string, string>[] = [],
      headers = new Set<string>();
    for (const [index, node] of selected.entries()) {
      const values = options.parents
        ? parentFields(node, parentCache)
        : new Map<string, string>();
      for (const [key, value] of fields(node, options.repeated ?? "columns"))
        values.set(key, value);
      for (const key of values.keys()) headers.add(key);
      for (const value of values.values()) expandedCharacters += value.length;
      if (expandedCharacters > XML_TABLE_LIMITS.expandedCharacters)
        throw new Error(
          "The expanded table exceeds 16 million text characters. Turn off parent values or choose fewer records.",
        );
      if (
        headers.size > XML_TABLE_LIMITS.columns ||
        headers.size * selected.length > XML_TABLE_LIMITS.cells
      )
        throw new Error(
          "This table is too wide or large. Choose another layout or record path.",
        );
      records.push(values);
      if (index % 250 === 0) await pause(options.signal);
    }
    const columns = [...headers];
    if (options.alphabetical) columns.sort((a, b) => a.localeCompare(b));
    rows = [
      columns,
      ...records.map((row) => columns.map((c) => row.get(c) ?? "")),
    ];
    warnings.push(
      options.repeated === "json"
        ? "Repeated child items are stored as JSON in one cell, retaining their field relationships."
        : "Repeated child elements use indexed column names such as item[1]/name. Fields from every record are included.",
    );
    if (!options.parents && selected[0] !== inspection.root)
      warnings.push(
        "Parent values are excluded. Enable Copy parent values to include ancestor attributes and direct leaf fields.",
      );
  } else {
    const depth = inspection.nodes.reduce(
      (max, n) => Math.max(max, n.indexedPath.split("/").length - 1),
      0,
    );
    rows = [
      options.layout === "key-value"
        ? ["Path", "Value"]
        : options.layout === "elements"
          ? ["Path", "Value", "Attributes"]
          : [
              ...Array.from({ length: depth }, (_, i) => `Level ${i + 1}`),
              "Value",
              "Attributes",
            ],
    ];
    for (const [index, node] of inspection.nodes.entries()) {
      if (options.layout === "key-value") {
        for (const [key, value] of node.attributes)
          rows.push([node.indexedPath + "/@" + key, value]);
        if (node.text || !node.children.length)
          rows.push([
            node.indexedPath + (node.children.length ? "/#text" : ""),
            node.text,
          ]);
      } else {
        const attrs = JSON.stringify(Object.fromEntries(node.attributes));
        if (options.layout === "elements")
          rows.push([node.indexedPath, node.text, attrs]);
        else {
          const parts = node.indexedPath.split("/").slice(1);
          rows.push([
            ...parts,
            ...Array(depth - parts.length).fill(""),
            node.text,
            attrs,
          ]);
        }
      }
      if (rows.length > XML_TABLE_LIMITS.rows + 1)
        throw new Error(
          "This output exceeds 50,000 rows. Choose a record table or a smaller XML file.",
        );
      if (index % 250 === 0) await pause(options.signal);
    }
  }
  checkTable(rows);
  let convertedDates = 0;
  if (options.epochDates) {
    // Convert only values, never paths or attribute JSON. Explicit opt-in because
    // ten-digit identifiers and epoch seconds cannot be distinguished reliably.
    const valueColumns =
      options.layout === "table"
        ? rows[0].map((_, i) => i)
        : [
            options.layout === "key-value"
              ? 1
              : options.layout === "elements"
                ? 1
                : rows[0].length - 2,
          ];
    for (const [i, row] of rows.entries())
      if (i) {
        for (const j of valueColumns)
          if (/^\d{10}(?:\d{3})?$/.test(row[j])) {
            const value = Number(row[j]) * (row[j].length === 10 ? 1000 : 1),
              date = new Date(value);
            if (
              date.getUTCFullYear() >= 1970 &&
              date.getUTCFullYear() <= 2100
            ) {
              row[j] = date.toISOString().slice(0, 10);
              convertedDates++;
            }
          }
        if (i % 500 === 0) await pause(options.signal);
      }
    warnings.push(
      `${convertedDates} ten- or thirteen-digit values converted to UTC dates. Review numeric identifiers before using this option.`,
    );
  }
  return { rows, warnings, recordPath, convertedDates };
}

export async function parseDelimited(
  text: string,
  delimiter: string,
  signal?: AbortSignal,
): Promise<string[][]> {
  inputSize(text);
  check(signal);
  if (![",", ";", "\t", "|"].includes(delimiter))
    throw new Error("Choose comma, semicolon, tab or pipe as delimiter.");
  text = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false,
    recordQuoted = false,
    count = 0,
    line = 1;
  const cell = () => {
    row.push(field);
    field = "";
    closed = false;
    count++;
    if (row.length > 512 || count > XML_TABLE_LIMITS.cells)
      throw new Error("CSV exceeds 512 columns or one million cells.");
  };
  const record = () => {
    cell();
    if (recordQuoted || row.length > 1 || row.some((v) => v !== ""))
      rows.push(row);
    row = [];
    recordQuoted = false;
    if (rows.length > XML_TABLE_LIMITS.rows + 1)
      throw new Error("CSV exceeds 50,000 data rows.");
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else {
        field += ch;
        if (ch === "\n") line++;
      }
    } else if (ch === delimiter) cell();
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      record();
      line++;
    } else if (ch === '"' && !field && !closed) {
      quoted = true;
      recordQuoted = true;
    } else if (closed || ch === '"')
      throw new Error(
        `Invalid CSV quoting near line ${line}. Escape quotes by doubling them inside a quoted field.`,
      );
    else field += ch;
    if (i % 100_000 === 0) await pause(signal);
  }
  if (quoted)
    throw new Error(`A quoted CSV field is not closed near line ${line}.`);
  if (field || row.length || closed) record();
  if (!rows.length) throw new Error("The CSV has no non-empty rows.");
  checkTable(rows);
  return rows;
}
const xmlEscape = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
function elementName(value: string) {
  return (
    /^[\p{L}_][\p{L}\p{N}\p{M}_.-]*$/u.test(value) && !/^xmlns$/i.test(value)
  );
}
export async function tableXml(
  rows: string[][],
  options: { header: boolean; root: string; row: string; signal?: AbortSignal },
) {
  checkTable(rows);
  check(options.signal);
  if (
    !rows.length ||
    rows.some((row) => row.some((value) => invalidCharacters.test(value)))
  )
    throw new Error(
      "The table is empty or contains characters XML cannot store.",
    );
  if (!elementName(options.root) || !elementName(options.row))
    throw new Error(
      "Root and row names must be XML names: start with a letter or underscore, then letters, digits, underscores, hyphens or dots.",
    );
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0),
    header = options.header ? rows[0] : [],
    body = options.header ? rows.slice(1) : rows;
  if (
    body.length > XML_TABLE_LIMITS.rows ||
    width * body.length > XML_TABLE_LIMITS.cells
  )
    throw new Error(
      "This XML output exceeds 50,000 data rows or one million cells. Choose fewer rows or columns.",
    );
  if (!body.length)
    throw new Error(
      "CSV contains only a header. Add at least one data row or turn off Header row.",
    );
  const used = new Set<string>();
  const mapping = Array.from({ length: width }, (_, i) => {
    const source = header[i] ?? `column_${i + 1}`;
    let name = source
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^\p{L}\p{N}\p{M}_.-]/gu, "_");
    if (!elementName(name)) name = `column_${i + 1}`;
    const base = name;
    let suffix = 2;
    while (used.has(name)) name = base + "_" + suffix++;
    used.add(name);
    return { source, name };
  });
  const chunks = [
    `<?xml version="1.0" encoding="UTF-8"?>\n<${options.root}>\n`,
  ];
  let size = chunks[0].length;
  for (const [index, row] of body.entries()) {
    const part =
      `  <${options.row}>\n` +
      mapping
        .map(
          ({ name, source }, i) =>
            `    <${name}${name !== source ? ` column="${xmlEscape(source)}"` : ""}>${xmlEscape(row[i] ?? "")}</${name}>`,
        )
        .join("\n") +
      `\n  </${options.row}>\n`;
    size += part.length;
    if (size > XML_TABLE_LIMITS.output)
      throw new Error("XML output exceeds 64MB. Choose fewer rows.");
    chunks.push(part);
    if (index % 250 === 0) await pause(options.signal);
  }
  chunks.push(`</${options.root}>\n`);
  const text = chunks.join("");
  if (new TextEncoder().encode(text).length > XML_TABLE_LIMITS.output)
    throw new Error("XML output exceeds 64MB. Choose fewer rows.");
  return { text, mapping, rows: body.length };
}

export async function exportTable(
  data: TableData,
  options: {
    format: "xlsx" | "xls" | "csv";
    delimiter?: string;
    bom?: boolean;
    protectFormulas?: boolean;
    name: string;
    signal?: AbortSignal;
  },
) {
  checkTable(data.rows);
  check(options.signal);
  let protectedCells = 0;
  if (options.format === "csv") {
    const delimiter = options.delimiter ?? ",";
    if (![",", ";", "\t", "|"].includes(delimiter))
      throw new Error("Choose a supported CSV delimiter.");
    const chunks: string[] = [];
    let size = 0;
    for (const [i, row] of data.rows.entries()) {
      const line =
        row
          .map((original) => {
            let value = original;
            if (
              options.protectFormulas !== false &&
              (/^[\t\r\n]|^\s*[=+@]/.test(value) ||
                (/^\s*-/.test(value) &&
                  !/^\s*-(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?\s*$/.test(
                    value,
                  )))
            ) {
              value = "'" + value;
              protectedCells++;
            }
            return value.includes(delimiter) || /["\n\r]/.test(value)
              ? '"' + value.replace(/"/g, '""') + '"'
              : value;
          })
          .join(delimiter) + "\r\n";
      size += line.length;
      if (size > XML_TABLE_LIMITS.output)
        throw new Error("CSV output exceeds 64MB.");
      chunks.push(line);
      if (i % 500 === 0) await pause(options.signal);
    }
    const blob = new Blob([options.bom === false ? "" : "\uFEFF", ...chunks], {
      type: "text/csv;charset=utf-8",
    });
    if (blob.size > XML_TABLE_LIMITS.output)
      throw new Error("CSV output exceeds 64MB.");
    return {
      blob,
      filename: tableBaseName(options.name) + ".csv",
      protectedCells,
    };
  }
  if (!["xlsx", "xls"].includes(options.format))
    throw new Error("Choose XLSX, XLS or CSV.");
  if (options.format === "xls" && data.rows[0].length > 256)
    throw new Error(
      "XLS supports only 256 columns. Choose XLSX for this table.",
    );
  if (data.rows.some((row) => row.some((value) => value.length > 32767)))
    throw new Error(
      "A value exceeds Excel’s 32,767-character cell limit. Choose CSV or another XML layout.",
    );
  await pause(options.signal);
  const XLSX = await import("xlsx"),
    workbook = XLSX.utils.book_new(),
    sheet = XLSX.utils.aoa_to_sheet(data.rows);
  // Every value remains a string: identifiers, dates and formula-like text are
  // never inferred as numbers or executable spreadsheet formulas.
  XLSX.utils.book_append_sheet(workbook, sheet, "XML data");
  const bytes = XLSX.write(workbook, {
    type: "array",
    bookType: options.format === "xlsx" ? "xlsx" : "biff8",
    compression: true,
  });
  check(options.signal);
  const blob = new Blob([bytes], {
    type:
      options.format === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/vnd.ms-excel",
  });
  if (blob.size > XML_TABLE_LIMITS.output)
    throw new Error("Excel output exceeds 64MB. Choose fewer records.");
  return {
    blob,
    filename: tableBaseName(options.name) + "." + options.format,
    protectedCells,
  };
}
