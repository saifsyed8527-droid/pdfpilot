"use client";

export type HtmlPdfScreenSize = "current" | "1920" | "1440" | "768" | "320";
export type HtmlPdfPageSize = "a3" | "a4" | "a5" | "letter";
export type HtmlPdfOrientation = "portrait" | "landscape";
export type HtmlPdfMargin = "none" | "small" | "big";
export interface HtmlPdfSettings {
  screenSize: HtmlPdfScreenSize;
  pageSize: HtmlPdfPageSize;
  orientation: HtmlPdfOrientation;
  oneLongPage: boolean;
  margin: HtmlPdfMargin;
  blockAds: boolean;
  removeOverlays: boolean;
}

const PAGE_SIZES = { a3: [842, 1191], a4: [595, 842], a5: [420, 595], letter: [612, 792] };
const MARGINS = { none: 0, small: 40, big: 64 };

export function htmlPdfGeometry(width: number, height: number, settings: HtmlPdfSettings) {
  const size = PAGE_SIZES[settings.pageSize];
  const [pageWidth, pageHeight] = settings.orientation === "portrait" ? size : [size[1], size[0]];
  const margin = MARGINS[settings.margin];
  const ratio = (pageWidth - margin * 2) / width;
  const contentHeight = height * ratio;
  // Never squash or silently truncate a long page to fit PDF's page-size limit.
  if (settings.oneLongPage && contentHeight + margin * 2 > 14400) {
    throw new Error('This website is too tall for one PDF page. Turn off "One long page" to save every section.');
  }
  return { pageWidth, pageHeight: settings.oneLongPage ? contentHeight + margin * 2 : pageHeight, margin, ratio };
}

async function withDeadline<T>(promise: Promise<T>, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), 20000); })]);
  } finally { clearTimeout(timer); }
}

export async function waitForHtmlAssets(doc: Document) {
  await withDeadline(doc.fonts.ready, "Website fonts are still loading. Please retry the conversion.");
  await withDeadline(Promise.all(Array.from(doc.images).map(async image => {
    // Only assets belonging to visible content are required for the snapshot.
    if (!image.getClientRects().length || !image.getAttribute("src") && !image.getAttribute("srcset")) return;
    if (!image.complete) await new Promise<void>((resolve, reject) => {
      const cleanup = () => { image.removeEventListener("load", loaded); image.removeEventListener("error", failed); };
      const loaded = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error("A website image could not load. Please refresh the preview and try again.")); };
      image.addEventListener("load", loaded, { once: true });
      image.addEventListener("error", failed, { once: true });
    });
    if (!image.naturalWidth) throw new Error("A website image is missing. Please refresh the preview before converting.");
    await image.decode();
  })), "Website images are still loading. Please retry the conversion.");
}

