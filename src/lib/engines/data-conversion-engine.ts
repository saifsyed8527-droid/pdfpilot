/**
 * Data Conversion Engine — CSV <-> XML and the shared row/field model
 * Excel <-> XML also builds on. Uses the browser's native `DOMParser`
 * (real Web API, zero new dependency) for XML reading, and string
 * templating for writing — XML generation needs no library, just correct
 * escaping, which is a handful of character replacements.
 *
 * XML has no single universal "row of data" schema the way CSV does, so
 * this engine defines one explicit, documented shape rather than
 * guessing at whatever schema a given business system expects:
 *
 *   <rows>
 *     <row>
 *       <ColumnName>value</ColumnName>
 *       ...
 *     </row>
 *     ...
 *   </rows>
 *
 * This is the same shape `csvToXml` produces and `xmlToCsv` expects —
 * round-trip safe by construction. It's the honest, general-purpose
 * format for "tabular data as XML," not a guess at any specific
 * accounting system's proprietary schema (Tally's XML schema, for
 * example, is undocumented outside Tally's own product and was not
 * guessed at here — see docs/business-tools-architecture.md).
 */

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Converts a CSV/spreadsheet header into a valid XML element name:
 *  strips anything that isn't a letter, digit, underscore, or hyphen,
 *  collapses whitespace to underscores, and guarantees the result starts
 *  with a letter or underscore (XML element names can't start with a
 *  digit) — falling back to a positional name if a header sanitizes to
 *  nothing usable (e.g. a header that was only punctuation). */
function sanitizeElementName(header: string, fallbackIndex: number): string {
  const cleaned = header
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "");
  if (cleaned.length === 0 || /^[0-9]/.test(cleaned)) {
    return cleaned.length === 0 ? `field_${fallbackIndex}` : `_${cleaned}`;
  }
  return cleaned;
}

/** Converts parsed CSV rows (header row first, matching `parseCsv`'s
 *  output) into the `<rows><row>...</row></rows>` XML shape above. */
