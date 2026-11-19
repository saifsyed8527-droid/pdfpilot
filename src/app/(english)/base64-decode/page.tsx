import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import type { Metadata } from "next";
import { Base64DecodeClient } from "./base64-decode-client";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema, getSoftwareApplicationSchema, getToolSeo } from "@/lib/seo";





const tool = getToolSeo("/base64-decode")!;






export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/base64-decode", languages: getHreflangLanguagesMap("/base64-decode") },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/base64-decode",
    images: [{ url: "/og/base64-decode.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/base64-decode.png"],
  },
};



export default function Base64DecodePage() {
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
      <Base64DecodeClient faqs={[]} related={[]} />
    </>
  );
}
