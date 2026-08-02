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

/**
 * Groups a set of selected 0-indexed pages into consecutive runs and
 * returns them as 1-indexed [start, end] ranges, sorted ascending — the
 * inverse of `expandPageRanges`. A gap in the selection always starts a
 * new group, exactly matching how the typed "1-3,5,7-9" syntax already
 * treats a comma: this is what makes visual thumbnail selection produce
 * the same multi-file output the text field always has, with no change
 * to the splitting engine itself.
 */
export function selectedPagesToRanges(selectedZeroIndexed: Set<number>): PageRange[] {
  const sorted = [...selectedZeroIndexed].sort((a, b) => a - b);
  const ranges: PageRange[] = [];

  for (const page of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && page === last[1]) {
      // already 1-indexed end === this page's 1-indexed value; extend
      last[1] = page + 1;
    } else {
      ranges.push([page + 1, page + 1]);
    }
  }

  return ranges;
}

/** Human-readable "1-3,5,7-9" form of `selectedPagesToRanges` — used to
 *  show users the exact range string their visual selection corresponds
 *  to, so the connection between clicking thumbnails and the underlying
 *  range syntax stays transparent rather than hidden. */
export function rangesToString(ranges: PageRange[]): string {
  return ranges.map(([start, end]) => (start === end ? `${start}` : `${start}-${end}`)).join(",");
}

export type RangeParseResult = { ranges: PageRange[]; error?: undefined } | { ranges?: undefined; error: string };

/**
 * Parses AND validates a typed range string against a real page count,
 * for tools where each range becomes its own output file (Split PDF) and
 * a bad range can't be silently dropped the way `expandPageRanges` drops
 * out-of-bounds single pages — a reversed, malformed, or fully out-of-
 * bounds range here would otherwise become an empty or missing output
 * file with no explanation. Returns the first problem found, in the
 * order the user typed it, so the error always points at what they'd fix
 * first.
 *
 * A range partially past the end of the document (e.g. "8-15" in a
 * 10-page file) is clamped to the real last page rather than rejected —
 * the same forgiving handling a real product gives a typo'd upper bound,
 * consistent with `expandPageRanges`'s existing "don't punish an
 * otherwise-valid range for one bad number" behavior. Only a range with
 * no valid pages at all (start past the last page) is a real error.
 */
export function parseAndValidateRanges(input: string, totalPages: number): RangeParseResult {
  const parts = input
    .split(",")
    .map((s) => s.replace(/\s+/g, ""))
    .filter(Boolean);

  if (parts.length === 0) {
    return { error: "Enter at least one page or range." };
  }

  const ranges: PageRange[] = [];
  for (const part of parts) {
    const match = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!match) {
      return { error: `"${part}" isn't a valid page or range. Use a number like 5, or a range like 1-3.` };
    }

    const start = Number(match[1]);
    const end = match[2] !== undefined ? Number(match[2]) : start;

    if (start < 1) {
      return { error: `"${part}" isn't valid — page numbers start at 1.` };
    }
    if (start > end) {
      return { error: `"${part}" is a reverse range — the start page must come before the end page.` };
    }
    if (start > totalPages) {
      return {
        error: `"${part}" is out of range — this document only has ${totalPages} page${totalPages === 1 ? "" : "s"}.`,
      };
    }

    ranges.push([start, Math.min(end, totalPages)]);
  }

  return { ranges };
}
