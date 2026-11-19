import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";


import type { Metadata } from "next";
import { ExtractPagesClient } from "./extract-pages-client";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema, getSoftwareApplicationSchema, getToolSeo } from "@/lib/seo";




const tool = getToolSeo("/extract-pages")!;





export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/extract-pages",
    languages: getHreflangLanguagesMap("/extract-pages"),
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/extract-pages",
    images: [{ url: "/og/extract-pages.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/extract-pages.png"],
  },
};



export default function ExtractPagesPage() {
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
  return <><ExtractPagesClient faqs={[]} related={[]} /></>;
}
