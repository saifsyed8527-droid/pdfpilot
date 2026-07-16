import type { Metadata } from "next";
import { JsonMinifierClient } from "./json-minifier-client";
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

const tool = getToolSeo("/json-minifier")!;
const toolEntity = getTool("/json-minifier")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/json-minifier" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/json-minifier",
    images: [{ url: "/og/json-minifier.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/json-minifier.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is JSON minifying with PDFPilot really free?",
    answer: "Yes. JSON Minifier is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The minifying runs entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "Why minify JSON?",
    answer: "Removing whitespace shrinks the file size for production use — configuration files, API responses, or any JSON shipped over a network benefit from not carrying formatting whitespace.",
  },
  {
    question: "Does minifying change my data in any way?",
    answer: "No — only whitespace is removed. Keys, values, and their order are preserved exactly.",
  },
];

export default function JsonMinifierPage() {
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
      <JsonMinifierClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
