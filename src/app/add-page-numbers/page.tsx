import type { Metadata } from "next";
import { AddPageNumbersClient } from "./add-page-numbers-client";
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

const tool = getToolSeo("/add-page-numbers")!;
const toolEntity = getTool("/add-page-numbers")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/add-page-numbers",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/add-page-numbers",
    images: [{ url: "/og/add-page-numbers.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/add-page-numbers.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is adding page numbers with PDFPilot really free?",
    answer:
      "Yes. Add Page Numbers is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. All page numbering happens entirely in your browser. Your files are never uploaded to PDFPilot's servers.",
  },
  {
    question: "Where are the page numbers placed?",
    answer:
      "Page numbers are added at the bottom center of every page, in the format \"Page X of Y\".",
  },
  {
    question: "Can I choose a different position or format for the page numbers?",
    answer:
      "Not currently. Add Page Numbers applies one consistent position and format — \"Page X of Y\" at the bottom center of every page — to every file.",
  },
  {
    question: "Do I need to install any software to add page numbers?",
    answer:
      "No installation is required. Add Page Numbers runs directly in your web browser.",
  },
];

export default function AddPageNumbersPage() {
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
      <AddPageNumbersClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
