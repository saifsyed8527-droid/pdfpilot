"use client";

import Link from "next/link";
import { Globe2 } from "lucide-react";
import { getActiveLocales } from "@/lib/i18n/locales";
import { localizedCorePath, parseLocalizedPath } from "@/lib/i18n/url-strategy";

/** Crawlable links are intentional: search engines and users can reach every
 * reciprocal language version without relying on JavaScript navigation. */
export function LanguageSwitcher({ currentPathname }: { currentPathname: string }) {
  const activeLocales = getActiveLocales();
  const parsed = parseLocalizedPath(currentPathname);
  if (!parsed.pageKey || activeLocales.length <= 1) return null;

  return (
    <details className="relative">
      <summary
        className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Choose language"
      >
        <Globe2 className="h-4 w-4" aria-hidden />
        <span className="hidden lg:inline">{activeLocales.find((item) => item.code === parsed.locale)?.nativeName}</span>
      </summary>
      <div className="absolute right-0 z-[70] mt-2 min-w-52 rounded-xl border bg-white p-2 shadow-xl dark:bg-slate-900">
        {activeLocales.map((locale) => (
          <Link
            key={locale.code}
            href={localizedCorePath(parsed.pageKey!, locale.code)}
            hrefLang={locale.code}
            lang={locale.code}
            className={`block rounded-lg px-3 py-2 text-sm hover:bg-muted ${locale.code === parsed.locale ? "font-semibold text-primary" : "text-foreground"}`}
          >
            {locale.nativeName}
          </Link>
        ))}
      </div>
    </details>
  );
}
