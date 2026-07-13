import type { Metadata } from "next";
import { PowerpointToPdfClient } from "./powerpoint-to-pdf-client";
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

const tool = getToolSeo("/powerpoint-to-pdf")!;
const toolEntity = getTool("/powerpoint-to-pdf")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/powerpoint-to-pdf",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/powerpoint-to-pdf",
    images: [{ url: "/og/powerpoint-to-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/powerpoint-to-pdf.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting PowerPoint to PDF with PDFPilot really free?",
    answer: "Yes. PowerPoint to PDF is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. The conversion happens entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "Will my PDF look exactly like my slides?",
    answer:
      "No. PowerPoint to PDF extracts each slide's text content into a clean, readable PDF — slide design, backgrounds, images, and the exact visual layout of the original presentation aren't preserved. It's built for pulling text out of a presentation, not for archiving its exact appearance.",
  },
  {
    question: "How many slides does this handle?",
    answer: "Every slide in your presentation, in order.",
  },
  {
    question: "What file types are supported?",
    answer: "The modern PowerPoint format, .pptx. Older .ppt files aren't supported.",
  },
];

export default function PowerpointToPdfPage() {
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
      <PowerpointToPdfClient faqs={faqs} related={[...relatedTools, ...relatedContent]} />
    </>
  );
}
