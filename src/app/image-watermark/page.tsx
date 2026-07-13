import type { Metadata } from "next";
import { ImageWatermarkClient } from "./image-watermark-client";
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

const tool = getToolSeo("/image-watermark")!;
const toolEntity = getTool("/image-watermark")!;
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
    canonical: "/image-watermark",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/image-watermark",
    images: [{ url: "/og/image-watermark.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/image-watermark.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is adding a watermark with PDFPilot really free?",
    answer: "Yes. Image Watermark is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my images uploaded to a server?",
    answer:
      "No. The watermark is drawn entirely in your browser using the Canvas API. Your image is never uploaded to PDFPilot's servers.",
  },
  {
    question: "Can I control where the watermark appears?",
    answer:
      "Yes. Choose from five fixed positions (center or any corner), or Tiled, which repeats the text diagonally across the whole image — useful for proofs you want harder to crop around.",
  },
  {
    question: "Can I adjust how visible the watermark is?",
    answer: "Yes, using the opacity slider — from a very subtle 5% up to a fully solid 100%.",
  },
  {
    question: "What image formats are supported?",
    answer: "You can upload JPG, PNG, or WEBP. The watermarked image is saved in the same format as your original.",
  },
  {
    question: "Can I use my own logo as a watermark instead of text?",
    answer:
      "Not currently — this tool only adds text watermarks. Image-based (logo) watermarks aren't supported yet.",
  },
];

export default function ImageWatermarkPage() {
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
      <ImageWatermarkClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
