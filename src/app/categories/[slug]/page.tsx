import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema } from "@/lib/seo";
import { CATEGORIES, getCategory } from "@/lib/content/categories";
import { resolveEntities } from "@/lib/content/registry";
import { buildEntityMetadata, buildEntityBreadcrumb, getEntitySchema } from "@/lib/content/seo";
import { EntityPageLayout } from "@/components/content/EntityPageLayout";

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

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = getCategory(`/categories/${slug}`);

  if (!category) {
    notFound();
  }

  // The category's "contains" list IS its related content — reused as-is,
  // no separate rendering path for "things a hub contains" vs. "things a
  // page relates to" (Task 7).
  const contains = resolveEntities(category.contains);
  const breadcrumb = buildEntityBreadcrumb(category);

  return (
    <>
      <JsonLd data={[getEntitySchema(category), getBreadcrumbSchema(breadcrumb)]} />
      <EntityPageLayout
        contentType={category.type}
        contentId={category.id}
        backHref="/"
        backLabel="Back to Home"
        title={category.title}
        related={contains}
        relatedTitle="In this category"
      >
        <p className="text-muted-foreground">{category.description}</p>
      </EntityPageLayout>
    </>
  );
}
