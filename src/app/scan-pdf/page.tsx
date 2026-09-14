import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getBreadcrumbSchema,
  getFaqSchema,
  getSoftwareApplicationSchema,
  getToolSeo,
  type FaqInput,
} from "@/lib/seo";
import { ScanPdfClient } from "./scan-pdf-client";

const tool = getToolSeo("/scan-pdf")!;

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/scan-pdf" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/scan-pdf",
    images: [{ url: "/og/scan-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/scan-pdf.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is Scan to PDF free?",
    answer: "Yes. Scan to PDF is free to use in your browser with no sign-up required.",
  },
  {
    question: "Are my scanned images uploaded?",
    answer: "No. PDFPilot creates the PDF locally in your browser, so your images stay on your device.",
  },
  {
    question: "Can I choose page size and margins?",
    answer: "Yes. You can choose portrait or landscape pages, Fit, A4, or US Letter size, and no, small, or big margins.",
  },
  {
    question: "Can I scan multiple pages into one PDF?",
    answer: "Yes. Add multiple scan images, arrange them in order, and keep Merge all images enabled to create one PDF.",
  },
];

export default function ScanPdfPage() {
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
      <ScanPdfClient />
    </>
  );
}
