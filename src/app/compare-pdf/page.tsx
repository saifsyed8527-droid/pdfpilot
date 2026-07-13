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

const tool = getToolSeo("/compare-pdf")!;
const toolEntity = getTool("/compare-pdf")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);

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
      "No. Compare PDFs extracts and compares each file's text content, not its visual appearance. Two PDFs with identical text but different fonts, colors, or layout will show as having no differences.",
  },
  {
    question: "What if one of my PDFs is a scanned document?",
    answer:
      "A scanned PDF with no real text layer has nothing to extract, so it will compare as entirely different from any PDF with real text — there's no text to match against.",
  },
  {
    question: "How are the differences shown?",
    answer:
      "Text removed from the original is shown struck through in red; text added in the revised version is highlighted in green. Unchanged text appears as normal.",
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
      <ComparePdfClient faqs={faqs} related={[...relatedTools, ...relatedContent]} />
    </>
  );
}
