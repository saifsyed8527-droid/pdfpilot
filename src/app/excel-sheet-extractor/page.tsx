import type { Metadata } from "next";
import { ExcelSheetExtractorClient } from "./excel-sheet-extractor-client";
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

const tool = getToolSeo("/excel-sheet-extractor")!;
const toolEntity = getTool("/excel-sheet-extractor")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/excel-sheet-extractor" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/excel-sheet-extractor",
    images: [{ url: "/og/excel-sheet-extractor.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/excel-sheet-extractor.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is extracting an Excel sheet with PDFPilot really free?",
    answer: "Yes. Excel Sheet Extractor is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The extraction runs entirely in your browser using a real spreadsheet library. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "How do I choose which sheet to extract?",
    answer: "After uploading, every sheet in the workbook appears in a dropdown — pick the one you want and extract it as its own file.",
  },
  {
    question: "Is the output a real, standalone Excel file?",
    answer: "Yes — a genuine single-sheet .xlsx workbook you can open independently, not a reference back to the original file.",
  },
  {
    question: "Are formulas converted to their calculated values?",
    answer: "Yes — the extracted sheet contains each cell's evaluated value, not the underlying formula text.",
  },
];

export default function ExcelSheetExtractorPage() {
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
      <ExcelSheetExtractorClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
