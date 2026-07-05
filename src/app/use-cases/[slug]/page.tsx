import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema } from "@/lib/seo";
import { USE_CASES, getUseCase } from "@/lib/content/use-cases";
import { resolveEntities, resolveEntity } from "@/lib/content/registry";
import { buildEntityMetadata, buildEntityBreadcrumb, getEntitySchema } from "@/lib/content/seo";
import { EntityPageLayout } from "@/components/content/EntityPageLayout";

interface UseCasePageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return USE_CASES.map((useCase) => ({ slug: useCase.slug }));
}

export async function generateMetadata({ params }: UseCasePageProps): Promise<Metadata> {
  const { slug } = await params;
  const useCase = getUseCase(`/use-cases/${slug}`);
  if (!useCase) return {};
  return buildEntityMetadata(useCase);
}

export default async function UseCasePage({ params }: UseCasePageProps) {
  const { slug } = await params;
  const useCase = getUseCase(`/use-cases/${slug}`);

  if (!useCase) {
    notFound();
  }

  const related = resolveEntities(useCase.related);
  const breadcrumb = buildEntityBreadcrumb(useCase);

  return (
    <>
      <JsonLd data={[getEntitySchema(useCase), getBreadcrumbSchema(breadcrumb)]} />
      <EntityPageLayout
        backHref="/"
        backLabel="Back to Home"
        title={useCase.title}
        related={related}
        relatedTitle="Tools used here"
      >
        <p className="text-muted-foreground">{useCase.description}</p>
        <ol className="space-y-3 list-decimal list-inside">
          {useCase.steps.map((step, index) => {
            const tool = resolveEntity(step.tool);
            return (
              <li key={index} className="text-muted-foreground">
                {step.instruction}
                {tool && (
                  <>
                    {" "}
                    <Link href={tool.path} className="underline underline-offset-4 hover:text-foreground">
                      Open {tool.title}
                    </Link>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </EntityPageLayout>
    </>
  );
}
