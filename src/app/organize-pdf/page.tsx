import type { Metadata } from "next";
import { OrganizePdfClient } from "./organize-pdf-client";
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
import { getClusterMembers } from "@/lib/content/topic-clusters";

const tool = getToolSeo("/organize-pdf")!;
const toolEntity = getTool("/organize-pdf")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const existingPaths = new Set(relatedContent.map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/organize-pdf" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/organize-pdf",
    images: [{ url: "/og/organize-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/organize-pdf.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is Organize PDF free to use?",
    answer:
      "Yes. Organize PDF is free to use in your browser, with no sign-up required.",
  },
  {
    question: "Are my PDFs uploaded to a server?",
    answer:
      "No. PDFPilot renders previews and creates the organized PDF locally in your browser.",
  },
  {
    question: "What can I do with Organize PDF?",
    answer:
      "You can reorder pages, rotate individual pages, remove pages, add blank pages, and add more PDFs into one organized output file.",
  },
  {
    question: "Can I add pages from another PDF?",
    answer:
      "Yes. Use Add more files to append pages from another PDF, then drag them into the exact order you need.",
  },
  {
    question: "Will organizing pages reduce quality?",
    answer:
      "No. Existing pages are copied into the new PDF without recompressing their content.",
  },
];

export default function OrganizePdfPage() {
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
      <OrganizePdfClient faqs={faqs} related={[...relatedContent, ...clusterMembers]} />
    </>
  );
}
