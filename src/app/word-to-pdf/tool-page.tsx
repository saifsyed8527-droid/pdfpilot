import type { Metadata } from "next";
import { ConversionDetails } from "@/components/seo/ConversionDetails";
import { conversionCopy } from "@/lib/i18n/conversion-copy";
import type { LocaleCode } from "@/lib/i18n/locales";
import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import { WordToPdfClient } from "./word-to-pdf-client";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getBreadcrumbSchema,
  getSoftwareApplicationSchema,
  getToolSeo,
} from "@/lib/seo";

const tool = getToolSeo("/word-to-pdf")!;

export const metadata: Metadata = {
  title: tool.title,
  description: conversionCopy("en", "word-to-pdf").description,
  alternates: {
    canonical: "/word-to-pdf",
    languages: getHreflangLanguagesMap("/word-to-pdf"),
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/word-to-pdf",
    images: [{ url: "/og/word-to-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/word-to-pdf.png"],
  },
};

export default function WordToPdfPage() {
  return (
    <>
      {tool && (
        <JsonLd
          data={[
            getSoftwareApplicationSchema({ ...tool, description: conversionCopy("en", "word-to-pdf").description, inLanguage: "en" }),
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
  return <><WordToPdfClient /><ConversionDetails tool="word-to-pdf" locale={locale} /></>;
}