// html2canvas 1.x does not implement object-fit. Bake the browser's crop into
// each affected image in the clone, retaining the original CSS box and border.
function preserveImageCrops(doc: Document) {
  for (const img of Array.from(doc.images)) {
    const css = doc.defaultView!.getComputedStyle(img);
    if (!["cover", "contain"].includes(css.objectFit) || !img.naturalWidth || !img.clientWidth || !img.clientHeight) continue;
    const width = img.clientWidth, height = img.clientHeight;
    const factor = css.objectFit === "cover" ? Math.max(width / img.naturalWidth, height / img.naturalHeight) : Math.min(width / img.naturalWidth, height / img.naturalHeight);
    const position = css.objectPosition.split(" ");
    const offset = (value: string, space: number) => value.endsWith("%") ? parseFloat(value) / 100 * space : parseFloat(value) || 0;
    const canvas = doc.createElement("canvas");
    const scale = Math.min(2, 2400 / Math.max(width, height));
    canvas.width = Math.max(1, Math.ceil(width * scale)); canvas.height = Math.max(1, Math.ceil(height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the website images.");
    context.scale(scale, scale);
    context.drawImage(img, offset(position[0], width - img.naturalWidth * factor), offset(position[1] || "50%", height - img.naturalHeight * factor), img.naturalWidth * factor, img.naturalHeight * factor);
    // A fresh canvas also avoids responsive-image density correction changing
    // naturalWidth after swapping an img's src during document cloning.
    for (const property of Array.from(css)) canvas.style.setProperty(property, css.getPropertyValue(property));
    canvas.style.width = css.width;
    canvas.style.height = css.height;
    canvas.style.objectFit = "fill";
    img.replaceWith(canvas);
  }
}

/** Render at the preview's viewport. Capture height must never become viewport
 * height: doing so changes vh/dvh units and stretches hero sections. Tiles bound
 * canvas memory; PDF pages and links keep the original aspect ratio. */
export async function captureHtmlElementToPdfBlob(element: HTMLElement, settings: HtmlPdfSettings, onProgress?: (percent: number) => void): Promise<Blob> {
  const doc = element.ownerDocument, view = doc.defaultView;
  if (!view) throw new Error("Please wait for the HTML preview to load.");
  await waitForHtmlAssets(doc);
  const viewportWidth = view.innerWidth, viewportHeight = view.innerHeight;
  const sourceWidth = Math.max(doc.documentElement.clientWidth, element.scrollWidth);
  const sourceHeight = Math.max(element.scrollHeight, doc.documentElement.scrollHeight);
  if (sourceWidth > 10000 || sourceHeight > 150000) throw new Error("This page is too large to render in the browser. Please convert a smaller section.");
  const { pageWidth, pageHeight, margin, ratio } = htmlPdfGeometry(sourceWidth, sourceHeight, settings);
  const [{ default: html2canvas }, { PDFDocument, PDFName, PDFString }] = await Promise.all([import("html2canvas"), import("pdf-lib")]);
  const pdf = await PDFDocument.create();
  const pageContentHeight = (pageHeight - margin * 2) / ratio;
  const pageCount = settings.oneLongPage ? 1 : Math.ceil(sourceHeight / pageContentHeight);
  const pages = Array.from({ length: pageCount }, () => pdf.addPage([pageWidth, pageHeight]));
  const scale = Math.min(2, 2400 / sourceWidth);
  const tileHeight = Math.min(2048, Math.floor(4000000 / (sourceWidth * scale * scale)));
  const scrollX = view.scrollX, scrollY = view.scrollY;
  view.scrollTo(0, 0);
  let outputBytes = 0;
  try {
    for (let y = 0; y < sourceHeight;) {
      const pageIndex = settings.oneLongPage ? 0 : Math.min(pageCount - 1, Math.floor((y + 0.01) / pageContentHeight));
      const pageEnd = pageIndex === pageCount - 1 ? sourceHeight : (pageIndex + 1) * pageContentHeight;
      const end = Math.min(sourceHeight, y + tileHeight, pageEnd);
      const height = end - y;
      const canvas = await html2canvas(doc.documentElement, {
        backgroundColor: "#ffffff", logging: false, useCORS: true, allowTaint: false,
        scale, x: 0, y, width: sourceWidth, height,
        windowWidth: viewportWidth, windowHeight: viewportHeight, scrollX: 0, scrollY: 0,
        onclone: async clone => {
          const freeze = clone.createElement("style");
          freeze.textContent = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";
          clone.head.append(freeze);
          preserveImageCrops(clone);
          await Promise.all(Array.from(clone.images).filter(img => img.src.startsWith("data:")).map(img => img.decode()));
        },
      });
      try {
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Could not render this PDF page.")), "image/jpeg", 0.95));
        outputBytes += blob.size;
        if (outputBytes > 128 * 1024 * 1024) throw new Error("The PDF is too large to finish in this browser. Choose a smaller screen size.");
        const image = await pdf.embedJpg(await blob.arrayBuffer());
        pages[pageIndex].drawImage(image, { x: margin, y: pageHeight - margin - (end - pageIndex * pageContentHeight) * ratio, width: sourceWidth * ratio, height: height * ratio });
      } finally { canvas.width = 1; canvas.height = 1; }
      y = end;
      onProgress?.(10 + y / sourceHeight * 85);
    }
    for (const link of Array.from(doc.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
      let url: URL;
      try { url = new URL(link.href); } catch { continue; }
      if (!["https:", "http:", "mailto:", "tel:"].includes(url.protocol)) continue;
      for (const rect of Array.from(link.getClientRects())) {
        const left = Math.max(0, rect.left), right = Math.min(sourceWidth, rect.right);
        if (right <= left || rect.height <= 0) continue;
        for (let i = 0; i < pageCount; i++) {
          const top = Math.max(rect.top, i * pageContentHeight), bottom = Math.min(rect.bottom, (i + 1) * pageContentHeight, sourceHeight);
          if (bottom <= top) continue;
          const annotation = pdf.context.obj({ Type: "Annot", Subtype: "Link", Rect: [margin + left * ratio, pageHeight - margin - (bottom - i * pageContentHeight) * ratio, margin + right * ratio, pageHeight - margin - (top - i * pageContentHeight) * ratio], Border: [0, 0, 0], A: { Type: "Action", S: "URI", URI: PDFString.of(url.href) } });
          pages[i].node.addAnnot(pdf.context.register(annotation));
        }
      }
    }
    pdf.catalog.set(PDFName.of("PageLayout"), PDFName.of("OneColumn"));
    const bytes = await pdf.save();
    onProgress?.(100);
    return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  } finally { view.scrollTo(scrollX, scrollY); }
}
