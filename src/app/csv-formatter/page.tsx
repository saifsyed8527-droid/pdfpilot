import type { Metadata } from "next";
import { CsvFormatterClient } from "./csv-formatter-client";
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

const tool = getToolSeo("/csv-formatter")!;
const toolEntity = getTool("/csv-formatter")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/csv-formatter" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/csv-formatter",
    images: [{ url: "/og/csv-formatter.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/csv-formatter.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is formatting CSV with PDFPilot really free?",
    answer: "Yes. CSV Formatter is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The formatting runs entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What exactly does this normalize?",
    answer: "Quoting (a field is quoted only when it actually needs to be — contains a comma, quote, or newline) and line endings (standardized to CRLF, the RFC 4180 convention).",
  },
  {
    question: "Does this change my actual data?",
    answer: "No — cell values are preserved exactly. Only the formatting around them (quoting, line endings) is normalized.",
  },
  {
    question: "When would I need this?",
    answer: "CSV files exported from different tools sometimes use inconsistent quoting or line-ending conventions — normalizing them helps when combining or comparing files from different sources.",
  },
];

export default function CsvFormatterPage() {
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
      <CsvFormatterClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
