import type { Metadata } from "next";
import { TsvToExcelClient } from "./tsv-to-excel-client";
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

const tool = getToolSeo("/tsv-to-excel")!;
const toolEntity = getTool("/tsv-to-excel")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/tsv-to-excel" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/tsv-to-excel",
    images: [{ url: "/og/tsv-to-excel.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/tsv-to-excel.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting TSV to Excel with PDFPilot really free?",
    answer: "Yes. TSV to Excel is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The conversion runs entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "Is the output a real Excel file?",
    answer: "Yes — a genuine, valid .xlsx workbook, with numeric-looking values stored as real numbers.",
  },
  {
    question: "Does this handle quoted fields in the source TSV?",
    answer: "Yes — quoted fields (including ones with embedded tabs) are parsed correctly before being written into the spreadsheet.",
  },
];

export default function TsvToExcelPage() {
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
      <TsvToExcelClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
