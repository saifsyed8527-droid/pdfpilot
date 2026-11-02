export interface BidiLayout {
  getEmbeddingLevels(
    text: string,
    direction?: "ltr" | "rtl",
  ): {
    levels: Uint8Array;
    paragraphs: { start: number; end: number; level: number }[];
  };
  getReorderedIndices(
    text: string,
    embedding: ReturnType<BidiLayout["getEmbeddingLevels"]>,
  ): number[];
  getReorderedString(
    text: string,
    embedding: ReturnType<BidiLayout["getEmbeddingLevels"]>,
  ): string;
}
/** Keep logical strings for font shaping; only reorder styled fragments into
 * visual positions. Split mixed-direction words at grapheme/embedding boundaries
 * so an Arabic word followed by digits never reverses the number. */
export function visualPptxRuns<T extends { text: string }>(
  runs: T[],
  bidi?: BidiLayout,
  direction?: "ltr" | "rtl",
): T[] {
  const text = runs.map((run) => run.text).join("");
  if (!bidi || !/[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(text)) return runs;
  const embedding = bidi.getEmbeddingLevels(text, direction),
    order = bidi.getReorderedIndices(text, embedding);
  const ranks = new Map(order.map((original, visual) => [original, visual]));
  const pieces: { run: T; start: number; level: number; rank: number }[] = [];
  let start = 0;
  for (const run of runs) {
    let previous: (typeof pieces)[number] | undefined;
    for (const { segment } of new Intl.Segmenter(undefined, {
      granularity: "grapheme",
    }).segment(run.text)) {
      const level = embedding.levels[start] ?? 0;
      if (previous && previous.level === level) previous.run.text += segment;
      else {
        previous = {
          run: { ...run, text: segment },
          start,
          level,
          rank: Infinity,
        };
        pieces.push(previous);
      }
      for (let i = 0; i < segment.length; i++)
        previous.rank = Math.min(previous.rank, ranks.get(start + i) ?? 0);
      start += segment.length;
    }
  }
  return pieces.sort((a, b) => a.rank - b.rank).map((piece) => piece.run);
}
