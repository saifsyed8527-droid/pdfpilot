import { ConnectionsPage, connectionMetadata } from "@/components/connections/ConnectionsPage";
type Props = { params: Promise<{ parts?: string[] }> };
export async function generateMetadata({ params }: Props) { return connectionMetadata((await params).parts ?? [], "en"); }
export default async function Page({ params }: Props) { return <ConnectionsPage parts={(await params).parts ?? []} />; }
