import type { Metadata } from "next";
import { OcrPdfClient } from "./ocr-pdf-client";
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

const tool = getToolSeo("/ocr-pdf")!;
const toolEntity = getTool("/ocr-pdf")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/ocr-pdf",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/ocr-pdf",
    images: [{ url: "/og/ocr-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/ocr-pdf.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is OCR with PDFPilot really free?",
    answer:
      "Yes. OCR PDF is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. Every page is rendered and recognized entirely in your browser using a WebAssembly OCR engine. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "How accurate is the text it extracts?",
    answer:
      "It depends heavily on the scan quality — a clean, high-resolution scan of printed text typically recognizes well; handwriting, low-resolution scans, or unusual fonts are recognized less reliably. This tool currently supports English text.",
  },
  {
    question: "Is this fast for large PDFs?",
    answer:
      "OCR runs page by page in your browser, so it's noticeably slower than PDFPilot's other tools — expect it to take several seconds per page, longer for large or high-resolution pages. This is an honest tradeoff of doing OCR entirely client-side rather than on a server.",
  },
  {
    question: "What does this tool actually output?",
    answer:
      "The recognized text, as plain text — one block per page. It doesn't produce a new searchable PDF file; for that, look for a future PDFPilot tool once that capability is available.",
  },
];

export default function OcrPdfPage() {
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
      <OcrPdfClient faqs={faqs} related={[...relatedTools, ...relatedContent]} />
    </>
  );
}
