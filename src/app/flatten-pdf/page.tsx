import type { Metadata } from "next";
import { FlattenPdfClient } from "./flatten-pdf-client";
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

const tool = getToolSeo("/flatten-pdf")!;
const toolEntity = getTool("/flatten-pdf")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/flatten-pdf",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/flatten-pdf",
    images: [{ url: "/og/flatten-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/flatten-pdf.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is flattening a PDF with PDFPilot really free?",
    answer: "Yes. Flatten PDF is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. Flattening happens entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What does flattening a PDF form actually do?",
    answer:
      "It converts every fillable field's current value into permanent page content and removes the field itself — after flattening, no one can edit those values, including you.",
  },
  {
    question: "How is this different from Fill PDF?",
    answer:
      "Fill PDF lets you type values into a form and locks them in as one step. Flatten PDF is for a form that's already been filled — in PDFPilot or any other app — and you just want to make those values permanent.",
  },
  {
    question: "What if my PDF doesn't have any form fields?",
    answer:
      "Flattening a PDF with no form fields simply returns the same PDF unchanged — there's nothing to lock in.",
  },
];

export default function FlattenPdfPage() {
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
      <FlattenPdfClient faqs={faqs} related={[...relatedTools, ...relatedContent]} />
    </>
  );
}
