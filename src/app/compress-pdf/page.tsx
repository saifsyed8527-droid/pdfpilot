import type { Metadata } from "next";
import { CompressPdfClient } from "./compress-pdf-client";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getBreadcrumbSchema,
  getFaqSchema,
  getSoftwareApplicationSchema,
  getToolSeo,
  type FaqInput,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: "Compress PDF Online Free | PDFPilot",
  description:
    "Reduce PDF file size without losing quality. Free online PDF compression tool with adjustable quality settings, all processed in your browser.",
  alternates: {
    canonical: "/compress-pdf",
  },
};

const tool = getToolSeo("/compress-pdf");

const faqs: FaqInput[] = [
  {
    question: "Is compressing PDFs with PDFPilot really free?",
    answer:
      "Yes. Compress PDF is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. All PDF compression happens entirely in your browser. Your files are never uploaded to PDFPilot's servers.",
  },
  {
    question: "What compression quality levels are available?",
    answer:
      "You can choose between Maximum Compression, Medium, or High Quality, depending on how much you want to reduce file size versus preserve image quality.",
  },
  {
    question: "Will compressing my PDF affect its content?",
    answer:
      "Compression rebuilds each page as an image at your chosen quality level, so file size is reduced but text on the page will no longer be selectable or searchable in the compressed file.",
  },
  {
    question: "Do I need to install any software to compress PDFs?",
    answer:
      "No installation is required. Compress PDF runs directly in your web browser.",
  },
];

export default function CompressPDFPage() {
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
      <CompressPdfClient faqs={faqs} />
    </>
  );
}
