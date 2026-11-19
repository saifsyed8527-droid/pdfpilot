import type { Metadata } from "next";
import { HomeClient } from "@/app/home-client";
import { SEARCH_INDEX } from "@/lib/search-index";
import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";

const TITLE = "Free Online PDF Tools — Private & No Sign-Up | PDFPilot";
const DESCRIPTION =
  "Free tools to merge, split, compress and convert PDFs. Local files use browser processing; URL imports and external resources can use server requests.";

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
