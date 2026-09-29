import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const TITLE = "Privacy Policy | PDFPilot";
const DESCRIPTION =
  "Learn how PDFPilot processes local files, fetches URL imports and uses site analytics. Check the details of the tool and input method you choose.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: TITLE,
    description: DESCRIPTION,
    url: "/privacy",
    images: [{ url: "/og/privacy.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og/privacy.png"],
  },
};

export default function PrivacyPage() {
  return (
    <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        <Link href="/" className="flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
        <div className="prose dark:prose-invert max-w-none space-y-4">
          <p>Technical processing information updated: September 29, 2026.</p>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Local File Processing</h2>
          <p>
            The current public tools process files selected from your device in your browser. Keep the tab open until processing finishes. This describes document processing, not every network request made by the website.
          </p>
          <h2 className="text-2xl font-semibold mt-8 mb-4">URL Imports and External Resources</h2>
          <p>
            HTML imports, external HTML assets and Excel imports by URL use server fetch routes. The server receives the requested URL and retrieves its content. Do not put credentials or private access tokens in a URL you submit.
          </p>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Website Analytics</h2>
          <p>The site includes Google Analytics and Microsoft Clarity integrations when configured. These can send usage information separately from document processing. Browser-local conversion does not mean the entire site makes no network requests.</p>
          <p>Read the processing and privacy details on each tool page before choosing an input method.</p>
        </div>
      </div>
    </div>
  );
}
