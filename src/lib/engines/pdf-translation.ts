import type { ExtractedPage } from "../pdf-text-extraction";

// Browser-supported pairs are checked at runtime; the menu is not a promise
// that every pair is installed or available on every device.
export const TRANSLATION_LANGUAGES = [
  ["ar", "Arabic — العربية", "ara"],
  ["bg", "Bulgarian — Български", ""],
  ["bn", "Bengali — বাংলা", "ben"],
  ["cs", "Czech — Čeština", "ces"],
  ["da", "Danish — Dansk", "dan"],
  ["de", "German — Deutsch", "deu"],
  ["el", "Greek — Ελληνικά", "ell"],
  ["en", "English", "eng"],
  ["es", "Spanish — Español", "spa"],
  ["fi", "Finnish — Suomi", "fin"],
  ["fr", "French — Français", "fra"],
  ["he", "Hebrew — עברית", "heb"],
  ["hi", "Hindi — हिन्दी", "hin"],
  ["hr", "Croatian — Hrvatski", ""],
  ["hu", "Hungarian — Magyar", "hun"],
  ["id", "Indonesian — Bahasa Indonesia", "ind"],
  ["it", "Italian — Italiano", "ita"],
  ["ja", "Japanese — 日本語", "jpn"],
  ["kn", "Kannada — ಕನ್ನಡ", "kan"],
  ["ko", "Korean — 한국어", "kor"],
  ["lt", "Lithuanian — Lietuvių", ""],
  ["mr", "Marathi — मराठी", "mar"],
  ["nl", "Dutch — Nederlands", "nld"],
  ["no", "Norwegian — Norsk", "nor"],
  ["pl", "Polish — Polski", "pol"],
  ["pt", "Portuguese — Português", "por"],
  ["ro", "Romanian — Română", "ron"],
  ["ru", "Russian — Русский", "rus"],
  ["sk", "Slovak — Slovenčina", "slk"],
  ["sl", "Slovenian — Slovenščina", ""],
  ["sv", "Swedish — Svenska", "swe"],
  ["ta", "Tamil — தமிழ்", "tam"],
  ["te", "Telugu — తెలుగు", "tel"],
  ["th", "Thai — ไทย", "tha"],
  ["tr", "Turkish — Türkçe", "tur"],
  ["uk", "Ukrainian — Українська", "ukr"],
  ["vi", "Vietnamese — Tiếng Việt", "vie"],
  ["zh", "Chinese, simplified — 简体中文", "chi_sim"],
  ["zh-Hant", "Chinese, traditional — 繁體中文", "chi_tra"],
] as const;
export type TranslationAvailability =
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable";
export interface LocalTranslator {
  translate(text: string, options?: { signal?: AbortSignal }): Promise<string>;
  destroy(): void;
}
export interface BrowserTranslatorApi {
  availability(options: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<TranslationAvailability>;
  create(options: {
    sourceLanguage: string;
    targetLanguage: string;
    signal: AbortSignal;
    monitor?: (monitor: {
      addEventListener(
        type: "downloadprogress",
        listener: (event: { loaded: number }) => void,
      ): void;
    }) => void;
  }): Promise<LocalTranslator>;
}
export function browserTranslator(): BrowserTranslatorApi | undefined {
  return typeof window === "undefined"
    ? undefined
    : (window as unknown as { Translator?: BrowserTranslatorApi }).Translator;
}
export class TranslationInputError extends Error {}
export function translationPair(
  sourceLanguage: string,
  targetLanguage: string,
) {
  if (
    ![sourceLanguage, targetLanguage].every((code) =>
      TRANSLATION_LANGUAGES.some(([id]) => id === code),
    )
  )
    throw new TranslationInputError(
      "Choose supported source and target languages.",
    );
  if (sourceLanguage === targetLanguage)
    throw new TranslationInputError("Choose a different target language.");
  return { sourceLanguage, targetLanguage };
}
export function checkTranslation(signal?: AbortSignal) {
  if (signal?.aborted)
    throw new DOMException("Translation cancelled.", "AbortError");
}
/** Split at sentence/word boundaries with a hard UTF-16 bound, preserving
 * every source character and keeping Unicode graphemes intact. */
export function translationChunks(
  text: string,
  language: string,
  maximum = 1500,
): string[] {
  if (!Number.isInteger(maximum) || maximum < 16 || maximum > 4000)
    throw new TranslationInputError("Invalid translation chunk size.");
  if (text.length > 200_000)
    throw new TranslationInputError(
      "A paragraph is too long. Choose a smaller section.",
    );
  const chunks: string[] = [];
  let chunk = "";
  const append = (value: string) => {
    if (value.length > maximum) {
      for (const { segment } of new Intl.Segmenter(language, {
        granularity: "grapheme",
      }).segment(value)) {
        if (segment.length > maximum)
          throw new TranslationInputError(
            "A text cluster is too long to translate. Simplify this paragraph.",
          );
        if (chunk.length + segment.length > maximum) {
          chunks.push(chunk);
          chunk = "";
        }
        chunk += segment;
      }
    } else {
      if (chunk.length + value.length > maximum) {
        chunks.push(chunk);
        chunk = "";
      }
      chunk += value;
    }
  };
  for (const { segment } of new Intl.Segmenter(language, {
    granularity: "sentence",
  }).segment(text)) {
    if (segment.length <= maximum) append(segment);
    else
      for (const { segment: word } of new Intl.Segmenter(language, {
        granularity: "word",
      }).segment(segment))
        append(word);
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

export interface TranslatedPage {
  pageNumber: number;
  original: string[];
  translated: string[];
  paragraphStyles: ExtractedPage["paragraphStyles"];
}
export async function translatePages(
  pages: ExtractedPage[],
  translator: LocalTranslator,
  options: {
    sourceLanguage: string;
    targetLanguage: string;
    signal?: AbortSignal;
    onProgress?: (value: number) => void;
    onStatus?: (message: string) => void;
  },
): Promise<TranslatedPage[]> {
  translationPair(options.sourceLanguage, options.targetLanguage);
  checkTranslation(options.signal);
  if (!pages.length || pages.length > 50)
    throw new TranslationInputError(
      "Choose 1–50 source pages per translation.",
    );
  const characters = pages.reduce(
    (sum, page) => sum + page.paragraphs.join("\n").length,
    0,
  );
  if (characters > 200_000)
    throw new TranslationInputError(
      "Choose fewer pages: translate up to 200,000 text characters at a time.",
    );
  if (
    !pages.some((page) => page.paragraphs.some((p) => /[\p{L}\p{N}]/u.test(p)))
  )
    throw new TranslationInputError(
      "No readable text was found. Enable OCR for scanned pages.",
    );
  let processed = 0,
    outputCharacters = 0;
  const result: TranslatedPage[] = [];
  for (const page of pages) {
    const translated: string[] = [];
    options.onStatus?.(`Translating source page ${page.pageNumber}…`);
    for (const text of page.paragraphs) {
      const parts: string[] = [];
      for (const chunk of translationChunks(text, options.sourceLanguage)) {
        checkTranslation(options.signal);
        let value = chunk;
        if (chunk.trim())
          value = await translator.translate(chunk, { signal: options.signal });
        checkTranslation(options.signal);
        if (typeof value !== "string" || (chunk.trim() && !value.trim()))
          throw new TranslationInputError(
            `Translation returned no text on page ${page.pageNumber}. Retry with fewer pages.`,
          );
        outputCharacters += value.length;
        if (outputCharacters > 1_000_000)
          throw new TranslationInputError(
            "The translated text is too large. Choose fewer pages.",
          );
        parts.push(value.trim());
        processed += chunk.length;
        options.onProgress?.(
          Math.min(100, (processed / Math.max(characters, 1)) * 100),
        );
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      translated.push(
        parts.join(
          ["zh", "zh-Hant", "ja"].includes(options.targetLanguage) ? "" : " ",
        ),
      );
    }
    result.push({
      pageNumber: page.pageNumber,
      original: [...page.paragraphs],
      translated,
      paragraphStyles: [...page.paragraphStyles],
    });
  }
  checkTranslation(options.signal);
  options.onProgress?.(100);
  return result;
}

export function translatedText(
  pages: TranslatedPage[],
  bilingual = false,
): string {
  return (
    pages
      .map(
        (p) =>
          `Source page ${p.pageNumber}\n\n${bilingual ? `Original\n${p.original.join("\n\n")}\n\nTranslation\n` : ""}${p.translated.join("\n\n") || "[No readable text on this page]"}`,
      )
      .join("\n\n\f\n\n") + "\n"
  );
}
export function translatedWordPages(
  pages: TranslatedPage[],
  bilingual = false,
): ExtractedPage[] {
  return pages.map((p) => ({
    pageNumber: p.pageNumber,
    paragraphs: [
      `Source page ${p.pageNumber}`,
      ...(bilingual ? ["Original", ...p.original, "Translation"] : []),
      ...(p.translated.length
        ? p.translated
        : ["No readable text on this page."]),
    ],
    paragraphStyles: [
      "heading2",
      ...(bilingual
        ? ["heading2" as const, ...p.paragraphStyles, "heading2" as const]
        : []),
      ...(p.translated.length ? p.paragraphStyles : ["body" as const]),
    ],
  }));
}

export function translationError(error: unknown): string {
  if (error instanceof TranslationInputError) return error.message;
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError")
    return "Your browser could not prepare translation. Click Translate again, and allow its language-pack download if prompted.";
  if (name === "NotSupportedError")
    return "This browser does not support this language pair. Choose another pair or use a supported desktop browser.";
  if (name === "NetworkError")
    return "The language pack could not download. Check your connection and retry.";
  if (name === "QuotaExceededError")
    return "This text exceeds the browser's translation limit. Try fewer pages.";
  return "Translation could not finish. Check the document languages and try fewer pages or a clearer PDF.";
}
