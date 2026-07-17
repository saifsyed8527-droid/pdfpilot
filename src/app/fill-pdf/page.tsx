import type { Metadata } from "next";
import { FillPdfClient } from "./fill-pdf-client";
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

const tool = getToolSeo("/fill-pdf")!;
const toolEntity = getTool("/fill-pdf")!;
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
    canonical: "/fill-pdf",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/fill-pdf",
    images: [{ url: "/og/fill-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/fill-pdf.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is filling PDF forms with PDFPilot really free?",
    answer:
      "Yes. Fill PDF is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. All form filling happens entirely in your browser. Your files are never uploaded to PDFPilot's servers.",
  },
  {
    question: "What kind of PDFs does this work with?",
    answer:
      "Fill PDF works with PDFs that already contain fillable form fields (an AcroForm) — for example, a form built in Adobe Acrobat or similar software. It doesn't add new fields to a PDF that doesn't already have any.",
  },
  {
    question: "What field types are supported?",
    answer:
      "Text fields, checkboxes, dropdowns, and radio button groups are supported. Multi-select list boxes, signature fields, and button fields aren't supported yet.",
  },
  {
    question: "What happens if my PDF has no fillable fields?",
    answer:
      "Fill PDF will tell you no fillable fields were found, rather than pretending to fill anything. Most regular documents (not built as forms) won't have any.",
  },
];

export default function FillPdfPage() {
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
      <FillPdfClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
