import type { Metadata } from "next";
import { XmlMinifierClient } from "./xml-minifier-client";
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

const tool = getToolSeo("/xml-minifier")!;
const toolEntity = getTool("/xml-minifier")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/xml-minifier" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/xml-minifier",
    images: [{ url: "/og/xml-minifier.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/xml-minifier.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is XML minifying with PDFPilot really free?",
    answer: "Yes. XML Minifier is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The minifying runs entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "Are comments preserved?",
    answer: "No — XML comments are dropped, since the browser's DOM parsing/re-serialization this tool uses doesn't preserve them as part of the element tree.",
  },
  {
    question: "Are attributes and element text preserved exactly?",
    answer: "Yes — only whitespace between tags is removed; attribute values and text content are kept exactly as parsed.",
  },
];

export default function XmlMinifierPage() {
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
      <XmlMinifierClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
