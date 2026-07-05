import type { Metadata } from "next";
import { JpgToPdfClient } from "./jpg-to-pdf-client";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getBreadcrumbSchema,
  getFaqSchema,
  getSoftwareApplicationSchema,
  getToolSeo,
  type FaqInput,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: "Convert JPG to PDF Online Free | PDFPilot",
  description:
    "Turn your JPG and PNG images into a single PDF document in seconds. Free online image-to-PDF converter that works in your browser.",
  alternates: {
    canonical: "/jpg-to-pdf",
  },
};

const tool = getToolSeo("/jpg-to-pdf");

const faqs: FaqInput[] = [
  {
    question: "Is converting JPG to PDF with PDFPilot really free?",
    answer:
      "Yes. JPG to PDF is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. All image to PDF conversion happens entirely in your browser. Your files are never uploaded to PDFPilot's servers.",
  },
  {
    question: "Can I convert both JPG and PNG images?",
    answer:
      "Yes. JPG to PDF accepts both JPG/JPEG and PNG image files.",
  },
  {
    question: "Can I remove an image before converting?",
    answer:
      "Yes. You can remove any image from your selection before converting by hovering over it and clicking the delete icon.",
  },
  {
    question: "Do I need to install any software to convert images to PDF?",
    answer:
      "No installation is required. JPG to PDF runs directly in your web browser.",
  },
];

export default function JPGToPDFPage() {
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
      <JpgToPdfClient faqs={faqs} />
    </>
  );
}
