import type { Metadata } from "next";
import { TextToHtmlClient } from "./text-to-html-client";
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

const tool = getToolSeo("/text-to-html")!;
const toolEntity = getTool("/text-to-html")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/text-to-html" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/text-to-html",
    images: [{ url: "/og/text-to-html.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/text-to-html.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting text to HTML with PDFPilot really free?",
    answer: "Yes. Text to HTML is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The conversion runs entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "Does this detect Markdown-style formatting in my text?",
    answer: "No — this is a structural wrap, not a Markdown parser. A line starting with # becomes literal text in a paragraph, not a heading. Use Markdown to HTML if your source text uses Markdown syntax.",
  },
  {
    question: "How are paragraphs and line breaks handled?",
    answer: "Text separated by a blank line becomes its own <p> paragraph; a single line break within a block becomes a <br>.",
  },
  {
    question: "Are special characters escaped safely?",
    answer: "Yes — characters like <, >, and & are escaped, so text containing them displays correctly as text rather than being interpreted as HTML markup.",
  },
];

export default function TextToHtmlPage() {
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
      <TextToHtmlClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
