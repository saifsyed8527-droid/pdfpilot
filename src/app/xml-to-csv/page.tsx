import type { Metadata } from "next";
import { XmlToCsvClient } from "./xml-to-csv-client";
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

const tool = getToolSeo("/xml-to-csv")!;
const toolEntity = getTool("/xml-to-csv")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/xml-to-csv",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/xml-to-csv",
    images: [{ url: "/og/xml-to-csv.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/xml-to-csv.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting XML to CSV with PDFPilot really free?",
    answer: "Yes. XML to CSV is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The conversion happens entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What XML structure does this expect?",
    answer:
      "<rows><row><Field>value</Field></row></rows> — the same structure PDFPilot's CSV to XML tool produces. Each <row> element becomes one CSV row; each row's child elements become columns.",
  },
  {
    question: "What if my XML doesn't match that structure?",
    answer:
      "This tool will show a clear error rather than guessing — it doesn't attempt to detect or convert arbitrary XML schemas from other systems, only the row/field structure described above.",
  },
  {
    question: "What happens if rows have different fields?",
    answer:
      "Column names and order come from the first <row> element. A later row missing one of those fields produces an empty cell in that column rather than shifting the other columns.",
  },
];

export default function XmlToCsvPage() {
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
      <XmlToCsvClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
