import type { Metadata } from "next";
import { MergePdfClient } from "./merge-pdf-client";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema, getSoftwareApplicationSchema, getToolSeo } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Merge PDF Files Online Free | PDFPilot",
  description:
    "Combine multiple PDF files into one document in seconds. Free, secure, and fast — no upload required, all processing happens in your browser.",
  alternates: {
    canonical: "/merge-pdf",
  },
};

const tool = getToolSeo("/merge-pdf");

export default function MergePDFPage() {
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
      <MergePdfClient />
    </>
  );
}
