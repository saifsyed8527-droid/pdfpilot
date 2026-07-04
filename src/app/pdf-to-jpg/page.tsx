import type { Metadata } from "next";
import { PdfToJpgClient } from "./pdf-to-jpg-client";

export const metadata: Metadata = {
  title: "Convert PDF to JPG Online Free | PDFPilot",
  description:
    "Convert PDF pages into high-quality JPG images instantly. Free, fast, and secure — no software installation needed.",
  alternates: {
    canonical: "/pdf-to-jpg",
  },
};

export default function PDFToJPGPage() {
  return <PdfToJpgClient />;
}
