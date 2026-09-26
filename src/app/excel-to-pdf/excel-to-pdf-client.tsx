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
    fidelityNote="Include cells, embedded pictures and standard 2D charts. Saved chart data, sheet positions, colours and clickable web links stay together; page breaks keep graphics whole. Excel-only objects and unsupported chart features show a clear error instead of disappearing. Conversion stays in your browser."
  />;
}
