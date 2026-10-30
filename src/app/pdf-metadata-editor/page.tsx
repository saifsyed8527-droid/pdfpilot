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
import { getClusterMembers } from "@/lib/content/topic-clusters";

const tool = getToolSeo("/pdf-metadata-editor")!;
const toolEntity = getTool("/pdf-metadata-editor")!;
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
      "Title, Author, Subject, Keywords, Creator, Producer, and creation/modification dates in UTC. Saving synchronizes the PDF Info dictionary and embedded XMP while preserving unrelated custom properties.",
  },
  {
    question: "Does editing metadata change the content of my PDF?",
    answer:
      "No. Only the document metadata changes. Every page's content, layout, and formatting stay exactly as they were.",
  },
  {
    question: "Can this tool remove all metadata for privacy?",
    answer:
      "Remove document metadata clears standard/custom Info fields, dates and embedded metadata streams. It does not remove visible text, form values, comments, attachments, document identifiers or metadata inside embedded images. It is not a substitute for redaction.",
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
      <PdfMetadataEditorClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
