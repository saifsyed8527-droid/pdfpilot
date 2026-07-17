import type { Metadata } from "next";
import { WordToPdfClient } from "./word-to-pdf-client";
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

const tool = getToolSeo("/word-to-pdf")!;
const toolEntity = getTool("/word-to-pdf")!;
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
    canonical: "/word-to-pdf",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/word-to-pdf",
    images: [{ url: "/og/word-to-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/word-to-pdf.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting Word to PDF with PDFPilot really free?",
    answer:
      "Yes. Word to PDF is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. The whole conversion happens entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "Does this preserve my document's exact formatting?",
    answer:
      "No. Word to PDF converts your document's text and headings into a clean, readable PDF — bold and italic styling, images, tables, and the exact page layout of the original Word document aren't preserved. If you need a PDF that looks pixel-for-pixel identical to the original, this tool isn't the right fit yet.",
  },
  {
    question: "What file types are supported?",
    answer:
      "The modern Word format, .docx. Older .doc files aren't supported.",
  },
  {
    question: "Do I need to install any software to convert Word to PDF?",
    answer:
      "No installation is required. Word to PDF runs directly in your web browser.",
  },
];

export default function WordToPdfPage() {
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
      <WordToPdfClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
