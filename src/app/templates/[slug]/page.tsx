import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema } from "@/lib/seo";
import { TEMPLATES, getTemplate } from "@/lib/content/templates";
import { resolveEntities } from "@/lib/content/registry";
import { buildEntityMetadata, buildEntityBreadcrumb, getEntitySchema } from "@/lib/content/seo";
import { EntityPageLayout } from "@/components/content/EntityPageLayout";
import { TemplateDownloadCard } from "./templates-client";

interface TemplatePageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return TEMPLATES.map((template) => ({ slug: template.slug }));
}

export async function generateMetadata({ params }: TemplatePageProps): Promise<Metadata> {
  const { slug } = await params;
  const template = getTemplate(`/templates/${slug}`);
  if (!template) return {};
  return buildEntityMetadata(template);
}

export default async function TemplatePage({ params }: TemplatePageProps) {
  const { slug } = await params;
  const template = getTemplate(`/templates/${slug}`);

  if (!template) {
    notFound();
  }

  const related = resolveEntities(template.related);
  const breadcrumb = buildEntityBreadcrumb(template);

  return (
    <>
      <JsonLd data={[getEntitySchema(template), getBreadcrumbSchema(breadcrumb)]} />
      <EntityPageLayout
        contentType={template.type}
        contentId={template.id}
        backHref="/"
        backLabel="Back to Home"
        title={template.title}
        related={related}
        relatedTitle="Related tools and industries"
      >
        <p className="text-muted-foreground">{template.description}</p>
        <TemplateDownloadCard
          generatorId={template.generatorId}
          downloadFileName={template.downloadFileName}
          toolName={template.slug}
        />
      </EntityPageLayout>
    </>
  );
}
