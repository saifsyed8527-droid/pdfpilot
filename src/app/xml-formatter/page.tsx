import type { Metadata } from "next";
import { XmlFormatterClient } from "./xml-formatter-client";
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

const tool = getToolSeo("/xml-formatter")!;
const toolEntity = getTool("/xml-formatter")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/xml-formatter" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/xml-formatter",
    images: [{ url: "/og/xml-formatter.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/xml-formatter.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is XML formatting with PDFPilot really free?",
    answer: "Yes. XML Formatter is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The formatting runs entirely in your browser using DOMParser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "Does this also validate my XML?",
    answer: "Yes — formatting requires a successful parse first, so malformed XML produces a clear error instead of a broken result. Use XML Validator if you just want a validity check without downloading a formatted file.",
  },
  {
    question: "Are XML attributes preserved?",
    answer: "Yes — every element's attributes are kept exactly as they were, only the whitespace between elements changes.",
  },
  {
    question: "Does this work with any XML, or just the <rows><row> shape other PDFPilot tools use?",
    answer: "Any well-formed XML document — this tool doesn't expect or require the <rows><row> structure that this project's CSV/Excel conversion tools use.",
  },
];

export default function XmlFormatterPage() {
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
      <XmlFormatterClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
