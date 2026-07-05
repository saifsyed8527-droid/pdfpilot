import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema } from "@/lib/seo";
import { COMPARISONS, getComparison } from "@/lib/content/comparisons";
import { resolveEntities } from "@/lib/content/registry";
import { buildEntityMetadata, buildEntityBreadcrumb, getEntitySchema } from "@/lib/content/seo";
import { EntityPageLayout } from "@/components/content/EntityPageLayout";

interface ComparisonPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return COMPARISONS.map((comparison) => ({ slug: comparison.slug }));
}

export async function generateMetadata({ params }: ComparisonPageProps): Promise<Metadata> {
  const { slug } = await params;
  const comparison = getComparison(`/compare/${slug}`);
  if (!comparison) return {};
  return buildEntityMetadata(comparison);
}

export default async function ComparisonPage({ params }: ComparisonPageProps) {
  const { slug } = await params;
  const comparison = getComparison(`/compare/${slug}`);

  if (!comparison) {
    notFound();
  }

  const related = resolveEntities(comparison.related);
  const breadcrumb = buildEntityBreadcrumb(comparison);
  const items = resolveEntities(comparison.items);

  return (
    <>
      <JsonLd data={[getEntitySchema(comparison), getBreadcrumbSchema(breadcrumb)]} />
      <EntityPageLayout
        backHref="/"
        backLabel="Back to Home"
        title={comparison.title}
        related={related}
        relatedTitle="Related tools"
      >
        <p className="text-muted-foreground">{comparison.description}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4"></th>
                <th className="text-left py-2 pr-4 font-semibold">{items[0]?.title}</th>
                <th className="text-left py-2 font-semibold">{items[1]?.title}</th>
              </tr>
            </thead>
            <tbody>
              {comparison.points.map((point) => (
                <tr key={point.label} className="border-b">
                  <td className="py-2 pr-4 font-medium text-muted-foreground align-top">{point.label}</td>
                  <td className="py-2 pr-4 align-top">{point.a}</td>
                  <td className="py-2 align-top">{point.b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EntityPageLayout>
    </>
  );
}
