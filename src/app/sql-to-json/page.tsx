import type { Metadata } from "next";
import { SqlToJsonClient } from "./sql-to-json-client";
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

const tool = getToolSeo("/sql-to-json")!;
const toolEntity = getTool("/sql-to-json")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/sql-to-json" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/sql-to-json",
    images: [{ url: "/og/sql-to-json.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/sql-to-json.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting SQL to JSON with PDFPilot really free?",
    answer: "Yes. SQL to JSON is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The conversion runs entirely in your browser using a real SQL parser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What kind of SQL does this tool understand?",
    answer: "INSERT INTO table (columns) VALUES (...) statements specifically. SELECT, UPDATE, DELETE, and CREATE TABLE statements aren't read by this tool.",
  },
  {
    question: "What does the JSON output look like?",
    answer: "An array of objects, one per VALUES tuple, keyed by the column names from the INSERT statement.",
  },
  {
    question: "Does this execute the SQL against a database?",
    answer: "No — nothing is executed anywhere. The SQL text is only parsed to extract the literal values it describes.",
  },
];

export default function SqlToJsonPage() {
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
      <SqlToJsonClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
