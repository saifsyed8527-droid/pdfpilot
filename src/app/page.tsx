import type { Metadata } from "next";
import { HomeClient } from "./home-client";
import { SEARCH_INDEX } from "@/lib/search-index";

const TITLE = "PDFPilot - Free Online PDF Tools | Merge, Split, Compress & Convert";
const DESCRIPTION =
  "Free online PDF tools to merge, split, compress, and convert PDFs instantly. No sign-up, no installation — everything runs securely in your browser.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    images: [{ url: "/og/home.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og/home.png"],
  },
};

export default function Home() {
  // The search index is built server-side — the client receives only the
  // slim SearchEntry fields, never the source entities (e.g. Guide bodies).
  return <HomeClient searchIndex={[...SEARCH_INDEX]} />;
}
