/** Resolve source links explicitly: a srcdoc iframe inherits the app's CSP,
 * whose base-uri restriction intentionally rejects an external <base>. */
export function htmlSourceBase(sourceUrl?: string, declaredBase?: string | null): string | undefined {
  const httpUrl = (value: string | undefined | null, base?: string) => {
    if (!value?.trim()) return undefined;
    try {
      const url = new URL(value, base);
      return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
    } catch { return undefined; }
  };
  const source = httpUrl(sourceUrl);
  return httpUrl(declaredBase, source) ?? source;
}

export function htmlSourceLink(value: string, base?: string): string | undefined {
  if (!value.trim()) return undefined;
  try {
    const url = new URL(value, base);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}
