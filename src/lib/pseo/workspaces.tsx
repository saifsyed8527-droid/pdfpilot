"use client";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { ToolLandingCopy } from "../i18n/core-content";
import type { FaqInput } from "../seo";
import type { ResolvedEntity } from "../content/registry";
type ToolProps = { landingCopy?: ToolLandingCopy; faqs: FaqInput[]; related: ResolvedEntity[]; templateSession?: never };
// Load exactly one original full client workspace, retaining its upload/state/processor/download flow.
// FAQs/related entries are surrounding page content, never processing configuration.
const workspaces: Record<string, ComponentType<ToolProps>> = {
  "jpg-to-pdf": dynamic<ToolProps>(() => import("../../app/jpg-to-pdf/jpg-to-pdf-client").then(module => module.JpgToPdfClient)),
  "word-to-pdf": dynamic<ToolProps>(() => import("../../app/word-to-pdf/word-to-pdf-client").then(module => module.WordToPdfClient)),
  "powerpoint-to-pdf": dynamic<ToolProps>(() => import("../../app/powerpoint-to-pdf/powerpoint-to-pdf-client").then(module => module.PowerpointToPdfClient)),
  "excel-to-pdf": dynamic<ToolProps>(() => import("../../app/excel-to-pdf/excel-to-pdf-client").then(module => module.ExcelToPdfClient)),
  "html-to-pdf": dynamic<ToolProps>(() => import("../../app/html-to-pdf/html-to-pdf-client").then(module => module.HtmlToPdfClient)),
  "pdf-to-jpg": dynamic<ToolProps>(() => import("../../app/pdf-to-jpg/pdf-to-jpg-client").then(module => module.PdfToJpgClient)),
  "pdf-to-word": dynamic<ToolProps>(() => import("../../app/pdf-to-word/pdf-to-word-client").then(module => module.PdfToWordClient)),
  "pdf-to-powerpoint": dynamic<ToolProps>(() => import("../../app/pdf-to-powerpoint/pdf-to-powerpoint-client").then(module => module.PdfToPowerpointClient)),
  "pdf-to-excel": dynamic<ToolProps>(() => import("../../app/pdf-to-excel/pdf-to-excel-client").then(module => module.PdfToExcelClient)),
  "pdf-to-pdfa": dynamic<ToolProps>(() => import("../../app/pdf-to-pdfa/pdf-to-pdfa-client").then(module => module.PdfToPdfaClient)),
  "merge-pdf": dynamic<ToolProps>(() => import("../../app/merge-pdf/merge-pdf-client").then(module => module.MergePdfClient)),
  "split-pdf": dynamic<ToolProps>(() => import("../../app/split-pdf/split-pdf-client").then(module => module.SplitPdfClient)),
  "delete-pages": dynamic<ToolProps>(() => import("../../app/delete-pages/delete-pages-client").then(module => module.DeletePagesClient)),
  "extract-pages": dynamic<ToolProps>(() => import("../../app/extract-pages/extract-pages-client").then(module => module.ExtractPagesClient)),
  "organize-pdf": dynamic<ToolProps>(() => import("../../app/organize-pdf/organize-pdf-client").then(module => module.OrganizePdfClient)),
  "rotate-pdf": dynamic<ToolProps>(() => import("../../app/rotate-pdf/rotate-pdf-client").then(module => module.RotatePdfClient)),
  "compress-pdf": dynamic<ToolProps>(() => import("../../app/compress-pdf/compress-pdf-client").then(module => module.CompressPdfClient)),
  "repair-pdf": dynamic<ToolProps>(() => import("../../app/repair-pdf/repair-pdf-client").then(module => module.RepairPdfClient)),
  "ocr-pdf": dynamic<ToolProps>(() => import("../../app/ocr-pdf/ocr-pdf-client").then(module => module.OcrPdfClient)),
  "scan-pdf": dynamic<ToolProps>(() => import("../../app/scan-pdf/scan-pdf-client").then(module => module.ScanPdfClient)),
  "add-page-numbers": dynamic<ToolProps>(() => import("../../app/add-page-numbers/add-page-numbers-client").then(module => module.AddPageNumbersClient)),
  "watermark-pdf": dynamic<ToolProps>(() => import("../../app/watermark-pdf/watermark-pdf-client").then(module => module.WatermarkPdfClient)),
  "crop-pdf": dynamic<ToolProps>(() => import("../../app/crop-pdf/crop-pdf-client").then(module => module.CropPdfClient)),
  "edit-pdf": dynamic<ToolProps>(() => import("../../app/edit-pdf/edit-pdf-client").then(module => module.EditPdfClient)),
  "fill-pdf": dynamic<ToolProps>(() => import("../../app/fill-pdf/fill-pdf-client").then(module => module.FillPdfClient)),
  "excel-to-xml": dynamic<ToolProps>(() => import("../../app/excel-to-xml/excel-to-xml-client").then(module => module.ExcelToXmlClient)),
};
export function IntentTool({ toolId, ...props }: ToolProps & { toolId: string }) {
  const Workspace = workspaces[toolId];
  if (!Workspace) throw new Error(`No public workspace: ${toolId}`);
  return <Workspace {...props} />;
}
