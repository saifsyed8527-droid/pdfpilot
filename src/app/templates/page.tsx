import { DocumentTemplateCollection } from "@/components/templates/DocumentTemplateCollection";
import { pseoMetadata } from "@/lib/content/pseo-metadata";
export const metadata = pseoMetadata("Free Editable PDF Templates", "Create planners, meeting agendas, checklists, invoices and logs. Customise online and download free fillable PDF templates in A4 or Letter.", "/templates");
export default function Page() { return <DocumentTemplateCollection />; }
