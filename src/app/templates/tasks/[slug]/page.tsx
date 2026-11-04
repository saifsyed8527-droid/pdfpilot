import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import { TaskWorkspace } from "@/components/templates/TaskWorkspace";
import { TASK_ROOT, TASK_TEMPLATES, getTaskTemplate, taskPath, relatedTasks } from "@/lib/content/task-templates";
import { DATA_WORKFLOWS, dataWorkflowPath } from "@/lib/content/data-workflows";
import { PDF_WORKFLOWS, workflowPath } from "@/lib/content/pdf-workflows";
import { getTool } from "@/lib/tools";
import { getBreadcrumbSchema } from "@/lib/seo";
import { pseoMetadata } from "@/lib/content/pseo-metadata";
import { catalogWorkspaces } from "@/lib/i18n/catalog-workspaces";
import { IntentTool } from "@/lib/pseo/workspaces";

type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return TASK_TEMPLATES.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: Props) {
  const task = getTaskTemplate((await params).slug);
  if (!task) notFound();
  return pseoMetadata(task.title, task.purpose, taskPath(task));
}
export default async function Page({ params }: Props) {
  const task = getTaskTemplate((await params).slug);
  if (!task) notFound();
  const tool = getTool("/" + task.tool)!, next = getTool("/" + task.nextTool)!;
  const load = catalogWorkspaces[tool.slug];
  const examples = relatedTasks(task);
  const workflows = [
    ...PDF_WORKFLOWS.filter(row => row.tools.includes(tool.slug)).map(row => ({ ...row, path: workflowPath(row) })),
    ...DATA_WORKFLOWS.filter(row => row.tools.includes(tool.slug)).map(row => ({ ...row, path: dataWorkflowPath(row) })),
  ];
  const crumbs = [{ name: "PDFPilot", path: "/" }, { name: "File task templates", path: TASK_ROOT }, { name: task.title, path: taskPath(task) }];
  return <article className="container mx-auto w-full max-w-6xl space-y-7 px-4 py-10">
    <JsonLd data={getBreadcrumbSchema(crumbs)} />
    <nav aria-label="Breadcrumb" className="text-sm"><Link href={TASK_ROOT} className="underline">File task templates</Link> / <Link href={tool.path} className="underline">{tool.name}</Link></nav>
    <header className="max-w-3xl"><h1 className="text-3xl font-bold tracking-tight md:text-4xl">{task.title}</h1><p className="mt-4 text-lg leading-relaxed text-muted-foreground">{task.purpose}</p></header>
    <div className="grid gap-5 md:grid-cols-2">
      <section className="rounded-xl border p-5"><h2 className="text-lg font-semibold">Set up the example</h2><p className="mt-2 leading-relaxed">{task.step}</p></section>
      <section className="rounded-xl border p-5"><h2 className="text-lg font-semibold">Check the result</h2><p className="mt-2 leading-relaxed">{task.check}</p></section>
    </div>
    <TaskWorkspace name={tool.name} toolPath={tool.path} samples={task.samples}>{load ? await load() : <IntentTool toolId={tool.slug} faqs={[]} related={[]} />}</TaskWorkspace>
    <section><h2 className="text-xl font-semibold">Continue with a related task</h2><ul className="mt-3 grid gap-3 sm:grid-cols-2">
      {workflows.map(row => <li key={row.slug}><Link className="font-medium text-primary underline" href={row.path}>{row.title}</Link><p className="text-sm text-muted-foreground">{row.steps.join(" → ")}</p></li>)}
      {examples.map(other => <li key={other.slug}><Link className="font-medium text-primary underline" href={taskPath(other)}>{other.title}</Link></li>)}
    </ul><p className="mt-4 text-sm"><Link className="underline" href={next.path}>Open {next.name}</Link> · <Link className="underline" href={TASK_ROOT}>Browse all file tasks</Link></p></section>
  </article>;
}
