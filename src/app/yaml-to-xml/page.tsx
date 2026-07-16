import type { Metadata } from "next";
import { YamlToXmlClient } from "./yaml-to-xml-client";
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

const tool = getToolSeo("/yaml-to-xml")!;
const toolEntity = getTool("/yaml-to-xml")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/yaml-to-xml" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/yaml-to-xml",
    images: [{ url: "/og/yaml-to-xml.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/yaml-to-xml.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting YAML to XML with PDFPilot really free?",
    answer: "Yes. YAML to XML is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The conversion runs entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What YAML structure does this tool expect?",
    answer: "A top-level list of mappings — e.g. a YAML sequence where each item is a set of key-value pairs. This is a tabular scope, the same as this project's other data-format tools, not arbitrary deeply-nested YAML.",
  },
  {
    question: "How does this conversion actually work?",
    answer: "In two real steps: your YAML is parsed with a real YAML library, then the resulting data is converted to XML the same way this project's JSON to XML tool works — nothing here is a direct YAML-to-XML translation, since no such single-step library exists; composing two already-verified conversions is the honest approach.",
  },
];

export default function YamlToXmlPage() {
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
      <YamlToXmlClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
