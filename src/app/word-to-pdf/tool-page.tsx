import type { Metadata } from "next";
import { WordToPdfClient } from "./word-to-pdf-client";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getBreadcrumbSchema,
  getFaqSchema,
  getSoftwareApplicationSchema,
  getToolSeo,
  type FaqInput,
} from "@/lib/seo";

const tool = getToolSeo("/word-to-pdf")!;

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/word-to-pdf",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/word-to-pdf",
    images: [{ url: "/og/word-to-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/word-to-pdf.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is converting Word to PDF with PDFPilot really free?",
    answer:
      "Yes. Word to PDF is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. The whole conversion happens entirely in your browser. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "Does this preserve my document's exact formatting?",
    answer:
      "The browser converter renders embedded images, tables, text styling, original page sizes, and supported hyperlinks. PDF pages are image-based, so text is not selectable or searchable. Fonts and page breaks can differ from Word, and unsupported artwork, notes, charts, or embedded media require export from the original editor. Preview the output before sharing; pixel-for-pixel Word fidelity is not guaranteed.",
  },
  {
    question: "What file types are supported?",
    answer:
      "The modern Word format, .docx. Older .doc files aren't supported.",
  },
  {
    question: "Do I need to install any software to convert Word to PDF?",
    answer:
      "No installation is required. Word to PDF runs directly in your web browser.",
  },
];

export default function WordToPdfPage() {
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
      <ToolWorkspace />
    </>
  );
}

/** Shared by the English route and every localized route; only copy may differ. */
export function ToolWorkspace() {
  return <WordToPdfClient />;
}
