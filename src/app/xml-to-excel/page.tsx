import type { Metadata } from "next";
import { XmlToExcelClient } from "./xml-to-excel-client";
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

const tool = getToolSeo("/xml-to-excel")!;
const toolEntity = getTool("/xml-to-excel")!;
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
    canonical: "/xml-to-excel",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/xml-to-excel",
    images: [{ url: "/og/xml-to-excel.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/xml-to-excel.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting XML to Excel with PDFPilot really free?",
    answer: "Yes. XML to Excel is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The conversion happens entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What XML structure does this expect?",
    answer:
      "<rows><row><Field>value</Field></row></rows> — the same structure PDFPilot's CSV to XML and Excel to XML tools produce.",
  },
  {
    question: "Is the resulting file a real Excel file?",
    answer:
      "Yes — a genuine .xlsx file any spreadsheet program can open, not a renamed CSV or plain text file. It's generated directly in the correct OOXML format.",
  },
  {
    question: "Does the output preserve formatting or formulas?",
    answer:
      "No — this produces plain data in a single sheet, with numeric-looking values stored as numbers and everything else as text. There's no formatting, multiple sheets, or formulas, since the source XML doesn't carry that information either.",
  },
];

export default function XmlToExcelPage() {
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
      <XmlToExcelClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
