import type { Metadata } from "next";
import { HtmlToTextClient } from "./html-to-text-client";
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

const tool = getToolSeo("/html-to-text")!;
const toolEntity = getTool("/html-to-text")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/html-to-text" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/html-to-text",
    images: [{ url: "/og/html-to-text.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/html-to-text.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting HTML to text with PDFPilot really free?",
    answer: "Yes. HTML to Text is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The conversion runs entirely in your browser, using the browser's own HTML parser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What happens to links and images?",
    answer: "Only their visible text is kept — a link's URL and an image's alt text aren't included, since neither is visible page content.",
  },
  {
    question: "Does this handle malformed or unclosed HTML tags?",
    answer: "Yes — it uses the browser's real HTML parser, the same one that renders any webpage, so it handles imperfect markup the way a browser actually would rather than failing on it.",
  },
  {
    question: "Are <script> and <style> contents included in the output?",
    answer: "No — neither is visible text a reader would see, so both are excluded from the result.",
  },
];

export default function HtmlToTextPage() {
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
      <HtmlToTextClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
