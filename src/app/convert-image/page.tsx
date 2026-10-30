import type { Metadata } from "next";
import { ConvertImageClient } from "./convert-image-client";
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

const tool = getToolSeo("/convert-image")!;
const toolEntity = getTool("/convert-image")!;
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
    canonical: "/convert-image",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/convert-image",
    images: [{ url: "/og/convert-image.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/convert-image.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting images with PDFPilot really free?",
    answer:
      "Yes. Convert Image is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. The whole conversion happens entirely in your browser using the browser's own image engine. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What image formats are supported?",
    answer:
      "Convert up to 30 JPG, PNG, WEBP, GIF or BMP images to JPG, PNG, WEBP or static GIF. You can also combine two or more images into an animated GIF with frame order, duration, fit, background and repeat controls. GIF input uses its first frame. SVG, TIFF, PSD and RAW are not supported by this tool.",
  },
  {
    question: "Can I convert HEIC (iPhone) photos?",
    answer:
      "Not with this tool, but PDFPilot has dedicated HEIC to JPG and HEIC to PNG converters that use a real HEIC decoder — use those for iPhone photos instead.",
  },
  {
    question: "Will converting reduce my image quality?",
    answer:
      "JPG and WEBP offer an adjustable quality setting. PNG preserves decoded pixels and transparency. GIF uses up to 256 colors per frame and a solid background, so photos can lose color detail. Conversions remove metadata. GIF output is limited to 2,048px per side, four megapixels per frame and 40 megapixels across an animation.",
  },
];

export default function ConvertImagePage() {
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
      <ConvertImageClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
