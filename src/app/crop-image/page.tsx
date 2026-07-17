import type { Metadata } from "next";
import { CropImageClient } from "./crop-image-client";
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

const tool = getToolSeo("/crop-image")!;
const toolEntity = getTool("/crop-image")!;
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
    canonical: "/crop-image",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/crop-image",
    images: [{ url: "/og/crop-image.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/crop-image.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is cropping an image with PDFPilot really free?",
    answer: "Yes. Crop Image is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. Cropping happens entirely in your browser using the Canvas API. Your image is never uploaded to PDFPilot's servers.",
  },
  {
    question: "How do I choose what to crop?",
    answer:
      "Enter the X and Y position of the crop area's top-left corner and its width and height, all in pixels, based on the image's actual dimensions shown after upload.",
  },
  {
    question: "What image formats are supported?",
    answer:
      "JPG, PNG, WEBP, GIF, and BMP can be uploaded. The cropped result is saved in the same format as your original when possible (JPG, PNG, or WEBP) — GIF and BMP are saved as PNG, since browsers can't re-encode to those formats.",
  },
  {
    question: "Will cropping reduce my image's quality?",
    answer:
      "No quality is lost in the crop itself. If your original is a JPG or WEBP, the crop is re-encoded at high quality; PNG is always lossless.",
  },
];

export default function CropImagePage() {
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
      <CropImageClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
