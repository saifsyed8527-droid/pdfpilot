import type { Metadata } from "next";
import { SummaryGeneratorClient } from "./summary-generator-client";
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

const tool = getToolSeo("/summary-generator")!;
const toolEntity = getTool("/summary-generator")!;
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
    canonical: "/summary-generator",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/summary-generator",
    images: [{ url: "/og/summary-generator.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/summary-generator.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is the PDF Summary Generator free?",
    answer: "Yes. Summary Generator is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. The whole summary runs entirely in your browser — your PDF is never uploaded anywhere, and no external service is called.",
  },
  {
    question: "Does this use AI or an LLM?",
    answer:
      "No. This is an extractive summary built on a transparent, browser-native scoring algorithm: it ranks sentences by word frequency, then keeps the most representative ones in their original order. No text is rewritten, and no facts are invented — every sentence in the summary appears verbatim in the source PDF.",
  },
  {
    question: "Does it work with a scanned PDF (no selectable text)?",
    answer:
      "Enable English OCR to read pages without selectable text. OCR runs locally and can make recognition mistakes. Native-text pages are extracted directly; other OCR languages are not included.",
  },
  {
    question: "Why is the summary shorter/longer than I expected?",
    answer:
      "The Short/Medium/Long selector picks an approximate fraction of the document's distinct sentences (roughly 10% / 20% / 35%). Very short documents will produce very short summaries, because there are fewer sentences available to pick from.",
  },
  {
    question: "Can I trace a summary sentence to its source?",
    answer:
      "Each selected sentence lists its source page or pages. Repeated sentences are included once. Always read the original context; sentence ranking does not interpret meaning.",
  },
  {
    question: "Can I save the summary?",
    answer:
      "Yes. Choose Text, Markdown or PDF before generating your summary. Downloads include the selected source sentences, page references, word counts and conversion notes.",
  },
];

export default function SummaryGeneratorPage() {
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
      <SummaryGeneratorClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
