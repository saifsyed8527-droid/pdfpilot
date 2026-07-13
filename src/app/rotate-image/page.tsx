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

const tool = getToolSeo("/rotate-image")!;
const toolEntity = getTool("/rotate-image")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);

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
      "Yes. Choose a rotation angle and toggle either flip option, then click Apply — both changes are made in a single re-encode.",
  },
  {
    question: "What image formats are supported?",
    answer:
      "JPG, PNG, WEBP, GIF, and BMP can be uploaded. The result is saved in the same format as your original when possible (JPG, PNG, or WEBP) — GIF and BMP are saved as PNG.",
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
      <RotateImageClient faqs={faqs} related={[...relatedTools, ...relatedContent]} />
    </>
  );
}
