import type { Metadata } from "next";
import { JpgToPdfClient } from "./jpg-to-pdf-client";
import { JsonLd } from "@/components/seo/JsonLd";
import { getSoftwareApplicationSchema, getToolSeo } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Convert JPG to PDF Online Free | PDFPilot",
  description:
    "Turn your JPG and PNG images into a single PDF document in seconds. Free online image-to-PDF converter that works in your browser.",
  alternates: {
    canonical: "/jpg-to-pdf",
  },
};

const tool = getToolSeo("/jpg-to-pdf");

export default function JPGToPDFPage() {
  return (
    <>
      {tool && <JsonLd data={getSoftwareApplicationSchema(tool)} />}
      <JpgToPdfClient />
    </>
  );
}
