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
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

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
    images: [{ url: "/og/unlock-pdf.png", width: 1200, height: 630, type: "image/png" }],
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
    question: "Is unlocking a PDF with PDFPilot really free?",
    answer: "Yes. Unlock PDF is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. The PDF is unlocked entirely in your browser. Your file and the password you enter are never uploaded to PDFPilot's servers — we have no way to see or store either.",
  },
  {
    question: "Does this crack or break the encryption?",
    answer:
      "No. This tool only works when you already know the correct open password for the file. It uses that password to open the PDF in a compliant PDF reader (the same one your browser uses), renders each page to an image, and writes a brand new, unprotected PDF from those images. It cannot recover a password you don't already have.",
  },
  {
    question: "Is the output a real PDF I can open in any reader?",
    answer:
      "Yes. The output is a standard, unprotected PDF that opens in Adobe Acrobat, Apple Preview, Chrome, Edge, and every other major PDF reader without any password.",
  },
  {
    question: "Does the output preserve selectable text and links?",
    answer:
      "No. Because the file is rebuilt from rendered page images, the output is flattened and image-based — selectable text, copyable text, hyperlinks, form fields, and fonts from the original are not preserved. This is a real, documented tradeoff of browser-native unlock, not a hidden bug.",
  },
  {
    question: "What if the password is wrong?",
    answer:
      "You'll see a clear error instead of a silent failure. The tool only proceeds with rendering once the PDF has been successfully opened with the password you entered.",
  },
  {
    question: "Can I unlock an AES-256 (strong encryption) PDF?",
    answer:
      "Yes — the browser's PDF reader (pdfjs-dist) supports all real-world encryption revisions used in practice, including stronger AES variants. This tool works with any encrypted PDF the reader itself can open when given the correct password.",
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
      <UnlockPdfClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
