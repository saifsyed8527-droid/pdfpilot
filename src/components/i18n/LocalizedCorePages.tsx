import { notFound } from "next/navigation";
import { HomeClient } from "@/app/home-client";
import { SEARCH_INDEX } from "@/lib/search-index";
import { CORE_PAGE_PATHS, getLocalizedToolContent, type CoreToolKey } from "@/lib/i18n/core-content";
import type { LocaleCode } from "@/lib/i18n/locales";
import { TOOL_WORKSPACES } from "@/lib/i18n/tool-workspaces";
import type { Tool } from "@/lib/tools";

export function LocalizedHome({ locale }: { locale: LocaleCode }) {
  return <HomeClient searchIndex={[...SEARCH_INDEX]} locale={locale} />;
}

export function LocalizedToolPage({ locale, toolKey }: { locale: LocaleCode; toolKey: CoreToolKey }) {
  const Workspace = TOOL_WORKSPACES[CORE_PAGE_PATHS.en[toolKey]];
  if (!Workspace) notFound();
  return <Workspace locale={locale} landingCopy={getLocalizedToolContent(locale, toolKey)} />;
}

export function LocalizedGenericToolPage({ locale, tool }: { locale: LocaleCode; tool: Tool }) {
  const Workspace = TOOL_WORKSPACES[tool.slug];
  if (!Workspace) notFound();
  return <Workspace locale={locale} />;
}
