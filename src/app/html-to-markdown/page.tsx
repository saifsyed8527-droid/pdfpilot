import type { Metadata } from "next";
import { HtmlToMarkdownClient } from "./html-to-markdown-client";
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

const tool = getToolSeo("/html-to-markdown")!;
const toolEntity = getTool("/html-to-markdown")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/html-to-markdown" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/html-to-markdown",
    images: [{ url: "/og/html-to-markdown.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/html-to-markdown.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting HTML to Markdown with PDFPilot really free?",
    answer: "Yes. HTML to Markdown is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The conversion runs entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What HTML elements convert cleanly?",
    answer: "Headings, paragraphs, bold/italic/strikethrough, links, images, ordered and unordered lists, blockquotes, code blocks, inline code, and standard HTML tables.",
  },
  {
    question: "What happens to elements Markdown can't represent, like <div> or CSS classes?",
    answer: "Structural wrapper elements without a Markdown equivalent are unwrapped — their content is kept, but the wrapping tag and any styling attributes are dropped, since Markdown has no way to represent inline styles or arbitrary CSS.",
  },
  {
    question: "Why would I need this instead of just copy-pasting?",
    answer: "Pasting rich HTML directly into a Markdown editor often carries over messy inline styles or broken formatting. This tool does the conversion properly, structurally.",
  },
];

export default function HtmlToMarkdownPage() {
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
      <HtmlToMarkdownClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
