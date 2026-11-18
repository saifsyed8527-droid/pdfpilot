import type { Metadata } from "next";
import Link from "next/link";
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
        {entry.slug === "what-is-a-rasterized-pdf" && <section><h2 className="text-xl font-semibold">What changes during compression?</h2><p className="mt-3 text-muted-foreground">PDFPilot can render pages as images when compressing. This may reduce an image-heavy file, but the smaller result can lose selectable text and links. The combined workflows ask you to accept this trade-off and keep the first-step PDF if compression would make it larger.</p><Link href="/pdf-workflows/merge-and-compress-pdf" className="mt-3 inline-block underline">Try merge and compress with sample files</Link></section>}
        {entry.slug === "what-is-flattening-a-pdf" && <section><h2 className="text-xl font-semibold">Try a real fillable PDF</h2><p className="mt-3 text-muted-foreground">A fillable template keeps its fields editable when you download it. Flattening makes the entered text part of the page. Keep an editable copy if you expect to update the values later.</p><Link href="/templates" className="mt-3 inline-block underline">Create a free fillable PDF template</Link></section>}
      </EntityPageLayout>
    </>
  );
}
