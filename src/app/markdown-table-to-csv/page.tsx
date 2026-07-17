import type { Metadata } from "next";
import { MarkdownTableToCsvClient } from "./markdown-table-to-csv-client";
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

const tool = getToolSeo("/markdown-table-to-csv")!;
const toolEntity = getTool("/markdown-table-to-csv")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/markdown-table-to-csv" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/markdown-table-to-csv",
    images: [{ url: "/og/markdown-table-to-csv.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/markdown-table-to-csv.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting a Markdown table to CSV with PDFPilot really free?",
    answer: "Yes. Markdown Table to CSV is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The conversion runs entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What happens if my file has more than one table?",
    answer:
      "Only the first table found in the file is converted. If you need the others, split them into separate files first.",
  },
  {
    question: "What if my file has no table at all?",
    answer:
      "You'll get a clear error saying no Markdown table was found, rather than an empty or incorrect CSV file.",
  },
];

export default function MarkdownTableToCsvPage() {
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
      <MarkdownTableToCsvClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
