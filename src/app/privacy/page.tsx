import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const TITLE = "Privacy Policy | PDFPilot";
const DESCRIPTION =
  "Read PDFPilot's privacy policy. We never store your files — all PDF processing happens locally in your browser.";

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
          <p>Last updated: {new Date().toLocaleDateString()}</p>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Information We Collect</h2>
          <p>
            We do not collect, store, or process any personal information or uploaded files.
            All PDF processing happens locally in your browser.
          </p>
          <h2 className="text-2xl font-semibold mt-8 mb-4">File Storage</h2>
          <p>
            Files are never uploaded to our servers. All processing is done entirely in your browser,
            ensuring complete privacy.
          </p>
        </div>
      </div>
    </div>
  );
}
