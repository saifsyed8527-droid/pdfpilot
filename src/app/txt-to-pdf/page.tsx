import type { Metadata } from "next";
import { TxtToPdfClient } from "./txt-to-pdf-client";
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

const tool = getToolSeo("/txt-to-pdf")!;
const toolEntity = getTool("/txt-to-pdf")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/txt-to-pdf",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/txt-to-pdf",
    images: [{ url: "/og/txt-to-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/txt-to-pdf.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting TXT to PDF with PDFPilot really free?",
    answer: "Yes. TXT to PDF is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. The conversion happens entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "How does this decide where paragraphs break?",
    answer:
      "A blank line in your text file starts a new paragraph. Plain text has no heading or formatting syntax, so every line becomes regular body text.",
  },
  {
    question: "What file types are supported?",
    answer: "Plain text files (.txt).",
  },
];

export default function TxtToPdfPage() {
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
      <TxtToPdfClient faqs={faqs} related={[...relatedTools, ...relatedContent]} />
    </>
  );
}
