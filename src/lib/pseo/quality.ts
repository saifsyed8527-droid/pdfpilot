import { portugueseIntent } from "./portuguese";
import { isPortugueseRecipe } from "./portuguese-content";
import { CAPABILITY_BY_ID } from "./capabilities";
import { fingerprint } from "./content";
import { classifyKeyword } from "./classify";
import type { PseoPage, Review } from "./schema";

export function qualityIssues(page: PseoPage, reserved: Set<string>, review?: Review): string[] {
  const errors: string[]=[]; const tool=CAPABILITY_BY_ID.get(page.baseToolId);
  if (!tool) return ["tool_not_public"];
  if (reserved.has(page.slug)) errors.push("route_collision");
  if(page.baseToolSlug!==tool.canonicalSlug) errors.push("base_tool_mismatch");
  if(page.canonicalUrl!==`https://pdfpilot.net/${page.locale ? page.locale+"/" : ""}${page.slug}`)errors.push("canonical_mismatch");
  if(!((page.language==="en"&&page.locale===null)||(page.language==="pt-BR"&&page.locale==="pt-br")))errors.push("localization_not_implemented");
  if(page.language==="pt-BR"&&!isPortugueseRecipe(portugueseIntent(page.primaryKeyword)))errors.push("missing_localized_recipe");
  if(page.fixture)errors.push("development_fixture");
  if(page.sourceFormat&&!tool.inputFormats.includes(page.sourceFormat))errors.push("unsupported_input_format");
  if(page.targetFormat&&!tool.outputFormats.includes(page.targetFormat))errors.push("unsupported_output_format");
  if(page.pageType==="size"&&!tool.supportsExactTargetSize)errors.push("exact_target_not_supported_by_core_tool");
  if(page.toolPreset&&!tool.allowedPseoPresets.some(p=>JSON.stringify(p)===JSON.stringify(page.toolPreset)))errors.push("unapproved_preset");
  if(page.pageType==="workflow")errors.push("workflow_requires_separate_review");
  if(page.recipeId==="unreviewed"||page.useCaseContent.length<2)errors.push("missing_distinct_useful_content");
  if(!page.h1.trim()||!page.metaTitle.trim()||!page.metaDescription.trim())errors.push("missing_metadata");
  const owner=page.language==="pt-BR"?portugueseIntent(page.primaryKeyword):classifyKeyword(page.primaryKeyword);
  if(page.language==="pt-BR")owner.signature="pt-BR:"+owner.signature;
  if(owner.family==="core"||owner.signature!==page.intentSignature)errors.push("keyword_owner_mismatch");
  if(page.demand.some(r=>r.language!==page.language))errors.push("untranslated_keyword_language");
  const copy=[page.metaTitle,page.metaDescription,page.intro,...page.useCaseContent,...page.compatibilityContent,...page.faqItems.map(f=>f.answer)].join(" ");
  if(tool.processingMode!=="client"&&/never leave|never uploaded|entirely (?:local|in your browser)|no (?:file )?uploads/i.test(copy))errors.push("unverified_privacy_claim");
  if(!tool.supportsExactTargetSize&&/guaranteed.*\b(?:kb|mb)|exactly \d/i.test(copy))errors.push("unsupported_exact_size_claim");
  if(["platform","device"].includes(page.pageType)&&review?.verifiedPlatform!==page.modifierValue)errors.push("platform_end_to_end_verification_required");
  if(!review)errors.push("editorial_review_required");
  else {
    if(review.status!=="approved")errors.push(`editorial_rejection:${review.reason ?? "review_rejected"}`);
    if(review.contentFingerprint!==page.contentFingerprint)errors.push("stale_content_review");
    if(review.capabilityFingerprint!==fingerprint(tool))errors.push("stale_capability_review");
  }
  return errors;
}

/** The same catalog constraints are used by the CLI and the route registry. */
export function catalogIssues(pages: PseoPage[]): string[] {
  const errors:string[]=[];const sets=new Map<string,Set<string>>();const slugs=new Set(pages.map(p=>p.slug));
  for(const page of pages){
    for(const key of ["slug","intentSignature","metaTitle","h1","contentFingerprint"] as const){
      const values=sets.get(key)??new Set<string>(); const value=page[key].toLowerCase();
      if(values.has(value))errors.push(`duplicate_${key}:${page.slug}`); values.add(value);sets.set(key,values);
    }
    if(!page.relatedTools.includes(page.baseToolId))errors.push(`missing_core_link:${page.slug}`);
    if(page.relatedTools.some(t=>!CAPABILITY_BY_ID.has(t)))errors.push(`invalid_tool_link:${page.slug}`);
    if(page.relatedPages.some(s=>!slugs.has(s)||s===page.slug))errors.push(`invalid_related_page:${page.slug}`);
    if(!page.indexable||!["approved","published"].includes(page.qualityStatus)||page.fixture)errors.push(`nonindexable_manifest_record:${page.slug}`);
    if(page.canonicalUrl!==`https://pdfpilot.net/${page.locale ? page.locale+"/" : ""}${page.slug}`)errors.push(`invalid_canonical:${page.slug}`);
  }
  // Compare task-specific paragraphs only; shared factual instructions need not be artificially rewritten.
  for(let i=0;i<pages.length;i++)for(let j=i+1;j<pages.length;j++){
    if(pages[i].baseToolId!==pages[j].baseToolId)continue;
    const a=new Set(pages[i].useCaseContent.join(" ").toLowerCase().split(/\W+/)); const b=new Set(pages[j].useCaseContent.join(" ").toLowerCase().split(/\W+/));
    const shared=[...a].filter(t=>b.has(t)).length;const union=new Set([...a,...b]).size;
    if(union&&shared/union>.88)errors.push(`near_duplicate_content:${pages[i].slug}:${pages[j].slug}`);
  }
  return errors;
}
