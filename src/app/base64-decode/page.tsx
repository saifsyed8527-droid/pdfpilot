import type { Metadata } from "next";
import { Base64DecodeClient } from "./base64-decode-client";
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

const tool = getToolSeo("/base64-decode")!;
const toolEntity = getTool("/base64-decode")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/base64-decode" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/base64-decode",
    images: [{ url: "/og/base64-decode.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/base64-decode.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is Base64 decoding with PDFPilot really free?",
    answer: "Yes. Base64 Decode is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The decoding runs entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "Why does the output download as decoded.bin instead of the original filename?",
    answer: "Base64 text only encodes a file's raw bytes — it doesn't carry the original filename or file type. Rename the downloaded file with the correct extension once you know what it should be.",
  },
  {
    question: "What happens if the text isn't valid Base64?",
    answer: "You'll get a clear error message rather than a corrupted or empty file.",
  },
  {
    question: "Can I decode a data: URI directly?",
    answer: "Not the whole URI — strip the \"data:...;base64,\" prefix first and upload just the Base64 portion after the comma.",
  },
];

export default function Base64DecodePage() {
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
      <Base64DecodeClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
