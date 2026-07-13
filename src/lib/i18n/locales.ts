/**
 * Language Registry — the single source of truth for which locales
 * PDFPilot supports, following the exact pattern every other registry in
 * this codebase already uses (TOOLS, CATEGORIES, GUIDES): one flat array,
 * every consumer derives from it, nothing hardcoded per-locale anywhere
 * else.
 *
 * Today only "en" is `active`. Every utility in src/lib/i18n/ is real and
 * functional against this registry as it stands — the only thing missing
 * for real localization is translated content and a `[locale]` route
 * segment, both explicitly out of scope for this sprint. Adding a real
 * second language later means: (1) add real translated content, (2) flip
 * `active: true` here, (3) add the `[locale]` route segment. No changes
 * needed to hreflang.ts, url-strategy.ts, or localized-metadata.ts — they
 * already handle N locales, not hardcoded for one.
 */

export interface Locale {
  /** BCP 47 language tag, lowercase — "en", "fr", "de", "es", etc. */
  code: string;
  /** English name, for internal/admin display (e.g. a future language
   *  switcher's accessible label before that language's own content
   *  exists to translate it into). */
  name: string;
  /** The name written in that language itself — what an actual switcher
   *  UI should display once one exists ("Français", not "French"). */
  nativeName: string;
  /** Right-to-left script. None of PDFPilot's initial candidate languages
   *  need this yet, but every consumer should branch on it now rather than
   *  assume ltr forever. */
  dir: "ltr" | "rtl";
  /** Whether this locale has real translated content and a live route.
   *  Every locale in this array is a real, researched candidate; `active`
   *  is what actually gates whether it's reachable — not presence in this
   *  array. */
  active: boolean;
}

/**
 * Extended for Phase 3's international rollout candidate list. Every
 * addition below is still `active: false` — this sprint prepares the
 * registry and re-verifies every consumer generalizes to the new entries
 * (in particular Arabic's `dir: "rtl"`, the first real RTL candidate in
 * this array — every i18n consumer already branched on `dir` per the note
 * above, but this is the first entry that actually exercises that branch
 * with a non-"ltr" value). No translated content, no route segment, no
 * locale made reachable — exactly the same non-change as the original 5.
 */
export const LOCALES: readonly Locale[] = [
  { code: "en", name: "English", nativeName: "English", dir: "ltr", active: true },
  { code: "es", name: "Spanish", nativeName: "Español", dir: "ltr", active: false },
  { code: "fr", name: "French", nativeName: "Français", dir: "ltr", active: false },
  { code: "de", name: "German", nativeName: "Deutsch", dir: "ltr", active: false },
  { code: "it", name: "Italian", nativeName: "Italiano", dir: "ltr", active: false },
  { code: "pt", name: "Portuguese", nativeName: "Português", dir: "ltr", active: false },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", dir: "ltr", active: false },
  { code: "ar", name: "Arabic", nativeName: "العربية", dir: "rtl", active: false },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", dir: "ltr", active: false },
  { code: "ja", name: "Japanese", nativeName: "日本語", dir: "ltr", active: false },
  { code: "ko", name: "Korean", nativeName: "한국어", dir: "ltr", active: false },
  { code: "zh", name: "Chinese", nativeName: "中文", dir: "ltr", active: false },
];

export const DEFAULT_LOCALE = "en";

export function getActiveLocales(): readonly Locale[] {
  return LOCALES.filter((locale) => locale.active);
}

export function getLocale(code: string): Locale | undefined {
  return LOCALES.find((locale) => locale.code === code);
}

export function isValidLocale(code: string): boolean {
  return LOCALES.some((locale) => locale.code === code);
}
