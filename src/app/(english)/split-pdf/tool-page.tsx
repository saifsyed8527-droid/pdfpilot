

import { SplitPdfGuide } from "./split-pdf-guide";
import type { ToolLandingCopy } from "@/lib/i18n/core-content";
import type { Metadata } from "next";
import { SplitPdfClient } from "./split-pdf-client";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getBreadcrumbSchema,
  getSoftwareApplicationSchema,
  getToolSeo,
} from "@/lib/seo";
import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
const englishLandingCopy: ToolLandingCopy = {
 title: "Split PDF",
 description: "Separate one PDF into the pages or ranges you need. Select your document, choose how to divide it, then check the PDFs you download. This PDF splitter creates separate documents from your chosen page groups.",
 buttonLabel: "Select PDF file", dropLabel: "or drag and drop a PDF file here", limitLabel: "100MB max per PDF",
};
const tool = getToolSeo("/split-pdf")!;

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/split-pdf",
    languages: getHreflangLanguagesMap("/split-pdf"),
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/split-pdf",
    images: [{ url: "/og/split-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/split-pdf.png"],
  },
};


export default function SplitPDFPage() {
  return (
    <>
      {tool && (
        <JsonLd
          data={[
            getSoftwareApplicationSchema({ ...tool, inLanguage: "en" }),
            getBreadcrumbSchema([
              { name: "Home", path: "/" },
              { name: tool.name, path: tool.path },
            ]),

          ]}
        />
      )}
      <div id="split-pdf-tool" tabIndex={-1}><ToolWorkspace /></div>
      <SplitPdfGuide />
      
    </>
  );
}

/** Shared by the English route and every localized route; only copy may differ. */
export function ToolWorkspace({ landingCopy = englishLandingCopy, locale: _locale = "en" }: { landingCopy?: import("@/lib/i18n/core-content").ToolLandingCopy; locale?: import("@/lib/i18n/locales").LocaleCode } = {}) {
  return <><SplitPdfClient landingCopy={landingCopy} /></>;
}
