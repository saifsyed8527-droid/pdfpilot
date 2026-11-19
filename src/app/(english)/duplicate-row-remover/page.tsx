import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import type { Metadata } from "next";
import { DuplicateRowRemoverClient } from "./duplicate-row-remover-client";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema, getSoftwareApplicationSchema, getToolSeo } from "@/lib/seo";





const tool = getToolSeo("/duplicate-row-remover")!;






export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/duplicate-row-remover", languages: getHreflangLanguagesMap("/duplicate-row-remover") },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/duplicate-row-remover",
    images: [{ url: "/og/duplicate-row-remover.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/duplicate-row-remover.png"],
  },
};



export default function DuplicateRowRemoverPage() {
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
      <DuplicateRowRemoverClient faqs={[]} related={[]} />
    </>
  );
}
