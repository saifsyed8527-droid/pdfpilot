import type { Metadata } from "next";
import { JsonToYamlClient } from "./json-to-yaml-client";
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

const tool = getToolSeo("/json-to-yaml")!;
const toolEntity = getTool("/json-to-yaml")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/json-to-yaml" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/json-to-yaml",
    images: [{ url: "/og/json-to-yaml.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/json-to-yaml.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting JSON to YAML with PDFPilot really free?",
    answer: "Yes. JSON to YAML is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The conversion runs entirely in your browser, using a real YAML library. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "Why convert JSON to YAML?",
    answer: "YAML is the standard format for config files in tools like Docker Compose, Kubernetes, and GitHub Actions — this tool helps when you have JSON data (e.g. from an API) that needs to become a config file.",
  },
  {
    question: "Does this preserve nested structures?",
    answer: "Yes — nested objects and arrays in the source JSON are represented as nested YAML mappings and sequences.",
  },
];

export default function JsonToYamlPage() {
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
      <JsonToYamlClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
