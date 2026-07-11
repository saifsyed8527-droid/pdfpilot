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
