"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { TEMPLATE_ROOT, TEMPLATE_TOOLS, TEMPLATE_TOOL_NAMES, type ConversionTemplate } from "@/lib/content/conversion-templates";

export function TemplateGallery({ templates, tool }: { templates: ConversionTemplate[]; tool?: string }) {
  const [query, setQuery] = useState("");
  const visible = templates.filter(row => `${row.title} ${row.description} ${row.tags.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <>
    <div className="my-8 flex flex-wrap items-center justify-between gap-4">
      <nav aria-label="Template categories" className="flex flex-wrap gap-2">
        <Link href={TEMPLATE_ROOT} aria-current={!tool ? "page" : undefined} className={`rounded-full border px-4 py-2 text-sm ${!tool ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground"}`}>All templates</Link>
        {TEMPLATE_TOOLS.map(slug => <Link key={slug} href={`${TEMPLATE_ROOT}/${slug}`} aria-current={tool === slug ? "page" : undefined} className={`rounded-full border px-4 py-2 text-sm ${tool === slug ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground"}`}>{TEMPLATE_TOOL_NAMES[slug]}</Link>)}
      </nav>
      <label className="flex w-full items-center gap-2 rounded-xl border bg-card px-3 py-2 text-card-foreground sm:w-72"><Search className="h-4 w-4 shrink-0" aria-hidden /><span className="sr-only">Search conversion templates</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search A4, batch, tables…" className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none" /></label>
    </div>
    <p role="status" className="mb-4 text-sm text-muted-foreground">{visible.length} template{visible.length === 1 ? "" : "s"}</p>
    <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visible.map(row => <li key={row.path} className="flex flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground transition-shadow hover:shadow-lg">
      <Link href={row.path} tabIndex={-1} aria-hidden className="flex h-44 items-center justify-center border-b bg-muted/40 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- static first-party sample conversion preview */}
        <img src={row.preview} alt="" width={420} height={236} loading="lazy" className="h-full w-full object-contain" />
      </Link>
      <div className="flex flex-1 flex-col p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{TEMPLATE_TOOL_NAMES[row.tool]}</p><h2 className="mt-2 text-lg font-semibold"><Link href={row.path}>{row.title}</Link></h2><p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{row.description}</p><p className="my-4 text-xs font-medium">{row.output}</p><Link href={row.path} className="inline-flex items-center gap-2 text-sm font-semibold text-primary">Use this template <ArrowRight className="h-4 w-4" aria-hidden /></Link></div>
    </li>)}</ul>
    {!visible.length && <p className="rounded-xl border p-8 text-center">No matching template. Try “A4”, “DOCX”, “slides” or clear your search.</p>}
  </>;
}
