import type { Metadata } from "next";
import { CsvToXmlClient } from "./csv-to-xml-client";
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

const tool = getToolSeo("/csv-to-xml")!;
const toolEntity = getTool("/csv-to-xml")!;
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
    canonical: "/csv-to-xml",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/csv-to-xml",
    images: [{ url: "/og/csv-to-xml.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/csv-to-xml.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting CSV to XML with PDFPilot really free?",
    answer: "Yes. CSV to XML is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The conversion happens entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What XML structure does this produce?",
    answer:
      "<rows><row><ColumnName>value</ColumnName>...</row></rows> — one <row> per CSV row, one child element per column, named after that column's header.",
  },
  {
    question: "What happens if a column header isn't a valid XML element name?",
    answer:
      "It's sanitized: spaces become underscores, punctuation is stripped, and a name starting with a digit gets an underscore prefix. A header that sanitizes to nothing usable falls back to a positional name like field_2.",
  },
  {
    question: "Will this XML match my accounting or ERP system's exact schema?",
    answer:
      "Not necessarily. This produces a generic, honest row/field XML structure — it does not attempt to match any specific proprietary system's schema (for example, Tally's XML format, which isn't publicly documented and isn't guessed at here).",
  },
];

export default function CsvToXmlPage() {
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
      <CsvToXmlClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
