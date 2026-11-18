import type { ComponentType } from "react";
import type { LocaleCode } from "./locales";
import type { ToolLandingCopy } from "./core-content";
import { ToolWorkspace as PdfToJpg } from "@/app/(english)/pdf-to-jpg/tool-page";
import { ToolWorkspace as JpgToPdf } from "@/app/(english)/jpg-to-pdf/tool-page";
import { ToolWorkspace as WordToPdf } from "@/app/(english)/word-to-pdf/tool-page";
import { ToolWorkspace as PowerpointToPdf } from "@/app/(english)/powerpoint-to-pdf/tool-page";
import { ToolWorkspace as ExcelToPdf } from "@/app/(english)/excel-to-pdf/tool-page";
import { ToolWorkspace as HtmlToPdf } from "@/app/(english)/html-to-pdf/tool-page";
import { ToolWorkspace as PdfToWord } from "@/app/(english)/pdf-to-word/tool-page";
import { ToolWorkspace as PdfToPowerpoint } from "@/app/(english)/pdf-to-powerpoint/tool-page";
import { ToolWorkspace as PdfToExcel } from "@/app/(english)/pdf-to-excel/tool-page";
import { ToolWorkspace as PdfToPdfa } from "@/app/(english)/pdf-to-pdfa/tool-page";
import { ToolWorkspace as DeletePages } from "@/app/(english)/delete-pages/tool-page";
import { ToolWorkspace as MergePdf } from "@/app/(english)/merge-pdf/tool-page";
import { ToolWorkspace as CompressPdf } from "@/app/(english)/compress-pdf/tool-page";
import { ToolWorkspace as SplitPdf } from "@/app/(english)/split-pdf/tool-page";
import { ToolWorkspace as ExtractPages } from "@/app/(english)/extract-pages/tool-page";
import { ToolWorkspace as OrganizePdf } from "@/app/(english)/organize-pdf/tool-page";
import { ToolWorkspace as ScanPdf } from "@/app/(english)/scan-pdf/tool-page";
import { ToolWorkspace as RepairPdf } from "@/app/(english)/repair-pdf/tool-page";
import { ToolWorkspace as OcrPdf } from "@/app/(english)/ocr-pdf/tool-page";
import { ToolWorkspace as RotatePdf } from "@/app/(english)/rotate-pdf/tool-page";
import { ToolWorkspace as AddPageNumbers } from "@/app/(english)/add-page-numbers/tool-page";
import { ToolWorkspace as WatermarkPdf } from "@/app/(english)/watermark-pdf/tool-page";
import { ToolWorkspace as CropPdf } from "@/app/(english)/crop-pdf/tool-page";
import { ToolWorkspace as EditPdf } from "@/app/(english)/edit-pdf/tool-page";
import { ToolWorkspace as FillPdf } from "@/app/(english)/fill-pdf/tool-page";
import { ToolWorkspace as ExcelToXml } from "@/app/(english)/excel-to-xml/tool-page";

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
