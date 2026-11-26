import { PowerpointToPdfGuide } from "./powerpoint-to-pdf-guide";
import { WorkspaceLocaleProvider } from "@/components/i18n/WorkspaceText";

import type { Metadata } from "next";

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
  description: tool.description,
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
            getSoftwareApplicationSchema({ ...tool, description: tool.description, inLanguage: "en" }),
            getBreadcrumbSchema([
              { name: "Home", path: "/" },
              { name: tool.name, path: tool.path },
            ]),
          ]}
        />
      )}
      <div id="powerpoint-to-pdf-tool" tabIndex={-1}>
        <WorkspaceLocaleProvider locale="en" words={{ "Convert PPTX slides to PDF, including drawings, images and text. Your files stay on your device.": "Convert PPTX to PDF in your browser, ready to read or share. Choose your PowerPoint presentation and check the finished PDF before sending it. This tool accepts .pptx files; older .ppt files need a different export route." }}>
          <ToolWorkspace />
        </WorkspaceLocaleProvider>
      </div>
      <PowerpointToPdfGuide />

    </>
  );
}

/** Shared by the English route and every localized route; only copy may differ. */
export function ToolWorkspace({ locale: _locale = "en" }: { locale?: LocaleCode } = {}) {
  return <>
    <PowerpointToPdfClient />
  </>;
}
