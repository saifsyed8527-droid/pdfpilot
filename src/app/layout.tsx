import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Toaster } from "sonner";
import { Analytics } from "@/components/analytics";
import { JsonLd } from "@/components/seo/JsonLd";
import { getOrganizationSchema, getWebSiteSchema } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL("https://pdfpilot.net"),
  title: "PDFPilot - Free PDF Tools for Everyone",
  description: "Merge, split, compress and convert PDFs instantly. Free, fast, and easy-to-use PDF tools.",
  keywords: ["PDF tools", "merge PDF", "split PDF", "compress PDF", "PDF to JPG", "JPG to PDF"],
  openGraph: {
    title: "PDFPilot - Free PDF Tools for Everyone",
    description: "Merge, split, compress and convert PDFs instantly.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PDFPilot - Free PDF Tools for Everyone",
    description: "Merge, split, compress and convert PDFs instantly.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="antialiased min-h-screen flex flex-col">
        <JsonLd data={[getOrganizationSchema(), getWebSiteSchema()]} />
        <Navbar />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
        <Toaster position="top-center" />
        <Analytics />
      </body>
    </html>
  );
}