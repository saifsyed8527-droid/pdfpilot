import type { Metadata } from "next";
import { WatermarkPdfClient } from "./watermark-pdf-client";
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

const tool = getToolSeo("/watermark-pdf")!;
const toolEntity = getTool("/watermark-pdf")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/watermark-pdf",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/watermark-pdf",
    images: [{ url: "/og/watermark-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/watermark-pdf.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is adding a watermark with PDFPilot really free?",
    answer:
      "Yes. Watermark PDF is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. All watermarking happens entirely in your browser. Your files are never uploaded to PDFPilot's servers.",
  },
  {
    question: "Can I use an image as a watermark instead of text?",
    answer:
      "Yes. Watermark PDF supports both text watermarks and image watermarks (JPG or PNG), including images with transparency.",
  },
  {
    question: "Can I control how visible the watermark is?",
    answer:
      "Yes. You can adjust the watermark's opacity, rotation, position, and scale before applying it, with a live preview so you can see the result first.",
  },
  {
    question: "Does the watermark apply to every page?",
    answer:
      "Yes. The watermark you configure is applied to every page in the document.",
  },
];

export default function WatermarkPdfPage() {
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
      <WatermarkPdfClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
