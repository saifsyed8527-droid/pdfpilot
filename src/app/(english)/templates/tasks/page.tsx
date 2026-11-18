import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { getTool } from "@/lib/tools";
import { TaskDirectory } from "@/components/templates/TaskDirectory";
import { TASK_ROOT, TASK_TEMPLATES, taskPath } from "@/lib/content/task-templates";
import { collectionSchema, pseoMetadata } from "@/lib/content/pseo-metadata";
import { getBreadcrumbSchema } from "@/lib/seo";

const title = "File task templates";
export const metadata = pseoMetadata(title, "Choose a PDF, image or data task. Open a working tool, download a practice file and compare your output with a concrete example.", TASK_ROOT);
export default function Page() {
  const cards = TASK_TEMPLATES.map(task => {
    const tool = getTool("/" + task.tool)!;
    return { path: taskPath(task), title: task.title, purpose: task.purpose, tool: tool.name, group: tool.domain === "image" ? "images" : tool.domain === "data" ? "data" : "documents" };
  });
  return <article className="container mx-auto max-w-6xl px-4 py-10">
    <JsonLd data={[collectionSchema(title, TASK_ROOT, TASK_TEMPLATES.map(task => ({ title: task.title, path: taskPath(task) }))), getBreadcrumbSchema([{ name: "PDFPilot", path: "/" }, { name: "Templates", path: "/templates" }, { name: title, path: TASK_ROOT }])]} />
    <nav aria-label="Breadcrumb" className="mb-4 text-sm"><Link href="/templates" className="underline">Templates</Link> / File tasks</nav>
    <h1 className="text-4xl font-bold">File task templates</h1>
    <p className="mt-4 max-w-3xl text-lg text-muted-foreground">Choose the result you need. Each task includes practice files, the actual tool and a check you can repeat on your own output.</p>
    <p className="mt-3"><Link className="text-primary underline" href="/pdf-workflows">Browse workflows that run two steps together</Link></p>
    <TaskDirectory cards={cards} />
  </article>;
}
