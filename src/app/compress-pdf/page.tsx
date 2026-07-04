import type { Metadata } from "next";
import { CompressPdfClient } from "./compress-pdf-client";

export const metadata: Metadata = {
  title: "Compress PDF Online Free | PDFPilot",
  description:
    "Reduce PDF file size without losing quality. Free online PDF compression tool with adjustable quality settings, all processed in your browser.",
  alternates: {
    canonical: "/compress-pdf",
  },
};

export default function CompressPDFPage() {
  return <CompressPdfClient />;
}
