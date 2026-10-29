import type { Metadata } from "next";
import { ComparePdfClient } from "./compare-pdf-client";
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

const tool = getToolSeo("/compare-pdf")!;
const toolEntity = getTool("/compare-pdf")!;
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
    canonical: "/compare-pdf",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/compare-pdf",
    images: [{ url: "/og/compare-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/compare-pdf.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is comparing PDFs with PDFPilot really free?",
    answer: "Yes. Compare PDFs is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. Both PDFs are compared entirely in your browser. Neither file is ever uploaded to PDFPilot's servers.",
  },
  {
    question: "Does this compare the visual layout of the two PDFs?",
    answer:
      "Yes. Compare PDFs checks selectable text and rendered page pixels. Review pages side by side or use a color overlay to see visual changes. You can adjust sensitivity and download a PDF report.",
  },
  {
    question: "What if one of my PDFs is a scanned document?",
    answer:
      "Scanned pages are compared visually. Text comparison needs selectable text and does not run OCR. The result explains when a page has no selectable text.",
  },
  {
    question: "How are the differences shown?",
    answer:
      "Removed text is red and struck through; added text is green. The visual overlay uses red for darker original pixels, green for darker revised pixels and purple for color changes. Download the PDF visual report or the complete text-change report.",
  },
];

export default function ComparePdfPage() {
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
      <ComparePdfClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
