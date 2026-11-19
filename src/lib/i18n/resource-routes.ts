import pages from './resource-pages.json';

/** Only complete, published resource paths can acquire language alternates. */
export const RESOURCE_PATHS = Object.keys(pages);
export const isResourcePath = (path: string) => Object.hasOwn(pages, path);
export function resourceInfo(path: string) { return pages[path as keyof typeof pages]; }

export async function loadResourceRoute(path: string) {
  if (!isResourcePath(path)) return undefined;
  const parts = path.split('/').filter(Boolean);
  const params = { slug: parts.at(-1)!, tool: parts[2], template: parts[3], category: parts[2] };
  const routeModule = await (async () => {
    switch (parts[0]) {
      case 'about': return import('@/app/(english)/about/page');
      case 'privacy': return import('@/app/(english)/privacy/page');
      case 'terms': return import('@/app/(english)/terms/page');
      case 'categories': return parts.length === 1 ? import('@/app/(english)/categories/page') : import('@/app/(english)/categories/[slug]/page');
    }
  })();
  return routeModule ? { module: routeModule, params } : undefined;
}
