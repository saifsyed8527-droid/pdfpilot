import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";


import type { Metadata } from "next";
import { PdfToPowerpointClient } from "./pdf-to-powerpoint-client";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema, getSoftwareApplicationSchema, getToolSeo } from "@/lib/seo";





const tool = getToolSeo("/pdf-to-powerpoint")!;






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
      
    </>
  );
}

/** Shared by the English route and every localized route; only copy may differ. */
export function ToolWorkspace({ locale: _locale = "en" }: { locale?: import("@/lib/i18n/locales").LocaleCode } = {}) {
  return (
    <>
      <PdfToPowerpointClient
        faqs={[]}
        related={[]}
      />
      
    </>
  );
}
