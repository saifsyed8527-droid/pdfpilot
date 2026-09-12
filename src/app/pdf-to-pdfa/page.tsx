import type { Metadata } from "next";
import { PdfToPdfaClient } from "./pdf-to-pdfa-client";
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
import { getClusterMembers } from "@/lib/content/topic-clusters";

const tool = getToolSeo("/pdf-to-pdfa")!;
const toolEntity = getTool("/pdf-to-pdfa")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id })));
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/pdf-to-pdfa",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/pdf-to-pdfa",
    images: [{ url: "/og/pdf-to-pdfa.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/pdf-to-pdfa.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is PDF to PDF/A free on PDFPilot?",
    answer: "Yes. PDF to PDF/A is free to use in PDFPilot, with no sign-up or account required.",
  },
  {
    question: "Are my PDF files uploaded?",
    answer: "No. The PDF/A conversion runs in your browser. Your PDF is not uploaded to PDFPilot servers.",
  },
  {
    question: "Which PDF/A levels can I choose?",
    answer:
      "You can choose common PDF/A-1, PDF/A-2, and PDF/A-3 levels including B, U, and A-style labels. The tool writes PDF/A identification metadata and creates an archive-ready browser-local copy.",
  },
  {
    question: "Is the output legally certified PDF/A?",
    answer:
      "PDFPilot creates an archive-ready PDF/A-style copy with PDF/A metadata and normalized output. Strict regulated archives may still require validation with their own PDF/A compliance checker.",
  },
  {
    question: "Should I preserve or flatten the PDF?",
    answer:
      "Preserve mode keeps the PDF structure and selectable text where possible. Flatten mode locks the page appearance into images, which can help visual preservation but may make text non-selectable.",
  },
];

export default function PdfToPdfaPage() {
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
      <PdfToPdfaClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
