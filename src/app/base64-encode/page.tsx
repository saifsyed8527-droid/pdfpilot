import type { Metadata } from "next";
import { Base64EncodeClient } from "./base64-encode-client";
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

const tool = getToolSeo("/base64-encode")!;
const toolEntity = getTool("/base64-encode")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/base64-encode" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/base64-encode",
    images: [{ url: "/og/base64-encode.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/base64-encode.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is Base64 encoding with PDFPilot really free?",
    answer: "Yes. Base64 Encode is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The encoding runs entirely in your browser using the browser's own FileReader API. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What file types can I encode?",
    answer: "Any file type — images, PDFs, spreadsheets, or any other binary file, since Base64 encoding operates on raw bytes, not a specific format.",
  },
  {
    question: "Why would I need to Base64 encode a file?",
    answer: "Common uses include embedding a small image directly in CSS or HTML (data URIs), or including binary data in a JSON payload or configuration file, since both formats only support text.",
  },
  {
    question: "Does Base64 encoding compress the file?",
    answer: "No — Base64 actually makes the data about 33% larger, since it's re-representing binary bytes as text characters, not compressing anything.",
  },
];

export default function Base64EncodePage() {
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
      <Base64EncodeClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
