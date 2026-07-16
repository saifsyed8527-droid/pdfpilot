import type { Metadata } from "next";
import { JsonToExcelClient } from "./json-to-excel-client";
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

const tool = getToolSeo("/json-to-excel")!;
const toolEntity = getTool("/json-to-excel")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/json-to-excel" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/json-to-excel",
    images: [{ url: "/og/json-to-excel.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/json-to-excel.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting JSON to Excel with PDFPilot really free?",
    answer: "Yes. JSON to Excel is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The conversion runs entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "Is the output a real Excel file?",
    answer:
      "Yes — a genuine, valid .xlsx workbook you can open in Excel, Google Sheets, or LibreOffice, not a renamed CSV.",
  },
  {
    question: "What JSON structure does this tool expect?",
    answer: "A JSON array of flat objects, e.g. [{\"Name\":\"Alice\",\"Age\":30}, ...] — the same shape JSON to CSV expects.",
  },
  {
    question: "Are numbers stored as real numbers in the spreadsheet?",
    answer: "Yes — unlike this project's CSV/XML tools, this converter writes genuinely numeric cells for number-typed JSON values, so formulas referencing them work correctly.",
  },
  {
    question: "Does this support multiple sheets?",
    answer: "No — the output is always a single sheet, since a flat JSON array of objects doesn't carry any information about how it should be split across sheets.",
  },
];

export default function JsonToExcelPage() {
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
      <JsonToExcelClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
