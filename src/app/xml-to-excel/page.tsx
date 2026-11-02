import type { Metadata } from "next";
import { XmlToExcelClient } from "./xml-to-excel-client";
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

const tool = getToolSeo("/xml-to-excel")!;
const toolEntity = getTool("/xml-to-excel")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id })),
);
const existingPaths = new Set(
  [...relatedTools, ...relatedContent].map((e) => e.path),
);
const clusterMembers = getClusterMembers(toolEntity.id).filter(
  (member) => !existingPaths.has(member.path),
);

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/xml-to-excel",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/xml-to-excel",
    images: [
      {
        url: "/og/xml-to-excel.png",
        width: 1200,
        height: 630,
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/xml-to-excel.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is XML to Excel free?",
    answer:
      "Yes. Convert on your device without an account. Files up to 8MB are supported.",
  },
  {
    question: "Can I convert nested XML?",
    answer:
      "Yes. Choose a record table, Key / Value, one row per element, or nested levels. Attributes and fields introduced in later records are retained. Table mode lets you select a record path and copy parent values.",
  },
  {
    question: "Will identifiers and formulas change?",
    answer:
      "All XLSX and XLS cells are stored as text. Leading zeros, long identifiers, date strings and formula-like values are not interpreted as numbers or formulas. You can explicitly opt in to converting epoch timestamps.",
  },
  {
    question: "What are the limits?",
    answer:
      "Up to 100,000 XML elements, 64 nested levels, 50,000 output rows, 512 columns and one million cells. XLS is limited to 256 columns. Excel cells support up to 32,767 characters. Malformed XML, DTDs and custom entities are rejected.",
  },
  {
    question: "Are my files uploaded?",
    answer:
      "Local files and pasted text are converted in your browser. Import from URL fetches a public file up to 4MB through PDFPilot’s server, then converts it on your device.",
  },
];

export default function XmlToExcelPage() {
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
      <XmlToExcelClient
        faqs={faqs}
        related={[...relatedTools, ...relatedContent, ...clusterMembers]}
      />
    </>
  );
}
