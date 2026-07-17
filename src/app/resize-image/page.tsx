import type { Metadata } from "next";
import { ResizeImageClient } from "./resize-image-client";
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

const tool = getToolSeo("/resize-image")!;
const toolEntity = getTool("/resize-image")!;
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
    canonical: "/resize-image",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/resize-image",
    images: [{ url: "/og/resize-image.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/resize-image.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is resizing images with PDFPilot really free?",
    answer:
      "Yes. Resize Image is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. Resizing happens entirely in your browser using the browser's own image engine. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "Can I resize without distorting the image?",
    answer:
      "Yes. With \"maintain aspect ratio\" on, entering just a width or height scales the other dimension proportionally, and entering both fits the image inside that box without stretching it.",
  },
  {
    question: "What output formats are supported?",
    answer:
      "JPG, PNG, and WEBP — the same formats Convert Image supports, for the same reason: those are the formats the browser's own image engine can reliably encode.",
  },
  {
    question: "Does resizing to a larger size improve image quality?",
    answer:
      "No. Resizing up stretches the existing pixels rather than adding real detail, so enlarging an image won't make it sharper.",
  },
];

export default function ResizeImagePage() {
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
      <ResizeImageClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
