import type { Metadata } from "next";
import { FlattenPdfClient } from "./flatten-pdf-client";
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

const tool = getToolSeo("/flatten-pdf")!;
const toolEntity = getTool("/flatten-pdf")!;
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
    canonical: "/flatten-pdf",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/flatten-pdf",
    images: [{ url: "/og/flatten-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/flatten-pdf.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is flattening a PDF with PDFPilot really free?",
    answer: "Yes. Flatten PDF is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. Flattening happens entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What does flattening a PDF form actually do?",
    answer:
      "It converts supported saved form-field appearances into ordinary page content and removes the interactive fields. Values are no longer editable as form fields, but a PDF editor can still change page content. Flattening is not redaction or tamper protection.",
  },
  {
    question: "How is this different from Fill PDF?",
    answer:
      "Fill PDF lets you enter values in a form. Flatten PDF takes an already-filled form and converts supported field appearances into page content. Keep the original if you will need the editable fields later.",
  },
  {
    question: "What if my PDF doesn't have any form fields?",
    answer:
      "A PDF without form fields is returned unchanged. Links, comments and other annotations are retained. Encrypted documents, signatures and unsupported form appearances are rejected rather than silently changed.",
  },
];

export default function FlattenPdfPage() {
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
      <FlattenPdfClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
