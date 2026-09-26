import Link from "next/link";
import { PDF_WORKFLOWS, workflowPath } from "@/lib/content/pdf-workflows";
export function ToolGrowthLinks({ tool }: { tool: string }) {
  const rows = PDF_WORKFLOWS.filter(row => row.tools.includes(tool));
  if (!rows.length && tool !== "fill-pdf") return null;
  return <section lang="en" dir="ltr" className="border-t bg-background px-4 py-10"><nav className="mx-auto max-w-5xl" aria-label="Templates and workflows"><h2 className="text-2xl font-semibold">PDF templates and workflows (English)</h2><ul className="mt-5 grid gap-4 sm:grid-cols-2">{rows.map(row => <li key={row.slug}><Link href={workflowPath(row)} hrefLang="en" className="block rounded-xl border p-4 hover:bg-muted"><span className="font-semibold">{row.title}</span><span className="mt-2 block text-sm text-muted-foreground">{row.description}</span></Link></li>)}{tool === "fill-pdf" && <li><Link href="/templates" hrefLang="en" className="block rounded-xl border p-4 hover:bg-muted"><span className="font-semibold">Start with a free fillable template</span><span className="mt-2 block text-sm text-muted-foreground">Planners, meeting agendas, checklists and logs you can customise and download.</span></Link></li>}</ul></nav></section>;
}
