import type { Metadata } from "next";
import { SplitPdfClient } from "./split-pdf-client";

export const metadata: Metadata = {
  title: "Split PDF Files Online Free | PDFPilot",
  description:
    "Extract or split pages from any PDF file instantly. Free and secure PDF splitting tool that works entirely in your browser.",
  alternates: {
    canonical: "/split-pdf",
  },
};

export default function SplitPDFPage() {
  return <SplitPdfClient />;
}
