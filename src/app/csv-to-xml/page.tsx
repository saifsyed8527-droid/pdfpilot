import type { Metadata } from "next";
import { CsvToXmlClient } from "./csv-to-xml-client";
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

const tool = getToolSeo("/csv-to-xml")!;
const toolEntity = getTool("/csv-to-xml")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id })),
);
const existingPaths = new Set(
  [...relatedTools, ...relatedContent].map((e) => e.path),
);
const clusterMembers = getClusterMembers(toolEntity.id).filter(
  (member) => !existingPaths.has(member.path),
);

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/csv-to-xml",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/csv-to-xml",
    images: [
      {
        url: "/og/csv-to-xml.png",
        width: 1200,
        height: 630,
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/csv-to-xml.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "What XML does this create?",
    answer:
      "Generic row/field XML. You can choose root and row element names and whether the first CSV row contains headers. This does not automatically match a particular accounting or ERP schema.",
  },
  {
    question: "Are duplicate column names preserved?",
    answer:
      "Yes. Generated XML names are unique. Duplicate or invalid names get a safe replacement, with the original header retained in a column attribute. Extra fields in wider rows are also kept.",
  },
  {
    question: "Does it support quotes and Unicode?",
    answer:
      "Yes. Quoted delimiters, doubled quotes, multiline fields and Unicode text are supported. Unclosed or malformed quoting produces an error. Choose comma, semicolon, tab or pipe for the source delimiter.",
  },
  {
    question: "Can I paste or copy data?",
    answer:
      "Yes. Upload a file, paste text, or import a public URL. Preview the XML, download the complete file, or copy text for outputs up to one million characters.",
  },
  {
    question: "Are my files uploaded?",
    answer:
      "Local files and pasted text are converted in the browser. Only URL imports fetch a public file through PDFPilot’s server. Local inputs are limited to 8MB; URL imports to 4MB.",
  },
];

export default function CsvToXmlPage() {
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
      <CsvToXmlClient
        faqs={faqs}
        related={[...relatedTools, ...relatedContent, ...clusterMembers]}
      />
    </>
  );
}
