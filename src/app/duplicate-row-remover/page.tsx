import type { Metadata } from "next";
import { DuplicateRowRemoverClient } from "./duplicate-row-remover-client";
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

const tool = getToolSeo("/duplicate-row-remover")!;
const toolEntity = getTool("/duplicate-row-remover")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/duplicate-row-remover" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/duplicate-row-remover",
    images: [{ url: "/og/duplicate-row-remover.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/duplicate-row-remover.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is removing duplicate rows with PDFPilot really free?",
    answer: "Yes. Duplicate Row Remover is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The deduplication runs entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "Is the header row ever counted as a duplicate?",
    answer: "No — the header row is always kept as-is, even if a data row later happens to match it exactly.",
  },
  {
    question: "What counts as a duplicate?",
    answer: "A row where every cell exactly matches another row's corresponding cell — case-sensitive and whitespace-sensitive. \"Alice\" and \"alice \" are treated as different.",
  },
  {
    question: "Which occurrence is kept when duplicates are found?",
    answer: "The first one — later exact matches are removed, preserving the original row order otherwise.",
  },
];

export default function DuplicateRowRemoverPage() {
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
      <DuplicateRowRemoverClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
