export interface DataWorkflow {
  slug: string;
  title: string;
  tools: [string, string];
  steps: [string, string];
  description: string;
  sample: string;
  input: string;
  output: string;
  example: string;
  limitation: string;
}
export const DATA_WORKFLOWS: readonly DataWorkflow[] = [
  { slug: "deduplicate-csv-and-export-json", title: "Remove duplicate CSV rows and export JSON", tools: ["duplicate-row-remover", "csv-to-json"], steps: ["Remove exact duplicate rows", "Convert the remaining rows to JSON objects"], input: "csv", output: "json", sample: "repeated.csv",
    description: "Clean an appended stock export and hand the unique records to a JSON importer in one run.", example: "The practice CSV has four data rows. A17 appears twice with identical values. The JSON download has three objects and one A17 record.", limitation: "Rows must match across every field to count as duplicates. CSV values become JSON strings, including numeric-looking quantities." },
  { slug: "clean-csv-and-create-excel-workbook", title: "Clean a CSV and create an Excel workbook", tools: ["csv-cleaner", "csv-to-excel"], steps: ["Trim cells and remove blank rows", "Write the cleaned table to XLSX"], input: "csv", output: "xlsx", sample: "untidy.csv",
    description: "Give a spreadsheet reviewer a clean workbook from an import containing padded values and empty lines.", example: "The practice input has a blank row and spaces around A17. Open the workbook to find a header and three stock records with clean identifiers.", limitation: "CSV carries values rather than workbook formatting or formulas. Keep the source if leading or trailing spaces are meaningful." },
  { slug: "turn-json-records-into-a-markdown-table", title: "Convert JSON records into a Markdown table", tools: ["json-to-csv", "csv-to-markdown-table"], steps: ["Arrange JSON records into CSV columns", "Render the columns as a Markdown table"], input: "json", output: "md", sample: "stock.json",
    description: "Turn an array from an API response into a table that can be pasted into a README or issue description.", example: "The three example records become three Markdown body rows. The second item, Pens, blue, stays in a single table cell.", limitation: "Use an array of objects for the table. Markdown is a display format and does not retain JSON value types." },
  { slug: "extract-sql-inserts-into-a-json-fixture", title: "Extract SQL INSERT values into a JSON fixture", tools: ["sql-to-csv", "csv-to-json"], steps: ["Read INSERT values into a table", "Use the column names as JSON keys"], input: "sql", output: "json", sample: "stock.sql",
    description: "Reuse the data in a small seed script without connecting to or executing queries on a database.", example: "The sample inserts three items into stock. In the JSON output, look for B04 with the item Pens, blue and units equal to the string 8.", limitation: "Supply supported INSERT statements for the same table with explicit column names. SELECT queries and database dumps are outside this workflow." },
  { slug: "turn-yaml-into-compact-json", title: "Convert YAML to compact JSON", tools: ["yaml-to-json", "json-minifier"], steps: ["Parse the YAML document", "Remove JSON formatting whitespace"], input: "yaml", output: "json", sample: "stock.yaml",
    description: "Build a compact JSON fixture from a readable YAML list without a separate minification step.", example: "Three YAML list entries become a one-line JSON array. In this sample the units are numbers and the space inside Pens, blue remains.", limitation: "Comments and other YAML presentation details have no JSON representation. Check scalar types if a consumer requires a strict schema." },
  { slug: "turn-csv-records-into-yaml", title: "Turn a CSV inventory into a YAML list", tools: ["csv-to-json", "json-to-yaml"], steps: ["Convert header-based CSV rows to objects", "Serialize the objects as a YAML sequence"], input: "csv", output: "yaml", sample: "stock.csv",
    description: "Turn spreadsheet records into a readable YAML fixture with stable field names for review.", example: "The sku column becomes a key in each of three YAML items. The B04 record retains its South zone and the comma inside its item name.", limitation: "Field names must be present and unique. Values start as CSV text, so inspect quantity types before using the YAML as application configuration." },
  { slug: "turn-tab-separated-data-into-sql-inserts", title: "Convert a tab-separated table to SQL INSERTs", tools: ["tsv-to-csv", "csv-to-sql"], steps: ["Read tab-delimited rows as a table", "Write INSERT statements for the destination table"], input: "tsv", output: "sql", sample: "stock.tsv",
    description: "Prepare a reviewable seed script from a tab-separated inventory file.", example: "With the default stock table, the script inserts three records. Locate C21 and verify the column order before running anything in a database.", limitation: "This workflow only writes a script. Review the SQL dialect, identifiers, types and quoting in your target database." },
  { slug: "clean-and-deduplicate-an-import-csv", title: "Trim and deduplicate a CSV before import", tools: ["csv-cleaner", "duplicate-row-remover"], steps: ["Trim fields and remove empty rows", "Remove rows that match after cleanup"], input: "csv", output: "csv", sample: "padded-duplicates.csv",
    description: "Catch duplicates that differ only by surrounding spaces, with cleanup and comparison in the right order.", example: "One A17 row contains padded values and another does not. After trimming they match and appear once in the three-record output.", limitation: "Deduplication compares complete normalized rows. Records that share an SKU but disagree in another column remain separate." },
];
export const DATA_WORKFLOW_ROOT = "/pdf-workflows/data";
export const dataWorkflowPath = (row: DataWorkflow) => DATA_WORKFLOW_ROOT + "/" + row.slug;
export const getDataWorkflow = (slug: string) => DATA_WORKFLOWS.find(row => row.slug === slug);
