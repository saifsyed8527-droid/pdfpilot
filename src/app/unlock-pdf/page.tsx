import type { Metadata } from "next";
import { UnlockPdfClient } from "./unlock-pdf-client";
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

const tool = getToolSeo("/unlock-pdf")!;
const toolEntity = getTool("/unlock-pdf")!;
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
    canonical: "/unlock-pdf",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/unlock-pdf",
    images: [
      {
        url: "/og/unlock-pdf.png",
        width: 1200,
        height: 630,
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/unlock-pdf.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is Unlock PDF free?",
    answer:
      "Yes. Native PDF decryption and batch downloads are free, with no account required.",
  },
  {
    question: "Are files or passwords uploaded?",
    answer:
      "No. Files and passwords stay in a temporary worker on your device. Processing is local, and PDFPilot cannot recover forgotten passwords.",
  },
  {
    question: "Does this recover an unknown password?",
    answer:
      "No. If a password is required, enter the current open or owner password. Files that open without a password can be processed with the password left blank.",
  },
  {
    question: "Will text, links and forms stay editable?",
    answer:
      "Yes. The tool removes encryption without rendering pages into images. Native text, fonts, images, links, metadata and ordinary form fields remain in the PDF.",
  },
  {
    question: "What if one password is wrong?",
    answer:
      "That file shows an error while completed files are kept. Set a current password for that individual file, then retry unfinished PDFs or download the completed files separately.",
  },
  {
    question: "What encryption can it read?",
    answer:
      "Standard password-based RC4, AES-128 and AES-256 PDFs are supported. Certificate-based encryption, signature fields, certified documents and XFA forms are not supported.",
  },
  {
    question: "What are the limits?",
    answer:
      "Up to 20 PDFs, 50MB each, 200MB combined and 1,000 pages per PDF. A result may be up to 100MB. An already unencrypted PDF is returned unchanged after inspection.",
  },
];

export default function UnlockPdfPage() {
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
      <UnlockPdfClient
        faqs={faqs}
        related={[...relatedTools, ...relatedContent, ...clusterMembers]}
      />
    </>
  );
}
