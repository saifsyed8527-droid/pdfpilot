import type { Metadata } from "next";
import { CsvToSqlClient } from "./csv-to-sql-client";
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

const tool = getToolSeo("/csv-to-sql")!;
const toolEntity = getTool("/csv-to-sql")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/csv-to-sql" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/csv-to-sql",
    images: [{ url: "/og/csv-to-sql.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/csv-to-sql.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting CSV to SQL with PDFPilot really free?",
    answer: "Yes. CSV to SQL is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The conversion runs entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What SQL dialect is the output written for?",
    answer: "Standard, widely-portable SQL — backtick-quoted identifiers (MySQL-style) and single-quoted, backslash-escaped string literals. It should work as-is in MySQL/MariaDB, and needs only minor adjustment (e.g. double quotes for identifiers) for PostgreSQL or SQL Server.",
  },
  {
    question: "How are numbers vs. text distinguished?",
    answer: "A cell is written unquoted (as a number) only if its entire text parses as a valid number; otherwise it's written as an escaped, quoted string — including things like phone numbers or ZIP codes with leading zeros, which correctly stay text.",
  },
  {
    question: "How is the table name chosen?",
    answer: "You enter it directly — invalid characters for a SQL identifier are stripped automatically.",
  },
  {
    question: "Is this output ready to run against a real database?",
    answer: "Yes, as a syntactically valid INSERT statement — but you're responsible for confirming the target table's schema actually matches the columns and types in the generated statement before running it.",
  },
];

export default function CsvToSqlPage() {
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
      <CsvToSqlClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
