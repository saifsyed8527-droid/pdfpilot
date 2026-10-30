export const OCR_LANGUAGES = [
  ["eng", "English"], ["ara", "Arabic — العربية"], ["ben", "Bengali — বাংলা"],
  ["chi_sim", "Chinese, simplified — 简体中文"], ["chi_tra", "Chinese, traditional — 繁體中文"],
  ["ces", "Czech — Čeština"], ["dan", "Danish — Dansk"], ["nld", "Dutch — Nederlands"],
  ["fin", "Finnish — Suomi"], ["fra", "French — Français"], ["deu", "German — Deutsch"],
  ["ell", "Greek — Ελληνικά"], ["guj", "Gujarati — ગુજરાતી"], ["heb", "Hebrew — עברית"],
  ["hin", "Hindi — हिन्दी"], ["hun", "Hungarian — Magyar"], ["ind", "Indonesian — Bahasa Indonesia"],
  ["ita", "Italian — Italiano"], ["jpn", "Japanese — 日本語"], ["kan", "Kannada — ಕನ್ನಡ"],
  ["kor", "Korean — 한국어"], ["mal", "Malayalam — മലയാളം"], ["mar", "Marathi — मराठी"],
  ["nep", "Nepali — नेपाली"], ["nor", "Norwegian — Norsk"], ["fas", "Persian — فارسی"],
  ["pol", "Polish — Polski"], ["por", "Portuguese — Português"], ["pan", "Punjabi — ਪੰਜਾਬੀ"],
  ["ron", "Romanian — Română"], ["rus", "Russian — Русский"], ["slk", "Slovak — Slovenčina"],
  ["spa", "Spanish — Español"], ["swe", "Swedish — Svenska"], ["tam", "Tamil — தமிழ்"],
  ["tel", "Telugu — తెలుగు"], ["tha", "Thai — ไทย"], ["tur", "Turkish — Türkçe"],
  ["ukr", "Ukrainian — Українська"], ["urd", "Urdu — اردو"], ["vie", "Vietnamese — Tiếng Việt"],
] as const;
export type OcrLanguage = typeof OCR_LANGUAGES[number][0];
export interface OcrOptions { languages?: readonly string[]; pages?: string; dpi?: number }
/** Tesseract separates CJK tokens with Latin word spaces. Join adjacent CJK
 * letters for readable/searchable Chinese and Japanese, retaining line breaks,
 * numbers, Latin text and Korean's meaningful word spaces. */
export function normalizeOcrText(text: string, languages: readonly string[]) {
  return languages.some(code => ["chi_sim", "chi_tra", "jpn"].includes(code))
    ? text.replace(/([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])[ \t]+(?=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/gu, "$1") : text;
}
export function ocrLanguages(languages?: readonly string[]): OcrLanguage[] {
  const selected = [...new Set(languages ?? ["eng"])];
  if (!selected.length || selected.length > 3 || selected.some(code => !OCR_LANGUAGES.some(([id]) => id === code))) throw new Error("Choose one to three document languages.");
  return selected as OcrLanguage[];
}
/** Strict page selection: an out-of-range number is never silently dropped. */
export function ocrPages(selection: string | undefined, total: number): number[] {
  if (!Number.isInteger(total) || total < 1 || total > 2000) throw new Error("Choose a PDF with 1–2,000 pages.");
  if (!selection?.trim()) { if (total > 200) throw new Error("Choose up to 200 pages for each OCR run."); return Array.from({ length: total }, (_, i) => i); }
  if (selection.length > 2000) throw new Error("Page selection is too long.");
  const selected = new Set<number>();
  for (const part of selection.split(",")) {
    const match = part.trim().match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if (!match) throw new Error("Enter pages like 1-3, 5, 8-10.");
    const start = Number(match[1]), end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start || end > total) throw new Error(`Choose pages between 1 and ${total}, with each range in ascending order.`);
    for (let page = start; page <= end; page++) { selected.add(page - 1); if (selected.size > 200) throw new Error("Choose up to 200 pages for each OCR run."); }
  }
  return [...selected].sort((a, b) => a - b);
}
