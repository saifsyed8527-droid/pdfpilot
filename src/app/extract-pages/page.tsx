import type { Metadata } from "next";
import { ExtractPagesClient } from "./extract-pages-client";
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

const tool = getToolSeo("/extract-pages")!;
const toolEntity = getTool("/extract-pages")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const existingPaths = new Set(relatedContent.map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/extract-pages",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/extract-pages",
    images: [{ url: "/og/extract-pages.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/extract-pages.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is extracting PDF pages with PDFPilot really free?",
    answer:
      "Yes. Extract Pages is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. All page extraction happens entirely in your browser. Your files are never uploaded to PDFPilot's servers.",
  },
  {
    question: "How is this different from Split PDF?",
    answer:
      "Split PDF creates a separate file for every comma-separated range you enter. Extract Pages does the opposite: it combines every page you select into a single new PDF, in order.",
  },
  {
    question: "Can I extract pages that aren't next to each other?",
    answer:
      "Yes. Click any combination of pages on the thumbnails, in any order — they'll be combined into one new PDF in their original page order, regardless of the order you clicked them.",
  },
  {
    question: "Do I need to install any software to extract PDF pages?",
    answer:
      "No installation is required. Extract Pages runs directly in your web browser.",
  },
];

export default function ExtractPagesPage() {
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
      <ExtractPagesClient faqs={faqs} related={[...relatedContent, ...clusterMembers]} />
    </>
  );
}
