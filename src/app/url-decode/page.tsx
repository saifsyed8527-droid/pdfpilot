import type { Metadata } from "next";
import { UrlDecodeClient } from "./url-decode-client";
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

const tool = getToolSeo("/url-decode")!;
const toolEntity = getTool("/url-decode")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/url-decode" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/url-decode",
    images: [{ url: "/og/url-decode.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/url-decode.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is URL decoding with PDFPilot really free?",
    answer: "Yes. URL Decode is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The decoding runs entirely in your browser using the standard decodeURIComponent function. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What happens with malformed percent-escapes?",
    answer: "You'll get a clear error message rather than a broken or truncated result — for example, text ending in a stray \"%2\" with no complete escape sequence.",
  },
  {
    question: "Does this decode a full URL, including the domain?",
    answer: "It decodes whatever text you give it — typically you'd use this on just the encoded portion (a query parameter value), not the domain, which is never percent-encoded.",
  },
];

export default function UrlDecodePage() {
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
      <UrlDecodeClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
