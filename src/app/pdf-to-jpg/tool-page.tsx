import { CoreToolHelp } from "@/components/seo/CoreToolHelp";
import { ToolGrowthLinks } from "@/components/seo/ToolGrowthLinks";
import type { Metadata } from "next";
import { PdfToJpgClient } from "./pdf-to-jpg-client";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getBreadcrumbSchema,
  getSoftwareApplicationSchema,
  getToolSeo,
} from "@/lib/seo";
import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";

const tool = getToolSeo("/pdf-to-jpg")!;

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/pdf-to-jpg",
    languages: getHreflangLanguagesMap("/pdf-to-jpg"),
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/pdf-to-jpg",
    images: [{ url: "/og/pdf-to-jpg.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/pdf-to-jpg.png"],
  },
};


export default function PDFToJPGPage() {
  return (
    <>
      {tool && (
        <JsonLd
          data={[
            getSoftwareApplicationSchema({ ...tool, inLanguage: "en" }),
            getBreadcrumbSchema([
              { name: "Home", path: "/" },
              { name: tool.name, path: tool.path },
            ]),

          ]}
        />
      )}
      <ToolWorkspace />
      <CoreToolHelp toolId="pdf-to-jpg" />
    </>
  );
}

/** Shared by the English route and every localized route; only copy may differ. */
export function ToolWorkspace({ landingCopy }: { landingCopy?: import("@/lib/i18n/core-content").ToolLandingCopy } = {}) {
  return <><PdfToJpgClient landingCopy={landingCopy} /><ToolGrowthLinks tool="pdf-to-jpg" /></>;
}
