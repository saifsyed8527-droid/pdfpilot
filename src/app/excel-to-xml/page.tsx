import type { Metadata } from "next";
import { ExcelToXmlClient } from "./excel-to-xml-client";
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

const tool = getToolSeo("/excel-to-xml")!;
const toolEntity = getTool("/excel-to-xml")!;
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
    canonical: "/excel-to-xml",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/excel-to-xml",
    images: [{ url: "/og/excel-to-xml.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/excel-to-xml.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting Excel to XML with PDFPilot really free?",
    answer: "Yes. Excel to XML is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The conversion happens entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What XML structure does this produce?",
    answer:
      "<rows><row><ColumnName>value</ColumnName>...</row></rows> — one <row> per spreadsheet row, one child element per column, named after that column's header row.",
  },
  {
    question: "Does this convert every sheet in my workbook?",
    answer:
      "No — only the first sheet with data. A workbook with multiple sheets will have the rest left out of the XML. This is a real, disclosed limitation, not a bug.",
  },
  {
    question: "Will this match my accounting or ERP system's exact XML schema?",
    answer:
      "Not necessarily. This produces a generic, honest row/field XML structure — it does not attempt to match any specific proprietary system's schema, including Tally's, which isn't publicly documented and isn't guessed at here.",
  },
  {
    question: "What happens with formulas or formatting in my spreadsheet?",
    answer:
      "Only the calculated cell values are converted — formulas, cell formatting, colors, and charts aren't preserved, since XML has no equivalent concept for them.",
  },
];

export default function ExcelToXmlPage() {
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
      <ExcelToXmlClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
