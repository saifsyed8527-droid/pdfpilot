import type { Metadata } from "next";
import { EditPdfClient } from "./edit-pdf-client";
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

const tool = getToolSeo("/edit-pdf")!;
const toolEntity = getTool("/edit-pdf")!;
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
    canonical: "/edit-pdf",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/edit-pdf",
    images: [{ url: "/og/edit-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/edit-pdf.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is Edit PDF really free?",
    answer:
      "Yes. Edit PDF is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. The entire editor runs in your browser — pages are rendered and your text is added locally. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What can I add to my PDF with this tool?",
    answer:
      "You can click anywhere on any page to add a text box, type your content, drag it into position, and adjust its font size and color before saving. This is different from Fill PDF, which only fills in fields that already exist in a fillable form — Edit PDF lets you add new text anywhere on a regular document.",
  },
  {
    question: "Can I edit rotated pages?",
    answer:
      "Not in this version. If a page has been rotated (for example with our Rotate PDF tool), adding text to that specific page is disabled to avoid placing it incorrectly — other, unrotated pages in the same file can still be edited normally.",
  },
  {
    question: "Can I add multiple text boxes, and to more than one page?",
    answer:
      "Yes. Add as many text boxes as you need, on as many pages as you need, before saving — each one keeps its own position, size, and color.",
  },
  {
    question: "Do I need to install any software to edit a PDF?",
    answer:
      "No installation is required. Edit PDF runs directly in your web browser.",
  },
];

export default function EditPdfPage() {
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
      <EditPdfClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
