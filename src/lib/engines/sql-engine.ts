/**
 * SQL Engine — SQL <-> rows, scoped specifically to INSERT statements (the
 * "data export/import as SQL" use case these tools target — a database
 * dump's INSERT statements, or generating INSERT statements from a
 * spreadsheet). Uses `node-sql-parser` for the parsing direction (verified
 * real: v5.4.0, 1000+ GitHub stars, actively maintained, pushed within the
 * last few months) — hand-rolling a SQL parser would be exactly the kind
 * of "fake it with regex" shortcut this project's honesty standard forbids;
 * SQL's grammar (nested expressions, varied quoting, escaped characters)
 * isn't something a regex can correctly parse.
 *
 * Deliberately NOT a general SQL engine: SELECT, UPDATE, DELETE, DDL, and
 * multi-table statements are out of scope. Every INSERT statement in a
 * file must target the same column list — mixing schemas across
 * statements produces a clear error, the same "don't silently misalign
 * data" rule CSV Merger already enforces.
 */

import type { Parser as SqlParserType } from "node-sql-parser";

interface SqlValueNode {
  type: string;
  value: unknown;
}

/** node-sql-parser returns quoted string literals with their escape
 *  sequences intact rather than resolved (verified directly: parsing
 *  'O\'Brien' or 'O''Brien' both come back as the literal, still-escaped
 *  text, backslash/doubled-quote and all) — so both of SQL's two real
 *  escaping conventions for an embedded single quote are unescaped here. */
function unescapeSqlString(value: string): string {
  return value.replace(/\\'/g, "'").replace(/''/g, "'");
}

function sqlValueToString(node: SqlValueNode | undefined): string {
  if (!node) return "";
  if (node.type === "null") return "";
  if (node.value === null || node.value === undefined) return "";
  if (node.type === "single_quote_string" || node.type === "string") {
    return unescapeSqlString(String(node.value));
  }
  return String(node.value);
}

/** Parses one or more `INSERT INTO table (...) VALUES (...), (...);`
 *  statements into the same `rows` shape (header row first) every other
 *  tool in this project uses. Every statement must share the exact same
 *  column list — this is a real, enforced constraint, not a silent
 *  best-effort merge. */
export async function sqlToRows(sqlText: string): Promise<string[][]> {
  const { Parser } = await import("node-sql-parser");
  const parser = new Parser() as SqlParserType;

  let ast: unknown;
  try {
    ast = parser.astify(sqlText, { database: "MySQL" });
  } catch (e) {
    throw new Error(`This doesn't look like valid SQL: ${e instanceof Error ? e.message : "parse failed"}`);
  }

  const statements = Array.isArray(ast) ? ast : [ast];
  const insertStatements = statements.filter(
    (s): s is { type: string; columns: string[]; values: { values: { value: SqlValueNode[] }[] } } =>
      typeof s === "object" && s !== null && (s as { type?: string }).type === "insert"
  );

  if (insertStatements.length === 0) {
    throw new Error("No INSERT statements were found. This tool only reads INSERT INTO ... VALUES ... statements.");
  }

  const columns = insertStatements[0].columns;
  if (!columns || columns.length === 0) {
    throw new Error("Couldn't determine the column list — this tool expects INSERT INTO table (col1, col2, ...) VALUES (...), with an explicit column list.");
  }

  const rows: string[][] = [columns];

  for (const statement of insertStatements) {
    if (JSON.stringify(statement.columns) !== JSON.stringify(columns)) {
      throw new Error("Every INSERT statement must target the exact same column list — this file has statements with different columns.");
    }
    for (const tuple of statement.values.values) {
      rows.push(columns.map((_, i) => sqlValueToString(tuple.value[i])));
    }
  }

  return rows;
}

function sqlEscapeString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function sanitizeTableName(name: string): string {
  const cleaned = name.trim().replace(/[^a-zA-Z0-9_]/g, "_");
  return cleaned.length > 0 && !/^[0-9]/.test(cleaned) ? cleaned : `table_${cleaned || "data"}`;
}

/** Generates a single `INSERT INTO table (...) VALUES (...), (...), ...;`
 *  statement from rows (header row first). Values that parse as real
 *  numbers are emitted unquoted; everything else is emitted as a quoted,
 *  escaped string — the same "guess numeric vs. text from the string
 *  itself" approach the hand-rolled XLSX writer already uses, since CSV/
 *  JSON/rows data carries no separate type information to draw from. */
export function rowsToSql(rows: string[][], tableName: string): string {
  if (rows.length === 0) {
    throw new Error("There are no rows to convert.");
  }
  const [header, ...body] = rows;
  if (body.length === 0) {
    throw new Error("This file has a header row but no data rows to convert.");
  }
  const table = sanitizeTableName(tableName);
  const columnList = header.map((h) => `\`${h.replace(/`/g, "")}\``).join(", ");

  const valueTuples = body.map((row) => {
    const values = header.map((_, i) => {
      const cell = row[i] ?? "";
      if (cell.trim() !== "" && !Number.isNaN(Number(cell))) {
        return cell;
      }
      return `'${sqlEscapeString(cell)}'`;
    });
    return `(${values.join(", ")})`;
  });

  return `INSERT INTO \`${table}\` (${columnList}) VALUES\n${valueTuples.join(",\n")};\n`;
}
