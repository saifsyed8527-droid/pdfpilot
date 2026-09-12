import type { Metadata } from "next";
import { PdfToExcelClient } from "./pdf-to-excel-client";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getBreadcrumbSchema,
  getFaqSchema,
  getSoftwareApplicationSchema,
  getToolSeo,
  type FaqInput,
} from "@/lib/seo";
import { getTool } from "@/lib/tools";
import { getContentReferencingTool } from "@/lib/content/tool-related";
import { resolveEntities } from "@/lib/content/registry";
import { getClusterMembers } from "@/lib/content/topic-clusters";

const tool = getToolSeo("/pdf-to-excel")!;
const toolEntity = getTool("/pdf-to-excel")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/pdf-to-excel",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/pdf-to-excel",
    images: [{ url: "/og/pdf-to-excel.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/pdf-to-excel.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting PDF to Excel with PDFPilot really free?",
    answer: "Yes. PDF to Excel is free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The conversion runs entirely in your browser. Your PDF is never uploaded to PDFPilot's servers.",
  },
  {
    question: "Does this work with scanned PDFs?",
    answer:
      "Scanned PDFs need OCR before table data can be extracted. This tool currently converts PDFs that already contain selectable text.",
  },
  {
    question: "Can I choose one Excel sheet or multiple sheets?",
    answer:
      "Yes. You can place all detected tables into one worksheet, or create a separate worksheet for each PDF page that contains table-like data.",
  },
  {
    question: "Will complex tables be perfect?",
    answer:
      "PDFs do not store tables as spreadsheet rows and columns, so PDFPilot detects table-like alignment from positioned text. Merged cells and irregular layouts may need review after conversion.",
  },
];

export default function PdfToExcelPage() {
  return (
    <>
      {tool && (
        <JsonLd
          data={[
            getSoftwareApplicationSchema(tool),
            getBreadcrumbSchema([
              { name: "Home", path: "/" },
              { name: tool.name, path: tool.path },
            ]),
            getFaqSchema(faqs),
          ]}
        />
      )}
      <PdfToExcelClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
