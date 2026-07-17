import type { Metadata } from "next";
import { RotatePdfClient } from "./rotate-pdf-client";
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

const tool = getToolSeo("/rotate-pdf")!;
const toolEntity = getTool("/rotate-pdf")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/rotate-pdf",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/rotate-pdf",
    images: [{ url: "/og/rotate-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/rotate-pdf.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is rotating PDFs with PDFPilot really free?",
    answer:
      "Yes. Rotate PDF is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. All PDF rotation happens entirely in your browser. Your files are never uploaded to PDFPilot's servers.",
  },
  {
    question: "Does rotation apply to every page?",
    answer:
      "Yes. The rotation you choose is applied to every page in the document. There's currently no option to rotate individual pages differently from the rest.",
  },
  {
    question: "Will rotating my PDF affect its quality?",
    answer:
      "No. Rotating a PDF only changes each page's orientation metadata — the underlying text, images, and formatting are untouched, so there's no quality loss.",
  },
  {
    question: "Do I need to install any software to rotate PDFs?",
    answer:
      "No installation is required. Rotate PDF runs directly in your web browser.",
  },
];

export default function RotatePDFPage() {
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
      <RotatePdfClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
