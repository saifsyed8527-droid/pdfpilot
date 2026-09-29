import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import { CoreToolHelp } from "@/components/seo/CoreToolHelp";
import { ToolGrowthLinks } from "@/components/seo/ToolGrowthLinks";
import type { Metadata } from "next";
import { OcrPdfClient } from "./ocr-pdf-client";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getBreadcrumbSchema,
  getSoftwareApplicationSchema,
  getToolSeo,
} from "@/lib/seo";

const tool = getToolSeo("/ocr-pdf")!;

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/ocr-pdf",
    languages: getHreflangLanguagesMap("/ocr-pdf"),
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/ocr-pdf",
    images: [{ url: "/og/ocr-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/ocr-pdf.png"],
  },
};


export default function OcrPdfPage() {
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
      <CoreToolHelp toolId="ocr-pdf" />
    </>
  );
}

/** Shared by the English route and every localized route; only copy may differ. */
export function ToolWorkspace() {
  return <><OcrPdfClient /><ToolGrowthLinks tool="ocr-pdf" /></>;
}
