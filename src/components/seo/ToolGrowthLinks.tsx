import { getToolIntents } from "@/lib/pseo/registry";
import Link from "next/link";
import { PDF_WORKFLOWS, workflowPath } from "@/lib/content/pdf-workflows";
export function ToolGrowthLinks({ tool }: { tool: string }) {
  const intents = getToolIntents(tool);
  const rows = PDF_WORKFLOWS.filter(row => row.tools.includes(tool));
  if (!rows.length && !intents.length && tool !== "fill-pdf") return null;
  return <section lang="en" dir="ltr" className="border-t bg-background px-4 py-10"><nav className="mx-auto max-w-5xl" aria-label="Templates and workflows"><h2 className="text-2xl font-semibold">PDF templates and workflows (English)</h2><ul className="mt-5 grid gap-4 sm:grid-cols-2">{intents.map(page => <li key={page.slug}><Link href={`/${page.slug}`} className="block rounded-xl border p-4 hover:bg-muted"><span className="font-semibold">{page.h1}</span></Link></li>)}{rows.map(row => <li key={row.slug}><Link href={workflowPath(row)} hrefLang="en" className="block rounded-xl border p-4 hover:bg-muted"><span className="font-semibold">{row.title}</span><span className="mt-2 block text-sm text-muted-foreground">{row.description}</span></Link></li>)}{tool === "fill-pdf" && <li><Link href="/templates" hrefLang="en" className="block rounded-xl border p-4 hover:bg-muted"><span className="font-semibold">Start with a free fillable template</span><span className="mt-2 block text-sm text-muted-foreground">Planners, meeting agendas, checklists and logs you can customise and download.</span></Link></li>}</ul>{intents.length > 0 && <Link className="mt-4 inline-block underline" href={`/pdf-workflows?tool=${tool}#tasks`}>Browse all related tasks</Link>}</nav></section>;
}
