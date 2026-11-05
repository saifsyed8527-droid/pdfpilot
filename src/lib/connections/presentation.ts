import copy from "./copy.json";
import { localizedToolName } from "../i18n/ui-copy";
import { CONNECTION_ROOT, getConnection, CONNECTION_SOURCES } from "./registry";
import { getTool } from "../tools";
import { getLocalizedToolDescription } from "../i18n/localized-tools";
import { type LocaleCode } from "../i18n/locales";

export function connectionName(slug: string, locale: LocaleCode) {
  if (slug === "google-drive") return "Google Drive";
  if (slug === "dropbox") return "Dropbox";
  const tool = getTool("/" + slug);
  return tool ? localizedToolName(tool.slug, locale, tool.name) : slug;
}
export function connectionSummary(slug: string, locale: LocaleCode) {
  const tool = getTool("/" + slug);
  return tool ? getLocalizedToolDescription(tool, locale) : copy[locale].cloudHelp;
}
export function connectionText(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key) => String(values[key] ?? match));
}
export function resolveConnectionPage(parts: string[], locale: LocaleCode) {
  const [source, target] = parts;
  const words = copy[locale];
  if (!parts.length) return { title: words.title, description: words.intro, path: CONNECTION_ROOT };
  if (parts.length === 1 && CONNECTION_SOURCES.includes(source)) {
    const values = { source: connectionName(source, locale) };
    return { title: connectionText(words.sourceTitle, values), description: connectionText(words.sourceIntro, values), path: CONNECTION_ROOT + "/" + source };
  }
  if (parts.length !== 2) return undefined;
  const connection = getConnection(source, target);
  if (!connection) return undefined;
  const values = { source: connectionName(source, locale), target: connectionName(target, locale), format: connection.cloud ? "" : connection.first.output.toUpperCase() };
  return { title: connectionText(connection.cloud ? words.cloudTitle : words.pairTitle, values), description: connectionText(connection.cloud ? words.cloudIntro : words.pairIntro, values), path: CONNECTION_ROOT + "/" + source + "/" + target, connection };
}
