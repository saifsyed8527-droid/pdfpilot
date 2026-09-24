import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { CORE_COPY, getCorePageKeyFromPath, getLocalizedToolContent, type CoreToolKey, type LocalizedToolContent } from "@/lib/i18n/core-content";
import type { LocaleCode } from "@/lib/i18n/locales";
import { localizedToolPath } from "@/lib/i18n/url-strategy";
import { getLocalizedToolDescription, getLocalizedToolLabels } from "@/lib/i18n/localized-tools";
import type { Tool } from "@/lib/tools";
import { TOOLS } from "@/lib/tools";
import { MergePdfClient } from "@/app/merge-pdf/merge-pdf-client";
import { SplitPdfClient } from "@/app/split-pdf/split-pdf-client";
import { CompressPdfClient } from "@/app/compress-pdf/compress-pdf-client";
import { PdfToJpgClient } from "@/app/pdf-to-jpg/pdf-to-jpg-client";
import { JpgToPdfClient } from "@/app/jpg-to-pdf/jpg-to-pdf-client";

export function LocalizedHome({ locale }: { locale: LocaleCode }) {
  const copy = CORE_COPY[locale];
  return (
    <div className="bg-slate-50/70 dark:bg-slate-950/40">
      <section className="container mx-auto max-w-5xl px-4 py-20 text-center md:py-28">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-red-600">PDFPilot</p>
        <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight text-slate-950 dark:text-white md:text-6xl">{copy.home.h1}</h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">{copy.home.intro}</p>
      </section>

      <section className="container mx-auto max-w-6xl px-4 pb-20" aria-labelledby="localized-tools-heading">
        <h2 id="localized-tools-heading" className="mb-8 text-center text-3xl font-bold tracking-tight">{copy.home.toolsHeading}</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => {
            const key = getCorePageKeyFromPath(tool.path);
            const content = key && key !== "home" ? getLocalizedToolContent(locale, key) : null;
            const Icon = tool.icon;
            return (
              <Link key={tool.slug} href={localizedToolPath(tool.slug, locale)} className="group rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-red-300 hover:shadow-lg dark:bg-slate-900">
                <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/40"><Icon className="h-6 w-6" aria-hidden /></span>
                <h3 className="text-xl font-semibold group-hover:text-red-600">{content?.title ?? tool.name}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{content?.description ?? getLocalizedToolDescription(tool, locale)}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="border-y bg-white dark:bg-slate-900">
        <div className="container mx-auto flex max-w-4xl flex-col items-center px-4 py-16 text-center">
          <ShieldCheck className="h-12 w-12 text-emerald-600" aria-hidden />
          <h2 className="mt-5 text-3xl font-bold">{copy.home.privacyHeading}</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">{copy.home.privacyBody}</p>
        </div>
      </section>
    </div>
  );
}

function ToolClient({ tool }: { tool: LocalizedToolContent }) {
  switch (tool.key) {
    case "merge": return <MergePdfClient landingCopy={tool} />;
    case "split": return <SplitPdfClient landingCopy={tool} />;
    case "compress": return <CompressPdfClient landingCopy={tool} />;
    case "pdfToJpg": return <PdfToJpgClient landingCopy={tool} />;
    case "jpgToPdf": return <JpgToPdfClient landingCopy={tool} />;
  }
}

export function LocalizedToolPage({ locale, toolKey }: { locale: LocaleCode; toolKey: CoreToolKey }) {
  const copy = CORE_COPY[locale];
  const tool = getLocalizedToolContent(locale, toolKey);
  return (
    <>
      <ToolClient tool={tool} />
      <section className="border-t bg-white py-16 dark:bg-slate-950" aria-labelledby="localized-how-heading">
        <div className="container mx-auto max-w-5xl px-4">
          <h2 id="localized-how-heading" className="text-center text-3xl font-bold">{copy.common.how}</h2>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {tool.steps.map((step, index) => (
              <li key={step} className="rounded-2xl border bg-slate-50 p-6 dark:bg-slate-900">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 font-bold text-white">{index + 1}</span>
                <p className="mt-4 leading-7">{step}</p>
              </li>
            ))}
          </ol>
          <h2 className="mt-16 text-center text-3xl font-bold">{copy.common.faq}</h2>
          <div className="mx-auto mt-8 max-w-3xl divide-y rounded-2xl border px-6">
            {tool.faqs.map((faq) => (
              <details key={faq.question} className="group py-5">
                <summary className="cursor-pointer font-semibold">{faq.question}</summary>
                <p className="mt-3 leading-7 text-muted-foreground">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

/** SEO landing shell for every non-core tool in every active locale. The
 * canonical application remains the proven English tool route; this page
 * supplies genuinely locale-scoped crawlable copy, metadata, FAQs and a clear
 * hand-off into the interactive tool instead of publishing a thin duplicate. */
export function LocalizedGenericToolPage({ locale, tool }: { locale: LocaleCode; tool: Tool }) {
  const labels = getLocalizedToolLabels(locale);
  const description = getLocalizedToolDescription(tool, locale);
  const steps = [labels.stepOne, labels.stepTwo, labels.stepThree];
  return (
    <main dir={locale === "ar" ? "rtl" : "ltr"} className="bg-slate-50/70 dark:bg-slate-950/40">
      <section className="container mx-auto max-w-4xl px-4 py-16 text-center md:py-24">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-red-600">PDFPilot · {labels.private}</p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white md:text-5xl">{tool.name} — {labels.free} {labels.online}</h1>
        <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">{description}</p>
        <Link href={tool.path} className="mt-8 inline-flex rounded-xl bg-red-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-red-700">{labels.useTool}</Link>
      </section>
      <section className="border-y bg-white dark:bg-slate-900" aria-labelledby="localized-tool-overview">
        <div className="container mx-auto max-w-5xl px-4 py-14">
          <h2 id="localized-tool-overview" className="text-3xl font-bold">{labels.overview}</h2>
          <p className="mt-4 max-w-3xl leading-8 text-muted-foreground">{description}</p>
          <h2 className="mt-12 text-3xl font-bold">{labels.stepsHeading}</h2>
          <ol className="mt-8 grid gap-5 md:grid-cols-3">
            {steps.map((step, index) => <li key={step} className="rounded-2xl border bg-slate-50 p-6 dark:bg-slate-950"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 font-bold text-white">{index + 1}</span><p className="mt-4 leading-7">{step}</p></li>)}
          </ol>
          <h2 className="mt-14 text-3xl font-bold">{labels.faqHeading}</h2>
          <div className="mx-auto mt-6 max-w-3xl divide-y rounded-2xl border px-6">
            <details className="py-5"><summary className="cursor-pointer font-semibold">{labels.faqFree}</summary><p className="mt-3 leading-7 text-muted-foreground">{labels.faqFreeAnswer}</p></details>
            <details className="py-5"><summary className="cursor-pointer font-semibold">{labels.faqInstall}</summary><p className="mt-3 leading-7 text-muted-foreground">{labels.faqInstallAnswer}</p></details>
          </div>
        </div>
      </section>
    </main>
  );
}
