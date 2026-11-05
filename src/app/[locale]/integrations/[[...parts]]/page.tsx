import { notFound } from "next/navigation";
import { ConnectionsPage, connectionMetadata } from "@/components/connections/ConnectionsPage";
import { getLocaleBySegment } from "@/lib/i18n/locales";
type Props = { params: Promise<{ locale: string; parts?: string[] }> };
function language(segment: string) { const locale = getLocaleBySegment(segment); if (!locale?.active || locale.code === "en") notFound(); return locale.code; }
export async function generateMetadata({ params }: Props) { const values = await params; return connectionMetadata(values.parts ?? [], language(values.locale)); }
export default async function Page({ params }: Props) { const values = await params; return <ConnectionsPage parts={values.parts ?? []} locale={language(values.locale)} />; }
