"use client";

import Link from "next/link";
import { Check, Globe2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { getActiveLocales } from "@/lib/i18n/locales";
import { localizedPath, parseLocalizedPath } from "@/lib/i18n/url-strategy";
import { uiText } from "@/lib/i18n/ui-copy";

/** Crawlable links are intentional: search engines and users can reach every
 * reciprocal language version without relying on JavaScript navigation. */
export function LanguageSwitcher({ currentPathname }: { currentPathname: string }) {
  const activeLocales = getActiveLocales();
  const parsed = parseLocalizedPath(currentPathname);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => setOpen(false), [currentPathname]);
  useEffect(() => {
    if (!open) return;
    const dismissOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissEscape);
    };
  }, [open]);
  if ((!parsed.pageKey && !parsed.toolPath) || activeLocales.length <= 1) return null;

  return (
    <div ref={containerRef} className="relative" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button
        ref={buttonRef}
        type="button"
        className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Choose language"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <Globe2 className="h-4 w-4" aria-hidden />
        <span className="hidden lg:inline">{activeLocales.find((item) => item.code === parsed.locale)?.nativeName}</span>
      </button>
      {open && <div id={panelId} aria-label="Languages" className="absolute end-0 z-[70] mt-2 max-h-[min(70vh,32rem)] w-64 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain rounded-xl border bg-white p-2 shadow-xl dark:bg-slate-900">
        <p className="px-3 py-2 text-xs text-muted-foreground">{uiText(parsed.locale, "Website language")}</p>
        {activeLocales.map((locale) => (
          <Link
            key={locale.code}
            href={localizedPath(parsed.path, locale.code)}
            hrefLang={locale.code}
            lang={locale.code}
            aria-current={locale.code === parsed.locale ? "page" : undefined}
            className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted focus-visible:bg-muted ${locale.code === parsed.locale ? "font-semibold text-primary" : "text-foreground"}`}
            onClick={() => setOpen(false)}
          >
            <span>{locale.code === "en" && parsed.locale !== "en" ? "Switch to English" : locale.nativeName}</span>
            {locale.code === parsed.locale && <Check className="h-4 w-4 shrink-0" aria-hidden />}
          </Link>
        ))}
        <p className="mt-2 border-t px-3 py-2 text-xs leading-5 text-muted-foreground">{uiText(parsed.locale, "Changing the website language does not translate your documents.")}</p>
      </div>}
    </div>
  );
}
