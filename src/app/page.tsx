import type { Metadata } from "next";
import { HomeClient } from "./home-client";

export const metadata: Metadata = {
  title: "PDFPilot - Free Online PDF Tools | Merge, Split, Compress & Convert",
  description:
    "Free online PDF tools to merge, split, compress, and convert PDFs instantly. No sign-up, no installation — everything runs securely in your browser.",
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  return <HomeClient />;
}
