import type { Metadata } from "next";
import { DocxMergeClient } from "./docx-merge-client";
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

const tool = getToolSeo("/docx-merge")!;
const toolEntity = getTool("/docx-merge")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/docx-merge",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/docx-merge",
    images: [{ url: "/og/docx-merge.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/docx-merge.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is merging Word documents with PDFPilot really free?",
    answer: "Yes. DOCX Merge is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. Every document is read and combined entirely in your browser. Your files are never uploaded to PDFPilot's servers.",
  },
  {
    question: "Does this preserve formatting, images, and tables?",
    answer:
      "No. DOCX Merge combines each document's text and headings into a clean new document — bold and italic styling, images, tables, and the exact layout of the originals aren't preserved.",
  },
  {
    question: "What order are the documents combined in?",
    answer:
      "The order shown in the file list — use the up and down arrows next to each file to reorder them before merging.",
  },
  {
    question: "How many documents can I merge at once?",
    answer: "As many as you upload — there's no fixed limit.",
  },
];

export default function DocxMergePage() {
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
      <DocxMergeClient faqs={faqs} related={[...relatedTools, ...relatedContent]} />
    </>
  );
}
