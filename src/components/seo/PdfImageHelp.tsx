import Link from "next/link";
import { CORE_COPY, getLocalizedToolContent } from "@/lib/i18n/core-content";
import { PDF_IMAGE_COPY, PDF_IMAGE_LIMITS } from "@/lib/i18n/pdf-image-copy";
import { localizedCorePath } from "@/lib/i18n/url-strategy";
import type { LocaleCode } from "@/lib/i18n/locales";
import { getToolIntents } from "@/lib/pseo/registry";

/** Shared server-rendered content and layout for every language, including working intent links. */
export function PdfImageHelp({ locale }: { locale: LocaleCode }) {
  const copy = PDF_IMAGE_COPY[locale], common = CORE_COPY[locale].common;
  const content = getLocalizedToolContent(locale, "pdfToJpg");
  const intents = getToolIntents("pdf-to-jpg", 12, locale);
  return <section lang={locale} className="border-t bg-background px-4 py-12">
    <div className="mx-auto max-w-5xl space-y-10">
      <div><h2 className="text-2xl font-semibold tracking-tight">{common.how}</h2><p className="mt-4 leading-7 text-muted-foreground">{copy.workflow}</p></div>
      <div className="grid gap-4 md:grid-cols-3">{[{ title: copy.pages, text: copy.pageHelp, detail: `${copy.high} / ${copy.standard}` }, { title: copy.images, text: copy.imageHelp, detail: copy.extractNote }, { title: copy.qualityTitle, text: copy.qualityNote, detail: copy.privacy }].map(card => <article key={card.title} className="rounded-xl border bg-slate-50/50 p-5 dark:bg-slate-900/50"><h3 className="text-lg font-semibold">{card.title}</h3><p className="mt-3 text-sm leading-6">{card.text}</p><p className="mt-3 text-sm leading-6 text-muted-foreground">{card.detail}</p></article>)}</div>
      <p className="rounded-xl border p-4 text-sm leading-6 text-muted-foreground">{PDF_IMAGE_LIMITS[locale]}</p>
      <div><h2 className="text-2xl font-semibold">{common.faq}</h2><dl className="mt-5 space-y-5">{content.faqs.map(faq => <div key={faq.question}><dt className="font-semibold">{faq.question}</dt><dd className="mt-2 leading-7 text-muted-foreground">{faq.answer}</dd></div>)}</dl></div>
      <nav aria-label={content.title} className="grid gap-3 sm:grid-cols-2">
        {intents.map(page => <Link className="rounded-xl border p-4 hover:bg-muted" key={page.slug} href={new URL(page.canonicalUrl).pathname} hrefLang={locale}><span className="font-semibold">{page.h1}</span><span className="mt-2 block text-sm text-muted-foreground">{page.intro}</span></Link>)}
        {(["jpgToPdf", "split"] as const).map(key => <Link className="rounded-xl border p-4 font-medium hover:bg-muted" key={key} href={localizedCorePath(key, locale)}>{getLocalizedToolContent(locale, key).title} →</Link>)}
      </nav>
    </div>
  </section>;
}
