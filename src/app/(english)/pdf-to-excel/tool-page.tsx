import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";


import type { Metadata } from "next";
import { PdfToExcelClient } from "./pdf-to-excel-client";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema, getSoftwareApplicationSchema, getToolSeo } from "@/lib/seo";





const tool = getToolSeo("/pdf-to-excel")!;






export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/pdf-to-excel",
    languages: getHreflangLanguagesMap("/pdf-to-excel"),
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/pdf-to-excel",
    images: [{ url: "/og/home.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/home.png"],
  },
};



export default function PdfToExcelPage() {
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
  return <><PdfToExcelClient faqs={[]} related={[]} /></>;
}
