import type { Metadata } from "next";
import { HomeClient } from "./home-client";
import { SEARCH_INDEX } from "@/lib/search-index";
import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";

const TITLE = "Free Online PDF Tools — Private & No Sign-Up | PDFPilot";
const DESCRIPTION =
  "Merge, split, compress and convert PDFs free in your browser. No uploads, watermarks or sign-up—your files stay private on your device.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/",
    languages: getHreflangLanguagesMap("/"),
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
