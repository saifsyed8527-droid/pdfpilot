import rows from "../content/pseo-pages.json";
import { pageSchema, type PseoPage } from "./schema";
import { CAPABILITY_BY_ID } from "./capabilities";

/** Offline build is the only writer. No CSV, AI, draft or URL-derived generation at request time. */
export const PSEO_PAGES: PseoPage[] = rows.map(row => pageSchema.parse(row));
const index = new Map<string, PseoPage>();
const signatures = new Set<string>();
for (const page of PSEO_PAGES) {
  if (!page.indexable || !["approved", "published"].includes(page.qualityStatus) || page.fixture || !CAPABILITY_BY_ID.has(page.baseToolId)
    || index.has(page.slug) || signatures.has(page.intentSignature) || page.canonicalUrl !== `https://pdfpilot.net/${page.locale ? page.locale+"/" : ""}${page.slug}`) throw new Error(`Invalid approved pSEO manifest: ${page.slug}`);
  index.set(page.slug, page); signatures.add(page.intentSignature);
}
export const getPseoPage = (slug: string, locale: string|null=null) => { const page=index.get(slug); return page?.locale===locale?page:undefined; };
export const getToolIntents = (tool: string, limit = 6, language = "en") => PSEO_PAGES.filter(p => p.baseToolId === tool && p.language===language).slice(0, limit);
export function browseIntents(query = "", tool = "", page = 1, pageSize = 24) {
  const q = query.toLowerCase().trim().slice(0, 200);
  const matches = PSEO_PAGES.filter(p => p.language==="en" && (!tool || p.baseToolId === tool) && (!q || `${p.h1} ${p.primaryKeyword} ${p.secondaryKeywords.join(" ")}`.toLowerCase().includes(q)));
  const totalPages = Math.max(1, Math.ceil(matches.length / pageSize));
  const current = Math.max(1, Math.min(Number.isFinite(page) ? Math.floor(page) : 1, totalPages));
  return { pages: matches.slice((current - 1) * pageSize, current * pageSize), total: matches.length, current, totalPages };
}
