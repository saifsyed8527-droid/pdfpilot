import type { Metadata } from "next";
import { CsvMergerClient } from "./csv-merger-client";
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

const tool = getToolSeo("/csv-merger")!;
const toolEntity = getTool("/csv-merger")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/csv-merger" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/csv-merger",
    images: [{ url: "/og/csv-merger.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/csv-merger.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is merging CSV files with PDFPilot really free?",
    answer: "Yes. CSV Merger is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The merging runs entirely in your browser. Your files are never uploaded to PDFPilot's servers.",
  },
  {
    question: "What happens if the files have different columns?",
    answer: "You'll get a clear error naming the file whose header doesn't match the first file's — this tool won't silently merge mismatched schemas, since that would misalign data under the wrong column names.",
  },
  {
    question: "How many files can I merge at once?",
    answer: "As many as you upload, as long as they all share the exact same header row.",
  },
  {
    question: "In what order are rows combined?",
    answer: "In the order you uploaded the files, with each file's rows appended after the previous one's.",
  },
];

export default function CsvMergerPage() {
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
      <CsvMergerClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
