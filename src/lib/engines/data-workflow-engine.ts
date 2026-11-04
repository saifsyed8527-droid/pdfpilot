import { cleanCsv, deduplicateCsvRows, minifyJson } from "./format-engine";
import { jsonToRows, jsonToYaml, rowsToCsv, rowsToJson, rowsToMarkdownTable, rowsToXlsx, yamlToJson } from "./data-conversion-engine";
import { parseCsv } from "./text-engine";
import type { DataWorkflow } from "../content/data-workflows";

export const WORKFLOW_INPUT_LIMIT = 1024 * 1024;
const types: Record<string, string> = { json: "application/json", md: "text/markdown", csv: "text/csv", sql: "application/sql", yaml: "application/yaml" };
function table(text: string, delimiter = ",") {
  const rows = parseCsv(text, delimiter);
  if (rows.length < 2) throw new Error("Include a header and at least one data row.");
  const headers = rows[0].map(header => header.trim());
  if (headers.some(header => !header) || new Set(headers).size !== headers.length) throw new Error("Give every column a nonempty, unique header.");
  if (rows.some(row => row.length !== headers.length)) throw new Error("Every data row must match the number of headers.");
  return rows;
}
export async function runDataWorkflow(workflow: DataWorkflow, source: string, tableName = "stock"): Promise<Blob> {
  const text = source.replace(/^\uFEFF/, "");
  if (!text.trim()) throw new Error("Choose a file containing data.");
  if (new TextEncoder().encode(text).length > WORKFLOW_INPUT_LIMIT) throw new Error("Choose a file of 1 MiB or less.");
  let result: string;
  switch (workflow.slug) {
    case "deduplicate-csv-and-export-json": result = rowsToJson(table(deduplicateCsvRows(text))); break;
    case "clean-csv-and-create-excel-workbook": return rowsToXlsx(table(cleanCsv(text)));
    case "turn-json-records-into-a-markdown-table": result = rowsToMarkdownTable(table(rowsToCsv(jsonToRows(text)))); break;
    case "extract-sql-inserts-into-a-json-fixture": {
      const { sqlToRows } = await import("./sql-engine");
      result = rowsToJson(table(rowsToCsv(await sqlToRows(text))));
      break;
    }
    case "turn-yaml-into-compact-json": result = minifyJson(await yamlToJson(text)); break;
    case "turn-csv-records-into-yaml": result = await jsonToYaml(rowsToJson(table(text))); break;
    case "turn-tab-separated-data-into-sql-inserts": {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(tableName)) throw new Error("Use a table name of at most 63 letters, numbers or underscores, starting with a letter or underscore.");
      const { rowsToSql } = await import("./sql-engine");
      result = rowsToSql(table(rowsToCsv(table(text, "\t"))), tableName);
      break;
    }
    case "clean-and-deduplicate-an-import-csv": {
      const clean = cleanCsv(text);
      table(clean);
      result = deduplicateCsvRows(clean);
      break;
    }
    default: throw new Error("Unknown data workflow.");
  }
  return new Blob([result], { type: types[workflow.output] });
}
