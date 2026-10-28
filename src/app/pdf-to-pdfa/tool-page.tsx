import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import { CoreToolHelp } from "@/components/seo/CoreToolHelp";
import { ToolGrowthLinks } from "@/components/seo/ToolGrowthLinks";
import type { Metadata } from "next";
import { PdfToPdfaClient } from "./pdf-to-pdfa-client";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getBreadcrumbSchema,
  getSoftwareApplicationSchema,
  getToolSeo,
  type FaqInput,
} from "@/lib/seo";
import { getTool } from "@/lib/tools";
import { getContentReferencingTool } from "@/lib/content/tool-related";
import { resolveEntities } from "@/lib/content/registry";
import { getClusterMembers } from "@/lib/content/topic-clusters";

const tool = getToolSeo("/pdf-to-pdfa")!;
const toolEntity = getTool("/pdf-to-pdfa")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id })));
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/pdf-to-pdfa",
    languages: getHreflangLanguagesMap("/pdf-to-pdfa"),
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/pdf-to-pdfa",
    images: [{ url: "/og/pdf-to-pdfa.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/pdf-to-pdfa.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is PDF to PDF/A free on PDFPilot?",
    answer: "Yes. PDF to PDF/A is free to use in PDFPilot, with no sign-up or account required.",
  },
  {
    question: "Are my PDF files uploaded?",
    answer: "No. The PDF/A conversion runs in your browser. Your PDF is not uploaded to PDFPilot servers.",
  },
  {
    question: "Which PDF/A levels can I choose?",
    answer:
      "PDF/A-1b, PDF/A-2b and PDF/A-3b visual profiles are available. Every page becomes a losslessly compressed image with an embedded sRGB color profile. Tagged A and Unicode U profiles are not supported.",
  },
  {
    question: "Is the output independently validated?",
    answer:
      "The converter has been tested with veraPDF for all three supported profiles. The browser does not run a PDF/A validator on each output. Validate your downloaded file against the requirements of your receiving archive.",
  },
  {
    question: "Will text and forms stay editable?",
    answer:
      "No. This visual archive converter flattens every page into an image. Text selection, interactive forms, links, signatures and attachments are not retained. Original page dimensions are preserved.",
  },
];

export default function PdfToPdfaPage() {
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

          ]}
        />
      )}
      <ToolWorkspace />
      <CoreToolHelp toolId="pdf-to-pdfa" />
    </>
  );
}

/** Shared by the English route and every localized route; only copy may differ. */
export function ToolWorkspace() {
  return <><PdfToPdfaClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} /><ToolGrowthLinks tool="pdf-to-pdfa" /></>;
}
