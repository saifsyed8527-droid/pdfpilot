import type { Metadata } from "next";
import { MergePdfClient } from "./merge-pdf-client";

export const metadata: Metadata = {
  title: "Merge PDF Files Online Free | PDFPilot",
  description:
    "Combine multiple PDF files into one document in seconds. Free, secure, and fast — no upload required, all processing happens in your browser.",
  alternates: {
    canonical: "/merge-pdf",
  },
};

export default function MergePDFPage() {
  return <MergePdfClient />;
}
