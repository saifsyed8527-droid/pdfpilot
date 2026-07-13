import type { Metadata } from "next";
import { SvgToPdfClient } from "./svg-to-pdf-client";
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

const tool = getToolSeo("/svg-to-pdf")!;
const toolEntity = getTool("/svg-to-pdf")!;
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
    canonical: "/svg-to-pdf",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/svg-to-pdf",
    images: [{ url: "/og/svg-to-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/svg-to-pdf.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting SVG to PDF with PDFPilot really free?",
    answer: "Yes. SVG to PDF is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. The conversion runs entirely in your browser. Your SVG file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "Is the output PDF a true vector conversion?",
    answer:
      "No, and this tool is upfront about that: your SVG is rendered onto a high-resolution canvas and embedded in the PDF as an image. The shapes and text you see are pixels, not editable vector paths or selectable text. No real, actively maintained browser library currently does true vector SVG-to-PDF conversion, so rather than fake that capability, this tool is honest about producing a high-quality raster result instead.",
  },
  {
    question: "Will the PDF look sharp, or blurry?",
    answer:
      "It's rendered at twice your SVG's native size before being embedded, so it stays crisp at normal viewing and printing sizes. Very large print sizes may still show some softness since it's a raster image.",
  },
  {
    question: "What SVG files can I upload?",
    answer:
      "Any standard SVG file. SVGs that don't declare an explicit width, height, or viewBox may render at a browser-default size — for best results, use an SVG that specifies its own dimensions.",
  },
];

export default function SvgToPdfPage() {
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
      <SvgToPdfClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
