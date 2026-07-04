import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "About PDFPilot | Free PDF Tools for Everyone",
  description:
    "Learn about PDFPilot's mission to provide free, fast, and privacy-first PDF tools accessible to everyone, without sign-ups or software installs.",
  alternates: {
    canonical: "/about",
  },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        <Link href="/" className="flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <h1 className="text-3xl font-bold mb-6">About PDFPilot</h1>
        <div className="prose dark:prose-invert max-w-none space-y-4">
          <p>
            PDFPilot provides free, fast, and easy-to-use PDF tools for everyone.
            Our mission is to make PDF manipulation accessible without the need
            for expensive software or complicated installations.
          </p>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Our Tools</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Merge PDF: Combine multiple PDF files into one</li>
            <li>Split PDF: Extract pages from a PDF file</li>
            <li>Compress PDF: Reduce the file size of your PDFs</li>
            <li>PDF to JPG: Convert PDF pages to high-quality images</li>
            <li>JPG to PDF: Turn your images into a single PDF document</li>
          </ul>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Privacy First</h2>
          <p>
            All processing happens in your browser. We never store your files,
            ensuring your privacy is protected.
          </p>
        </div>
      </div>
    </main>
  );
}
