import type { Metadata } from "next";
import { CsvToJsonClient } from "./csv-to-json-client";
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

const tool = getToolSeo("/csv-to-json")!;
const toolEntity = getTool("/csv-to-json")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/csv-to-json" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/csv-to-json",
    images: [{ url: "/og/csv-to-json.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/csv-to-json.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting CSV to JSON with PDFPilot really free?",
    answer: "Yes. CSV to JSON is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The conversion runs entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What does the JSON output look like?",
    answer:
      "An array of objects, one per row, keyed by the header row's column names — e.g. [{\"Name\":\"Alice\",\"Age\":\"30\"}].",
  },
  {
    question: "Are numbers converted to actual numbers in the output?",
    answer:
      "No — every value is kept as a string, exactly as CSV itself stores it. This tool doesn't guess which columns were meant to be numeric.",
  },
  {
    question: "What if a row has fewer values than the header?",
    answer: "Missing values produce an empty string for that key in the resulting object, rather than an error.",
  },
  {
    question: "Does this handle quoted fields with commas inside them?",
    answer:
      "Yes — the CSV parser follows RFC 4180 quoting rules, so a value like \"Smith, John\" inside quotes is read as one field, not split into two.",
  },
];

export default function CsvToJsonPage() {
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
      <CsvToJsonClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
