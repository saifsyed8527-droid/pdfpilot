import type { Metadata } from "next";
import { CsvToMarkdownTableClient } from "./csv-to-markdown-table-client";
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

const tool = getToolSeo("/csv-to-markdown-table")!;
const toolEntity = getTool("/csv-to-markdown-table")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/csv-to-markdown-table" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/csv-to-markdown-table",
    images: [{ url: "/og/csv-to-markdown-table.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/csv-to-markdown-table.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting CSV to a Markdown table with PDFPilot really free?",
    answer: "Yes. CSV to Markdown Table is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The conversion runs entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What Markdown table format does this produce?",
    answer:
      "Standard GitHub-flavored Markdown (GFM) pipe tables — the format GitHub, GitLab, and most Markdown renderers support natively.",
  },
  {
    question: "What happens if a cell contains a pipe character or a line break?",
    answer:
      "Pipe characters are escaped (\\|) so they don't break the table's column alignment, and line breaks within a cell are replaced with a space, since a Markdown table row can't span multiple lines.",
  },
];

export default function CsvToMarkdownTablePage() {
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
      <CsvToMarkdownTableClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
