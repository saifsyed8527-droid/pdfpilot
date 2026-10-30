interface Embedding { levels: Uint8Array; paragraphs: { start: number; end: number; level: number }[] }
export default function bidiFactory(): {
  getEmbeddingLevels(text: string, direction?: "ltr" | "rtl"): Embedding;
  getReorderedString(text: string, embedding: Embedding): string;
};
