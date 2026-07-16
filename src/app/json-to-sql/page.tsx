import type { Metadata } from "next";
import { JsonToSqlClient } from "./json-to-sql-client";
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

const tool = getToolSeo("/json-to-sql")!;
const toolEntity = getTool("/json-to-sql")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/json-to-sql" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/json-to-sql",
    images: [{ url: "/og/json-to-sql.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/json-to-sql.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting JSON to SQL with PDFPilot really free?",
    answer: "Yes. JSON to SQL is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The conversion runs entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What SQL dialect is the output written for?",
    answer: "Standard, widely-portable SQL — backtick-quoted identifiers (MySQL-style) and single-quoted, backslash-escaped string literals.",
  },
  {
    question: "What JSON structure does this tool expect?",
    answer: "A JSON array of flat objects, e.g. [{\"Name\":\"Alice\",\"Age\":30}, ...] — the same shape JSON to CSV and JSON to Excel expect.",
  },
  {
    question: "Is this output ready to run against a real database?",
    answer: "Yes, as a syntactically valid INSERT statement — but you're responsible for confirming the target table's schema actually matches the columns and types in the generated statement before running it.",
  },
];

export default function JsonToSqlPage() {
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
      <JsonToSqlClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
