"use client";

import { FileSpreadsheet } from "lucide-react";
import { OfficeToPdfWorkspace } from "@/components/tool/OfficeToPdfWorkspace";
import { convertExcelFileToPdf, inspectExcelWorkbook } from "@/lib/engines/excel-to-pdf-engine";

const XLSX = { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] };
const fontByteCache = new Map<string, Uint8Array>();

export function ExcelToPdfClient() {
  return <OfficeToPdfWorkspace
    title="Excel to PDF"
    description="Convert one or many XLSX spreadsheets into clean, readable PDFs."
    buttonLabel="Select Excel files"
    dropLabel="or drop Excel files here"
    accepted={XLSX}
    extension="XLSX"
    icon={FileSpreadsheet}
    accent="emerald"
    toolName="excel-to-pdf"
    inspectSheets={inspectExcelWorkbook}
    convert={(file, progress, cancelled, sheets) => convertExcelFileToPdf(file, sheets, progress, cancelled, fontByteCache)}
    fidelityNote="Choose one sheet or several. Saved formula results, cell colours, row heights, column widths and the spreadsheet grid are preserved across readable PDF pages."
  />;
}
