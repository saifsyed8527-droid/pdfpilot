import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import type { Metadata } from "next";
import { TranslatePdfClient } from "./translate-pdf-client";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getToolSeo,
  getSoftwareApplicationSchema,
  getBreadcrumbSchema,
} from "@/lib/seo";
const tool = getToolSeo("/translate-pdf")!;
export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/translate-pdf", languages: getHreflangLanguagesMap("/translate-pdf") },
  openGraph: { type: "website", siteName: "PDFPilot", locale: "en_US", title: tool.title, description: tool.description, url: tool.path, images: ["/og/home.png"] },
  twitter: { card: "summary_large_image", title: tool.title, description: tool.description, images: ["/og/home.png"] },
};
export default function TranslatePdfPage() {
  return (
    <>
      <JsonLd
        data={[
          getSoftwareApplicationSchema(tool),
          getBreadcrumbSchema([
            { name: "Home", path: "/" },
            { name: tool.name, path: tool.path },
          ]),
        ]}
      />
      <TranslatePdfClient />
    </>
  );
}
