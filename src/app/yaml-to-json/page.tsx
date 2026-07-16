import type { Metadata } from "next";
import { YamlToJsonClient } from "./yaml-to-json-client";
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

const tool = getToolSeo("/yaml-to-json")!;
const toolEntity = getTool("/yaml-to-json")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/yaml-to-json" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/yaml-to-json",
    images: [{ url: "/og/yaml-to-json.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/yaml-to-json.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting YAML to JSON with PDFPilot really free?",
    answer: "Yes. YAML to JSON is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The conversion runs entirely in your browser, using a real YAML parser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "Does this support nested YAML structures?",
    answer: "Yes — unlike this project's CSV/Excel-focused conversion tools, YAML naturally supports nested objects and arrays, and the JSON output preserves that same nested structure.",
  },
  {
    question: "What YAML features are supported?",
    answer: "Standard YAML 1.1/1.2 syntax — mappings, sequences, scalars, anchors and aliases, and multi-document handling of the first document in a file.",
  },
  {
    question: "What happens if my YAML has a syntax error?",
    answer: "You'll get a clear error message describing what couldn't be parsed, rather than a broken or partial JSON output.",
  },
];

export default function YamlToJsonPage() {
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
      <YamlToJsonClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
