"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getActiveLocales } from "@/lib/i18n/locales";
import { parseLocalizedPath, localizedPath } from "@/lib/i18n/url-strategy";

/**
 * Language switcher — architecture only, not wired into the (frozen)
 * navbar. Real, functional component: given the current pathname, it
 * lists every active locale and navigates to that locale's equivalent
 * URL when one is chosen. Not imported by any live page yet.
 *
 * Renders nothing when only one locale is active (today) — a switcher
 * with a single option lets a user "switch" to the page they're already
 * on, which is worse than no switcher, not a safe default to ship. This
 * is the correct behavior for the current one-locale state, not a
 * placeholder: the moment a second locale goes active, this component
 * starts rendering real options with zero code changes.
 *
 * Phase 3 wires this in by importing it into navbar.tsx once real
 * translated routes exist — that's a Navigation change, explicitly out of
 * scope for this sprint.
 */
export function LanguageSwitcher({ currentPathname }: { currentPathname: string }) {
  const activeLocales = getActiveLocales();
  if (activeLocales.length <= 1) return null;

  const { locale: currentLocale, path: canonicalPath } = parseLocalizedPath(currentPathname);

  return (
    <Select
      value={currentLocale}
      onValueChange={(nextLocale) => {
        window.location.href = localizedPath(canonicalPath, nextLocale);
      }}
    >
      <SelectTrigger aria-label="Choose language" className="w-auto">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {activeLocales.map((locale) => (
          <SelectItem key={locale.code} value={locale.code}>
            {locale.nativeName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
