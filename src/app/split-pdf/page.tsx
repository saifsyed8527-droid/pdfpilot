import type { Metadata } from "next";
import { SplitPdfClient } from "./split-pdf-client";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema, getSoftwareApplicationSchema, getToolSeo } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Split PDF Files Online Free | PDFPilot",
  description:
    "Extract or split pages from any PDF file instantly. Free and secure PDF splitting tool that works entirely in your browser.",
  alternates: {
    canonical: "/split-pdf",
  },
};

const tool = getToolSeo("/split-pdf");

export default function SplitPDFPage() {
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
      <SplitPdfClient />
    </>
  );
}
