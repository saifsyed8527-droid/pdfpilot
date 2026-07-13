import type { Metadata } from "next";
import { InsertPagesClient } from "./insert-pages-client";
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

const tool = getToolSeo("/insert-pages")!;
const toolEntity = getTool("/insert-pages")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/insert-pages",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/insert-pages",
    images: [{ url: "/og/insert-pages.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/insert-pages.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is inserting PDF pages with PDFPilot really free?",
    answer: "Yes. Insert Pages is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. Inserting pages happens entirely in your browser. Neither file is ever uploaded to PDFPilot's servers.",
  },
  {
    question: "How is this different from Merge PDF?",
    answer:
      "Merge PDF combines whole documents together, one after another. Insert Pages slots every page of a second PDF into a specific position inside the first — the middle of a document, not just the end.",
  },
  {
    question: "Can I use this to replace a page instead of just adding one?",
    answer:
      "Yes — delete the page you want to replace with PDFPilot's Delete Pages tool first, note that page's position, then use Insert Pages to add the replacement at that same spot.",
  },
  {
    question: "What happens if I insert at position 0?",
    answer:
      "The second PDF's pages are added at the very beginning of the first document, before its existing first page.",
  },
];

export default function InsertPagesPage() {
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
      <InsertPagesClient faqs={faqs} related={[...relatedTools, ...relatedContent]} />
    </>
  );
}
