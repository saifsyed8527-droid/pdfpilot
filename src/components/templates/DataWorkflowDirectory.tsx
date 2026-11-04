import Link from "next/link";
import { DATA_WORKFLOWS, dataWorkflowPath } from "@/lib/content/data-workflows";
import { TASK_ROOT } from "@/lib/content/task-templates";
export function DataWorkflowDirectory() {
  return <section id="data-workflows" className="mt-10 scroll-mt-24">
    <h2 className="text-2xl font-bold">Spreadsheet and data workflows</h2>
    <p className="mt-3 text-muted-foreground">Run two compatible tools on one file. Try the practice data to inspect the output before using your own file.</p>
    <ul className="mt-5 grid gap-4 md:grid-cols-2">{DATA_WORKFLOWS.map(row => <li key={row.slug} className="rounded-xl border p-4">
      <Link href={dataWorkflowPath(row)} className="font-semibold text-primary underline">{row.title}</Link><p className="mt-2 text-sm">{row.steps.join(" → ")}</p>
    </li>)}</ul>
    <Link href={TASK_ROOT} className="mt-5 inline-block underline">Browse an example for every file tool</Link>
  </section>;
}
