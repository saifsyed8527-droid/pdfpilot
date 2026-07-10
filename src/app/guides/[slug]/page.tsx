import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JsonLd } from "@/components/seo/JsonLd";
import { getArticleSchema, getBreadcrumbSchema } from "@/lib/seo";
import { GUIDES, getGuide } from "@/lib/content/guides";
import { resolveEntities } from "@/lib/content/registry";
import { RelatedContent } from "@/components/content/RelatedContent";

interface GuidePageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(`/guides/${slug}`);
  if (!guide) return {};

  const title = `${guide.title} | PDFPilot`;

  return {
    title,
    description: guide.description,
    alternates: { canonical: guide.path },
    openGraph: {
      type: "article",
      siteName: "PDFPilot",
      locale: "en_US",
      title,
      description: guide.description,
      url: guide.path,
      // Reuses the existing Compress PDF OG image (the guide is about that
      // tool) rather than generating a new asset for a single seed guide —
      // see Sprint 5.0 report for the reasoning.
      images: [{ url: "/og/compress-pdf.png", width: 1200, height: 630, type: "image/png" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: guide.description,
      images: ["/og/compress-pdf.png"],
    },
  };
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const guide = getGuide(`/guides/${slug}`);

  if (!guide) {
    notFound();
  }

  const related = resolveEntities(guide.related);

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        <JsonLd
          data={[
            getArticleSchema({ title: guide.title, description: guide.description, path: guide.path }),
            getBreadcrumbSchema([
              { name: "Home", path: "/" },
              { name: "Guides", path: "/guides" },
              { name: guide.title, path: guide.path },
            ]),
          ]}
        />

        <Link href="/guides" className="flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Guides
        </Link>

        <Card>
          <CardHeader>
            <CardTitle asChild className="text-2xl md:text-3xl">
              <h1>{guide.title}</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {guide.body.map((paragraph, index) => (
              <p key={index} className="text-muted-foreground">
                {paragraph}
              </p>
            ))}
          </CardContent>
        </Card>

        {related.length > 0 && (
          <Card className="mt-8">
            <CardContent className="pt-6">
              <RelatedContent title="Related tool" items={related} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
