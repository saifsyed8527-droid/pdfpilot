import Link from "next/link";
import { taskForTool, taskPath, TASK_ROOT } from "@/lib/content/task-templates";
import { DATA_WORKFLOWS, dataWorkflowPath } from "@/lib/content/data-workflows";
import { PDF_WORKFLOWS, workflowPath } from "@/lib/content/pdf-workflows";

export function ToolTaskLinks({ slug }: { slug: string }) {
  const task = taskForTool(slug);
  if (!task) return null;
  const pairs = [
    ...DATA_WORKFLOWS.filter(row => row.tools.includes(slug)).map(row => ({ title: row.title, path: dataWorkflowPath(row) })),
    ...PDF_WORKFLOWS.filter(row => row.tools.includes(slug)).map(row => ({ title: row.title, path: workflowPath(row) })),
  ];
  return <nav aria-label="Practice templates for this tool" className="border-t">
    <div className="container mx-auto max-w-5xl space-y-3 px-4 py-8">
      <h2 className="text-xl font-bold">Try a worked example</h2>
      <Link href={taskPath(task)} className="font-semibold text-primary underline">{task.title}</Link>
      <p className="max-w-3xl text-sm text-muted-foreground">{task.purpose}</p>
      {pairs.length > 0 && <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">{pairs.map(row => <li key={row.path}><Link href={row.path} className="underline">{row.title}</Link></li>)}</ul>}
      <Link href={TASK_ROOT} className="inline-block text-sm underline">Browse file task templates</Link>
    </div>
  </nav>;
}
