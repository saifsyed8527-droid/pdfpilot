import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RelatedContent } from "./RelatedContent";
import type { ResolvedEntity } from "@/lib/content/registry";

interface EntityPageLayoutProps {
  backHref: string;
  backLabel: string;
  title: string;
  children: React.ReactNode;
  related?: ResolvedEntity[];
  relatedTitle?: string;
}

/**
 * The shared shell for every content-type detail page (Help, Comparison,
 * Use Case, Category). Only the body content differs per type — the outer
 * container, back-link, title card, and related-content card are identical,
 * so they live here once instead of being copy-pasted per route.
 */
export function EntityPageLayout({
  backHref,
  backLabel,
  title,
  children,
  related = [],
  relatedTitle = "Related",
}: EntityPageLayoutProps) {
  return (
    <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        <Link
          href={backHref}
          className="flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>

        <Card>
          <CardHeader>
            <CardTitle asChild className="text-2xl md:text-3xl">
              <h1>{title}</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">{children}</CardContent>
        </Card>

        {related.length > 0 && (
          <Card className="mt-8">
            <CardContent className="pt-6">
              <RelatedContent title={relatedTitle} items={related} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
