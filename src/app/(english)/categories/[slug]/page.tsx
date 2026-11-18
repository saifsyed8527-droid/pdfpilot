import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema } from "@/lib/seo";
import { CATEGORIES, getCategory } from "@/lib/content/categories";
import { resolveEntities } from "@/lib/content/registry";
import { buildEntityMetadata, buildEntityBreadcrumb, getEntitySchema } from "@/lib/content/seo";
import { TOOLS } from "@/lib/tools";
import { RelatedContent } from "@/components/content/RelatedContent";
import { TrackContentOpened } from "@/components/content/TrackContentOpened";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategory(`/categories/${slug}`);
  if (!category) return {};
  return buildEntityMetadata(category);
}

const TOOLS_BY_ID = new Map(TOOLS.map((tool) => [tool.id, tool]));

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = getCategory(`/categories/${slug}`);

  if (!category) {
    notFound();
  }

  const breadcrumb = buildEntityBreadcrumb(category);

  // A category page is a tool-execution surface, not a fork between
  // "tool" and "guide" - the primary tool is featured as one big,
  // unmissable action; every other contained tool is a small supporting
  // grid; guides and help entries become plain-language sections below
  // ("How it works" / "Common questions") instead of a mixed link list
  // the user has to parse type-labels to make sense of.
  const toolRefs = category.contains.filter((ref) => ref.type === "tool");
  const otherRefs = category.contains.filter((ref) => ref.type !== "tool");
  const categoryTools = toolRefs
    .map((ref) => TOOLS_BY_ID.get(ref.id))
    .filter((tool) => tool !== undefined);
  const [primaryTool, ...relatedTools] = categoryTools;

  const otherContent = resolveEntities(otherRefs);
  const guides = otherContent.filter((entity) => entity.type === "guide");
  const helpItems = otherContent.filter((entity) => entity.type === "help");
  const moreContent = otherContent.filter(
    (entity) => entity.type !== "guide" && entity.type !== "help"
  );

  return (
    <>
      <JsonLd data={[getEntitySchema(category), getBreadcrumbSchema(breadcrumb)]} />
      <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12">
        <TrackContentOpened contentType={category.type} contentId={category.id} />
        <div className="container mx-auto px-4 max-w-3xl">
          <Link
            href="/"
            className="flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">{category.title}</h1>
          <p className="text-muted-foreground mb-8">{category.description}</p>

          {primaryTool && (
            <Link href={primaryTool.path} className="block group mb-8">
              <Card className="border-2 transition-all duration-200 group-hover:border-primary/50 group-hover:shadow-md">
                <CardContent className="pt-6 flex items-center gap-5">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 transition-colors group-hover:bg-primary/15">
                    <primaryTool.icon className="h-7 w-7 text-primary" aria-hidden />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-semibold group-hover:text-primary transition-colors">
                      {primaryTool.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">{primaryTool.tagline}</p>
                  </div>
                  <ArrowRight
                    className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0"
                    aria-hidden
                  />
                </CardContent>
              </Card>
            </Link>
          )}

          {relatedTools.length > 0 && (
            <section className="mb-10">
              <h2 className="text-sm font-semibold mb-4">Related tools</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {relatedTools.map((tool) => (
                  <Link key={tool.path} href={tool.path} className="block group">
                    <Card className="h-full border transition-all duration-200 group-hover:border-primary/40 group-hover:shadow-sm">
                      <CardContent className="pt-5 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <tool.icon className="h-4 w-4 text-primary" aria-hidden />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm group-hover:text-primary transition-colors">
                            {tool.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{tool.tagline}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {guides.length > 0 && (
            <section className="mb-10">
              <h2 className="text-sm font-semibold mb-4">How it works</h2>
              <ul className="space-y-2">
                {guides.map((guide) => (
                  <li key={guide.path}>
                    <Link
                      href={guide.path}
                      className="text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground"
                    >
                      {guide.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {helpItems.length > 0 && (
            <section className="mb-10">
              <h2 className="text-sm font-semibold mb-4">Common questions</h2>
              <ul className="space-y-2">
                {helpItems.map((item) => (
                  <li key={item.path}>
                    <Link
                      href={item.path}
                      className="text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground"
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {moreContent.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <RelatedContent title="More" items={moreContent} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