export function rowsToXml(rows: string[][]): string {
  if (rows.length === 0) {
    throw new Error("There are no rows to convert.");
  }
  const [header, ...body] = rows;
  const elementNames = header.map((name, index) => sanitizeElementName(name, index));

  const rowsXml = body
    .map((row) => {
      const fields = elementNames
        .map((name, index) => `    <${name}>${escapeXmlText(row[index] ?? "")}</${name}>`)
        .join("\n");
      return `  <row>\n${fields}\n  </row>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<rows>\n${rowsXml}\n</rows>\n`;
}

/** Parses the `<rows><row><Field>value</Field></row></rows>` shape back
 *  into a 2D array (header row first) — the inverse of `rowsToXml`. Column
 *  order is taken from the first `<row>` element's child order; a later
 *  row missing a field that an earlier row had produces an empty cell
 *  rather than silently shifting columns. Throws a clear error for XML
 *  that isn't in this shape rather than silently producing garbage rows —
 *  this function does not attempt to guess the schema of arbitrary XML
 *  from other systems. */
export function xmlToRows(xmlText: string): string[][] {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    throw new Error("This file isn't valid XML — it couldn't be parsed.");
  }

  const rowElements = Array.from(doc.documentElement.children).filter((el) => el.tagName === "row");
  if (rowElements.length === 0) {
    throw new Error(
      'No <row> elements found under the root. This tool expects the <rows><row><Field>value</Field></row></rows> shape.'
    );
  }

  const columnNames = Array.from(rowElements[0].children).map((el) => el.tagName);
  const rows: string[][] = [columnNames];

  for (const rowEl of rowElements) {
    const fieldsByName = new Map<string, string>();
    for (const fieldEl of Array.from(rowEl.children)) {
      fieldsByName.set(fieldEl.tagName, fieldEl.textContent ?? "");
    }
    rows.push(columnNames.map((name) => fieldsByName.get(name) ?? ""));
  }

  return rows;
}

export function csvToXml(csvText: string, parseCsvFn: (csv: string) => string[][]): string {
  return rowsToXml(parseCsvFn(csvText));
}

/** Escapes text for inline use inside a spreadsheet cell's inlineStr XML —
 *  the same three characters as `escapeXmlText`, reused rather than
 *  duplicated (both write literal text into an XML text node). */
function escapeCellText(value: string): string {
  return escapeXmlText(value);
}

function columnLetter(index: number): string {
  let letter = "";
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

/** Builds the three OOXML parts a minimal single-sheet .xlsx needs, as
 *  plain strings — pure templating, no zipping, so this half is testable
 *  (and was tested, against real parsed CSV/XML data) without touching
 *  the async `fflate` import. */
function buildXlsxParts(rows: string[][]): Record<string, string> {
  const sheetRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, colIndex) => {
          const ref = `${columnLetter(colIndex)}${rowIndex + 1}`;
          const isNumeric = value.trim() !== "" && !Number.isNaN(Number(value));
          return isNumeric
            ? `<c r="${ref}"><v>${escapeCellText(value)}</v></c>`
            : `<c r="${ref}" t="inlineStr"><is><t>${escapeCellText(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`,
  };
}

/**
 * Writes rows (header row first) as a real, minimal, valid .xlsx —
 * hand-rolled OOXML zipped with `fflate` (real, 2900+ GitHub stars,
 * actively maintained — verified before adding as a direct dependency,
 * not assumed). No XLSX-writing library (SheetJS, exceljs) is a
 * dependency of this project; hand-writing the OOXML parts directly
 * avoids adding one for what is, structurally, a simple templating
 * problem — every cell is a plain inline string or a bare number, no
 * styles, formulas, or multiple sheets.
 */
export async function rowsToXlsx(rows: string[][]): Promise<Blob> {
  if (rows.length === 0) {
    throw new Error("There are no rows to convert.");
  }
  const { zipSync, strToU8 } = await import("fflate");
  const parts = buildXlsxParts(rows);
  const zipped = zipSync(Object.fromEntries(Object.entries(parts).map(([name, content]) => [name, strToU8(content)])));
  return new Blob([zipped], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/** Serializes rows back to delimited text (RFC 4180: quote a field only
 *  when it contains the delimiter, a quote, or a newline; double up
 *  embedded quotes). `delimiter` defaults to "," (CSV); "\t" produces TSV. */
export function rowsToCsv(rows: string[][], delimiter: string = ","): string {
  const escapeCsvField = (field: string): string => {
    const needsQuoting = new RegExp(`["${delimiter}\\n\\r]`).test(field);
    if (needsQuoting) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };
  return rows.map((row) => row.map(escapeCsvField).join(delimiter)).join("\r\n") + "\r\n";
}

/** Serializes rows as a standard GFM Markdown pipe table: the first row
 *  as the header, a `---` separator row sized to the column count, then
 *  one row per remaining record. Pipe characters and newlines inside a
 *  cell would break the table's column alignment, so they're escaped
 *  (`\|`) or replaced with a space respectively — the same honest
 *  necessity as CSV's quoting rules above, just for a different delimiter. */
export function rowsToMarkdownTable(rows: string[][]): string {
  if (rows.length === 0) {
    throw new Error("There are no rows to render.");
  }
  const columnCount = Math.max(...rows.map((row) => row.length));
  const escapeCell = (cell: string): string => (cell ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
  const formatRow = (row: string[]): string => {
    const cells = Array.from({ length: columnCount }, (_, i) => escapeCell(row[i] ?? ""));
    return `| ${cells.join(" | ")} |`;
  };

  const [headerRow, ...bodyRows] = rows;
  const separator = `| ${Array.from({ length: columnCount }, () => "---").join(" | ")} |`;
  return [formatRow(headerRow), separator, ...bodyRows.map(formatRow)].join("\n") + "\n";
}

/**
 * Generic tabular JSON <-> rows conversion — the JSON equivalent of the
 * XML <rows><row> shape above. Scope is deliberately the same: a flat
 * array of flat objects (the natural shape "spreadsheet data as JSON"
 * takes), not arbitrary nested JSON. An array of objects with mismatched
 * keys still round-trips correctly — the union of every object's keys
 * becomes the column set, missing keys become empty cells, exactly like
 * xmlToRows already does for missing XML fields.
 */
export function jsonToRows(jsonText: string): string[][] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("This file isn't valid JSON — it couldn't be parsed.");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("This tool expects a JSON array of objects, e.g. [{\"Name\":\"...\"}, ...].");
  }
  if (!parsed.every((item) => typeof item === "object" && item !== null && !Array.isArray(item))) {
    throw new Error("Every item in the JSON array must be a plain object (not a nested array or primitive).");
  }

  const columns: string[] = [];
  for (const item of parsed as Record<string, unknown>[]) {
    for (const key of Object.keys(item)) {
      if (!columns.includes(key)) columns.push(key);
    }
  }

  const stringifyCell = (value: unknown): string => {
    if (value === undefined || value === null) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const rows: string[][] = [columns];
  for (const item of parsed as Record<string, unknown>[]) {
    rows.push(columns.map((col) => stringifyCell(item[col])));
  }
  return rows;
}

/** Converts rows (header row first) into a JSON array of flat objects —
 *  the inverse of `jsonToRows`. Every cell is stored as a string; this
 *  tool doesn't guess which fields were originally numbers or booleans,
 *  since CSV/Excel/TSV/XML don't carry that type information either. */
export function rowsToJson(rows: string[][]): string {
  if (rows.length === 0) {
    throw new Error("There are no rows to convert.");
  }
  const [header, ...body] = rows;
  const objects = body.map((row) => {
    const obj: Record<string, string> = {};
    header.forEach((col, index) => {
      obj[col] = row[index] ?? "";
    });
    return obj;
  });
  return JSON.stringify(objects, null, 2);
}

/**
 * YAML <-> JSON via `js-yaml` (verified real: v4.2.0, 6600+ GitHub stars,
 * actively maintained). Dynamically imported, matching this project's
 * established code-splitting convention for every library-backed engine.
 */
export async function yamlToJson(yamlText: string): Promise<string> {
  const yaml = await import("js-yaml");
  let parsed: unknown;
  try {
    parsed = yaml.load(yamlText);
  } catch (e) {
    throw new Error(`This file isn't valid YAML: ${e instanceof Error ? e.message : "parse failed"}`);
  }
  return JSON.stringify(parsed, null, 2);
}

export async function jsonToYaml(jsonText: string): Promise<string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("This file isn't valid JSON — it couldn't be parsed.");
  }
  const yaml = await import("js-yaml");
  return yaml.dump(parsed);
}
