import DocumentShell from "@/components/DocumentShell";
import { getLocale } from "@/lib/i18n/locales";
export { metadata, viewport } from "@/components/DocumentShell";
export default function EnglishLayout({children}: {children: React.ReactNode}) {
  return <DocumentShell locale={getLocale("en")!}>{children}</DocumentShell>;
}
