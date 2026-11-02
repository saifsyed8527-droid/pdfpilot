import type { Metadata } from "next";
import { XmlToCsvClient } from "./xml-to-csv-client";
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

const tool = getToolSeo("/xml-to-csv")!;
const toolEntity = getTool("/xml-to-csv")!;
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
    canonical: "/xml-to-csv",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/xml-to-csv",
    images: [
      {
        url: "/og/xml-to-csv.png",
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
    images: ["/og/xml-to-csv.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "What XML can I convert?",
    answer:
      "Nested XML, repeated records, attributes and namespaces are supported. Select a record table or use path-based layouts for irregular documents. Fields found only in later records are included.",
  },
  {
    question: "Can I change the CSV layout?",
    answer:
      "Choose comma, semicolon, tab or pipe; sort table columns; select a record path; copy parent values; choose separate columns or JSON cells for repeated children. Preview the result before downloading.",
  },
  {
    question: "How are Unicode and formulas handled?",
    answer:
      "CSV is UTF-8, with an optional Excel marker. Formula-like values can be prefixed with an apostrophe. CSV readers may still infer numbers or dates; use XML to Excel when identifiers must remain text cells.",
  },
  {
    question: "Are invalid files ignored?",
    answer:
      "No. Malformed XML produces an error so that content is not silently discarded. DTDs and custom entities are not loaded. Correct the source file and replace it to retry.",
  },
  {
    question: "Are my files uploaded?",
    answer:
      "Local files and pasted text stay in your browser. URL import fetches a public file through PDFPilot’s server. Local inputs are limited to 8MB; URL imports to 4MB.",
  },
];

export default function XmlToCsvPage() {
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
      <XmlToCsvClient
        faqs={faqs}
        related={[...relatedTools, ...relatedContent, ...clusterMembers]}
      />
    </>
  );
}
