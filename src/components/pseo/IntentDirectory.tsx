import Link from "next/link";
import { browseIntents, PSEO_PAGES } from "@/lib/pseo/registry";
import { CAPABILITIES } from "@/lib/pseo/capabilities";
export function IntentDirectory({ query = "", tool = "", page = 1 }: { query?: string; tool?: string; page?: number }) {
  if (!PSEO_PAGES.length) return null;
  const result = browseIntents(query, tool, page);
  const href = (p: number) => `/pdf-workflows?${new URLSearchParams({ q: query, tool, page: String(p) })}#tasks`;
  return <section id="tasks" className="mt-12 border-t pt-10"><h2 className="text-2xl font-semibold">Find a PDF task</h2>
    <form action="/pdf-workflows#tasks" className="mt-5 flex flex-wrap items-end gap-3"><label className="flex flex-col gap-2">Search tasks<input name="q" defaultValue={query} maxLength={200} className="rounded border bg-background px-3 py-2" /></label><label className="flex flex-col gap-2">Tool<select name="tool" defaultValue={tool} className="rounded border bg-background px-3 py-2"><option value="">All tools</option>{CAPABILITIES.map(t=><option value={t.toolId} key={t.toolId}>{t.displayName}</option>)}</select></label><button className="rounded bg-primary px-4 py-2 text-primary-foreground">Search</button></form>
    <p className="mt-4 text-sm text-muted-foreground">{result.total} tasks</p><ul className="mt-5 grid gap-5 md:grid-cols-2">{result.pages.map(p=><li className="rounded-xl border p-5" key={p.slug}><h3 className="font-semibold"><Link href={`/${p.slug}`}>{p.h1}</Link></h3><p className="mt-2 text-sm text-muted-foreground">{p.metaDescription}</p></li>)}</ul>
    <nav aria-label="Task directory pages" className="mt-6 flex gap-5">{result.current>1&&<Link href={href(result.current-1)}>Previous</Link>}<span>Page {result.current} of {result.totalPages}</span>{result.current<result.totalPages&&<Link href={href(result.current+1)}>Next</Link>}</nav>
  </section>;
}
