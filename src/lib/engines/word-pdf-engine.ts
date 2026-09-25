import { checkWordArchiveEntry, safeWordLink, WORD_PDF_LIMITS } from "./word-pdf-policy";

interface WordPdfOptions {
  isCancelled?: () => boolean;
  onProgress?: (progress: number, message: string) => void;
  onPagePreview?: (image: string) => void;
  rotation?: 0 | 90 | 180 | 270;
}

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const LAYOUT_ERROR = "This document has a layout that cannot fit safely on its original pages in the browser. Please use Word or Google Docs to export this file as PDF; no incomplete PDF was created.";

function xml(bytes: Uint8Array): Document {
  const source = new TextDecoder().decode(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error("Document XML entities are not supported.");
  const parsed = new DOMParser().parseFromString(source, "application/xml");
  if (parsed.querySelector("parsererror")) throw new Error("This DOCX contains invalid document XML.");
  return parsed;
}

async function preflight(bytes: Uint8Array): Promise<number> {
  const { unzipSync } = await import("fflate");
  let count = 0, total = 0;
  const names = new Set<string>();
  const parts = unzipSync(bytes, { filter: (entry) => {
    count++; total += entry.originalSize;
    checkWordArchiveEntry(entry.name, entry.originalSize, count, total);
    names.add(entry.name);
    return /\.(xml|rels)$/i.test(entry.name);
  } });
  if (!parts["word/document.xml"]) throw new Error("Please choose a valid, unencrypted DOCX document.");
  let imageCount = 0;
  for (const [name, part] of Object.entries(parts)) {
    const doc = xml(part);
    if (name.endsWith(".rels")) {
      for (const rel of Array.from(doc.getElementsByTagName("Relationship"))) {
        const type = rel.getAttribute("Type") || "";
        const target = rel.getAttribute("Target") || "";
        if (rel.getAttribute("TargetMode") === "External") {
          if (!type.endsWith("/hyperlink")) throw new Error("This document uses externally linked content. Embed its images in the DOCX first; browser conversion will not fetch external files.");
          if (!safeWordLink(target)) rel.remove();
        } else if (type.endsWith("/image")) {
          const folder = name.slice(0, name.lastIndexOf("/_rels/"));
          const resolved = new URL(target, `https://docx.invalid/${folder}/`).pathname.slice(1);
          if (!names.has(resolved)) throw new Error("An embedded image is missing from this DOCX. Please re-export the original document.");
          if (!/\.(png|jpe?g|gif|webp|bmp)$/i.test(target)) throw new Error("This document contains an unsupported image format. Please change vector/HEIC images to PNG or JPEG before converting.");
        }
      }
    }
    if (!/^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(name)) continue;
    // Unsupported objects must not disappear silently from a successful download.
    for (const tag of ["altChunk", "object", "pict", "txbxContent", "ins", "del", "footnoteReference", "endnoteReference"]) {
      if (doc.getElementsByTagNameNS(W, tag).length) throw new Error("This document contains legacy artwork, embedded objects, notes, or tracked changes that this browser converter cannot safely preserve. Please export it from Word or Google Docs.");
    }
    if (doc.getElementsByTagNameNS("*", "chart").length || doc.getElementsByTagNameNS("*", "videoFile").length || doc.getElementsByTagNameNS("*", "audioFile").length || doc.getElementsByTagNameNS("*", "relIds").length) {
      throw new Error("Charts, SmartArt, and embedded audio/video are not supported in this browser conversion. Please export this document from its original editor.");
    }
    if (doc.getElementsByTagNameNS("*", "oMath").length || Array.from(doc.getElementsByTagNameNS(A, "graphicData")).some((item) => item.getAttribute("uri") !== "http://schemas.openxmlformats.org/drawingml/2006/picture")) {
      throw new Error("This document contains equations or drawing objects that this browser converter cannot preserve reliably. Please export it from the original editor.");
    }
    for (const blip of Array.from(doc.getElementsByTagNameNS(A, "blip"))) {
      if (blip.hasAttributeNS(R, "link")) throw new Error("Please embed linked images in the DOCX before converting.");
      if (blip.hasAttributeNS(R, "embed")) imageCount++;
    }
    if (Array.from(doc.getElementsByTagNameNS(A, "srcRect")).some((crop) => ["l", "t", "r", "b"].some((side) => Number(crop.getAttribute(side) || 0) !== 0))) throw new Error("This document uses cropped artwork that this browser converter cannot yet preserve accurately. Please export it from its original editor.");
  }
  return imageCount;
}

async function createRenderFrame(): Promise<HTMLIFrameElement> {
  const frame = document.createElement("iframe");
  frame.title = "Private document rendering";
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("data-clarity-mask", "True");
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.style.cssText = "position:fixed;left:-20000px;top:0;width:1600px;height:1200px;border:0;pointer-events:none;";
  const loaded = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("The private document renderer did not start. Please try again.")), 15000);
    frame.onload = () => { clearTimeout(timer); resolve(); };
  });
  // No scripts, connections, forms, or external document resources in this frame.
  frame.srcdoc = '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: blob:; style-src \'unsafe-inline\'; font-src \'none\'; base-uri \'none\'; form-action \'none\'"><style>html,body{margin:0;padding:0;background:#fff;color:#000;color-scheme:light}section.docx{background:#fff!important;box-shadow:none!important;margin:0!important}section.docx>article{flex-shrink:0}p.pdfpilot-continuation:before{content:none!important}</style></head><body></body></html>';
  document.body.append(frame);
  try { await loaded; return frame; } catch (error) { frame.remove(); throw error; }
}

