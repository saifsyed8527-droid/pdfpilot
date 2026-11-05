import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { connectionName, connectionSummary, connectionText, resolveConnectionPage } from "@/lib/connections/presentation";
import { CONNECTION_SOURCES, connectionTargets, connectionPath, getConnection, OPERATIONS } from "@/lib/connections/registry";
import copy from "@/lib/connections/copy.json";
import { getLocale, type LocaleCode } from "@/lib/i18n/locales";
import { localizedPath } from "@/lib/i18n/url-strategy";
import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema } from "@/lib/seo";
import { ConnectionRunner } from "./ConnectionRunner";
import { ConnectedTool } from "./ConnectedTool";
import { catalogWorkspaces } from "@/lib/i18n/catalog-workspaces";
import { IntentTool } from "@/lib/pseo/workspaces";

export function connectionMetadata(parts: string[], locale: LocaleCode): Metadata {
  const page = resolveConnectionPage(parts, locale);
  if (!page) notFound();
  const path = localizedPath(page.path, locale);
  return { title: page.title + " | PDFPilot", description: page.description,
    alternates: { canonical: path, languages: getHreflangLanguagesMap(page.path) },
    openGraph: { title: page.title, description: page.description, locale: getLocale(locale)!.ogLocale, url: path, siteName: "PDFPilot", images: [{ url: "/og/home.png", width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title: page.title, description: page.description, images: ["/og/home.png"] },
  };
}

export async function ConnectionsPage({ parts, locale = "en" }: { parts: string[]; locale?: LocaleCode }) {
  const page = resolveConnectionPage(parts, locale);
  if (!page) notFound();
  const words = copy[locale];
  const [source, target] = parts;
  const connection = target ? getConnection(source, target) : undefined;
  const path = (value: string) => localizedPath(value, locale);
  const values = { source: connectionName(source ?? "", locale), target: connectionName(target ?? "", locale) };
  const crumbs = [{ name: "PDFPilot", path: path("/") }, { name: words.title, path: path(connectionPath()) }];
  if (source) crumbs.push({ name: values.source, path: path(connectionPath(source)) });
  if (target) crumbs.push({ name: values.target, path: path(connectionPath(source, target)) });
  const candidates = source ? connectionTargets(source) : [];
  const related = connection ? candidates.filter(row => row.target !== target).slice(0, 12) : candidates;
  const names = (first: string, second: string) => resolveConnectionPage([first, second], locale)!.title;
  const load = target ? catalogWorkspaces[target] : undefined;
  return <article className="container mx-auto w-full max-w-6xl space-y-8 px-4 py-10">
    <JsonLd data={[
      getBreadcrumbSchema(crumbs),
      { "@context": "https://schema.org", "@type": connection ? "WebPage" : "CollectionPage", name: page.title, description: page.description, url: "https://pdfpilot.net" + path(page.path), inLanguage: locale },
    ]} />
    <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm">{crumbs.slice(0, -1).map(crumb => <Link key={crumb.path} className="underline" href={crumb.path}>{crumb.name}</Link>)}</nav>
    <header className="max-w-4xl"><h1 className="text-3xl font-bold tracking-tight md:text-5xl">{page.title}</h1><p className="mt-5 text-lg leading-relaxed text-muted-foreground">{page.description}</p></header>
    {!source && <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{CONNECTION_SOURCES.map(slug => <li key={slug} className="rounded-xl border p-5"><Link href={path(connectionPath(slug))} className="text-lg font-semibold underline">{connectionName(slug, locale)}</Link><p className="mt-2 text-sm text-muted-foreground">{connectionSummary(slug, locale)}</p><p className="mt-3 text-xs">{words.count.replace("{count}", String(connectionTargets(slug).length))}</p></li>)}</ul>}
    {connection?.cloud && <>
      <section className="space-y-4 rounded-xl border p-6"><h2 className="text-xl font-semibold">{words.steps}</h2>
        <ol className="list-inside list-decimal space-y-3">{[words.cloudStep, words.cloudThen, words.cloudFinish].map(text => <li key={text}>{connectionText(text, values)}</li>)}</ol>
        <p className="text-sm text-muted-foreground">{words.cloudHelp}</p>
      </section>
      <p className="max-w-3xl leading-relaxed">{connectionSummary(target, locale)}</p>
      <ConnectedTool name={values.target} description={connectionSummary(target, locale)} locale={locale}>{load ? await load() : <IntentTool toolId={target} faqs={[]} related={[]} />}</ConnectedTool>
    </>}
    {connection && !connection.cloud && <>
      <section className="grid gap-4 sm:grid-cols-2">{[connection.first, connection.next].map((operation, index) => <div key={operation.slug} className="space-y-3 rounded-xl border p-6"><h2 className="text-lg font-semibold">{index + 1}. {connectionName(operation.slug, locale)}</h2><p className="text-sm text-muted-foreground">{connectionSummary(operation.slug, locale)}</p><dl className="flex flex-wrap gap-5 text-sm"><div><dt>{words.inputs}</dt><dd className="font-semibold">{operation.input.toUpperCase()}</dd></div><div><dt>{words.outputs}</dt><dd className="font-semibold">{operation.output.toUpperCase()}</dd></div></dl></div>)}</section>
      <ConnectionRunner source={source} target={target} locale={locale} />
      <section className="space-y-3"><h2 className="text-xl font-semibold">{words.settings}</h2><p>{words.fileLimit}</p><p>{connection.first.input === "pdf" ? words.pdfLimit : words.dataLimit}</p><p>{connection.first.input === "pdf" ? words.pdfNote : words.formatNote}</p>
        {[source, target].includes("watermark-pdf") && <p>{words.watermarkNote}</p>}{[source, target].includes("add-page-numbers") && <p>{words.numberNote}</p>}
        <div className="flex flex-wrap gap-4">{connection.first.samples.map(name => <a download key={name} className="underline" href={"/task-examples/" + name}>{name}</a>)}</div>
      </section>
    </>}
    {connection && <section className="space-y-3"><h2 className="text-xl font-semibold">{words.check}</h2><p>{words.resultCheck}</p><div className="flex flex-wrap gap-4">{[source, target].filter(slug => OPERATIONS.some(row => row.slug === slug) || slug === target).map(slug => <Link key={slug} className="underline" href={path("/" + slug)}>{words.openTool.replace("{tool}", connectionName(slug, locale))}</Link>)}</div></section>}
    {source && <section><h2 className="mb-4 text-2xl font-semibold">{connection ? words.related : words.count.replace("{count}", String(related.length))}</h2><ul className="grid gap-4 sm:grid-cols-2">{related.map(row => <li key={row.target} className="rounded-xl border p-4"><Link href={path(connectionPath(source, row.target))} className="font-semibold underline">{names(source, row.target)}</Link><p className="mt-2 text-sm text-muted-foreground">{connectionSummary(row.target, locale)}</p></li>)}</ul></section>}
    {source && <Link href={path(connectionPath())} className="inline-block underline">{words.all}</Link>}
  </article>;
}
