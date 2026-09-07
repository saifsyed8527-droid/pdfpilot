"use client";

import { FileSpreadsheet } from "lucide-react";
import { OfficeToPdfWorkspace } from "@/components/tool/OfficeToPdfWorkspace";
import { convertOfficeFileToPdf } from "@/lib/engines/office-engine";

const XLSX = { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] };

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
    convert={(file, progress) => convertOfficeFileToPdf(file, progress)}
    fidelityNote="Text and table structure are preserved for readability. Cell styling, charts and exact spreadsheet grid layout are not reproduced."
  />;
}
