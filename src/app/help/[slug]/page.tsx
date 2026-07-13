import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema } from "@/lib/seo";
import { HELP_ENTRIES, getHelp } from "@/lib/content/help";
import { resolveEntities } from "@/lib/content/registry";
import { buildEntityMetadata, buildEntityBreadcrumb, getEntitySchema } from "@/lib/content/seo";
import { EntityPageLayout } from "@/components/content/EntityPageLayout";

interface HelpPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return HELP_ENTRIES.map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({ params }: HelpPageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = getHelp(`/help/${slug}`);
  if (!entry) return {};
  return buildEntityMetadata(entry);
}

export default async function HelpPage({ params }: HelpPageProps) {
  const { slug } = await params;
  const entry = getHelp(`/help/${slug}`);

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
        relatedTitle="Related tool"
      >
        <p className="text-muted-foreground">{entry.answer}</p>
      </EntityPageLayout>
    </>
  );
}
