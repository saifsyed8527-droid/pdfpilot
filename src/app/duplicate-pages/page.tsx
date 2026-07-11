import type { Metadata } from "next";
import { DuplicatePagesClient } from "./duplicate-pages-client";
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

const tool = getToolSeo("/duplicate-pages")!;
const toolEntity = getTool("/duplicate-pages")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/duplicate-pages",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/duplicate-pages",
    images: [{ url: "/og/duplicate-pages.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/duplicate-pages.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is duplicating PDF pages with PDFPilot really free?",
    answer:
      "Yes. Duplicate Pages is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. All page duplication happens entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "Where does the duplicated page get inserted?",
    answer:
      "Each duplicated page is inserted immediately after its original — duplicating page 3 in a 5-page PDF produces a 6-page PDF with the new copy at position 4.",
  },
  {
    question: "Can I duplicate more than one page at a time?",
    answer:
      "Yes. Enter page numbers or ranges, such as 2,4-6, and PDFPilot duplicates each one in place.",
  },
  {
    question: "How is this different from Rearrange Pages?",
    answer:
      "Rearrange Pages reorders your PDF's existing pages — it doesn't add any. Duplicate Pages adds a copy of each page you choose without changing the order of the rest.",
  },
];

export default function DuplicatePagesPage() {
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
      <DuplicatePagesClient faqs={faqs} related={[...relatedTools, ...relatedContent]} />
    </>
  );
}
