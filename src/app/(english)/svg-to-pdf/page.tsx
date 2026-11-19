import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import type { Metadata } from "next";
import { SvgToPdfClient } from "./svg-to-pdf-client";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema, getSoftwareApplicationSchema, getToolSeo } from "@/lib/seo";





const tool = getToolSeo("/svg-to-pdf")!;






export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/svg-to-pdf", languages: getHreflangLanguagesMap("/svg-to-pdf"),
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/svg-to-pdf",
    images: [{ url: "/og/svg-to-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/svg-to-pdf.png"],
  },
};



export default function SvgToPdfPage() {
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
      <SvgToPdfClient faqs={[]} related={[]} />
    </>
  );
}
