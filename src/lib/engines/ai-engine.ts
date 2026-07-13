/**
 * AI Engine — architecture only, not implemented. Every function below
 * throws `AiEngineUnavailableError` unconditionally.
 *
 * WHY this is architecture-only, not implementation:
 * Calling OpenAI/Anthropic/Gemini directly from client-side JavaScript
 * requires embedding an API key in the shipped bundle — anyone can read it
 * from devtools or the network tab. This isn't a style preference or a
 * missing library; it's how bearer-token API auth works. There is no
 * client-side-only way to call a paid LLM API safely. Every real product
 * that offers "Chat with PDF"-style features proxies the call through a
 * server it controls, which is also where per-user rate limiting and cost
 * control have to live.
 *
 * This engine defines the provider-agnostic shape every AI-powered tool
 * should call (summarize, translate, extract, chat), so that when a server
 * proxy exists, adding a provider means implementing `AiProvider` once —
 * no tool-level code changes, no registry changes.
 *
 * THE PATH TO REAL IMPLEMENTATION: a Next.js Route Handler under
 * src/app/api/ai/ (e.g. summarize/route.ts) holding the provider API key
 * server-side (env var, never sent to the client), implementing `AiProvider` per
 * provider (OpenAI, Claude, Gemini). See
 * docs/phase-2-server-architecture.md for the full write-up, including
 * cost/rate-limiting considerations specific to a free, high-traffic tool.
 */

export class AiEngineUnavailableError extends Error {
  constructor(operation: string) {
    super(
      `${operation} requires a server-side API proxy that does not exist yet in this deployment — ` +
        `an LLM provider's API key cannot be safely embedded in client-side code. ` +
        `See the doc comment on src/lib/engines/ai-engine.ts for the full explanation.`
    );
    this.name = "AiEngineUnavailableError";
  }
}

export type AiProviderName = "openai" | "claude" | "gemini" | "local";

/**
 * The contract every provider implementation fulfills once a server proxy
 * exists. Deliberately small and text-in/text-out — provider-specific
 * features (e.g. a particular model's function-calling format) belong
 * inside that provider's implementation, not in this shared interface.
 */
export interface AiProvider {
  name: AiProviderName;
  summarize(text: string): Promise<string>;
  translate(text: string, targetLanguage: string): Promise<string>;
  extractKeyPoints(text: string): Promise<string[]>;
  chat(text: string, question: string): Promise<string>;
}

/**
 * The functions below (AI OCR, Writing, Suggestions, Metadata, Search) are
 * PDFPilot-specific capabilities layered on top of a provider, not raw
 * provider primitives themselves — each would internally combine a real
 * provider's `chat`/`summarize` call with PDFPilot's own data (the tool
 * registry, extracted document text), the same way a real implementation
 * of `chatWithDocument` above would. That's why they take a `_provider`
 * parameter like the original three functions rather than being added as
 * new methods on `AiProvider` itself.
 */

export async function summarizeDocument(_text: string, _provider: AiProviderName = "claude"): Promise<string> {
  throw new AiEngineUnavailableError("Document summarization");
}

export async function translateDocument(
  _text: string,
  _targetLanguage: string,
  _provider: AiProviderName = "claude"
): Promise<string> {
  throw new AiEngineUnavailableError("Document translation");
}

export async function chatWithDocument(
  _text: string,
  _question: string,
  _provider: AiProviderName = "claude"
): Promise<string> {
  throw new AiEngineUnavailableError("Chat with document");
}

/**
 * AI OCR — a vision-capable model reading text directly from an image
 * (vision input, not text-in, unlike the functions above — still one
 * provider-agnostic proxy call, just with an image payload), as a
 * *complement* to tesseract.js (ocr-engine.ts), not a replacement.
 * tesseract.js already does real, working, browser-native OCR today; the
 * honest reason to add an LLM-based path later is accuracy on genuinely
 * hard cases (poor handwriting, low-contrast scans, unusual layouts)
 * where a vision model measurably outperforms a classical OCR engine —
 * not because the existing OCR is fake or broken.
 */
export async function recognizeTextWithAi(_imageBase64: string, _provider: AiProviderName = "claude"): Promise<string> {
  throw new AiEngineUnavailableError("AI-assisted OCR");
}

/**
 * AI Writing — generating new text from a prompt (e.g. "draft a cover
 * letter"), distinct from `summarizeDocument` (condensing text that
 * already exists). No client-side tool calls this today; the interface
 * exists so a future "Generate a document" tool has a stable contract to
 * build against rather than inventing its own ad hoc API.
 */
export async function generateTextWithAi(_prompt: string, _provider: AiProviderName = "claude"): Promise<string> {
  throw new AiEngineUnavailableError("AI text generation");
}

/**
 * AI Suggestions — recommending which PDFPilot tool fits a plain-language
 * description of what the user is trying to do ("I need to combine my
 * bank statements into one file" -> Merge PDF). Deliberately not built as
 * keyword matching against TOOLS' names/descriptions today, because
 * labeling a simple substring/synonym lookup "AI" would misrepresent it —
 * that's exactly what src/lib/search.ts's real synonym/fuzzy matching
 * already does honestly, under its own real name. Genuine AI Suggestions
 * needs actual semantic understanding of an open-ended request, which
 * needs a real LLM call.
 */
export async function suggestToolForRequest(
  _request: string,
  _provider: AiProviderName = "claude"
): Promise<string[]> {
  throw new AiEngineUnavailableError("AI tool suggestions");
}

/**
 * AI Metadata — auto-drafting a PDF's title/keywords from its extracted
 * text, as a starting point for PDF Metadata Editor (pdf-engine.ts's
 * `writePdfMetadata`) rather than requiring a user to type them by hand.
 * The engine call itself is what's deferred; the metadata *write* path
 * this would feed into already exists and is real.
 */
export async function suggestMetadataWithAi(
  _text: string,
  _provider: AiProviderName = "claude"
): Promise<{ title: string; keywords: string[] }> {
  throw new AiEngineUnavailableError("AI metadata suggestions");
}

/**
 * AI Search — semantic, natural-language search over the tool/content
 * catalog ("something to shrink a scanned PDF" matching Compress PDF even
 * without the word "compress" appearing anywhere). Distinct from the real,
 * live keyword/synonym/fuzzy search in src/lib/search.ts, which this does
 * NOT replace — that search is fast, free, and already good at literal and
 * near-literal matches. AI Search would be an opt-in fallback for queries
 * that search.ts's real matching genuinely can't resolve, not a
 * replacement for a working system.
 */
export async function semanticSearchWithAi(_query: string, _provider: AiProviderName = "claude"): Promise<string[]> {
  throw new AiEngineUnavailableError("AI semantic search");
}
