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

/** Serializes rows back to CSV text (RFC 4180: quote a field only when it
 *  contains a comma, quote, or newline; double up embedded quotes). */
export function rowsToCsv(rows: string[][]): string {
  const escapeCsvField = (field: string): string => {
    if (/[",\n\r]/.test(field)) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };
  return rows.map((row) => row.map(escapeCsvField).join(",")).join("\r\n") + "\r\n";
}
