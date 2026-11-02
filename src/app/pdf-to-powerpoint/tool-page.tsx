import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import { CoreToolHelp } from "@/components/seo/CoreToolHelp";
import { ToolGrowthLinks } from "@/components/seo/ToolGrowthLinks";
import type { Metadata } from "next";
import { PdfToPowerpointClient } from "./pdf-to-powerpoint-client";
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

const tool = getToolSeo("/pdf-to-powerpoint")!;
const toolEntity = getTool("/pdf-to-powerpoint")!;
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
    canonical: "/pdf-to-powerpoint",
    languages: getHreflangLanguagesMap("/pdf-to-powerpoint"),
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/pdf-to-powerpoint",
    images: [
      {
        url: "/og/pdf-to-powerpoint.png",
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
    images: ["/og/pdf-to-powerpoint.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting PDF to PowerPoint with PDFPilot really free?",
    answer:
      "Yes. PDF to PowerPoint is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. The whole conversion happens entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "How does PDF to PowerPoint decide what goes on each slide?",
    answer:
      "Each selected PDF page becomes one slide. Keep page appearance uses a page image; Editable text creates visible text boxes on a plain background. Match the first selected page, or choose 16:9 or 4:3. Other page sizes fit without stretching.",
  },
  {
    question: "Can I edit the text after converting?",
    answer:
      "Choose Editable text to create visible PowerPoint text boxes. This mode does not reconstruct pictures, original fonts, colors, charts or complex layout. Keep page appearance preserves the page image; changing its invisible searchable text does not change the visible image.",
  },
  {
    question: "What if my PDF is a scanned document?",
    answer:
      "Keep page appearance preserves scans as slide images. Auto and Free OCR can recognize text in 41 document languages, with up to three selected. Auto reads pages without selectable text; Free OCR also reads scans with selectable captions. Use clear upright scans and review names, numbers and punctuation.",
  },
  {
    question: "Do I need to install any software to convert PDF to PowerPoint?",
    answer:
      "No installation is required. PDF to PowerPoint runs directly in your web browser.",
  },
];

export default function PdfToPowerpointPage() {
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
      <CoreToolHelp toolId="pdf-to-powerpoint" />
    </>
  );
}

/** Shared by the English route and every localized route; only copy may differ. */
export function ToolWorkspace() {
  return (
    <>
      <PdfToPowerpointClient
        faqs={faqs}
        related={[...relatedTools, ...relatedContent, ...clusterMembers]}
      />
      <ToolGrowthLinks tool="pdf-to-powerpoint" />
    </>
  );
}
