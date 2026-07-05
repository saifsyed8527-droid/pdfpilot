import type { Metadata } from "next";
import { MergePdfClient } from "./merge-pdf-client";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getBreadcrumbSchema,
  getFaqSchema,
  getSoftwareApplicationSchema,
  getToolSeo,
  type FaqInput,
} from "@/lib/seo";

const TITLE = "Merge PDF Files Online Free | PDFPilot";
const DESCRIPTION =
  "Combine multiple PDF files into one document in seconds. Free, secure, and fast — no upload required, all processing happens in your browser.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/merge-pdf",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: TITLE,
    description: DESCRIPTION,
    url: "/merge-pdf",
    images: [{ url: "/og/merge-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og/merge-pdf.png"],
  },
};

const tool = getToolSeo("/merge-pdf");

const faqs: FaqInput[] = [
  {
    question: "Is merging PDFs with PDFPilot really free?",
    answer:
      "Yes. Merge PDF is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. All PDF merging happens entirely in your browser. Your files are never uploaded to PDFPilot's servers.",
  },
  {
    question: "Can I change the order of the PDFs before merging?",
    answer:
      "Yes. After adding your files, you can drag and drop them into the order you want before merging.",
  },
  {
    question: "Is there a limit to how many PDF files I can merge?",
    answer:
      "There's no fixed limit built into the tool — you can add as many PDF files as you'd like to combine into a single document.",
  },
  {
    question: "Do I need to install any software to merge PDFs?",
    answer:
      "No installation is required. Merge PDF runs directly in your web browser.",
  },
];

export default function MergePDFPage() {
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
      <MergePdfClient faqs={faqs} />
    </>
  );
}
