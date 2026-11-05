import type { LocaleCode } from "@/lib/i18n/locales";
import { resourceDictionary, resourceText } from "@/lib/i18n/resource-copy";
import { localizedPath } from "@/lib/i18n/url-strategy";
import Link from "next/link";
import { taskForTool, taskPath, TASK_ROOT } from "@/lib/content/task-templates";
import { DATA_WORKFLOWS, dataWorkflowPath } from "@/lib/content/data-workflows";
import { PDF_WORKFLOWS, workflowPath } from "@/lib/content/pdf-workflows";

export async function ToolTaskLinks({ slug, locale="en" }: { slug: string; locale?: LocaleCode }) {
  const words=await resourceDictionary(locale), t=(text:string)=>resourceText(words,text);
  const task = taskForTool(slug);
  if (!task) return null;
  const pairs = [
    ...DATA_WORKFLOWS.filter(row => row.tools.includes(slug)).map(row => ({ title: row.title, path: dataWorkflowPath(row) })),
    ...PDF_WORKFLOWS.filter(row => row.tools.includes(slug)).map(row => ({ title: row.title, path: workflowPath(row) })),
  ];
  return <nav aria-label="Practice templates for this tool" className="border-t">
    <div className="container mx-auto max-w-5xl space-y-3 px-4 py-8">
      <h2 className="text-xl font-bold">{t("Try a worked example")}</h2>
      <Link href={localizedPath(taskPath(task),locale)} className="font-semibold text-primary underline">{t(task.title)}</Link>
      <p className="max-w-3xl text-sm text-muted-foreground">{t(task.purpose)}</p>
      {pairs.length > 0 && <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">{pairs.map(row => <li key={row.path}><Link href={localizedPath(row.path,locale)} className="underline">{t(row.title)}</Link></li>)}</ul>}
      <Link href={localizedPath(TASK_ROOT,locale)} className="inline-block text-sm underline">{t("Browse file task templates")}</Link>
    </div>
  </nav>;
}
