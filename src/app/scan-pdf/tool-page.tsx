import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import { CoreToolHelp } from "@/components/seo/CoreToolHelp";
import { ToolGrowthLinks } from "@/components/seo/ToolGrowthLinks";
import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getBreadcrumbSchema,
  getSoftwareApplicationSchema,
  getToolSeo,
} from "@/lib/seo";
import { ScanPdfClient } from "./scan-pdf-client";

const tool = getToolSeo("/scan-pdf")!;

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/scan-pdf", languages: getHreflangLanguagesMap("/scan-pdf") },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/scan-pdf",
    images: [{ url: "/og/scan-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/scan-pdf.png"],
  },
};


export default function ScanPdfPage() {
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
      <CoreToolHelp toolId="scan-pdf" />
    </>
  );
}

/** Shared by the English route and every localized route; only copy may differ. */
export function ToolWorkspace() {
  return <><ScanPdfClient /><ToolGrowthLinks tool="scan-pdf" /></>;
}
