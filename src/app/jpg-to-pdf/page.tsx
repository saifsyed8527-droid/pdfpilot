import type { Metadata } from "next";
import { JpgToPdfClient } from "./jpg-to-pdf-client";

export const metadata: Metadata = {
  title: "Convert JPG to PDF Online Free | PDFPilot",
  description:
    "Turn your JPG and PNG images into a single PDF document in seconds. Free online image-to-PDF converter that works in your browser.",
  alternates: {
    canonical: "/jpg-to-pdf",
  },
};

export default function JPGToPDFPage() {
  return <JpgToPdfClient />;
}
