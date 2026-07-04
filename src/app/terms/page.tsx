import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service | PDFPilot",
  description:
    "Read the terms of service for using PDFPilot's free online PDF tools.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        <Link href="/" className="flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
        <div className="prose dark:prose-invert max-w-none space-y-4">
          <p>Last updated: {new Date().toLocaleDateString()}</p>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Use of Service</h2>
          <p>
            PDFPilot provides free PDF tools for personal and commercial use.
            You may use our service without creating an account.
          </p>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Disclaimer</h2>
          <p>
            The service is provided &quot;as is&quot; without any warranties. We are not
            responsible for any data loss or damage resulting from using our tools.
          </p>
        </div>
      </div>
    </main>
  );
}
