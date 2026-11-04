import Link from "next/link";
import { notFound } from "next/navigation";
import { DATA_WORKFLOWS, dataWorkflowPath, getDataWorkflow } from "@/lib/content/data-workflows";
import { taskForTool, taskPath } from "@/lib/content/task-templates";
import { DataWorkflowRunner } from "@/components/templates/DataWorkflowRunner";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema } from "@/lib/seo";
import { pseoMetadata } from "@/lib/content/pseo-metadata";
import { getTool } from "@/lib/tools";

type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return DATA_WORKFLOWS.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: Props) {
  const row = getDataWorkflow((await params).slug);
  if (!row) notFound();
  return pseoMetadata(row.title, row.description, dataWorkflowPath(row));
}
export default async function Page({ params }: Props) {
  const row = getDataWorkflow((await params).slug);
  if (!row) notFound();
  return <article className="container mx-auto w-full max-w-5xl space-y-6 px-4 py-10">
    <JsonLd data={getBreadcrumbSchema([{ name: "PDFPilot", path: "/" }, { name: "File workflows", path: "/pdf-workflows" }, { name: row.title, path: dataWorkflowPath(row) }])} />
    <nav aria-label="Breadcrumb" className="text-sm"><Link href="/pdf-workflows#data-workflows" className="underline">File workflows</Link> / {row.input.toUpperCase()} → {row.output.toUpperCase()}</nav>
    <header className="max-w-3xl"><h1 className="text-3xl font-bold md:text-4xl">{row.title}</h1><p className="mt-4 text-lg text-muted-foreground">{row.description}</p></header>
    <ol className="grid list-inside list-decimal gap-3 sm:grid-cols-2">{row.steps.map((step,i) => <li key={step} className="rounded-xl border p-4 font-medium">{step}<p className="mt-1 text-sm font-normal text-muted-foreground">{getTool("/" + row.tools[i])!.name}</p></li>)}</ol>
    <DataWorkflowRunner workflow={row} />
    <section className="max-w-3xl space-y-3"><h2 className="text-xl font-bold">What to check in the example</h2><p>{row.example}</p><a href={"/task-examples/" + row.sample} download className="inline-block text-sm text-primary underline">Download the source example</a><h2 className="pt-2 text-xl font-bold">Working with your own file</h2><p>{row.limitation}</p></section>
    <nav aria-label="Individual tools and templates"><h2 className="text-xl font-bold">Run one step on its own</h2><ul className="mt-2 space-y-2">{row.tools.map(slug => { const task = taskForTool(slug)!; return <li key={slug}><Link href={"/" + slug} className="underline">{getTool("/" + slug)!.name}</Link> · <Link href={taskPath(task)} className="text-primary underline">{task.title}</Link></li>; })}</ul></nav>
  </article>;
}
