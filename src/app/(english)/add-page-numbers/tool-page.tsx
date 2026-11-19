import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";


import type { Metadata } from "next";
import { AddPageNumbersClient } from "./add-page-numbers-client";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema, getSoftwareApplicationSchema, getToolSeo } from "@/lib/seo";





const tool = getToolSeo("/add-page-numbers")!;






export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/add-page-numbers",
    languages: getHreflangLanguagesMap("/add-page-numbers"),
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/add-page-numbers",
    images: [{ url: "/og/add-page-numbers.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/add-page-numbers.png"],
  },
};



export default function AddPageNumbersPage() {
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
  return <><AddPageNumbersClient faqs={[]} related={[]} /></>;
}
