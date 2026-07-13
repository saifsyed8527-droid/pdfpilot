import type { Metadata } from "next";
import { CsvToPdfClient } from "./csv-to-pdf-client";
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

const tool = getToolSeo("/csv-to-pdf")!;
const toolEntity = getTool("/csv-to-pdf")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/csv-to-pdf",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/csv-to-pdf",
    images: [{ url: "/og/csv-to-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/csv-to-pdf.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting CSV to PDF with PDFPilot really free?",
    answer: "Yes. CSV to PDF is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. The conversion happens entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What happens if a cell's text is too long for its column?",
    answer:
      "It's truncated with an ellipsis (…). Every column is the same fixed width, so growing one cell isn't possible without breaking the rest of the table's alignment.",
  },
  {
    question: "Does this support quoted fields with commas inside them?",
    answer:
      "Yes — standard CSV quoting (fields wrapped in double quotes, with \"\" for an escaped quote) is handled correctly.",
  },
  {
    question: "What happens with very wide spreadsheets?",
    answer:
      "All columns share the page width equally, so a CSV with many columns will have narrow columns and more truncated cells. This tool is best suited to CSVs with a modest number of columns.",
  },
];

export default function CsvToPdfPage() {
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
      <CsvToPdfClient faqs={faqs} related={[...relatedTools, ...relatedContent]} />
    </>
  );
}
