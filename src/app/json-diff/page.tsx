import type { Metadata } from "next";
import { JsonDiffClient } from "./json-diff-client";
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

const tool = getToolSeo("/json-diff")!;
const toolEntity = getTool("/json-diff")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/json-diff" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/json-diff",
    images: [{ url: "/og/json-diff.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/json-diff.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is comparing JSON files with PDFPilot really free?",
    answer: "Yes. JSON Diff is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The comparison runs entirely in your browser. Your files are never uploaded to PDFPilot's servers.",
  },
  {
    question: "How does the comparison actually work?",
    answer:
      "Both files are parsed and re-serialized with consistent 2-space indentation — the same normalization JSON Formatter uses — then compared line by line. Malformed JSON in either file is rejected with a clear parser error before any comparison happens.",
  },
  {
    question: "Does reordering an object's keys count as a change?",
    answer:
      "Yes. This is a real, disclosed limitation: re-serializing JSON preserves each object's own key order as parsed, so the same data with keys in a different order will show as changed lines, even though the underlying data is identical.",
  },
];

export default function JsonDiffPage() {
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
      <JsonDiffClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
