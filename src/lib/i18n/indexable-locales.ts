import { isLaunchTool, LOCALIZED_LAUNCH_TOOL_SLUGS } from "../launch-catalog";
import { hasCatalogCopy } from "./catalog-copy";
import type { LocaleCode } from "./locales";

/** Publishing a new English tool requires providing a localized workspace and copy before advertising alternates. */
export function hasLocalizedTool(slug: string) {
  return isLaunchTool(slug) && (LOCALIZED_LAUNCH_TOOL_SLUGS.includes(slug) || hasCatalogCopy(slug));
}

export function isLocaleIndexable(path: string, locale: LocaleCode): boolean {
  return locale === "en" || path === "/" || hasLocalizedTool(path.slice(1));
}
