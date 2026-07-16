import type { Metadata } from "next";
import { MarkdownToHtmlClient } from "./markdown-to-html-client";
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

const tool = getToolSeo("/markdown-to-html")!;
const toolEntity = getTool("/markdown-to-html")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/markdown-to-html" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/markdown-to-html",
    images: [{ url: "/og/markdown-to-html.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/markdown-to-html.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting Markdown to HTML with PDFPilot really free?",
    answer: "Yes. Markdown to HTML is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The conversion runs entirely in your browser, using a real Markdown parser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What Markdown features are supported?",
    answer: "Headings, paragraphs, bold/italic, links, images, ordered and unordered lists, blockquotes, code blocks, inline code, horizontal rules, and tables.",
  },
  {
    question: "Is the output styled?",
    answer: "No — the HTML output is unstyled semantic markup (headings, paragraphs, lists, etc.) with no CSS attached. You control the styling on your end.",
  },
  {
    question: "Is this different from Markdown to PDF?",
    answer: "Yes. Markdown to PDF (a separate PDFPilot tool) renders headings and paragraphs directly into a PDF document. This tool produces HTML markup instead — useful when you need the content for a webpage or another HTML-consuming system, not a finished PDF.",
  },
];

export default function MarkdownToHtmlPage() {
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
      <MarkdownToHtmlClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
