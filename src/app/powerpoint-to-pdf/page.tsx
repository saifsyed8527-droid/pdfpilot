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
import { getClusterMembers } from "@/lib/content/topic-clusters";

const tool = getToolSeo("/powerpoint-to-pdf")!;
const toolEntity = getTool("/powerpoint-to-pdf")!;
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
    question: "Will my PDF look like my slides?",
    answer:
      "Each slide becomes one PDF page reconstructed from your presentation's real content: text keeps its position, font size, bold/italic, color, and alignment; shape fills and images are placed where they actually appear on the slide. Tables, charts, and rotated or flipped shapes aren't reproduced yet — those parts of a slide are skipped rather than shown incorrectly.",
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
      <PowerpointToPdfClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
