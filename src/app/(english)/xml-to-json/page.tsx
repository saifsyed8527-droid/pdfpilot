import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import type { Metadata } from "next";
import { XmlToJsonClient } from "./xml-to-json-client";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema, getSoftwareApplicationSchema, getToolSeo } from "@/lib/seo";





const tool = getToolSeo("/xml-to-json")!;






export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/xml-to-json", languages: getHreflangLanguagesMap("/xml-to-json") },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/xml-to-json",
    images: [{ url: "/og/xml-to-json.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/xml-to-json.png"],
  },
};



export default function XmlToJsonPage() {
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
      <XmlToJsonClient faqs={[]} related={[]} />
    </>
  );
}
