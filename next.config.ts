import type { NextConfig } from "next";
import path from "path";

// GA (via @next/third-parties) and Microsoft Clarity are the only third-party
// script/network origins this site loads (src/components/analytics) — the CSP
// below allowlists exactly those, nothing broader.
//
// 'unsafe-eval' is dev-only: webpack's dev runtime evaluates code via eval()
// for source maps, so a CSP without it silently blocks ALL hydration under
// `next dev` (no console error surfaces — the page just never becomes
// interactive). Production bundles contain no eval, so prod stays strict.
const isDev = process.env.NODE_ENV === "development";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com https://www.clarity.ms`,
  "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://www.clarity.ms https://c.clarity.ms",
  "img-src 'self' data: blob: https://www.google-analytics.com https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Silences the "multiple lockfiles" workspace-root inference warning and
  // ensures file tracing for deployment resolves against this project, not
  // whatever directory a sibling lockfile happens to live in.
  outputFileTracingRoot: path.join(__dirname),

  // pptxgenjs's browser bundle statically references Node's `fs`/`https`
  // (guarded at runtime, never actually reached in a browser context) using
  // both the bare and "node:"-prefixed specifiers. The bare specifiers are
  // handled by `resolve.fallback` below. The "node:"-prefixed ones hit
  // webpack's URI-scheme parser *before* normal resolution (fallback/alias)
  // ever runs, producing "UnhandledSchemeError" — the documented fix is
  // NormalModuleReplacementPlugin, which rewrites `node:x` -> `x` early
  // enough that scheme parsing never sees the `node:` prefix.
  webpack: (config, { webpack }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      https: false,
      os: false,
      path: false,
    };
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: { request: string }) => {
        resource.request = resource.request.replace(/^node:/, "");
      })
    );

    // officeparser's browser bundle lazy-loads its per-format sub-modules
    // via an expression-based dynamic import (`import(`./${x}.js`)`) rather
    // than a static string, so webpack can't statically resolve which file
    // is actually requested. Its fallback is to treat the whole containing
    // directory as a "context module" — bundling everything in
    // node_modules/officeparser/dist/, including the .d.ts type-declaration
    // files sitting alongside the real .js output, which aren't valid JS.
    // Two other standard mechanisms were tried and rejected: IgnorePlugin
    // matches against the *request string*, which context-module-swept
    // files don't present in a matchable form, so it never intercepts
    // these; `module.noParse` stops the parse-time crash but still ships
    // the raw, invalid-JS file content into the bundle, which then breaks
    // Next's minifier instead. ContextReplacementPlugin is the correct,
    // documented tool for exactly this situation: it narrows which files
    // an expression-based context import is allowed to resolve to, so the
    // .d.ts files are never included in the first place.
    config.plugins.push(
      new webpack.ContextReplacementPlugin(/officeparser[\\/]dist/, /\.(?:m?js|json)$/)
    );

    return config;
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
        ],
      },
    ];
  },
};

export default nextConfig;
