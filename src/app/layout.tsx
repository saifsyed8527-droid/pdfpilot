import type { Metadata, Viewport } from "next";
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
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PDFPilot",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: "PDFPilot - Free PDF Tools for Everyone",
    description: "Merge, split, compress and convert PDFs instantly.",
    url: "/",
    images: [{ url: "/og/home.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PDFPilot - Free PDF Tools for Everyone",
    description: "Merge, split, compress and convert PDFs instantly.",
    images: ["/og/home.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth" data-scroll-behavior="smooth">
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