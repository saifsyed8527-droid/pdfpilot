"use client";
import { useResourceI18n } from "@/components/i18n/ResourceLocaleProvider";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { TEMPLATE_ROOT, TEMPLATE_TOOLS, TEMPLATE_TOOL_NAMES, type ConversionTemplate } from "@/lib/content/conversion-templates";

export function TemplateGallery({ templates, tool }: { templates: ConversionTemplate[]; tool?: string }) {
  const { t: tr, href: localHref } = useResourceI18n();

  const [query, setQuery] = useState("");
  const visible = templates.filter(row => `${row.title} ${tr(row.title)} ${row.description} ${tr(row.description)} ${row.tags.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <>
    <div className="my-8 flex flex-wrap items-center justify-between gap-4">
      <nav aria-label={tr("Template categories")} className="flex flex-wrap gap-2">
        <Link href={localHref(TEMPLATE_ROOT)} aria-current={!tool ? "page" : undefined} className={`rounded-full border px-4 py-2 text-sm ${!tool ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground"}`}>{tr("All templates")}</Link>
        {tr(TEMPLATE_TOOLS.map(slug => <Link key={slug} href={localHref(`${TEMPLATE_ROOT}/${slug}`)} aria-current={tool === slug ? "page" : undefined} className={`rounded-full border px-4 py-2 text-sm ${tool === slug ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground"}`}>{tr(TEMPLATE_TOOL_NAMES[slug])}</Link>))}
      </nav>
      <label className="flex w-full items-center gap-2 rounded-xl border bg-card px-3 py-2 text-card-foreground sm:w-72"><Search className="h-4 w-4 shrink-0" aria-hidden /><span className="sr-only">{tr("Search conversion templates")}</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={tr("Search A4, batch, tables…")} className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none" /></label>
    </div>
    <p role="status" className="mb-4 text-sm text-muted-foreground">{tr(visible.length)} {tr(" template")}{tr(visible.length === 1 ? "" : "s")}</p>
    <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{tr(visible.map(row => <li key={row.path} className="flex flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground transition-shadow hover:shadow-lg">
      <Link href={localHref(row.path)} tabIndex={-1} aria-hidden className="flex h-44 items-center justify-center border-b bg-muted/40 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- static first-party sample conversion preview */}
        <img src={row.preview} alt={tr("")} width={420} height={236} loading="lazy" className="h-full w-full object-contain" />
      </Link>
      <div className="flex flex-1 flex-col p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tr(TEMPLATE_TOOL_NAMES[row.tool])}</p><h2 className="mt-2 text-lg font-semibold"><Link href={localHref(row.path)}>{tr(row.title)}</Link></h2><p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{tr(row.description)}</p><p className="my-4 text-xs font-medium">{tr(row.output)}</p><Link href={localHref(row.path)} className="inline-flex items-center gap-2 text-sm font-semibold text-primary">{tr("Use this template ")}<ArrowRight className="h-4 w-4" aria-hidden /></Link></div>
    </li>))}</ul>
    {tr(!visible.length && <p className="rounded-xl border p-8 text-center">{tr("No matching template. Try “A4”, “DOCX”, “slides” or clear your search.")}</p>)}
  </>;
}
