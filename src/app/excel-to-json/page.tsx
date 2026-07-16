import type { Metadata } from "next";
import { ExcelToJsonClient } from "./excel-to-json-client";
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

const tool = getToolSeo("/excel-to-json")!;
const toolEntity = getTool("/excel-to-json")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/excel-to-json" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/excel-to-json",
    images: [{ url: "/og/excel-to-json.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/excel-to-json.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting Excel to JSON with PDFPilot really free?",
    answer: "Yes. Excel to JSON is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The conversion runs entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "Does this work with multi-sheet workbooks?",
    answer:
      "It reads the first sheet only. Use Excel Sheet Extractor first if you need a specific sheet from a multi-sheet workbook converted instead.",
  },
  {
    question: "What does the JSON output look like?",
    answer: "An array of objects, one per row, keyed by the header row's column names.",
  },
  {
    question: "Are formulas converted to their calculated values?",
    answer: "Yes — this tool reads each cell's evaluated value, not its underlying formula text.",
  },
  {
    question: "What Excel formats are supported?",
    answer: "Both .xlsx and the older .xls format are accepted.",
  },
];

export default function ExcelToJsonPage() {
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
      <ExcelToJsonClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
