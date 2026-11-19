import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import type { Metadata } from "next";
import { InsertPagesClient } from "./insert-pages-client";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema, getSoftwareApplicationSchema, getToolSeo } from "@/lib/seo";





const tool = getToolSeo("/insert-pages")!;






export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/insert-pages", languages: getHreflangLanguagesMap("/insert-pages"),
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/insert-pages",
    images: [{ url: "/og/insert-pages.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/insert-pages.png"],
  },
};



export default function InsertPagesPage() {
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
      <InsertPagesClient faqs={[]} related={[]} />
    </>
  );
}
