/**
 * Browser-native extractive PDF summarization. No LLM, no server calls,
 * no API keys — 100% client-side, using TF-IDF-style sentence scoring.
 *
 * Extractive (not abstractive) means the summary is made of real sentences
 * pulled straight from the document, ordered as they originally appeared.
 * No invented facts, no hallucinations, no style rewrite — just the most
 * representative sentences from the source text. This is called out
 * explicitly in the tool's UI rather than being presented as an AI that
 * "understands" your document.
 */

import { extractPdfText, hasNoExtractableText } from "../pdf-text-extraction";

const ENGLISH_STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "for",
  "from", "has", "had", "have", "he", "in", "is", "it", "its", "of", "on",
  "that", "the", "to", "was", "were", "will", "with", "this", "they",
  "you", "your", "we", "our", "their", "which", "who", "what", "when",
  "where", "how", "why", "can", "could", "should", "would", "may",
  "might", "must", "shall", "do", "does", "did", "done", "just",
  "not", "no", "nor", "or", "so", "than", "too", "very", "s", "t",
  "also", "into", "than", "then", "there", "these", "those", "through",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !ENGLISH_STOPWORDS.has(w));
}

interface Sentence {
  index: number;
  text: string;
  score: number;
}

function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [text];
  return matches.map((s) => s.trim()).filter((s) => s.length > 0);
}

export interface SummaryResult {
  originalWordCount: number;
  summaryWordCount: number;
  sentencesPicked: number;
  totalSentences: number;
  summary: string;
  bulletPoints: string[];
}

/**
 * Generates an extractive summary from a PDF file.
 *
 * @param targetRatio Approximate fraction of original sentences to keep.
 *                    0.15 → ~15% of sentences, a short summary; 0.3 → 30%.
 */
export async function summarizePdf(file: File, targetRatio = 0.2): Promise<SummaryResult> {
  const pages = await extractPdfText(file);

  if (hasNoExtractableText(pages)) {
    throw new Error(
      "No text could be extracted from this PDF. It may be a scanned document with no selectable text — try OCR PDF first."
    );
  }

  const fullText = pages.map((p) => p.paragraphs.join(" ")).join("\n\n");
  const sentences = splitSentences(fullText);

  if (sentences.length === 0) {
    throw new Error("This PDF doesn't contain any complete sentences to summarize.");
  }

  // --- 1. Build term frequencies across the whole document ---
  const docTokens = tokenize(fullText);
  const termFreq = new Map<string, number>();
  for (const token of docTokens) termFreq.set(token, (termFreq.get(token) ?? 0) + 1);

  // --- 2. Score each sentence ---
  const scored: Sentence[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const tokens = tokenize(sentences[i]);
    if (tokens.length === 0) continue;

    let score = 0;
    for (const token of tokens) {
      score += termFreq.get(token) ?? 0;
    }
    // Normalize by sentence length so long sentences don't always win;
    // apply a tiny position bonus (first 10% of document carries a
    // little more weight) because introductions tend to be important.
    score /= Math.sqrt(tokens.length);
    if (i < Math.max(1, sentences.length * 0.1)) {
      score *= 1.1;
    }

    scored.push({ index: i, text: sentences[i], score });
  }

  // --- 3. Pick top N sentences, keep original order ---
  const targetCount = Math.max(1, Math.min(scored.length, Math.round(scored.length * targetRatio)));
  const top = [...scored].sort((a, b) => b.score - a.score).slice(0, targetCount);
  const topSet = new Set(top.map((s) => s.index));
  const ordered = scored
    .filter((s) => topSet.has(s.index))
    .sort((a, b) => a.index - b.index);

  const summaryText = ordered.map((s) => s.text).join(" ");

  return {
    originalWordCount: docTokens.length,
    summaryWordCount: tokenize(summaryText).length,
    sentencesPicked: ordered.length,
    totalSentences: scored.length,
    summary: summaryText,
    bulletPoints: ordered.map((s) => s.text),
  };
}
