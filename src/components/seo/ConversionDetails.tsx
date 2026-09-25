import Link from "next/link";
import { conversionCopy, type ConversionToolSlug } from "@/lib/i18n/conversion-copy";
import { getLocale, type LocaleCode } from "@/lib/i18n/locales";
import { getConversionWorkflows } from "@/lib/content/conversion-workflows";

/** Below the unchanged workspace. This copy is server rendered, never document content. */
export function ConversionDetails({ tool, locale = "en" }: { tool: ConversionToolSlug; locale?: LocaleCode }) {
  const copy = conversionCopy(locale, tool);
  return <section data-conversion-details={tool} lang={locale} dir={getLocale(locale)?.dir} className="border-t bg-background px-4 py-12 text-foreground">
    <div className="mx-auto max-w-4xl space-y-8">
      <div><h2 className="text-2xl font-semibold">{copy.how}</h2><p className="mt-3 text-muted-foreground">{copy.description}</p><ol className="mt-4 list-decimal space-y-2 ps-6">{copy.steps.map(step => <li key={step}>{step}</li>)}</ol></div>
      <div><h2 className="text-xl font-semibold">{copy.check}</h2><p className="mt-3 leading-relaxed text-muted-foreground">{copy.limitations}</p></div>
      <nav aria-label={copy.workflows}><h2 className="text-xl font-semibold">{copy.workflows}</h2><ul className="mt-4 grid gap-3 sm:grid-cols-2" lang="en" dir="ltr">{getConversionWorkflows(tool).map(page => <li key={page.slug}><Link href={page.path} hrefLang="en" className="underline underline-offset-4 hover:text-primary">{page.title}</Link></li>)}</ul></nav>
    </div>
  </section>;
}
