import type { Metadata } from "next";
import { CsvCleanerClient } from "./csv-cleaner-client";
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

const tool = getToolSeo("/csv-cleaner")!;
const toolEntity = getTool("/csv-cleaner")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/csv-cleaner" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/csv-cleaner",
    images: [{ url: "/og/csv-cleaner.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/csv-cleaner.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is cleaning CSV files with PDFPilot really free?",
    answer: "Yes. CSV Cleaner is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The cleaning runs entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What exactly counts as an \"empty row\"?",
    answer: "A row where every cell is empty after trimming whitespace — a row with even one non-blank cell is kept.",
  },
  {
    question: "Does this remove duplicate rows?",
    answer: "No — this tool only handles whitespace and empty rows. Use Duplicate Row Remover separately for exact duplicate rows.",
  },
  {
    question: "Is the header row treated specially?",
    answer: "No — it's cleaned the same way as every other row (whitespace trimmed), but it's never dropped even if unusual, since it's still a real, non-empty row.",
  },
];

export default function CsvCleanerPage() {
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
      <CsvCleanerClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
