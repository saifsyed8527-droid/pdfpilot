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
import { getTool } from "@/lib/tools";
import { getContentReferencingTool } from "@/lib/content/tool-related";
import { getClusterMembers } from "@/lib/content/topic-clusters";

const tool = getToolSeo("/jpg-to-pdf")!;
const toolEntity = getTool("/jpg-to-pdf")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const existingPaths = new Set(relatedContent.map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/jpg-to-pdf",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/jpg-to-pdf",
    images: [{ url: "/og/jpg-to-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/jpg-to-pdf.png"],
  },
};

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
      <JpgToPdfClient faqs={faqs} related={[...relatedContent, ...clusterMembers]} />
    </>
  );
}
