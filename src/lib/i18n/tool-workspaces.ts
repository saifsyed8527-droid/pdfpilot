import type { ComponentType } from "react";
import type { LocaleCode } from "./locales";
import type { ToolLandingCopy } from "./core-content";
import { ToolWorkspace as PdfToJpg } from "@/app/pdf-to-jpg/tool-page";
import { ToolWorkspace as JpgToPdf } from "@/app/jpg-to-pdf/tool-page";
import { ToolWorkspace as WordToPdf } from "@/app/word-to-pdf/tool-page";
import { ToolWorkspace as PowerpointToPdf } from "@/app/powerpoint-to-pdf/tool-page";
import { ToolWorkspace as ExcelToPdf } from "@/app/excel-to-pdf/tool-page";
import { ToolWorkspace as HtmlToPdf } from "@/app/html-to-pdf/tool-page";
import { ToolWorkspace as PdfToWord } from "@/app/pdf-to-word/tool-page";
import { ToolWorkspace as PdfToPowerpoint } from "@/app/pdf-to-powerpoint/tool-page";
import { ToolWorkspace as PdfToExcel } from "@/app/pdf-to-excel/tool-page";
import { ToolWorkspace as PdfToPdfa } from "@/app/pdf-to-pdfa/tool-page";
import { ToolWorkspace as DeletePages } from "@/app/delete-pages/tool-page";
import { ToolWorkspace as MergePdf } from "@/app/merge-pdf/tool-page";
import { ToolWorkspace as CompressPdf } from "@/app/compress-pdf/tool-page";
import { ToolWorkspace as SplitPdf } from "@/app/split-pdf/tool-page";
import { ToolWorkspace as ExtractPages } from "@/app/extract-pages/tool-page";
import { ToolWorkspace as OrganizePdf } from "@/app/organize-pdf/tool-page";
import { ToolWorkspace as ScanPdf } from "@/app/scan-pdf/tool-page";
import { ToolWorkspace as RepairPdf } from "@/app/repair-pdf/tool-page";
import { ToolWorkspace as OcrPdf } from "@/app/ocr-pdf/tool-page";
import { ToolWorkspace as RotatePdf } from "@/app/rotate-pdf/tool-page";
import { ToolWorkspace as AddPageNumbers } from "@/app/add-page-numbers/tool-page";
import { ToolWorkspace as WatermarkPdf } from "@/app/watermark-pdf/tool-page";
import { ToolWorkspace as CropPdf } from "@/app/crop-pdf/tool-page";
import { ToolWorkspace as EditPdf } from "@/app/edit-pdf/tool-page";
import { ToolWorkspace as FillPdf } from "@/app/fill-pdf/tool-page";
import { ToolWorkspace as ExcelToXml } from "@/app/excel-to-xml/tool-page";

/** One workspace implementation per tool; never substitute a translated marketing page. */
export const TOOL_WORKSPACES: Record<string, ComponentType<{ landingCopy?: ToolLandingCopy; locale?: LocaleCode }>> = {
  "pdf-to-jpg": PdfToJpg,
  "jpg-to-pdf": JpgToPdf,
  "word-to-pdf": WordToPdf,
  "powerpoint-to-pdf": PowerpointToPdf,
  "excel-to-pdf": ExcelToPdf,
  "html-to-pdf": HtmlToPdf,
  "pdf-to-word": PdfToWord,
  "pdf-to-powerpoint": PdfToPowerpoint,
  "pdf-to-excel": PdfToExcel,
  "pdf-to-pdfa": PdfToPdfa,
  "delete-pages": DeletePages,
  "merge-pdf": MergePdf,
  "compress-pdf": CompressPdf,
  "split-pdf": SplitPdf,
  "extract-pages": ExtractPages,
  "organize-pdf": OrganizePdf,
  "scan-pdf": ScanPdf,
  "repair-pdf": RepairPdf,
  "ocr-pdf": OcrPdf,
  "rotate-pdf": RotatePdf,
  "add-page-numbers": AddPageNumbers,
  "watermark-pdf": WatermarkPdf,
  "crop-pdf": CropPdf,
  "edit-pdf": EditPdf,
  "fill-pdf": FillPdf,
  "excel-to-xml": ExcelToXml,
};
