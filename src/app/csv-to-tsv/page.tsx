import type { Metadata } from "next";
import { CsvToTsvClient } from "./csv-to-tsv-client";
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

const tool = getToolSeo("/csv-to-tsv")!;
const toolEntity = getTool("/csv-to-tsv")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/csv-to-tsv" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/csv-to-tsv",
    images: [{ url: "/og/csv-to-tsv.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/csv-to-tsv.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting CSV to TSV with PDFPilot really free?",
    answer: "Yes. CSV to TSV is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The conversion runs entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "Why would I need TSV instead of CSV?",
    answer: "Some import tools and databases expect tab-separated data specifically, particularly when the data itself contains commas that would otherwise need extensive quoting.",
  },
  {
    question: "What happens to values that contain tabs?",
    answer: "They're automatically wrapped in quotes in the TSV output, so a tab inside a value isn't mistaken for a column separator.",
  },
  {
    question: "Does this handle quoted fields with embedded commas in the source CSV?",
    answer: "Yes — quoted fields are parsed correctly following RFC 4180 rules before being re-written as TSV.",
  },
];

export default function CsvToTsvPage() {
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
      <CsvToTsvClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
