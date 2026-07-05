import type { Metadata } from "next";
import { CompressPdfClient } from "./compress-pdf-client";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema, getSoftwareApplicationSchema, getToolSeo } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Compress PDF Online Free | PDFPilot",
  description:
    "Reduce PDF file size without losing quality. Free online PDF compression tool with adjustable quality settings, all processed in your browser.",
  alternates: {
    canonical: "/compress-pdf",
  },
};

const tool = getToolSeo("/compress-pdf");

export default function CompressPDFPage() {
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
      <CompressPdfClient />
    </>
  );
}
