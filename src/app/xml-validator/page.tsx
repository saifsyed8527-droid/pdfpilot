import type { Metadata } from "next";
import { XmlValidatorClient } from "./xml-validator-client";
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

const tool = getToolSeo("/xml-validator")!;
const toolEntity = getTool("/xml-validator")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/xml-validator" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/xml-validator",
    images: [{ url: "/og/xml-validator.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/xml-validator.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is validating XML with PDFPilot really free?",
    answer: "Yes. XML Validator is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The validation runs entirely in your browser using DOMParser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "Does this check against an XML Schema (XSD) or DTD?",
    answer: "No — this checks well-formedness (correct tag nesting, matching open/close tags, valid syntax), not validity against a specific schema. It won't catch a document that's syntactically correct XML but doesn't match your particular schema's rules.",
  },
  {
    question: "Does this download anything?",
    answer: "No — this tool just checks well-formedness and shows the result on screen. Use XML Formatter if you also want a downloadable, cleanly-indented copy.",
  },
];

export default function XmlValidatorPage() {
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
      <XmlValidatorClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
