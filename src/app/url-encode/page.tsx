import type { Metadata } from "next";
import { UrlEncodeClient } from "./url-encode-client";
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

const tool = getToolSeo("/url-encode")!;
const toolEntity = getTool("/url-encode")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/url-encode" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/url-encode",
    images: [{ url: "/og/url-encode.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/url-encode.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is URL encoding with PDFPilot really free?",
    answer: "Yes. URL Encode is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The encoding runs entirely in your browser using the standard encodeURIComponent function. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What characters get encoded?",
    answer: "Spaces, &, ?, #, /, and other characters with special meaning in a URL, plus any non-ASCII characters — each is replaced with its percent-escaped equivalent, e.g. a space becomes %20.",
  },
  {
    question: "When would I need this?",
    answer: "Building a query string value that contains special characters, or embedding a value with spaces or symbols safely inside a URL.",
  },
];

export default function UrlEncodePage() {
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
      <UrlEncodeClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
