import type { Metadata } from "next";
import { CompressImageClient } from "./compress-image-client";
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

const tool = getToolSeo("/compress-image")!;
const toolEntity = getTool("/compress-image")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/compress-image",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/compress-image",
    images: [{ url: "/og/compress-image.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/compress-image.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is compressing an image with PDFPilot really free?",
    answer: "Yes. Compress Image is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. Compression happens entirely in your browser. Your image is never uploaded to PDFPilot's servers.",
  },
  {
    question: "Why does my PNG get converted to JPG?",
    answer:
      "PNG is a lossless format — browsers can't re-encode it at a lower quality to shrink it. To meaningfully reduce a PNG's file size, this tool converts it to JPG, which supports adjustable quality.",
  },
  {
    question: "How much smaller will my file be?",
    answer:
      "It depends entirely on the image and the quality you choose — PDFPilot shows the exact size reduction after compressing so you can decide whether to try a different quality level.",
  },
];

export default function CompressImagePage() {
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
      <CompressImageClient faqs={faqs} related={[...relatedTools, ...relatedContent]} />
    </>
  );
}
