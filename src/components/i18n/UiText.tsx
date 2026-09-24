"use client";

import { usePathname } from "next/navigation";
import { CORE_COPY } from "@/lib/i18n/core-content";
import { parseLocalizedPath } from "@/lib/i18n/url-strategy";
import { uiText, localizedToolName } from "@/lib/i18n/ui-copy";
import { localizedToolSummary } from "@/lib/i18n/tool-summaries";

export function useToolCopy() {
  const { locale, path } = parseLocalizedPath(usePathname());
  const slug = path.slice(1);
  return {
    locale,
    common: CORE_COPY[locale].common,
    t: (text: string) => uiText(locale, text),
    title: (fallback: string) => localizedToolName(slug, locale, fallback),
    description: (fallback: string) => localizedToolSummary(slug, locale, fallback),
  };
}

/** Text-only localization: produces no wrapper and cannot alter tool layout. */
export function UiText({ text }: { text: string }) {
  return useToolCopy().t(text);
}
