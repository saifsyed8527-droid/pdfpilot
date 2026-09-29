import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import { CoreToolHelp } from "@/components/seo/CoreToolHelp";
import { ToolGrowthLinks } from "@/components/seo/ToolGrowthLinks";
import type { Metadata } from "next";
import { ExcelToXmlClient } from "./excel-to-xml-client";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getBreadcrumbSchema,
  getSoftwareApplicationSchema,
  getToolSeo,
} from "@/lib/seo";

const tool = getToolSeo("/excel-to-xml")!;

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/excel-to-xml",
    languages: getHreflangLanguagesMap("/excel-to-xml"),
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/excel-to-xml",
    images: [{ url: "/og/excel-to-xml.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/excel-to-xml.png"],
  },
};

export default function ExcelToXmlPage() {
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
      <CoreToolHelp toolId="excel-to-xml" />
    </>
  );
}

/** Shared by the English route and every localized route; only copy may differ. */
export function ToolWorkspace() {
  return <><ExcelToXmlClient /><ToolGrowthLinks tool="excel-to-xml" /></>;
}
