import type { Metadata } from "next";
import { JsonFormatterClient } from "./json-formatter-client";
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

const tool = getToolSeo("/json-formatter")!;
const toolEntity = getTool("/json-formatter")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/json-formatter" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/json-formatter",
    images: [{ url: "/og/json-formatter.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/json-formatter.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is JSON formatting with PDFPilot really free?",
    answer: "Yes. JSON Formatter is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The formatting runs entirely in your browser using JSON.parse and JSON.stringify. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "Does this also validate my JSON?",
    answer: "Yes — formatting requires a successful parse first, so malformed JSON produces a clear error instead of a broken result. Use JSON Validator if you just want a validity check without downloading a formatted file.",
  },
  {
    question: "What indentation does the output use?",
    answer: "2 spaces per nesting level, a common convention for readable JSON.",
  },
  {
    question: "Does formatting change my data in any way?",
    answer: "No — only whitespace changes. Keys, values, and their order are preserved exactly as parsed.",
  },
];

export default function JsonFormatterPage() {
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
      <JsonFormatterClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
