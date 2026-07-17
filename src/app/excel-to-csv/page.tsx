import type { Metadata } from "next";
import { ExcelToCsvClient } from "./excel-to-csv-client";
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

const tool = getToolSeo("/excel-to-csv")!;
const toolEntity = getTool("/excel-to-csv")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/excel-to-csv" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/excel-to-csv",
    images: [{ url: "/og/excel-to-csv.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/excel-to-csv.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting Excel to CSV with PDFPilot really free?",
    answer: "Yes. Excel to CSV is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The conversion runs entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "Which sheet does this convert if my workbook has more than one?",
    answer:
      "Only the first sheet. Use Excel Sheet Extractor first if you need to pick a specific sheet from a multi-sheet workbook.",
  },
  {
    question: "What CSV format does the output use?",
    answer:
      "Standard RFC 4180: fields are quoted only when they contain a comma, quote, or newline, with CRLF line endings — the same format every other CSV tool on this site produces.",
  },
];

export default function ExcelToCsvPage() {
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
      <ExcelToCsvClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
