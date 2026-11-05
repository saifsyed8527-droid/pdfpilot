import { getPseoPage } from "@/lib/pseo/registry";
import pages from './resource-pages.json';

/** Only complete, published resource paths can acquire language alternates. */
export const RESOURCE_PATHS = Object.keys(pages);
export const isResourcePath = (path: string) => Object.hasOwn(pages, path);
export function resourceInfo(path: string) { return pages[path as keyof typeof pages]; }

export async function loadResourceRoute(path: string) {
  if (!isResourcePath(path)) return undefined;
  const intent = getPseoPage(path.slice(1));
  if (intent) return { module: { default: async () => (await import('@/components/pseo/IntentPage')).IntentPage({page:intent}) }, params: { slug: intent.slug, tool: '', template: '', category: '' } };
  const parts = path.split('/').filter(Boolean);
  const params = { slug: parts.at(-1)!, tool: parts[2], template: parts[3], category: parts[2] };
  const routeModule = await (async () => {
    switch (parts[0]) {
      case 'about': return import('@/app/about/page');
      case 'privacy': return import('@/app/privacy/page');
      case 'terms': return import('@/app/terms/page');
      case 'guides': return parts.length === 1 ? import('@/app/guides/page') : import('@/app/guides/[slug]/page');
      case 'categories': return parts.length === 1 ? import('@/app/categories/page') : import('@/app/categories/[slug]/page');
      case 'help': return import('@/app/help/[slug]/page');
      case 'compare': return import('@/app/compare/[slug]/page');
      case 'use-cases': return import('@/app/use-cases/[slug]/page');
      case 'industries': return import('@/app/industries/[slug]/page');
      case 'glossary': return import('@/app/glossary/[slug]/page');
      case 'checklists': return import('@/app/checklists/[slug]/page');
      case 'pdf-workflows': return parts.length === 1 ? import('@/app/pdf-workflows/page') : parts[1] === 'data' ? import('@/app/pdf-workflows/data/[slug]/page') : import('@/app/pdf-workflows/[slug]/page');
      case 'templates':
        if (parts.length === 1) return import('@/app/templates/page');
        if (parts[1] === 'collections') return import('@/app/templates/collections/[category]/page');
        if (parts[1] === 'tasks') return parts.length === 2 ? import('@/app/templates/tasks/page') : import('@/app/templates/tasks/[slug]/page');
        if (parts[1] === 'conversions') return parts.length === 2 ? import('@/app/templates/conversions/page') : parts.length === 3 ? import('@/app/templates/conversions/[tool]/page') : import('@/app/templates/conversions/[tool]/[template]/page');
        return import('@/app/templates/[slug]/page');
    }
  })();
  return routeModule ? { module: routeModule, params } : undefined;
}
