"use client";
import { useState } from "react";
import Link from "next/link";
import type { DocumentTemplate } from "@/lib/content/document-templates";
export function DocumentTemplateGallery({ templates }: { templates: readonly DocumentTemplate[] }) {
  const [query, setQuery] = useState("");
  const visible = templates.filter(row => `${row.name} ${row.description} ${row.category}`.toLowerCase().includes(query.toLowerCase().trim()));
  return <><label className="mt-8 block max-w-md text-sm font-medium">Search PDF templates<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Try planner, meeting or checklist" className="mt-2 w-full rounded-xl border bg-background px-4 py-3" /></label><p role="status" className="my-5 text-sm text-muted-foreground">{visible.length} editable templates</p><ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{visible.map(row => <li key={row.slug} className="overflow-hidden rounded-2xl border bg-card text-card-foreground"><Link href={`/templates/${row.slug}`} tabIndex={-1} aria-hidden className="block border-b bg-muted/30 p-5">
    {/* eslint-disable-next-line @next/next/no-img-element -- original generated PDF previews */}
    <img src={`/template-samples/documents/${row.slug}.png`} alt="" width={595} height={842} loading="lazy" className="h-52 w-full object-contain" /></Link><div className="p-5"><p className="text-xs font-semibold uppercase text-muted-foreground">{row.category} · {row.rows} rows</p><h2 className="mt-2 text-xl font-semibold"><Link href={`/templates/${row.slug}`}>{row.name}</Link></h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{row.description}</p><Link href={`/templates/${row.slug}#editor`} className="mt-4 inline-block text-sm font-semibold text-primary">Use this template →</Link></div></li>)}</ul>{!visible.length && <p className="rounded-xl border p-6">No matching template. Try “planner”, “meeting” or clear the search.</p>}</>;
}
