export type PageRange = [number, number];

/**
 * Parses a page-range string like "1-3,5,7-9" into [start, end] pairs
 * (1-indexed, inclusive). Extracted from Split PDF's original inline
 * implementation — shared by every tool that accepts typed page ranges
 * (Split, Delete Pages, Extract Pages) so the syntax and its edge cases
 * stay identical everywhere instead of drifting per tool.
 */
export function parsePageRanges(input: string): PageRange[] {
  const ranges: PageRange[] = [];
  const parts = input.split(",").map((s) => s.trim()).filter(Boolean);

  parts.forEach((part) => {
    if (part.includes("-")) {
      const [start, end] = part.split("-").map(Number);
      ranges.push([start, end]);
    } else {
      const page = Number(part);
      ranges.push([page, page]);
    }
  });

  return ranges;
}

/**
 * Expands parsed ranges into a deduplicated, ascending list of valid
 * 0-indexed page numbers. Page numbers outside the document's actual page
 * count are silently dropped — the same "skip, don't error" behavior Split
 * PDF has always had, now shared instead of reimplemented per tool.
 */
export function expandPageRanges(ranges: PageRange[], totalPages: number): number[] {
  const pages = new Set<number>();

  for (const [start, end] of ranges) {
    for (let page = start; page <= end; page++) {
      if (page > 0 && page <= totalPages) {
        pages.add(page - 1);
      }
    }
  }

  return [...pages].sort((a, b) => a - b);
}
