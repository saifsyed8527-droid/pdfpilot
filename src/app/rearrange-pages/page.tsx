import type { Metadata } from "next";
import { RearrangePagesClient } from "./rearrange-pages-client";
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

const tool = getToolSeo("/rearrange-pages")!;
const toolEntity = getTool("/rearrange-pages")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const existingPaths = new Set(relatedContent.map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/rearrange-pages",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/rearrange-pages",
    images: [{ url: "/og/rearrange-pages.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/rearrange-pages.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is rearranging PDF pages with PDFPilot really free?",
    answer:
      "Yes. Rearrange Pages is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. All page reordering happens entirely in your browser. Your files are never uploaded to PDFPilot's servers.",
  },
  {
    question: "How do I reorder pages?",
    answer:
      "After uploading, every page appears as a thumbnail you can drag and drop into the order you want. The new PDF follows exactly the order you arrange them in.",
  },
  {
    question: "Will rearranging pages affect their quality?",
    answer:
      "No. Pages are copied exactly as they were, just in a new order — nothing about their content or quality changes.",
  },
  {
    question: "Do I need to install any software to rearrange PDF pages?",
    answer:
      "No installation is required. Rearrange Pages runs directly in your web browser.",
  },
];

export default function RearrangePagesPage() {
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
      <RearrangePagesClient faqs={faqs} related={[...relatedContent, ...clusterMembers]} />
    </>
  );
}
