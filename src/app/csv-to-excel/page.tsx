import type { Metadata } from "next";
import { CsvToExcelClient } from "./csv-to-excel-client";
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

const tool = getToolSeo("/csv-to-excel")!;
const toolEntity = getTool("/csv-to-excel")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/csv-to-excel" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/csv-to-excel",
    images: [{ url: "/og/csv-to-excel.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/csv-to-excel.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting CSV to Excel with PDFPilot really free?",
    answer: "Yes. CSV to Excel is completely free to use, with no sign-up or account required.",
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
    question: "Does this handle quoted fields and commas inside values correctly?",
    answer:
      "Yes — this tool parses CSV using the same RFC 4180 quoting rules (quoted fields, embedded commas, escaped quotes) every other CSV tool on this site uses.",
  },
  {
    question: "Are numbers stored as real numbers in the spreadsheet?",
    answer:
      "Yes — number-looking values are written as genuinely numeric cells, so formulas referencing them work correctly.",
  },
];

export default function CsvToExcelPage() {
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
      <CsvToExcelClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
