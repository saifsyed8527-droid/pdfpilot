import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import type { Metadata } from "next";
import { FlattenPdfClient } from "./flatten-pdf-client";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema, getSoftwareApplicationSchema, getToolSeo } from "@/lib/seo";





const tool = getToolSeo("/flatten-pdf")!;






export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/flatten-pdf", languages: getHreflangLanguagesMap("/flatten-pdf"),
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/flatten-pdf",
    images: [{ url: "/og/flatten-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/flatten-pdf.png"],
  },
};



export default function FlattenPdfPage() {
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
      <FlattenPdfClient faqs={[]} related={[]} />
    </>
  );
}
