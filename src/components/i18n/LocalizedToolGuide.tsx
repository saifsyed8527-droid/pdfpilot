import Link from "next/link";
import { catalogGuidance } from "@/lib/i18n/catalog-copy";
import { localizedToolName } from "@/lib/i18n/ui-copy";
import { localizedToolPath } from "@/lib/i18n/url-strategy";
import type { LocaleCode } from "@/lib/i18n/locales";
import { TOOLS, type Tool } from "@/lib/tools";

export function LocalizedToolGuide({ tool, locale }: { tool: Tool; locale: LocaleCode }) {
  if (locale === "en") return null;
  const guide = catalogGuidance(tool.slug, locale);
  const related = tool.relatedTools.map(id => TOOLS.find(item => item.id === id)).filter(item => item !== undefined);
  return <section lang={locale} className="container mx-auto max-w-5xl space-y-4 px-4 py-8">
    <h2 className="text-xl font-semibold">{guide.check}</h2>
    <p className="leading-relaxed">{guide.note}</p>
    {related.length > 0 && <nav aria-label={guide.related}>
      <h3 className="font-semibold">{guide.related}</h3>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
        {related.map(item => <li key={item.slug}><Link prefetch={false} className="underline" href={localizedToolPath(item.slug, locale)}>{localizedToolName(item.slug, locale, item.name)}</Link></li>)}
      </ul>
    </nav>}
  </section>;
}
