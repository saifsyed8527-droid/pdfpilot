import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema } from "@/lib/seo";
import { GLOSSARY, getGlossaryEntry } from "@/lib/content/glossary";
import { resolveEntities } from "@/lib/content/registry";
import { buildEntityMetadata, buildEntityBreadcrumb, getEntitySchema } from "@/lib/content/seo";
import { EntityPageLayout } from "@/components/content/EntityPageLayout";

interface GlossaryPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return GLOSSARY.map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({ params }: GlossaryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = getGlossaryEntry(`/glossary/${slug}`);
  if (!entry) return {};
  return buildEntityMetadata(entry);
}

export default async function GlossaryPage({ params }: GlossaryPageProps) {
  const { slug } = await params;
  const entry = getGlossaryEntry(`/glossary/${slug}`);

  if (!entry) {
    notFound();
  }

  const related = resolveEntities(entry.related);
  const breadcrumb = buildEntityBreadcrumb(entry);

  return (
    <>
      <JsonLd data={[getEntitySchema(entry), getBreadcrumbSchema(breadcrumb)]} />
      <EntityPageLayout
        contentType={entry.type}
        contentId={entry.id}
        backHref="/"
        backLabel="Back to Home"
        title={entry.title}
        related={related}
        relatedTitle="Related tools"
      >
        <p className="text-lg font-medium">{entry.definition}</p>
        <p className="text-muted-foreground">{entry.description}</p>
      </EntityPageLayout>
    </>
  );
}
