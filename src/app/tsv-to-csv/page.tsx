import type { Metadata } from "next";
import { TsvToCsvClient } from "./tsv-to-csv-client";
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

const tool = getToolSeo("/tsv-to-csv")!;
const toolEntity = getTool("/tsv-to-csv")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/tsv-to-csv" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/tsv-to-csv",
    images: [{ url: "/og/tsv-to-csv.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/tsv-to-csv.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting TSV to CSV with PDFPilot really free?",
    answer: "Yes. TSV to CSV is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The conversion runs entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What's the actual difference between TSV and CSV?",
    answer: "Only the field separator — TSV uses a tab character between values, CSV uses a comma. The row/column structure is otherwise identical.",
  },
  {
    question: "What if a value in my TSV already contains a comma?",
    answer: "It's automatically wrapped in quotes in the CSV output, following standard CSV quoting rules, so the comma inside it isn't mistaken for a new column.",
  },
  {
    question: "Does this handle quoted fields in the source TSV?",
    answer: "Yes — quoted fields (including ones containing tabs or newlines) are parsed correctly, the same quoting rules CSV uses.",
  },
];

export default function TsvToCsvPage() {
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
      <TsvToCsvClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
