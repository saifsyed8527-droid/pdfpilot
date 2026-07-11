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

const tool = getToolSeo("/convert-image")!;
const toolEntity = getTool("/convert-image")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);

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
      "You can convert to JPG, PNG, or WEBP. Most common formats can be used as input, including JPG, PNG, WEBP, GIF (first frame only), and BMP.",
  },
  {
    question: "Can I convert HEIC (iPhone) photos?",
    answer:
      "Not currently. HEIC decoding isn't reliably supported across browsers, and the available conversion libraries for it weren't maintained well enough to trust — rather than offer an unreliable HEIC converter, this tool doesn't claim to support it.",
  },
  {
    question: "Will converting reduce my image quality?",
    answer:
      "Converting to JPG or WEBP uses lossy compression, which can slightly reduce quality depending on the setting. Converting to PNG is lossless.",
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
      <ConvertImageClient faqs={faqs} related={[...relatedTools, ...relatedContent]} />
    </>
  );
}
