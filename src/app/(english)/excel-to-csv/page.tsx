import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import type { Metadata } from "next";
import { ExcelToCsvClient } from "./excel-to-csv-client";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema, getSoftwareApplicationSchema, getToolSeo } from "@/lib/seo";





const tool = getToolSeo("/excel-to-csv")!;






export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/excel-to-csv", languages: getHreflangLanguagesMap("/excel-to-csv") },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/excel-to-csv",
    images: [{ url: "/og/excel-to-csv.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/excel-to-csv.png"],
  },
};



export default function ExcelToCsvPage() {
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
      <ExcelToCsvClient faqs={[]} related={[]} />
    </>
  );
}
