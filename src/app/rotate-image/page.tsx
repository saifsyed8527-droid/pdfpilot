import type { Metadata } from "next";
import { RotateImageClient } from "./rotate-image-client";
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

const tool = getToolSeo("/rotate-image")!;
const toolEntity = getTool("/rotate-image")!;
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
    canonical: "/rotate-image",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/rotate-image",
    images: [{ url: "/og/rotate-image.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/rotate-image.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is rotating or flipping an image with PDFPilot really free?",
    answer:
      "Yes. Rotate & Flip Image is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. Rotating and flipping happen entirely in your browser. Your image is never uploaded to PDFPilot's servers.",
  },
  {
    question: "Can I rotate and flip in the same operation?",
    answer:
      "Yes. Apply 90-degree rotations and flips to all images, the selected image, or only portrait or landscape originals. The preview shows each image's final position. Flips use the original axes before rotation. Save all results together in a ZIP, or download a single image.",
  },
  {
    question: "What image formats are supported?",
    answer:
      "JPG, PNG, WEBP, GIF and BMP can be uploaded, up to 30 files and 200MB combined. Choose PNG, JPG, WEBP or the original format when supported. GIF uses its first frame; GIF and BMP save as PNG. PNG retains transparency, JPG uses a white background, and re-encoding removes metadata.",
  },
];

export default function RotateImagePage() {
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
      <RotateImageClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
