import type { Metadata } from "next";
import { CropPdfClient } from "./crop-pdf-client";
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

const tool = getToolSeo("/crop-pdf")!;
const toolEntity = getTool("/crop-pdf")!;
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
    canonical: "/crop-pdf",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/crop-pdf",
    images: [{ url: "/og/crop-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/crop-pdf.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is cropping a PDF with PDFPilot really free?",
    answer:
      "Yes. Crop PDF is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. All cropping happens entirely in your browser. Your files are never uploaded to PDFPilot's servers.",
  },
  {
    question: "Can I crop just one page instead of the whole document?",
    answer:
      "Yes. You can choose to crop every page or a single page by number.",
  },
  {
    question: "What's the difference between a preset and a custom crop?",
    answer:
      "Presets trim an even margin (10%, 20%, or 30%) from every edge. A custom crop lets you enter an exact number of points to trim from the top, right, bottom, and left independently.",
  },
  {
    question: "Does cropping delete any content from the PDF?",
    answer:
      "No. Cropping changes each page's visible area (its CropBox) rather than deleting content — the original page content is preserved, just outside the visible crop.",
  },
];

export default function CropPdfPage() {
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
      <CropPdfClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
