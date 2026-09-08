import type { Metadata } from "next";
import { HtmlToPdfClient } from "./html-to-pdf-client";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getBreadcrumbSchema,
  getFaqSchema,
  getSoftwareApplicationSchema,
  getToolSeo,
  type FaqInput,
} from "@/lib/seo";

const tool = getToolSeo("/html-to-pdf")!;

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/html-to-pdf" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/html-to-pdf",
    images: [{ url: "/og/html-to-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/html-to-pdf.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Can I convert a website URL to PDF?",
    answer: "Yes. Paste a public website URL, adjust the PDF options, then convert it to a downloadable PDF.",
  },
  {
    question: "Can I upload an HTML file from my device?",
    answer: "Yes. PDFPilot supports local .html and .htm files up to 100MB.",
  },
  {
    question: "Does the PDF download automatically?",
    answer: "Yes. After conversion finishes, PDFPilot starts the PDF download automatically and keeps a download button available.",
  },
];

export default function HtmlToPdfPage() {
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
      <HtmlToPdfClient />
    </>
  );
}
