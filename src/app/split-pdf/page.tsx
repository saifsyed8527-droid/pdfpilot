import type { Metadata } from "next";
import { SplitPdfClient } from "./split-pdf-client";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getBreadcrumbSchema,
  getFaqSchema,
  getSoftwareApplicationSchema,
  getToolSeo,
  type FaqInput,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: "Split PDF Files Online Free | PDFPilot",
  description:
    "Extract or split pages from any PDF file instantly. Free and secure PDF splitting tool that works entirely in your browser.",
  alternates: {
    canonical: "/split-pdf",
  },
};

const tool = getToolSeo("/split-pdf");

const faqs: FaqInput[] = [
  {
    question: "Is splitting PDFs with PDFPilot really free?",
    answer:
      "Yes. Split PDF is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. All PDF splitting happens entirely in your browser. Your files are never uploaded to PDFPilot's servers.",
  },
  {
    question: "How do I choose which pages to extract?",
    answer:
      "Enter the page ranges you want, such as 1-3,5,7-9, and PDFPilot creates a separate PDF file for each range you specify.",
  },
  {
    question: "Can I split a PDF into more than one file at once?",
    answer:
      "Yes. If you enter multiple ranges separated by commas, each range is saved as its own PDF file, and you can download them individually or all at once.",
  },
  {
    question: "Do I need to install any software to split PDFs?",
    answer:
      "No installation is required. Split PDF runs directly in your web browser.",
  },
];

export default function SplitPDFPage() {
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
      <SplitPdfClient faqs={faqs} />
    </>
  );
}
