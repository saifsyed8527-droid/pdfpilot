import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GUIDES } from "@/lib/content/guides";

const TITLE = "Guides | PDFPilot";
const DESCRIPTION = "Free guides and explainers to help you get the most out of PDFPilot's tools.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/guides",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: TITLE,
    description: DESCRIPTION,
    url: "/guides",
    images: [{ url: "/og/home.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og/home.png"],
  },
};

export default function GuidesIndexPage() {
  return (
    <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        <Link href="/" className="flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <h1 className="text-3xl font-bold mb-6">Guides</h1>

        <div className="space-y-4">
          {GUIDES.map((guide) => (
            <Card key={guide.path}>
              <CardHeader>
                <CardTitle className="text-xl">
                  <Link href={guide.path} className="hover:underline">
                    {guide.title}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{guide.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
