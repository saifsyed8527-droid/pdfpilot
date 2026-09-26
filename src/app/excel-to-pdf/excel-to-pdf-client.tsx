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
    addButtonPosition="top"
    inspectSheets={inspectExcelWorkbook}
    convert={(file, progress, cancelled, sheets) => convertExcelFileToPdf(file, sheets, progress, cancelled, fontByteCache)}
    fidelityNote="Choose one sheet or several. Print populated cells with saved formula results, table colours and clickable web links. Long text wraps onto readable pages. Sheets with charts or pictures need Excel’s PDF export."
  />;
}
