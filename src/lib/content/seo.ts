import type { Metadata } from "next";
import {
  getArticleSchema,
  getCollectionPageSchema,
  getFaqSchema,
  getHowToSchema,
  type BreadcrumbItemInput,
} from "@/lib/seo";
import { resolveEntities, resolveEntity } from "./registry";
import type { GuideEntity } from "./guides";
import type { HelpEntity } from "./help";
import type { ComparisonEntity } from "./comparisons";
import type { UseCaseEntity } from "./use-cases";
import type { CategoryEntity } from "./categories";
import type { IndustryEntity } from "./industries";
import type { GlossaryEntity } from "./glossary";
import type { ChecklistEntity } from "./checklists";
import type { TemplateEntity } from "./templates";
import type { BaseContentEntity } from "./types";

/**
 * Every reusable helper a new content-type page needs, in one place, so no
 * page hand-builds its own metadata/breadcrumb/schema logic (Tasks 4-6).
 */

const DEFAULT_OG_IMAGE = "/og/home.png";

interface BuildMetadataOptions {
  ogImage?: string;
}

export function buildEntityMetadata(
  entity: Pick<BaseContentEntity, "title" | "description" | "path">,
  options: BuildMetadataOptions = {}
): Metadata {
  const title = `${entity.title} | PDFPilot`;
  const ogImage = options.ogImage ?? DEFAULT_OG_IMAGE;

  return {
    title,
    description: entity.description,
    alternates: { canonical: entity.path },
    openGraph: {
      type: "website",
      siteName: "PDFPilot",
      locale: "en_US",
      title,
      description: entity.description,
      url: entity.path,
      images: [{ url: ogImage, width: 1200, height: 630, type: "image/png" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: entity.description,
      images: [ogImage],
    },
  };
}

export function buildEntityBreadcrumb(
  entity: Pick<BaseContentEntity, "title" | "path">,
  parent?: { name: string; path: string }
): BreadcrumbItemInput[] {
  const trail: BreadcrumbItemInput[] = [{ name: "Home", path: "/" }];
  if (parent) trail.push(parent);
  trail.push({ name: entity.title, path: entity.path });
  return trail;
}

type AnyContentEntity =
  | GuideEntity
  | HelpEntity
  | ComparisonEntity
  | UseCaseEntity
  | CategoryEntity
  | IndustryEntity
  | GlossaryEntity
  | ChecklistEntity
  | TemplateEntity;

/**
 * Maps each implemented content type to the existing schema builder that
 * fits it best. This switch is over a closed union (unlike registry.ts's
 * open ContentType switch), so TypeScript already enforces exhaustiveness —
 * omitting a case here is a compile error, not a silent runtime gap.
 */
export function getEntitySchema(entity: AnyContentEntity) {
  switch (entity.type) {
    case "guide":
      return getArticleSchema({
        title: entity.title,
        description: entity.description,
        path: entity.path,
      });
    case "help":
      return getFaqSchema([{ question: entity.question, answer: entity.answer }]);
    case "comparison":
      return getCollectionPageSchema({
        name: entity.title,
        description: entity.description,
        path: entity.path,
        items: resolveEntities(entity.items).map((item) => ({
          name: item.title,
          url: item.path,
        })),
      });
    case "use-case":
      return getHowToSchema({
        name: entity.title,
        description: entity.description,
        path: entity.path,
        // Resolved per-step with `resolveEntity` (not the bulk
        // `resolveEntities`, which filters out unresolved refs and would
        // silently shift every later step out of alignment with its tool).
        steps: entity.steps.map((step) => {
          const tool = resolveEntity(step.tool);
          return { name: tool?.title ?? entity.title, text: step.instruction, url: tool?.path };
        }),
      });
    case "category":
      return getCollectionPageSchema({
        name: entity.title,
        description: entity.description,
        path: entity.path,
        items: resolveEntities(entity.contains).map((item) => ({
          name: item.title,
          url: item.path,
        })),
      });
    case "industry":
      return getCollectionPageSchema({
        name: entity.title,
        description: entity.description,
        path: entity.path,
        items: resolveEntities(entity.recommendedTools.map((r) => r.tool)).map((item) => ({
          name: item.title,
          url: item.path,
        })),
      });
    case "learning-resource":
      return getArticleSchema({
        title: entity.title,
        description: entity.definition,
        path: entity.path,
      });
    case "template":
      return getArticleSchema({
        title: entity.title,
        description: entity.description,
        path: entity.path,
      });
    case "checklist":
      return getHowToSchema({
        name: entity.title,
        description: entity.description,
        path: entity.path,
        steps: entity.items.map((item) => {
          const tool = item.tool ? resolveEntity(item.tool) : undefined;
          return { name: entity.title, text: item.text, url: tool?.path };
        }),
      });
  }
}
