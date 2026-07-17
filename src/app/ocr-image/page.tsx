import type { Metadata } from "next";
import { OcrImageClient } from "./ocr-image-client";
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

const tool = getToolSeo("/ocr-image")!;
const toolEntity = getTool("/ocr-image")!;
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
    canonical: "/ocr-image",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/ocr-image",
    images: [{ url: "/og/ocr-image.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/ocr-image.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is OCR with PDFPilot really free?",
    answer: "Yes. OCR Image is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. Text is recognized entirely in your browser using a WebAssembly OCR engine. Your image is never uploaded to PDFPilot's servers.",
  },
  {
    question: "How accurate is the text it extracts?",
    answer:
      "It depends heavily on image quality — a clean, high-resolution photo or scan of printed text typically recognizes well; handwriting, blurry photos, or unusual fonts are recognized less reliably. This tool currently supports English text.",
  },
  {
    question: "What image formats are supported?",
    answer: "JPG, PNG, WEBP, and BMP.",
  },
  {
    question: "How is this different from OCR PDF?",
    answer:
      "OCR PDF renders each page of a PDF to an image first, then recognizes text on every page. OCR Image works directly on a single photo or screenshot — no PDF involved.",
  },
];

export default function OcrImagePage() {
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
      <OcrImageClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
