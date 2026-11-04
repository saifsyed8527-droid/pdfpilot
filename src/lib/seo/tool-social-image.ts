/** Use the branded site card for tools without a dedicated published image. */
const siteCardTools = new Set(["repair-pdf", "organize-pdf", "scan-pdf", "edit-pdf", "pdf-to-excel", "pdf-to-pdfa", "summary-generator", "lock-pdf", "unlock-pdf", "html-to-pdf", "redact-pdf", "pdf-to-markdown", "sign-pdf", "photo-editor", "meme-generator", "blur-face", "html-to-image", "remove-background", "upscale-image", "translate-pdf"]);
export function toolSocialImage(slug: string) {
  return siteCardTools.has(slug) ? "/og/home.png" : `/og/${slug}.png`;
}
