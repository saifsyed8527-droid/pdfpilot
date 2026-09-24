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
      "PDF Forms works two ways: fill in a PDF that already has fillable fields (an AcroForm, e.g. built in Adobe Acrobat), or build new fields on any PDF that doesn't have any yet — either by placing them yourself or using automatic field detection.",
  },
  {
    question: "What field types are supported?",
    answer:
      "Text fields (including multiline), checkboxes, radio button groups, dropdowns, multi-select list boxes, and signature fields are all supported for both filling and creating.",
  },
  {
    question: "What happens if my PDF has no fillable fields?",
    answer:
      "PDF Forms offers to detect likely field locations automatically (based on visual cues like underlines and boxes) or let you add fields manually — either way, you review and adjust every field before exporting.",
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
      <ToolWorkspace />
    </>
  );
}

/** Shared by the English route and every localized route; only copy may differ. */
export function ToolWorkspace() {
  return <FillPdfClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />;
}
