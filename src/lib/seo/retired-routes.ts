import retiredIntents from "../content/pseo-pages.json";
/** Retired editorial/growth pages. Distinct real tool operations are not retired. */
export const RETIRED_RESOURCE_ROOTS = ["templates", "pdf-workflows", "integrations", "workflows", "guides", "help", "compare", "use-cases", "industries", "glossary", "checklists", "pseo-preview"] as const;
const retiredIntentSlugs = new Set(retiredIntents.map(page => page.slug));
/** Accepts canonical English paths or an already locale-stripped intent alias. */
export function isRetiredResourcePath(path: string): boolean {
  const segments = path.split(/[?#]/, 1)[0].split("/").filter(Boolean);
  return RETIRED_RESOURCE_ROOTS.some(segment => segment === segments[0]) || (segments.length === 1 && retiredIntentSlugs.has(segments[0]));
}
