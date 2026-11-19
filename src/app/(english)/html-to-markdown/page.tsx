import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import type { Metadata } from "next";
import { HtmlToMarkdownClient } from "./html-to-markdown-client";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema, getSoftwareApplicationSchema, getToolSeo } from "@/lib/seo";





const tool = getToolSeo("/html-to-markdown")!;






export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/html-to-markdown", languages: getHreflangLanguagesMap("/html-to-markdown") },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/html-to-markdown",
    images: [{ url: "/og/html-to-markdown.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/html-to-markdown.png"],
  },
};



export default function HtmlToMarkdownPage() {
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
      <HtmlToMarkdownClient faqs={[]} related={[]} />
    </>
  );
}
