import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";


import type { Metadata } from "next";
import { PdfToWordClient } from "./pdf-to-word-client";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema, getSoftwareApplicationSchema, getToolSeo } from "@/lib/seo";
const tool = getToolSeo("/pdf-to-word")!;

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/pdf-to-word",
    languages: getHreflangLanguagesMap("/pdf-to-word"),
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/pdf-to-word",
    images: [
      {
        url: "/og/pdf-to-word.png",
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
    images: ["/og/pdf-to-word.png"],
  },
};



export default function PdfToWordPage() {
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
      
    </>
  );
}

/** Shared by the English route and every localized route; only copy may differ. */
export function ToolWorkspace({ locale: _locale = "en" }: { locale?: import("@/lib/i18n/locales").LocaleCode } = {}) {
  return (
    <>
      <PdfToWordClient faqs={[]} />
      
    </>
  );
}
