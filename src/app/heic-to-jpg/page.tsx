import type { Metadata } from "next";
import { HeicToJpgClient } from "./heic-to-jpg-client";
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

const tool = getToolSeo("/heic-to-jpg")!;
const toolEntity = getTool("/heic-to-jpg")!;
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
    canonical: "/heic-to-jpg",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/heic-to-jpg",
    images: [{ url: "/og/heic-to-jpg.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/heic-to-jpg.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting HEIC to JPG with PDFPilot really free?",
    answer: "Yes. HEIC to JPG is completely free to use, with no sign-up or account required.",
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
    question: "Why would I need to convert HEIC to JPG?",
    answer:
      "JPG is universally supported — you can upload it to any website, open it on any device, or attach it anywhere without compatibility issues, which isn't always true for HEIC.",
  },
  {
    question: "Does converting to JPG reduce image quality?",
    answer:
      "JPG uses lossy compression, so there's a small quality trade-off, but at the default quality setting used here it's not noticeable for typical photos.",
  },
  {
    question: "Can I convert multiple HEIC files at once?",
    answer: "This tool converts one photo at a time. Upload another HEIC file after each conversion to continue.",
  },
];

export default function HeicToJpgPage() {
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
      <HeicToJpgClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
