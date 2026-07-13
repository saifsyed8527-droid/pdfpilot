import type { Metadata } from "next";
import { PdfMetadataEditorClient } from "./pdf-metadata-editor-client";
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

const tool = getToolSeo("/pdf-metadata-editor")!;
const toolEntity = getTool("/pdf-metadata-editor")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/pdf-metadata-editor",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/pdf-metadata-editor",
    images: [{ url: "/og/pdf-metadata-editor.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/pdf-metadata-editor.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is editing PDF metadata with PDFPilot really free?",
    answer:
      "Yes. PDF Metadata Editor is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. Metadata is read and written entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What metadata can I edit?",
    answer:
      "Title, Author, Subject, Keywords, Creator, and Producer. The document's creation and modification dates are shown for reference but aren't editable in this tool.",
  },
  {
    question: "Does editing metadata change the content of my PDF?",
    answer:
      "No. Only the document metadata changes. Every page's content, layout, and formatting stay exactly as they were.",
  },
  {
    question: "Can this tool remove all metadata for privacy?",
    answer:
      "Click \"Clear All Metadata\" to blank out every field in one step, or clear individual fields yourself before saving. This tool doesn't scrub lower-level metadata some PDFs carry (such as embedded XMP data) — for full metadata removal, treat this as a partial, not complete, privacy tool.",
  },
];

export default function PdfMetadataEditorPage() {
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
      <PdfMetadataEditorClient faqs={faqs} related={[...relatedTools, ...relatedContent]} />
    </>
  );
}
