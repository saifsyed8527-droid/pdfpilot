import type { Metadata } from "next";
import { ConversionDetails } from "@/components/seo/ConversionDetails";
import { conversionCopy } from "@/lib/i18n/conversion-copy";
import type { LocaleCode } from "@/lib/i18n/locales";
import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import { PowerpointToPdfClient } from "./powerpoint-to-pdf-client";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getBreadcrumbSchema,
  getSoftwareApplicationSchema,
  getToolSeo,
} from "@/lib/seo";
const tool = getToolSeo("/powerpoint-to-pdf")!;

export const metadata: Metadata = {
  title: tool.title,
  description: conversionCopy("en", "powerpoint-to-pdf").description,
  alternates: {
    canonical: "/powerpoint-to-pdf",
    languages: getHreflangLanguagesMap("/powerpoint-to-pdf"),
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/powerpoint-to-pdf",
    images: [{ url: "/og/powerpoint-to-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/powerpoint-to-pdf.png"],
  },
};

export default function PowerpointToPdfPage() {
  return (
    <>
      {tool && (
        <JsonLd
          data={[
            getSoftwareApplicationSchema({ ...tool, description: conversionCopy("en", "powerpoint-to-pdf").description, inLanguage: "en" }),
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
export function ToolWorkspace({ locale = "en" }: { locale?: LocaleCode } = {}) {
  return <><PowerpointToPdfClient /><ConversionDetails tool="powerpoint-to-pdf" locale={locale} /></>;
}
