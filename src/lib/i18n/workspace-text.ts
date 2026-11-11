export type WorkspaceDictionary = Record<string, string>;
/** Interpolate only explicit UI templates. Values (including filenames) are never translated. */
export function translateWorkspaceText(words: WorkspaceDictionary, text: string, values: readonly unknown[] = []): string {
  const translated = words[text] ?? text;
  return translated.replace(/\{(\d+)\}/g, (match, index) => Number(index) < values.length ? String(values[Number(index)] ?? "") : match);
}
