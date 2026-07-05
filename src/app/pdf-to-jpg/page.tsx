import type { Metadata } from "next";
import { PdfToJpgClient } from "./pdf-to-jpg-client";
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

const tool = getToolSeo("/pdf-to-jpg")!;
const relatedContent = getContentReferencingTool(getTool("/pdf-to-jpg")!.id);

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/pdf-to-jpg",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/pdf-to-jpg",
    images: [{ url: "/og/pdf-to-jpg.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/pdf-to-jpg.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting PDF to JPG with PDFPilot really free?",
    answer:
      "Yes. PDF to JPG is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. All PDF to JPG conversion happens entirely in your browser. Your files are never uploaded to PDFPilot's servers.",
  },
  {
    question: "Does each page become a separate image?",
    answer:
      "Yes. Every page in your PDF is converted into its own high-quality JPG image.",
  },
  {
    question: "Can I download all the converted images at once?",
    answer:
      "Yes. Once conversion is complete, you can download each image individually or download all of them at once.",
  },
  {
    question: "Do I need to install any software to convert PDFs to JPG?",
    answer:
      "No installation is required. PDF to JPG runs directly in your web browser.",
  },
];

export default function PDFToJPGPage() {
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
      <PdfToJpgClient faqs={faqs} related={relatedContent} />
    </>
  );
}
