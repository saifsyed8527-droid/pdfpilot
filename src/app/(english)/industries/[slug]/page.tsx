import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema } from "@/lib/seo";
import { INDUSTRIES, getIndustry } from "@/lib/content/industries";
import { resolveEntities, resolveEntity } from "@/lib/content/registry";
import { buildEntityMetadata, buildEntityBreadcrumb, getEntitySchema } from "@/lib/content/seo";
import { EntityPageLayout } from "@/components/content/EntityPageLayout";

interface IndustryPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return INDUSTRIES.map((industry) => ({ slug: industry.slug }));
}

export async function generateMetadata({ params }: IndustryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const industry = getIndustry(`/industries/${slug}`);
  if (!industry) return {};
  return buildEntityMetadata(industry);
}

export default async function IndustryPage({ params }: IndustryPageProps) {
  const { slug } = await params;
  const industry = getIndustry(`/industries/${slug}`);

  if (!industry) {
    notFound();
  }

  const related = resolveEntities(industry.related);
  const breadcrumb = buildEntityBreadcrumb(industry);

  return (
    <>
      <JsonLd data={[getEntitySchema(industry), getBreadcrumbSchema(breadcrumb)]} />
      <EntityPageLayout
        contentType={industry.type}
        contentId={industry.id}
        backHref="/"
        backLabel="Back to Home"
        title={industry.title}
        related={related}
        relatedTitle="Related tools"
      >
        <p className="text-muted-foreground">{industry.description}</p>
        <ul className="space-y-4">
          {industry.recommendedTools.map((item, index) => {
            const tool = resolveEntity(item.tool);
            return (
              <li key={index} className="text-muted-foreground">
                {tool ? (
                  <Link href={tool.path} className="font-medium text-foreground underline underline-offset-4">
                    {tool.title}
                  </Link>
                ) : null}
                <p className="mt-1">{item.reason}</p>
              </li>
            );
          })}
        </ul>
      </EntityPageLayout>
    </>
  );
}
