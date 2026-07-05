/**
 * Regenerates every static branding asset under /public:
 * favicons, Apple/Android icons, favicon.ico, and the per-page OG images.
 *
 * Usage: node scripts/generate-assets.js  (or: npm run generate:assets)
 *
 * Rendering is done entirely offline via `sharp` (SVG -> PNG rasterization).
 * No Next.js runtime image generation is involved — output is static files.
 *
 * See scripts/README.md for full documentation.
 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const OG_DIR = path.join(PUBLIC_DIR, "og");
const TEMPLATES_DIR = path.join(__dirname, "templates");

// The canonical tool data — same source the Next.js app reads via
// src/lib/tools.ts. This is the single source of truth for the 5 tools;
// nothing tool-related is hardcoded separately in this script anymore.
const toolsData = require(path.join(__dirname, "..", "src", "lib", "tools-data.json"));

const SOCIAL_TEMPLATE = fs.readFileSync(path.join(TEMPLATES_DIR, "social-template.svg"), "utf8");
const ICON_TEMPLATE = fs.readFileSync(path.join(TEMPLATES_DIR, "icon-template.svg"), "utf8");

function renderTemplate(template, values) {
  return Object.entries(values).reduce(
    (svg, [token, value]) => svg.split(`{{${token}}}`).join(value),
    template
  );
}

function renderSocialImage({ title, subtitle }) {
  return renderTemplate(SOCIAL_TEMPLATE, { TITLE: title, SUBTITLE: subtitle });
}

function renderIcon({ size }) {
  // Same geometry math as the original inline generator — only the
  // surrounding SVG markup moved out to scripts/templates/icon-template.svg.
  const iconScale = (size / 24) * 0.52;
  const iconRendered = 24 * iconScale;
  const offset = (size - iconRendered) / 2;
  const baseStrokeWidth = 2 / iconScale < 1.6 ? 1.6 * iconScale : 2;
  const strokeWidth = baseStrokeWidth / iconScale;
  const radius = size * 0.1875;

  return renderTemplate(ICON_TEMPLATE, {
    SIZE: size,
    RADIUS: radius,
    OFFSET: offset,
    ICON_SCALE: iconScale,
    STROKE_WIDTH: strokeWidth,
  });
}

// Pages that aren't part of the Tool model (home + static utility pages) —
// their OG copy lives here since there's no canonical entity for them yet.
const NON_TOOL_OG_PAGES = {
  home: { slug: "home", title: "PDFPilot", subtitle: "Merge, Split, Compress &amp; Convert PDFs" },
  about: { slug: "about", title: "About PDFPilot", subtitle: "Free, fast, privacy-first PDF tools" },
  privacy: { slug: "privacy", title: "Privacy Policy", subtitle: "Your files never leave your browser" },
  terms: { slug: "terms", title: "Terms of Service", subtitle: "Terms for using PDFPilot's free tools" },
};

// The 9 pages that get an OG image: home, the 5 canonical tools (sourced
// from src/lib/tools-data.json — the same file the Next.js app reads via
// src/lib/tools.ts), and the 3 static utility pages.
const OG_IMAGES = [
  NON_TOOL_OG_PAGES.home,
  ...toolsData.map((tool) => ({
    slug: tool.slug,
    title: tool.name,
    subtitle: tool.ogSubtitle,
  })),
  NON_TOOL_OG_PAGES.about,
  NON_TOOL_OG_PAGES.privacy,
  NON_TOOL_OG_PAGES.terms,
];

function buildIcoFromPng(pngBuffer, dimension) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count

  const entry = Buffer.alloc(16);
  entry.writeUInt8(dimension >= 256 ? 0 : dimension, 0); // width
  entry.writeUInt8(dimension >= 256 ? 0 : dimension, 1); // height
  entry.writeUInt8(0, 2); // color palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8); // image data size
  entry.writeUInt32LE(22, 12); // offset (6 header + 16 entry)

  return Buffer.concat([header, entry, pngBuffer]);
}

async function main() {
  fs.mkdirSync(OG_DIR, { recursive: true });

  for (const { slug, title, subtitle } of OG_IMAGES) {
    const svg = renderSocialImage({ title, subtitle });
    const outPath = path.join(OG_DIR, `${slug}.png`);
    await sharp(Buffer.from(svg))
      .resize(1200, 630)
      .png({ compressionLevel: 9, quality: 90 })
      .toFile(outPath);
    const stat = fs.statSync(outPath);
    console.log(`OG   og/${slug}.png -> ${(stat.size / 1024).toFixed(1)} KB`);
  }

  const iconSizes = [
    { name: "favicon-16x16.png", size: 16 },
    { name: "favicon-32x32.png", size: 32 },
    { name: "apple-touch-icon.png", size: 180 },
    { name: "android-chrome-192x192.png", size: 192 },
    { name: "android-chrome-512x512.png", size: 512 },
  ];

  const pngBuffers = {};
  for (const { name, size } of iconSizes) {
    const svg = renderIcon({ size });
    const outPath = path.join(PUBLIC_DIR, name);
    const buf = await sharp(Buffer.from(svg))
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toBuffer();
    fs.writeFileSync(outPath, buf);
    pngBuffers[size] = buf;
    console.log(`ICON ${name} -> ${(buf.length / 1024).toFixed(1)} KB`);
  }

  // favicon.ico: single-image ICO container wrapping the 32x32 PNG (widely supported "PNG-in-ICO" format)
  const icoBuffer = buildIcoFromPng(pngBuffers[32], 32);
  fs.writeFileSync(path.join(PUBLIC_DIR, "favicon.ico"), icoBuffer);
  console.log(`ICO  favicon.ico -> ${(icoBuffer.length / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
