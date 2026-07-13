import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema } from "@/lib/seo";
import { CHECKLISTS, getChecklist } from "@/lib/content/checklists";
import { resolveEntities, resolveEntity } from "@/lib/content/registry";
import { buildEntityMetadata, buildEntityBreadcrumb, getEntitySchema } from "@/lib/content/seo";
import { EntityPageLayout } from "@/components/content/EntityPageLayout";
import { ChecklistItems } from "./checklist-items-client";

interface ChecklistPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return CHECKLISTS.map((checklist) => ({ slug: checklist.slug }));
}

export async function generateMetadata({ params }: ChecklistPageProps): Promise<Metadata> {
  const { slug } = await params;
  const checklist = getChecklist(`/checklists/${slug}`);
  if (!checklist) return {};
  return buildEntityMetadata(checklist);
}

export default async function ChecklistPage({ params }: ChecklistPageProps) {
  const { slug } = await params;
  const checklist = getChecklist(`/checklists/${slug}`);

  if (!checklist) {
    notFound();
  }

  const related = resolveEntities(checklist.related);
  const breadcrumb = buildEntityBreadcrumb(checklist);

  return (
    <>
      <JsonLd data={[getEntitySchema(checklist), getBreadcrumbSchema(breadcrumb)]} />
      <EntityPageLayout
        contentType={checklist.type}
        contentId={checklist.id}
        backHref="/"
        backLabel="Back to Home"
        title={checklist.title}
        related={related}
        relatedTitle="Related tools and guides"
      >
        <p className="text-muted-foreground">{checklist.description}</p>
        <ChecklistItems
          checklistId={checklist.id}
          items={checklist.items}
          resolvedTools={checklist.items.map((item) => (item.tool ? resolveEntity(item.tool) : undefined))}
        />
      </EntityPageLayout>
    </>
  );
}
