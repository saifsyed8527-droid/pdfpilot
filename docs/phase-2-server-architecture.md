# Server architecture recommendation — Security & AI engines

Written during Phase 2 as the deferred-but-designed plan for the two
product families that genuinely need a server: PDF encryption/signing and
AI features. Not implemented — this is the plan for when it is.

## Why these two families need a server (recap)

- **Security**: no trustworthy client-side PDF encryption/signing library
  exists today (full verification record in `src/lib/engines/security-engine.ts`).
  Real, production-grade PDF encryption needs `qpdf` (industry-standard,
  used by Adobe and others) or an equivalent — as a server binary, not the
  immature `qpdf-wasm` (v0.1.0, 7 stars, no docs).
- **AI**: LLM provider API keys cannot be embedded in client-side code
  without being readable by anyone who opens devtools. This is a hard
  constraint of bearer-token auth, not a library gap.

## Recommended architecture

**Next.js Route Handlers**, not a separate service. This app already runs
as a normal Next.js deployment (`next.config.ts` has no `output: "export"`
restriction), so `src/app/api/*/route.ts` files are available with zero
new infrastructure — no separate backend to stand up, deploy, or pay for
independently.

```
src/app/api/
  security/
    encrypt/route.ts     -- POST, shells out to server-side qpdf binary
    decrypt/route.ts
    sign/route.ts         -- needs a real certificate — a business decision
                             (self-signed vs. a real CA-issued cert), not
                             just an engineering one
  ai/
    summarize/route.ts    -- POST, proxies to the chosen LLM provider
    translate/route.ts
    chat/route.ts
```

Each route:
1. Receives the file/text from the client (the only data that crosses the
   wire — no client-side API keys, no client-side qpdf).
2. Calls the real tool/provider server-side, using env vars for secrets
   (`ANTHROPIC_API_KEY`, etc. — never exposed to the client bundle; Next.js
   already separates server-only env vars from `NEXT_PUBLIC_*` ones).
3. Returns the result.

The client-side `security-engine.ts` / `ai-engine.ts` functions become
simple `fetch("/api/security/encrypt", { method: "POST", body })` calls —
the function *signatures* defined now don't change, only their bodies.

## Secrets management

Environment variables via the hosting platform's standard mechanism
(Vercel env vars, or `.env.local` for local dev, already `.gitignore`d in
this project). No new secrets-management service needed at this scale —
introducing something like Vault/AWS Secrets Manager would be over-
engineering for a handful of API keys.

## Rate limiting & cost control

Necessary before AI routes go live, not optional: LLM API calls cost real
money per request, and this is a free, unauthenticated, high-traffic
product. Recommend a simple IP-based or session-based rate limit
(e.g. `@upstash/ratelimit` with a free-tier Redis, or an in-memory limiter
if a single server instance is acceptable) before enabling any AI route in
production. Document this as a launch blocker for the AI family
specifically, not for Security (encryption is comparatively cheap — mostly
CPU-bound qpdf calls, not metered third-party API usage).

## What does NOT need a server

Every other Phase 2 family (PDF page/metadata operations, image
conversion, OCR) runs entirely client-side with verified real libraries —
no server dependency, no new operational surface, no ongoing cost. This
split is intentional: browser-first stays the default; server involvement
is the exception, justified per-family, not a blanket architecture change.

## Queueing

Not needed at current or near-term scale. qpdf calls and single-document
AI requests complete in seconds; a request queue would be premature
infrastructure for a problem that doesn't exist yet. Revisit only if
traffic volume or request duration actually demands it.
