import Link from "next/link";
import { DocumentTemplateCollection } from "@/components/templates/DocumentTemplateCollection";
import { pseoMetadata } from "@/lib/content/pseo-metadata";
export const metadata = pseoMetadata("Free Editable PDF Templates", "Create planners, meeting agendas, checklists, invoices and logs. Customise online and download free fillable PDF templates in A4 or Letter.", "/templates");
export default function Page() { return <><nav aria-label="Template libraries" className="container mx-auto flex max-w-6xl flex-wrap gap-4 px-4 pt-6 text-sm font-semibold text-primary"><Link href="/templates/tasks" className="underline">Browse file task templates</Link><Link href="/pdf-workflows" className="underline">Run a two-step workflow</Link></nav><DocumentTemplateCollection /></>; }
