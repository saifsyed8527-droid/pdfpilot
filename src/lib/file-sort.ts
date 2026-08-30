/** Shared alphabetical file sorting for multi-file tool workflows (merge,
 *  batch image-to-PDF, etc.) — one implementation so every tool's A→Z / Z→A
 *  buttons behave identically. Uses `localeCompare` with numeric collation
 *  so "file2.pdf" sorts before "file10.pdf" rather than after it. */
export function sortFilesByName<T extends { name: string }>(
  files: T[],
  direction: "asc" | "desc"
): T[] {
  const sorted = [...files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
  );
  return direction === "desc" ? sorted.reverse() : sorted;
}
