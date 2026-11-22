import type { Metadata } from "next";
import { MergePdfClient } from "./merge-pdf-client";
import { MergePdfGuide } from "./merge-pdf-guide";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getBreadcrumbSchema,
  getSoftwareApplicationSchema,
  getToolSeo,
} from "@/lib/seo";
import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import type { ToolLandingCopy } from "@/lib/i18n/core-content";
const tool = getToolSeo("/merge-pdf")!;
const englishLandingCopy: ToolLandingCopy = {
  title: "Merge PDF",
  description: "Combine PDF files into one document in the order you choose. Select your files, arrange them, then check and download the merged PDF. This online PDF merger works with two documents or several attachments.",
  buttonLabel: "Select PDF files",
  dropLabel: "or drag and drop PDF files here",
  limitLabel: "100MB max per PDF",
};

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/merge-pdf",
    languages: getHreflangLanguagesMap("/merge-pdf"),
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/merge-pdf",
    images: [{ url: "/og/merge-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/merge-pdf.png"],
  },
};


export default function MergePDFPage() {
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
      <div id="merge-pdf-tool" tabIndex={-1}>
        <ToolWorkspace />
      </div>
      <MergePdfGuide />
    </>
  );
}

/** Shared by the English route and every localized route; only copy may differ. */
export function ToolWorkspace({ landingCopy = englishLandingCopy, locale: _locale = "en" }: { landingCopy?: ToolLandingCopy; locale?: import("@/lib/i18n/locales").LocaleCode } = {}) {
  return <><MergePdfClient landingCopy={landingCopy} /></>;
}
