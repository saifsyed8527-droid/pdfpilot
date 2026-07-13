import type { Metadata } from "next";
import { HeicToPngClient } from "./heic-to-png-client";
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

const tool = getToolSeo("/heic-to-png")!;
const toolEntity = getTool("/heic-to-png")!;
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
    canonical: "/heic-to-png",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/heic-to-png",
    images: [{ url: "/og/heic-to-png.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/heic-to-png.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting HEIC to PNG with PDFPilot really free?",
    answer: "Yes. HEIC to PNG is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my photos uploaded to a server?",
    answer:
      "No. The conversion runs entirely in your browser using a real HEIC decoder compiled to WebAssembly (based on libheif). Your photo is never uploaded anywhere.",
  },
  {
    question: "What is a HEIC file?",
    answer:
      "HEIC (High Efficiency Image Container) is the default photo format used by iPhones since iOS 11. It compresses better than JPG, but many apps, websites, and Windows PCs can't open it directly.",
  },
  {
    question: "Why convert HEIC to PNG instead of JPG?",
    answer:
      "PNG uses lossless compression, so nothing is lost from the original image data, and it supports transparency. Choose PNG when you need maximum quality or plan to edit the image further; choose JPG for smaller file sizes.",
  },
  {
    question: "Will the PNG be larger than the original HEIC file?",
    answer:
      "Usually, yes. HEIC compresses more efficiently than PNG, so a lossless PNG conversion is typically a larger file than the original HEIC.",
  },
  {
    question: "Can I convert multiple HEIC files at once?",
    answer: "This tool converts one photo at a time. Upload another HEIC file after each conversion to continue.",
  },
];

export default function HeicToPngPage() {
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
      <HeicToPngClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
