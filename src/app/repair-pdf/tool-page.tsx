import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getBreadcrumbSchema,
  getFaqSchema,
  getSoftwareApplicationSchema,
  getToolSeo,
  type FaqInput,
} from "@/lib/seo";
import { RepairPdfClient } from "./repair-pdf-client";

const tool = getToolSeo("/repair-pdf")!;

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/repair-pdf" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/repair-pdf",
    images: [{ url: "/og/repair-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/repair-pdf.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Can PDFPilot repair every broken PDF?",
    answer:
      "No repair tool can recover every damaged PDF, but PDFPilot can rebuild many PDFs that still contain readable page data.",
  },
  {
    question: "Are my PDFs uploaded?",
    answer:
      "No. Repair PDF runs locally in your browser. Your PDF never leaves your device.",
  },
  {
    question: "What does Repair PDF do?",
    answer:
      "It tries to open the PDF with a tolerant parser, copy recoverable pages into a clean document, and save a fresh PDF structure.",
  },
  {
    question: "Can it repair password-protected PDFs?",
    answer:
      "Encrypted PDFs must be unlocked first before Repair PDF can rebuild them.",
  },
];

export default function RepairPdfPage() {
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
      <ToolWorkspace />
    </>
  );
}

/** Shared by the English route and every localized route; only copy may differ. */
export function ToolWorkspace() {
  return <RepairPdfClient />;
}
