import type { Metadata } from "next";
import { CsvSplitterClient } from "./csv-splitter-client";
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

const tool = getToolSeo("/csv-splitter")!;
const toolEntity = getTool("/csv-splitter")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/csv-splitter" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/csv-splitter",
    images: [{ url: "/og/csv-splitter.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/csv-splitter.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is splitting CSV files with PDFPilot really free?",
    answer: "Yes. CSV Splitter is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The splitting runs entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "Does every output file include the header row?",
    answer: "Yes — each split file repeats the original header row, so every part is a complete, valid CSV you can open on its own.",
  },
  {
    question: "How are the output files downloaded?",
    answer: "As separate file downloads (split-part-1.csv, split-part-2.csv, and so on) triggered one after another, not as a single zip archive.",
  },
  {
    question: "What if my file has a header but no data rows?",
    answer: "You'll get a clear error rather than an empty split — there's nothing to split if there's no data beneath the header.",
  },
];

export default function CsvSplitterPage() {
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
      <CsvSplitterClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
