import type { Metadata } from "next";
import { JsonToCsvClient } from "./json-to-csv-client";
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

const tool = getToolSeo("/json-to-csv")!;
const toolEntity = getTool("/json-to-csv")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/json-to-csv" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/json-to-csv",
    images: [{ url: "/og/json-to-csv.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/json-to-csv.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting JSON to CSV with PDFPilot really free?",
    answer: "Yes. JSON to CSV is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The conversion runs entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What JSON structure does this tool expect?",
    answer:
      "A JSON array of flat objects — for example [{\"Name\":\"Alice\",\"Age\":30}, {\"Name\":\"Bob\",\"Age\":25}]. This matches how most APIs and databases export tabular data as JSON.",
  },
  {
    question: "What happens if objects have different keys?",
    answer:
      "The output columns are the union of every object's keys. An object missing a given key produces an empty cell for that column rather than shifting other columns.",
  },
  {
    question: "What if my JSON has nested objects or arrays as values?",
    answer:
      "A nested object or array value is stored as its JSON string representation in that cell, since CSV has no native way to represent nested structure. This tool doesn't flatten nested data automatically.",
  },
  {
    question: "Can I convert a single JSON object instead of an array?",
    answer:
      "No — this tool expects an array, since CSV is inherently a table of rows. A single object has no rows to produce.",
  },
];

export default function JsonToCsvPage() {
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
      <JsonToCsvClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
