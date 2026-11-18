"use client";
import { useWorkspaceText } from "@/components/i18n/WorkspaceText";


import { FileSpreadsheet } from "lucide-react";
import { OfficeToPdfWorkspace } from "@/components/tool/OfficeToPdfWorkspace";
import { convertExcelFileToPdf, inspectExcelSheetChoices } from "@/lib/engines/excel-to-pdf-engine";

const excelFiles = {
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
};
const fontByteCache = new Map<string, Uint8Array>();

export function ExcelToPdfClient() {
  const __copy = useWorkspaceText();
  return <OfficeToPdfWorkspace
    title={__copy("Excel to PDF")}
    description={__copy("Convert XLSX and Excel 97–2003 XLS spreadsheets to PDF. Choose which sheets to include.")}
    buttonLabel={__copy("Select Excel files")}
    dropLabel={__copy("or drop Excel files here")}
    accepted={excelFiles}
    extension="XLSX or XLS"
    icon={FileSpreadsheet}
    accent="emerald"
    toolName="excel-to-pdf"
    addButtonPosition="top"
    inspectSheets={inspectExcelSheetChoices}
    convert={(file, progress, cancelled, sheets) => convertExcelFileToPdf(file, sheets, progress, cancelled, fontByteCache)}
    fidelityNote="XLSX supports cells, embedded pictures and standard 2D charts. Excel 97–2003 XLS exports cell values, number formats, merged cells and web links in a table. For XLS drawings or charts, save a copy as XLSX first. Hidden sheets are marked and start unchecked."
  />;
}
