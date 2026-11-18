import DocumentShell from "@/components/DocumentShell";
import { getLocale, getLocaleBySegment } from "@/lib/i18n/locales";
export { metadata, viewport } from "@/components/DocumentShell";
/** Unknown single segments may be English pSEO routes; page resolution owns 404s. */
export default async function LocaleLayout({children, params}: {children: React.ReactNode; params: Promise<{locale:string}>}) {
  const {locale:segment} = await params;
  const locale = getLocaleBySegment(segment) ?? getLocale("en")!;
  return <DocumentShell locale={locale}>{children}</DocumentShell>;
}
