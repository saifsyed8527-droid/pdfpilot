import Link from "next/link";
import { getConnection, connectionPath, connectionTargets } from "@/lib/connections/registry";
import { connectionName, resolveConnectionPage } from "@/lib/connections/presentation";
import { localizedPath } from "@/lib/i18n/url-strategy";
import type { LocaleCode } from "@/lib/i18n/locales";
import copy from "@/lib/connections/copy.json";

export function ToolConnectionLinks({ slug, locale }: { slug: string; locale: LocaleCode }) {
  const cloud = [getConnection("google-drive", slug), getConnection("dropbox", slug)].filter(Boolean);
  if (!cloud.length) return null;
  const links = [...cloud, ...connectionTargets(slug).slice(0, 6)];
  return <nav className="border-t" aria-label={copy[locale].related}><div className="container mx-auto max-w-5xl space-y-4 px-4 py-7">
    <h2 className="text-xl font-semibold">{copy[locale].related}</h2>
    <ul className="grid gap-3 sm:grid-cols-2">{links.map(connection => connection && <li key={connection.source + connection.target}><Link href={localizedPath(connectionPath(connection.source, connection.target), locale)} className="text-sm underline">{resolveConnectionPage([connection.source, connection.target], locale)!.title}</Link></li>)}</ul>
    {connectionTargets(slug).length > 0 && <Link href={localizedPath(connectionPath(slug), locale)} className="inline-block underline">{connectionName(slug, locale)} · {copy[locale].all}</Link>}
  </div></nav>;
}
