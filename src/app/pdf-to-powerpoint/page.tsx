import type { Metadata } from "next";
import { PdfToPowerpointClient } from "./pdf-to-powerpoint-client";
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

const tool = getToolSeo("/pdf-to-powerpoint")!;
const toolEntity = getTool("/pdf-to-powerpoint")!;
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
    canonical: "/pdf-to-powerpoint",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/pdf-to-powerpoint",
    images: [{ url: "/og/pdf-to-powerpoint.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/pdf-to-powerpoint.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting PDF to PowerPoint with PDFPilot really free?",
    answer:
      "Yes. PDF to PowerPoint is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. The whole conversion happens entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "How does PDF to PowerPoint decide what goes on each slide?",
    answer:
      "Each page of your PDF becomes one slide, containing that page's text content. The original layout, images, and visual design aren't preserved — this tool is built for pulling text out of a PDF into an editable slide deck, not for recreating the PDF's exact appearance.",
  },
  {
    question: "What if my PDF is a scanned document or has no selectable text?",
    answer:
      "PDF to PowerPoint can only extract text that's already stored as real text in the PDF. If your PDF is a scanned image with no text layer, there's nothing to extract, and you'll see an error instead of an empty presentation.",
  },
  {
    question: "Do I need to install any software to convert PDF to PowerPoint?",
    answer:
      "No installation is required. PDF to PowerPoint runs directly in your web browser.",
  },
];

export default function PdfToPowerpointPage() {
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
      <PdfToPowerpointClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
