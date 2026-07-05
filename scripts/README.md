# Asset Generator

## Why this exists

PDFPilot's favicons, PWA icons, and per-page Open Graph / Twitter Card images
are static files served from `/public` — not generated at request time or
build time by Next.js. That was a deliberate choice (see Sprint 3): this is a
utility website, and we want these assets to be plain files with predictable
URLs, cacheable forever, with zero runtime cost.

Static files still need to be *produced* somehow, and hand-exporting PNGs
from a design tool every time copy or branding changes is slow and easy to
get subtly wrong (wrong size, wrong margin, stale copy). `scripts/generate-assets.js`
exists so every one of these assets can be regenerated deterministically from
one command, with the visual design defined in one place.

## What it generates

| Output | Size | Purpose |
|---|---|---|
| `public/og/*.png` (9 files) | 1200×630 | Open Graph / Twitter Card image, one per public page |
| `public/favicon-16x16.png` | 16×16 | Browser tab favicon |
| `public/favicon-32x32.png` | 32×32 | Browser tab favicon (high-DPI) |
| `public/favicon.ico` | 32×32 | Legacy favicon format (PNG embedded in an ICO container) |
| `public/apple-touch-icon.png` | 180×180 | iOS home-screen icon |
| `public/android-chrome-192x192.png` | 192×192 | Android/PWA icon (referenced by `site.webmanifest`) |
| `public/android-chrome-512x512.png` | 512×512 | Android/PWA icon, splash screens (referenced by `site.webmanifest`) |

`public/site.webmanifest` itself is a hand-written static file, not generated
by this script — it just points at the two Android icon files above.

## Folder structure

```
scripts/
  generate-assets.js       # the generator — reads templates, writes PNGs
  templates/
    social-template.svg    # OG/Twitter image layout (1200x630)
    icon-template.svg      # square app-icon layout (favicons, Apple/Android)
  README.md                # this file
```

## Prerequisites

- Node.js (any version compatible with this project's Next.js/TypeScript toolchain)
- `sharp` — an explicit `devDependency` in `package.json`. It does the SVG →
  PNG rasterization (via its bundled libvips) and is the only third-party
  dependency this script needs. Run `npm install` first if you haven't
  already.

## How to regenerate all assets

From the project root:

```bash
npm run generate:assets
```

Equivalent to running `node scripts/generate-assets.js` directly. It's
idempotent — safe to re-run any time — and overwrites every generated file
in place. It prints each output file's size as it writes it, so you can spot
anything that looks unexpectedly large.

## Where output is written

Everything is written directly into `/public`, matching the table above —
`public/og/` for OG images, and the project root of `public/` for
favicons/icons. Nothing is written outside `public/`, and nothing in
`src/` is touched.

## Dependencies required

Just `sharp` (see Prerequisites). No Next.js APIs, no browser, no
`next/og`/`ImageResponse`, no headless browser — the whole pipeline is
`fs.readFileSync` → string substitution → `sharp` → `fs.writeFileSync`.

## Best practices when updating branding

The two files in `scripts/templates/` are the **single source of truth** for
layout, colors, typography, logo placement, the accent bar, and safe
margins. To change any of these:

1. Edit `scripts/templates/social-template.svg` and/or
   `scripts/templates/icon-template.svg` directly — these are plain SVG, and
   most vector editors (Figma, Illustrator, Inkscape) can open and re-export
   them if you want to iterate visually rather than by hand-editing markup.
2. Run `npm run generate:assets` to re-render every PNG from the updated
   template.
3. **Do not** re-introduce layout/color/typography values into
   `generate-assets.js`. The script should only ever contain: the list of
   per-page title/subtitle text, the per-icon-size geometry math (which
   necessarily varies by pixel size and can't live in a single static SVG),
   and the file I/O plumbing. If you find yourself editing pixel values,
   colors, or font settings inside the `.js` file, that's a sign the change
   belongs in a template instead.
4. Check the rendered output at both full size and thumbnail size (see
   Sprint 3's QA process) before committing — small text can become
   illegible when a social platform shrinks the image for a feed preview.
5. Keep text content inside the safe margins already established in
   `social-template.svg` (roughly 80px / 6.7% from the left, more from every
   other edge) — some platforms (notably older WhatsApp clients) can crop
   toward a tighter aspect ratio than the standard 1.91:1 OG spec.

## Notes for future contributors

- The two templates use `{{TOKEN}}` placeholders (`{{TITLE}}`, `{{SUBTITLE}}`
  in the social template; `{{SIZE}}`, `{{RADIUS}}`, `{{OFFSET}}`,
  `{{ICON_SCALE}}`, `{{STROKE_WIDTH}}` in the icon template).
  `generate-assets.js`'s `renderTemplate()` helper does a plain string
  substitution — there's no templating engine dependency to learn.
- The icon template is rendered once per target pixel size (16, 32, 180,
  192, 512) because the stroke width and icon placement are computed
  proportionally so the mark stays crisp and centered at every size — this
  is why those specific values are computed in JS rather than hardcoded in
  the SVG, unlike the colors and layout, which are fixed and live entirely
  in the template.
- The logo mark reused across every asset is the exact same `FileText` icon
  (path data) already used by `lucide-react` in `src/components/navbar.tsx`
  and `src/components/footer.tsx` — if that icon ever changes, the path data
  in both templates should be updated to match, so the favicon/OG branding
  stays consistent with the actual navbar logo.
- `favicon.ico` is a hand-built ICO container (see
  `buildIcoFromPng()` in `generate-assets.js`) wrapping the 32×32 PNG,
  rather than produced by a dedicated ICO library — this avoids adding a
  second image dependency for a format that's just a small binary wrapper
  around a PNG.