function pageSize(page: HTMLElement): { width: number; height: number } {
  const style = page.ownerDocument.defaultView!.getComputedStyle(page);
  const width = parseFloat(style.width), height = parseFloat(style.minHeight);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 96 || height < 96 || width * height > WORD_PDF_LIMITS.pagePixels / 4) throw new Error(LAYOUT_ERROR);
  return { width, height };
}

/** Paginate whole blocks and table rows, never arbitrary canvas strips. */
function paginate(source: HTMLElement, check: () => void): HTMLElement[] {
  const { height } = pageSize(source);
  const doc = source.ownerDocument;
  const pages: HTMLElement[] = [];
  let page: HTMLElement, article: HTMLElement;
  function nextPage(template: HTMLElement) {
    check();
    if (pages.length >= WORD_PDF_LIMITS.pages) throw new Error("This document exceeds the 200-page browser conversion limit.");
    page = source.cloneNode(true) as HTMLElement;
    page.style.height = `${height}px`;
    page.querySelectorAll(":scope > article").forEach((node) => node.remove());
    article = template.cloneNode(false) as HTMLElement;
    article.style.marginBottom = "auto";
    page.insertBefore(article, page.querySelector(":scope > footer"));
    source.before(page); pages.push(page);
  }
  function fits(): boolean {
    const style = doc.defaultView!.getComputedStyle(page);
    const rect = page.getBoundingClientRect();
    const footer = page.querySelector(":scope > footer");
    const limit = Math.min(rect.top + height - parseFloat(style.paddingBottom), footer?.getBoundingClientRect().top ?? Infinity);
    return article.getBoundingClientRect().bottom <= limit + 0.75;
  }
  function splitParagraph(block: HTMLElement, template: HTMLElement) {
    if (block.querySelector("img,svg,math,br")) throw new Error(`${LAYOUT_ERROR} (Oversized image or paragraph.)`);
    const text = block.textContent || "";
    if (!text.trim()) throw new Error(LAYOUT_ERROR);
    const walker = doc.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = []; let current: Node | null;
    while ((current = walker.nextNode())) nodes.push(current as Text);
    function fragment(start: number, end: number) {
      const range = doc.createRange();
      let offset = 0, started = false;
      for (const node of nodes) {
        const last = offset + node.length;
        if (!started && start <= last) { range.setStart(node, start - offset); started = true; }
        if (end <= last) { range.setEnd(node, end - offset); break; }
        offset = last;
      }
      const clone = block.cloneNode(false) as HTMLElement;
      if (start) { clone.classList.add("pdfpilot-continuation"); clone.style.counterIncrement = "none"; clone.removeAttribute("id"); }
      // Range.cloneContents omits the common ancestor (e.g. an italic span or
      // hyperlink when a long paragraph is one text run). Restore that ancestry
      // so continuation pages retain their original inline styling and links.
      let contents: Node = range.cloneContents();
      let ancestor = range.commonAncestorContainer;
      if (ancestor.nodeType === Node.TEXT_NODE) ancestor = ancestor.parentNode!;
      while (ancestor && ancestor !== block) {
        const wrapper = ancestor.cloneNode(false) as HTMLElement;
        if (start) wrapper.removeAttribute("id");
        wrapper.appendChild(contents); contents = wrapper; ancestor = ancestor.parentNode!;
      }
      clone.append(contents); return clone;
    }
    let start = 0;
    while (start < text.length) {
      check();
      let low = start + 1, high = text.length, best = start;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const part = fragment(start, mid); article.append(part);
        const fitsHere = fits(); part.remove();
        if (fitsHere) { best = mid; low = mid + 1; } else high = mid - 1;
      }
      if (best === start) throw new Error(LAYOUT_ERROR);
      // Prefer a word boundary without dropping whitespace or rich-text runs.
      if (best < text.length) {
        const boundary = text.lastIndexOf(" ", best - 1);
        if (boundary > start) best = boundary + 1;
      }
      article.append(fragment(start, best)); start = best;
      if (start < text.length) nextPage(template);
    }
  }
  for (const template of Array.from(source.querySelectorAll<HTMLElement>(":scope > article"))) {
    if (doc.defaultView!.getComputedStyle(template).columnCount !== "auto" && doc.defaultView!.getComputedStyle(template).columnCount !== "1") throw new Error(LAYOUT_ERROR);
    nextPage(template);
    for (const original of Array.from(template.children)) {
      check();
      const block = original.cloneNode(true) as HTMLElement;
      // Word allows a full-page inline picture without a text baseline below it.
      // HTML's default line box would otherwise push these image-only paragraphs
      // past the bottom edge (common in Google Docs exports).
      if (block.tagName === "P" && block.querySelector("img") && !block.textContent?.trim()) {
        block.style.fontSize = "0"; block.style.lineHeight = "0";
        block.querySelectorAll<HTMLElement>("span,img").forEach((node) => { node.style.verticalAlign = "top"; node.style.lineHeight = "0"; });
      }
      article!.append(block);
      if (fits()) continue;
      block.remove();
      if (article!.children.length) nextPage(template);
      article!.append(block);
      if (fits()) continue;
      block.remove();
      if (block.tagName === "TABLE") {
        const table = block as HTMLTableElement;
        if (Array.from(table.querySelectorAll("td,th")).some((cell) => Number(cell.getAttribute("rowspan") || 1) > 1)) throw new Error(LAYOUT_ERROR);
        const rows = Array.from(table.rows);
        const headerRows = new Set(Array.from(table.tHead?.rows ?? []));
        function tableShell() {
          const shell = table.cloneNode(false) as HTMLTableElement;
          table.querySelectorAll(":scope > colgroup, :scope > caption, :scope > thead").forEach((child) => shell.append(child.cloneNode(true)));
          article!.append(shell); return shell;
        }
        let shell = tableShell(), body = shell.createTBody(), added = 0;
        for (const row of rows.filter((row) => !headerRows.has(row))) {
          body.append(row);
          if (!fits()) {
            row.remove();
            if (!added) throw new Error(`${LAYOUT_ERROR} (A table row is taller than one page.)`);
            nextPage(template); shell = tableShell(); body = shell.createTBody(); added = 0; body.append(row);
            if (!fits()) throw new Error(`${LAYOUT_ERROR} (A table row is taller than one page.)`);
          }
          added++;
        }
      } else if (block.tagName === "P") splitParagraph(block, template);
      else throw new Error(LAYOUT_ERROR);
    }
  }
  if (!pages.length) throw new Error("No renderable pages were found in this document.");
  source.remove(); return pages;
}

