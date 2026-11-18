import { notFound } from "next/navigation";
import { DOCUMENT_CATEGORIES, type DocumentTemplate } from "@/lib/content/document-templates";
import { DocumentTemplateCollection } from "@/components/templates/DocumentTemplateCollection";
import { pseoMetadata } from "@/lib/content/pseo-metadata";
type Props = { params: Promise<{ category: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return Object.keys(DOCUMENT_CATEGORIES).map(category => ({ category })); }
function getCategory(key: string) { return Object.prototype.hasOwnProperty.call(DOCUMENT_CATEGORIES, key) ? key as DocumentTemplate["category"] : undefined; }
export async function generateMetadata({ params }: Props) { const key = getCategory((await params).category); return key ? pseoMetadata(DOCUMENT_CATEGORIES[key].title, DOCUMENT_CATEGORIES[key].description, `/templates/collections/${key}`) : {}; }
export default async function Page({ params }: Props) { const key = getCategory((await params).category); if (!key) notFound(); return <DocumentTemplateCollection category={key} />; }
