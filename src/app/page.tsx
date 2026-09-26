import type { Metadata } from "next";
import Link from "next/link";
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
  return <><HomeClient searchIndex={[...SEARCH_INDEX]} /><section className="container mx-auto px-4 pb-14"><div className="rounded-2xl border bg-card p-6 text-card-foreground md:p-8"><h2 className="text-2xl font-semibold">Start with a template or finish two PDF tasks together</h2><p className="mt-3 text-muted-foreground">Create a ready-to-fill document, choose conversion settings or run a complete workflow.</p><nav aria-label="PDF templates and workflows" className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Link className="rounded-xl border p-4 font-semibold hover:bg-muted" href="/templates">Free editable PDF templates →</Link><Link className="rounded-xl border p-4 font-semibold hover:bg-muted" href="/templates/conversions">Conversion templates →</Link><Link className="rounded-xl border p-4 font-semibold hover:bg-muted" href="/pdf-workflows">PDF workflows →</Link><Link className="text-sm underline" href="/pdf-workflows/merge-and-compress-pdf">Merge and compress PDF</Link><Link className="text-sm underline" href="/templates/weekly-planner-template">Weekly planner PDF template</Link><Link className="text-sm underline" href="/pdf-workflows/combine-word-documents-to-pdf">Combine Word documents into one PDF</Link></nav></div></section></>;
}
