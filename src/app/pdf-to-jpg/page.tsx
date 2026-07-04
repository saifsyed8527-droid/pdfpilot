import type { Metadata } from "next";
import { PdfToJpgClient } from "./pdf-to-jpg-client";
import { JsonLd } from "@/components/seo/JsonLd";
import { getSoftwareApplicationSchema, getToolSeo } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Convert PDF to JPG Online Free | PDFPilot",
  description:
    "Convert PDF pages into high-quality JPG images instantly. Free, fast, and secure — no software installation needed.",
  alternates: {
    canonical: "/pdf-to-jpg",
  },
};

const tool = getToolSeo("/pdf-to-jpg");

export default function PDFToJPGPage() {
  return (
    <>
      {tool && <JsonLd data={getSoftwareApplicationSchema(tool)} />}
      <PdfToJpgClient />
    </>
  );
}
