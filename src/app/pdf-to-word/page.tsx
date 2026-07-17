import type { Metadata } from "next";
import { PdfToWordClient } from "./pdf-to-word-client";
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

const tool = getToolSeo("/pdf-to-word")!;
const toolEntity = getTool("/pdf-to-word")!;
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
    canonical: "/pdf-to-word",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/pdf-to-word",
    images: [{ url: "/og/pdf-to-word.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/pdf-to-word.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting PDF to Word with PDFPilot really free?",
    answer:
      "Yes. PDF to Word is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. The whole conversion happens entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "Does this preserve my PDF's exact layout?",
    answer:
      "No. PDF to Word extracts the text content of your PDF into an editable Word document — original fonts, exact positioning, images, and tables aren't preserved. It's built for getting editable text out of a PDF, not for recreating its exact visual design.",
  },
  {
    question: "What if my PDF is a scanned document or has no selectable text?",
    answer:
      "PDF to Word can only extract text that's already stored as real text in the PDF. If your PDF is a scanned image with no text layer, there's nothing to extract, and you'll see an error instead of an empty document.",
  },
  {
    question: "Do I need to install any software to convert PDF to Word?",
    answer:
      "No installation is required. PDF to Word runs directly in your web browser.",
  },
];

export default function PdfToWordPage() {
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
      <PdfToWordClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
