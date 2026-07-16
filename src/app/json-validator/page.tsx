import type { Metadata } from "next";
import { JsonValidatorClient } from "./json-validator-client";
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

const tool = getToolSeo("/json-validator")!;
const toolEntity = getTool("/json-validator")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/json-validator" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/json-validator",
    images: [{ url: "/og/json-validator.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/json-validator.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is validating JSON with PDFPilot really free?",
    answer: "Yes. JSON Validator is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The validation runs entirely in your browser using JSON.parse. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What kind of error message do I get for invalid JSON?",
    answer: "The exact error your browser's own JSON parser produces, which typically identifies what kind of syntax problem was found and often its approximate position in the file.",
  },
  {
    question: "Does this download anything?",
    answer: "No — this tool just checks validity and shows the result on screen. Use JSON Formatter if you also want a downloadable, cleanly-indented copy of valid JSON.",
  },
];

export default function JsonValidatorPage() {
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
      <JsonValidatorClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
