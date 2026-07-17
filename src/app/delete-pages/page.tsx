import type { Metadata } from "next";
import { DeletePagesClient } from "./delete-pages-client";
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
import { getClusterMembers } from "@/lib/content/topic-clusters";

const tool = getToolSeo("/delete-pages")!;
const toolEntity = getTool("/delete-pages")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const existingPaths = new Set(relatedContent.map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/delete-pages",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/delete-pages",
    images: [{ url: "/og/delete-pages.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/delete-pages.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is deleting PDF pages with PDFPilot really free?",
    answer:
      "Yes. Delete Pages is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. All page deletion happens entirely in your browser. Your files are never uploaded to PDFPilot's servers.",
  },
  {
    question: "How do I choose which pages to delete?",
    answer:
      "Enter the page numbers or ranges you want removed, such as 2,4-6, and PDFPilot rebuilds the PDF without those pages.",
  },
  {
    question: "Can I delete every page in the document?",
    answer:
      "No. A PDF needs at least one page, so if the pages you select would remove the entire document, Delete Pages will show an error instead of producing an empty file.",
  },
  {
    question: "Will deleting pages affect the quality of the remaining pages?",
    answer:
      "No. The remaining pages are copied exactly as they were, with no change to their content, formatting, or quality.",
  },
];

export default function DeletePagesPage() {
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
      <DeletePagesClient faqs={faqs} related={[...relatedContent, ...clusterMembers]} />
    </>
  );
}
