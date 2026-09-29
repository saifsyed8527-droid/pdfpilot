import { z } from "zod";

export const families = ["core", "format", "size", "platform", "device", "use-case", "workflow", "informational", "unsupported", "irrelevant"] as const;
export const safeSlug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const text = z.string().trim().min(1);
export const capabilitySchema = z.object({
  toolId: safeSlug, canonicalSlug: safeSlug, displayName: text, category: text, componentReference: text,
  inputFormats: z.array(text), outputFormats: z.array(text), supportedInputTypes: z.array(text), supportedOutputTypes: z.array(text),
  supportedOperations: z.array(text).min(1), supportsMultipleFiles: z.boolean(), supportsExactTargetSize: z.boolean(),
  supportsPresets: z.boolean(), allowedPseoPresets: z.array(z.record(z.unknown())),
  processingMode: z.enum(["client", "server", "hybrid", "unknown"]), privacyFacts: z.array(text).min(1),
  platformRequirements: z.array(text), verifiedPlatforms: z.array(text), limitations: z.array(text).min(1),
  canonicalCoreKeyword: text, publicStatus: z.literal("public"), facts: z.array(text), howToSteps: z.array(text).min(3),
  evidence: z.array(z.object({ path: text, sha256: z.string().length(64) }).strict()).min(1), reviewedAt: z.string().date(),
}).strict();
export type Capability = z.infer<typeof capabilitySchema>;

export const provenanceSchema = z.object({
  sourceDataset: text, sourceFile: text, sourceRowId: z.number().int().min(2),
  sourceMarket: z.string().regex(/^(?:[A-Z]{2}|UNKNOWN|GLOBAL)$/), language: text,
}).strict();
export const keywordSchema = provenanceSchema.extend({
  id: text, keyword: z.string(), normalizedKeyword: z.string(), raw: z.record(z.string()),
  searchVolume: z.number().nonnegative().nullable(), keywordDifficulty: z.number().min(0).max(100).nullable(),
  cpc: z.number().nonnegative().nullable(), competition: z.number().nonnegative().nullable(),
  intent: z.string(), trend: z.string(), serpFeatures: z.array(z.string()), results: z.number().nonnegative().nullable(), warnings: z.array(text),
}).strict();
export type Keyword = z.infer<typeof keywordSchema>;

export const pageSchema = z.object({
  id: text, slug: safeSlug, pageType: z.enum(["format", "size", "platform", "device", "use-case", "workflow"]),
  baseToolId: safeSlug, baseToolSlug: safeSlug, primaryKeyword: text, secondaryKeywords: z.array(text),
  intentCluster: text, intentSignature: text, modifierType: text, modifierValue: text,
  sourceFormat: text.optional(), targetFormat: text.optional(), targetSize: z.number().positive().optional(),
  useCase: text.optional(), platform: text.optional(), device: text.optional(),
  provenance: z.array(provenanceSchema).min(1), demand: z.array(keywordSchema).min(1),
  language: text, locale: text.nullable(), metaTitle: text, metaDescription: text, h1: text, subtitle: text,
  intro: text, howToSteps: z.array(text).min(3), useCaseContent: z.array(text), compatibilityContent: z.array(text),
  limitationsContent: z.array(text).min(1), faqItems: z.array(z.object({ question: text, answer: text }).strict()),
  toolPreset: z.record(z.unknown()).nullable(), relatedPages: z.array(safeSlug), relatedTools: z.array(safeSlug),
  canonicalUrl: z.string().url(), indexable: z.boolean(), qualityStatus: z.enum(["draft", "validated", "approved", "rejected", "published"]),
  rejectionReason: z.array(text), createdAt: z.string().date(), updatedAt: z.string().date(), lastReviewed: z.string().date().nullable(),
  contentFingerprint: text, recipeId: text, fixture: z.boolean(),
}).strict();
export type PseoPage = z.infer<typeof pageSchema>;

export const reviewSchema = z.object({
  status: z.enum(["approved", "rejected"]), reviewer: text, reviewedAt: z.string().date(),
  contentFingerprint: text, capabilityFingerprint: text,
  distinctUtility: text, evidence: z.array(text).min(1),
  verifiedPlatform: z.string().optional(), reason: text.optional(),
}).strict();
export type Review = z.infer<typeof reviewSchema>;
