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
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

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
    images: [{ url: "/og/lock-pdf.png", width: 1200, height: 630, type: "image/png" }],
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
    question: "Is locking a PDF with PDFPilot really free?",
    answer: "Yes. Lock PDF is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. The PDF is encrypted entirely in your browser. Your file and the password you set are never uploaded to PDFPilot's servers — if you forget the password, there is no way for us to recover it either.",
  },
  {
    question: "Is this real encryption, or just a viewer restriction?",
    answer:
      "Real encryption — the PDF Standard Security Handler defined by the PDF specification itself (128-bit, Revision 3), the same compatibility level Adobe Acrobat, Apple Preview, and every major browser open without prompting. The file's contents are genuinely encrypted, not just hidden behind an in-app password screen.",
  },
  {
    question: "What password does it use?",
    answer:
      "The single password you set is required to open the file at all — this tool doesn't set up separate print/copy permission restrictions with a different owner password, just one password that locks the whole document.",
  },
  {
    question: "What if I forget the password?",
    answer:
      "There is no recovery option. Because encryption happens locally and PDFPilot never sees your password or your file, we have no way to unlock it for you — store it somewhere safe before you close this tab.",
  },
  {
    question: "Will the locked PDF open in Adobe Acrobat, Preview, and other readers?",
    answer:
      "Yes. It uses the standard PDF encryption format every major PDF reader supports, not a proprietary scheme — anyone with the password can open it in any compliant reader.",
  },
  {
    question: "Can I lock a PDF that's already password-protected?",
    answer:
      "No — an already-encrypted PDF needs to be unlocked with its existing password first. Locking an already-protected file isn't supported.",
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
      <LockPdfClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
