import type { Metadata } from "next";
import { SqlToCsvClient } from "./sql-to-csv-client";
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

const tool = getToolSeo("/sql-to-csv")!;
const toolEntity = getTool("/sql-to-csv")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/sql-to-csv" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/sql-to-csv",
    images: [{ url: "/og/sql-to-csv.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/sql-to-csv.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting SQL to CSV with PDFPilot really free?",
    answer: "Yes. SQL to CSV is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The conversion runs entirely in your browser using a real SQL parser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What kind of SQL does this tool understand?",
    answer: "INSERT INTO table (columns) VALUES (...) statements specifically — the format a database export or seed script uses to represent data. SELECT, UPDATE, DELETE, and table-definition (CREATE TABLE) statements aren't read by this tool.",
  },
  {
    question: "Does this require an explicit column list in the INSERT statement?",
    answer: "Yes — INSERT INTO table (col1, col2) VALUES (...), not the column-list-omitted form (INSERT INTO table VALUES (...)), since this tool has no other way to know what each value's column is.",
  },
  {
    question: "What if my SQL file has INSERT statements for different tables or columns?",
    answer: "You'll get a clear error — every statement in the file must target the exact same column list, so the resulting CSV has one consistent set of columns.",
  },
  {
    question: "Does this execute the SQL against a database?",
    answer: "No — nothing is executed anywhere. The SQL text is only parsed to extract the literal values it describes.",
  },
];

export default function SqlToCsvPage() {
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
      <SqlToCsvClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
