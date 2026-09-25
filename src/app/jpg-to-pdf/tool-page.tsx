import type { Metadata } from "next";
import { ConversionDetails } from "@/components/seo/ConversionDetails";
import { conversionCopy } from "@/lib/i18n/conversion-copy";
import type { LocaleCode } from "@/lib/i18n/locales";
import { JpgToPdfClient } from "./jpg-to-pdf-client";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getBreadcrumbSchema,
  getSoftwareApplicationSchema,
  getToolSeo,
} from "@/lib/seo";
import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";

const tool = getToolSeo("/jpg-to-pdf")!;

export const metadata: Metadata = {
  title: tool.title,
  description: conversionCopy("en", "jpg-to-pdf").description,
  alternates: {
    canonical: "/jpg-to-pdf",
    languages: getHreflangLanguagesMap("/jpg-to-pdf"),
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/jpg-to-pdf",
    images: [{ url: "/og/jpg-to-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/jpg-to-pdf.png"],
  },
};

export default function JPGToPDFPage() {
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
    </>
  );
}

/** Shared by the English route and every localized route; only copy may differ. */
export function ToolWorkspace({ landingCopy, locale = "en" }: { landingCopy?: import("@/lib/i18n/core-content").ToolLandingCopy; locale?: LocaleCode } = {}) {
  return <><JpgToPdfClient landingCopy={landingCopy} /><ConversionDetails tool="jpg-to-pdf" locale={locale} /></>;
}
