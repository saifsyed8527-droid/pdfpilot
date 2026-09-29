import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import { CoreToolHelp } from "@/components/seo/CoreToolHelp";
import { ToolGrowthLinks } from "@/components/seo/ToolGrowthLinks";
import type { Metadata } from "next";
import { ExcelToPdfClient } from "./excel-to-pdf-client";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getBreadcrumbSchema,
  getSoftwareApplicationSchema,
  getToolSeo,
} from "@/lib/seo";

const tool = getToolSeo("/excel-to-pdf")!;

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/excel-to-pdf",
    languages: getHreflangLanguagesMap("/excel-to-pdf"),
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/excel-to-pdf",
    images: [{ url: "/og/excel-to-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/excel-to-pdf.png"],
  },
};

export default function ExcelToPdfPage() {
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
      <CoreToolHelp toolId="excel-to-pdf" />
    </>
  );
}

/** Shared by the English route and every localized route; only copy may differ. */
export function ToolWorkspace() {
  // This route hides the footer and originally fills the viewport below the
  // 4rem navigation plus its border. Keep discovery links below that workspace.
  return <><div className="flex min-h-[calc(100dvh-4rem-1px)] flex-col"><ExcelToPdfClient /></div><ToolGrowthLinks tool="excel-to-pdf" /></>;
}