export async function convertWordToPdf(file: File, options: WordPdfOptions = {}): Promise<Blob> {
  const check = () => { if (options.isCancelled?.()) throw new Error("Conversion cancelled."); };
  if (file.size > WORD_PDF_LIMITS.inputBytes) throw new Error("Choose a DOCX file up to 100MB.");
  check(); options.onProgress?.(2, "Checking embedded images and document structure…");
  const data = new Uint8Array(await file.arrayBuffer());
  const expectedImages = await preflight(data); check();
  const [{ renderAsync }, { default: html2canvas }, { PDFDocument, PDFName, PDFString, degrees }] = await Promise.all([
    import("docx-preview"), import("html2canvas"), import("pdf-lib"),
  ]);
  const frame = await createRenderFrame();
  // html2canvas measures font baselines in the host document, not the isolated
  // render frame. Tailwind's `img { display: block }` breaks its hidden 1px
  // inline-image probe and moves all text down across table borders. Reset only
  // that exact temporary probe, never the site's visible images or document.
  const metricStyle = document.createElement("style");
  metricStyle.textContent = 'body > div[style*="visibility: hidden"][style*="white-space: nowrap"] > img[width="1"][height="1"]{display:inline!important}';
  document.head.append(metricStyle);
  try {
    const doc = frame.contentDocument!;
    doc.body.setAttribute("data-clarity-mask", "True");
    // renderAsync clears its style container: never hand it the frame's head,
    // which holds the resource policy and our print-only layout rules.
    const styles = doc.createElement("div");
    doc.head.append(styles);
    options.onProgress?.(8, "Rendering images, tables and formatting on your device…");
    await renderAsync(data, doc.body, styles, {
      inWrapper: false, ignoreWidth: false, ignoreHeight: false, ignoreFonts: true,
      // Saved Word page hints are not reliable after browser font substitution.
      // Render sections separately so a zero-margin appendix cannot inherit the
      // preceding section's margins; paginate actual browser geometry below.
      breakPages: true, ignoreLastRenderedPageBreak: true, useBase64URL: true,
      renderHeaders: true, renderFooters: true, renderFootnotes: true, renderEndnotes: true,
      renderAltChunks: false, renderComments: false, renderChanges: false, experimental: false,
    });
    check();
    // Word's legacy Symbol bullet is a private-use character. It otherwise
    // becomes a missing-glyph box when that proprietary font is unavailable.
    const bulletStyle = doc.createElement("style");
    bulletStyle.textContent = 'p[data-word-symbol-bullet]:not(.pdfpilot-continuation)::before{content:"•"!important;font-family:Arial,sans-serif!important}';
    doc.head.append(bulletStyle);
    doc.querySelectorAll("p").forEach((paragraph) => {
      const marker = doc.defaultView!.getComputedStyle(paragraph, "::before");
      if (marker.content.includes("\uF0B7") && /\bSymbol\b/i.test(marker.fontFamily)) paragraph.setAttribute("data-word-symbol-bullet", "true");
    });
    const images = Array.from(doc.images);
    if (images.length < expectedImages) throw new Error("Some embedded images could not be rendered. Please re-export this DOCX; no incomplete PDF was created.");
    await Promise.all(images.map(async (image) => {
      if (!/^data:image\/(png|jpeg|gif|webp|bmp);base64,/i.test(image.src)) throw new Error("An embedded image could not be read safely.");
      try { await image.decode(); } catch { throw new Error("An embedded image is damaged or unsupported. No incomplete PDF was created."); }
      if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 50_000_000) throw new Error("An image is too large or unreadable for browser conversion.");
    }));
    await doc.fonts.ready; check();
    const pages = Array.from(doc.querySelectorAll<HTMLElement>("section.docx")).flatMap((page) => paginate(page, check));
    if (pages.length > WORD_PDF_LIMITS.pages) throw new Error("This document exceeds the 200-page browser conversion limit.");
    // Images positioned beyond a page must not be silently cropped by capture.
    for (const page of pages) {
      const bounds = page.getBoundingClientRect();
      for (const image of Array.from(page.querySelectorAll("img"))) {
        const rect = image.getBoundingClientRect();
        if (rect.left < bounds.left - 1 || rect.top < bounds.top - 1 || rect.right > bounds.right + 1 || rect.bottom > bounds.bottom + 1) throw new Error(`${LAYOUT_ERROR} (An image extends outside page ${pages.indexOf(page) + 1}.)`);
      }
    }
    const pdf = await PDFDocument.create();
    const pdfPages = pages.map((page) => { const size = pageSize(page); const result = pdf.addPage([size.width * 0.75, size.height * 0.75]); result.setRotation(degrees(options.rotation || 0)); return result; });
    let outputImageBytes = 0;
    const bookmarks = new Map<string, { page: number; y: number }>();
    pages.forEach((page, index) => {
      const top = page.getBoundingClientRect().top;
      page.querySelectorAll<HTMLElement>("[id]").forEach((el) => { if (!bookmarks.has(el.id)) bookmarks.set(el.id, { page: index, y: pdfPages[index].getHeight() - (el.getBoundingClientRect().top - top) * 0.75 }); });
    });
    for (let index = 0; index < pages.length; index++) {
      check();
      const page = pages[index], size = pageSize(page);
      options.onProgress?.(15 + index / pages.length * 80, `Creating PDF page ${index + 1} of ${pages.length}…`);
      const canvas = await html2canvas(page, {
        scale: 2, backgroundColor: "#ffffff", logging: false, allowTaint: false, useCORS: false,
        width: Math.ceil(size.width), height: Math.ceil(size.height), windowWidth: 1600, windowHeight: 1200,
        // External URLs are never fetched; the isolated source frame only allows embedded images.
        onclone: (clone) => clone.querySelectorAll("a").forEach((link) => { if (!safeWordLink(link.getAttribute("href") || "")) link.removeAttribute("href"); }),
      });
      try {
        check();
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("The browser could not create this PDF page.")), "image/png"));
        outputImageBytes += blob.size;
        if (outputImageBytes > 128 * 1024 * 1024) throw new Error("The rendered PDF is too large to finish safely in the browser. Please split the Word document first.");
        const image = await pdf.embedPng(await blob.arrayBuffer());
        const output = pdfPages[index];
        output.drawImage(image, { x: 0, y: 0, width: output.getWidth(), height: output.getHeight() });
        if (options.onPagePreview) {
          const thumbnail = doc.createElement("canvas");
          const width = Math.min(1000, canvas.width), height = Math.round(canvas.height * width / canvas.width);
          const sideways = options.rotation === 90 || options.rotation === 270;
          thumbnail.width = sideways ? height : width; thumbnail.height = sideways ? width : height;
          const context = thumbnail.getContext("2d")!;
          context.translate(thumbnail.width / 2, thumbnail.height / 2);
          context.rotate((options.rotation || 0) * Math.PI / 180);
          context.drawImage(canvas, -width / 2, -height / 2, width, height);
          options.onPagePreview(thumbnail.toDataURL("image/png"));
          thumbnail.width = 0; thumbnail.height = 0;
        }
        const bounds = page.getBoundingClientRect();
        for (const link of Array.from(page.querySelectorAll("a[href]"))) {
          const href = safeWordLink(link.getAttribute("href") || "");
          if (!href) continue;
          const bookmark = href.startsWith("#") ? bookmarks.get(href.slice(1)) : null;
          if (href.startsWith("#") && !bookmark) continue;
          for (const rect of Array.from(link.getClientRects())) {
            const x1 = Math.max(0, (rect.left - bounds.left) * 0.75), x2 = Math.min(output.getWidth(), (rect.right - bounds.left) * 0.75);
            const y1 = Math.max(0, output.getHeight() - (rect.bottom - bounds.top) * 0.75), y2 = Math.min(output.getHeight(), output.getHeight() - (rect.top - bounds.top) * 0.75);
            if (x2 <= x1 || y2 <= y1) continue;
            const annotation = pdf.context.obj({ Type: "Annot", Subtype: "Link", Rect: [x1, y1, x2, y2], Border: [0, 0, 0],
              ...(bookmark ? { Dest: [pdfPages[bookmark.page].ref, PDFName.of("XYZ"), 0, bookmark.y, null] } : { A: { Type: "Action", S: "URI", URI: PDFString.of(href) } }),
            });
            output.node.addAnnot(pdf.context.register(annotation));
          }
        }
      } finally { canvas.width = 0; canvas.height = 0; }
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    check(); options.onProgress?.(98, "Finalizing your PDF…");
    const bytes = await pdf.save(); check();
    return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  } finally { metricStyle.remove(); frame.remove(); }
}
