import type { Metadata } from "next";
import { ColumnExtractorClient } from "./column-extractor-client";
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

const tool = getToolSeo("/column-extractor")!;
const toolEntity = getTool("/column-extractor")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/column-extractor" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/column-extractor",
    images: [{ url: "/og/column-extractor.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/column-extractor.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is extracting CSV columns with PDFPilot really free?",
    answer: "Yes. Column Extractor is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The extraction runs entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "How do I choose which columns to keep?",
    answer: "After uploading, every detected column header appears as a toggle button — click to select or deselect it, then extract.",
  },
  {
    question: "Can I reorder columns in the output?",
    answer: "The output follows your file's original column order among the ones you selected — this tool doesn't currently support reordering columns independent of their original position.",
  },
  {
    question: "What happens to the header row?",
    answer: "It's kept, filtered down to just the columns you selected, the same as every data row.",
  },
];

export default function ColumnExtractorPage() {
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
      <ColumnExtractorClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
