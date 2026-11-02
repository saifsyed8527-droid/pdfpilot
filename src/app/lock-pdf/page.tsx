import type { Metadata } from "next";
import { LockPdfClient } from "./lock-pdf-client";
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

const tool = getToolSeo("/lock-pdf")!;
const toolEntity = getTool("/lock-pdf")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id })),
);
const existingPaths = new Set(
  [...relatedTools, ...relatedContent].map((e) => e.path),
);
const clusterMembers = getClusterMembers(toolEntity.id).filter(
  (member) => !existingPaths.has(member.path),
);

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/lock-pdf",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/lock-pdf",
    images: [
      { url: "/og/lock-pdf.png", width: 1200, height: 630, type: "image/png" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/lock-pdf.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is Protect PDF free?",
    answer:
      "Yes. AES-256 password protection, batch processing and permission controls are free, with no account required.",
  },
  {
    question: "Are files or passwords uploaded?",
    answer:
      "No. PDFs and passwords stay in a temporary worker on your device. PDFPilot cannot recover a forgotten password.",
  },
  {
    question: "What encryption does it use?",
    answer:
      "New files use AES-256, PDF Standard Security Handler revision 6. A password is required to open the result. Current PDF readers support this format; very old readers may need an update.",
  },
  {
    question: "Can I restrict copying, editing or printing?",
    answer:
      "Yes. Set full, low-resolution or no printing; allow or restrict copying; and choose editing permissions. These settings depend on the PDF reader and are not enforced by every application. Use an open password to encrypt the document.",
  },
  {
    question: "What is the owner password?",
    answer:
      "It is a separate password for permission management. You may set one different from the open password or leave it empty to generate one locally. The open password can still be used by Unlock PDF.",
  },
  {
    question: "Can I change an existing password?",
    answer:
      "Yes. Enter the current open or owner password under Permissions and existing password, then set and confirm the new open password. Individual current passwords are supported for a batch.",
  },
  {
    question: "What are the limits?",
    answer:
      "Up to 20 PDFs, 50MB each, 200MB combined and 1,000 pages per PDF. A result may be up to 100MB. Signature fields, certification and XFA forms are rejected; ordinary forms, text, links and images remain native.",
  },
];

export default function LockPdfPage() {
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
      <LockPdfClient
        faqs={faqs}
        related={[...relatedTools, ...relatedContent, ...clusterMembers]}
      />
    </>
  );
}
