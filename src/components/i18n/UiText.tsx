"use client";

import { useIntentPresentation } from "@/components/pseo/IntentPresentation";
import { usePathname } from "next/navigation";
import { CORE_COPY } from "@/lib/i18n/core-content";
import { parseLocalizedPath } from "@/lib/i18n/url-strategy";
import { useWorkspaceText } from "./WorkspaceText";
import { localizedToolName } from "@/lib/i18n/ui-copy";
import { localizedToolSummary } from "@/lib/i18n/tool-summaries";

export function useToolCopy() {
  const t = useWorkspaceText();
  const intent = useIntentPresentation();
  const { locale, path } = parseLocalizedPath(usePathname());
  const slug = path.slice(1);
  return {
    locale,
    common: CORE_COPY[locale].common,
    t,
    title: (fallback: string) => intent?.title ?? localizedToolName(slug, locale, fallback),
    description: (fallback: string) => intent?.description ?? localizedToolSummary(slug, locale, fallback),
  };
}

export { UiText } from "./WorkspaceText";
