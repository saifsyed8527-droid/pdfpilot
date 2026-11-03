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

const PAGE_SIZES = {
  a3: [842, 1191],
  a4: [595, 842],
  a5: [420, 595],
  letter: [612, 792],
};
const MARGINS = { none: 0, small: 40, big: 64 };

export function htmlPdfGeometry(
  width: number,
  height: number,
  settings: HtmlPdfSettings,
) {
  if (
    ![width, height].every((value) => Number.isFinite(value) && value > 0) ||
    !Object.hasOwn(PAGE_SIZES, settings.pageSize) ||
    !Object.hasOwn(MARGINS, settings.margin) ||
    !["portrait", "landscape"].includes(settings.orientation)
  ) {
    throw new Error("Choose valid page dimensions and PDF settings.");
  }
  const size = PAGE_SIZES[settings.pageSize];
  const [pageWidth, pageHeight] =
    settings.orientation === "portrait" ? size : [size[1], size[0]];
  const margin = MARGINS[settings.margin];
  const ratio = (pageWidth - margin * 2) / width;
  const contentHeight = height * ratio;
  // Never squash or silently truncate a long page to fit PDF's page-size limit.
  if (settings.oneLongPage && contentHeight + margin * 2 > 14400) {
    throw new Error(
      'This website is too tall for one PDF page. Turn off "One long page" to save every section.',
    );
  }
  return {
    pageWidth,
    pageHeight: settings.oneLongPage ? contentHeight + margin * 2 : pageHeight,
    margin,
    ratio,
  };
}

function checkCapture(signal?: AbortSignal) {
  if (signal?.aborted)
    throw new DOMException("Conversion cancelled.", "AbortError");
}
// html2canvas only removes its temporary iframe after a successful render.
// Keep pre-existing frames and remove only this conversion's leftovers.
export function captureFrameCleanup(doc: Document) {
  const existing = new Set(
    doc.querySelectorAll("iframe.html2canvas-container"),
  );
  return () => {
    for (const frame of Array.from(
      doc.querySelectorAll("iframe.html2canvas-container"),
    ))
      if (!existing.has(frame)) frame.remove();
  };
}
async function withDeadline<T>(
  promise: Promise<T>,
  message: string,
  signal?: AbortSignal,
): Promise<T> {
  checkCapture(signal);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort = () => {};
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), 20000);
        abort = () =>
          reject(new DOMException("Conversion cancelled.", "AbortError"));
        signal?.addEventListener("abort", abort, { once: true });
      }),
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

export async function waitForHtmlAssets(doc: Document, signal?: AbortSignal) {
  checkCapture(signal);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    await withDeadline(
      doc.fonts.ready,
      "Website fonts are still loading. Please retry the conversion.",
      controller.signal,
    );
    await withDeadline(
      Promise.all(
        Array.from(doc.images).map(async (image) => {
          checkCapture(controller.signal);
          // Only assets belonging to visible content are required for the snapshot.
          if (
            !image.getClientRects().length ||
            (!image.getAttribute("src") && !image.getAttribute("srcset"))
          )
            return;
          if (!image.complete)
            await new Promise<void>((resolve, reject) => {
              const cleanup = () => {
                image.removeEventListener("load", loaded);
                image.removeEventListener("error", failed);
                controller.signal.removeEventListener("abort", cancelled);
              };
              const loaded = () => {
                cleanup();
                resolve();
              };
              const failed = () => {
                cleanup();
                reject(
                  new Error(
                    "A website image could not load. Please refresh the preview and try again.",
                  ),
                );
              };
              const cancelled = () => {
                cleanup();
                reject(new DOMException("Conversion cancelled.", "AbortError"));
              };
              image.addEventListener("load", loaded, { once: true });
              image.addEventListener("error", failed, { once: true });
              controller.signal.addEventListener("abort", cancelled, {
                once: true,
              });
              // The image may have finished between the first check and listener setup.
              if (image.complete) loaded();
            });
          checkCapture(controller.signal);
          if (!image.naturalWidth)
            throw new Error(
              "A website image is missing. Please refresh the preview before converting.",
            );
          await image.decode();
          checkCapture(controller.signal);
        }),
      ),
      "Website images are still loading. Please retry the conversion.",
      controller.signal,
    );
  } finally {
    controller.abort();
    signal?.removeEventListener("abort", abort);
  }
}

// html2canvas 1.x does not implement object-fit. Bake the browser's crop into
// each affected image in the clone, retaining the original CSS box and border.
export function preserveImageCrops(doc: Document) {
  for (const img of Array.from(doc.images)) {
    const css = doc.defaultView!.getComputedStyle(img);
    if (
      !["cover", "contain"].includes(css.objectFit) ||
      !img.naturalWidth ||
      !img.clientWidth ||
      !img.clientHeight
    )
      continue;
    const width = img.clientWidth,
      height = img.clientHeight;
    const factor =
      css.objectFit === "cover"
        ? Math.max(width / img.naturalWidth, height / img.naturalHeight)
        : Math.min(width / img.naturalWidth, height / img.naturalHeight);
    const position = css.objectPosition.split(" ");
    const offset = (value: string, space: number) =>
      value.endsWith("%")
        ? (parseFloat(value) / 100) * space
        : parseFloat(value) || 0;
    const canvas = doc.createElement("canvas");
    const scale = Math.min(2, 2400 / Math.max(width, height));
    canvas.width = Math.max(1, Math.ceil(width * scale));
    canvas.height = Math.max(1, Math.ceil(height * scale));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("This browser could not prepare the website images.");
    context.scale(scale, scale);
    context.drawImage(
      img,
      offset(position[0], width - img.naturalWidth * factor),
      offset(position[1] || "50%", height - img.naturalHeight * factor),
      img.naturalWidth * factor,
      img.naturalHeight * factor,
    );
    // A fresh canvas also avoids responsive-image density correction changing
    // naturalWidth after swapping an img's src during document cloning.
    for (const property of Array.from(css))
      canvas.style.setProperty(property, css.getPropertyValue(property));
    canvas.style.width = css.width;
    canvas.style.height = css.height;
    canvas.style.objectFit = "fill";
    img.replaceWith(canvas);
  }
}

/** Render at the preview's viewport. Capture height must never become viewport
 * height: doing so changes vh/dvh units and stretches hero sections. Tiles bound
 * canvas memory; PDF pages and links keep the original aspect ratio. */
export async function captureHtmlElementToPdfBlob(
  element: HTMLElement,
  settings: HtmlPdfSettings,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  checkCapture(signal);
  const doc = element.ownerDocument,
    view = doc.defaultView;
  if (!view) throw new Error("Please wait for the HTML preview to load.");
  if (doc.querySelectorAll("*").length > 6000)
    throw new Error(
      "This page is too complex to capture in this browser. Use a smaller HTML page.",
    );
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 180_000);
  const scrollX = view.scrollX,
    scrollY = view.scrollY;
  const cleanupFrames = captureFrameCleanup(doc);
  try {
    await waitForHtmlAssets(doc, controller.signal);
    checkCapture(controller.signal);
    const viewportWidth = view.innerWidth,
      viewportHeight = view.innerHeight;
    const sourceWidth = Math.max(
      doc.documentElement.clientWidth,
      element.scrollWidth,
    );
    const sourceHeight = Math.max(
      element.scrollHeight,
      doc.documentElement.scrollHeight,
    );
    if (sourceWidth > 10000 || sourceHeight > 150000)
      throw new Error(
        "This page is too large to render in the browser. Please convert a smaller section.",
      );
    const { pageWidth, pageHeight, margin, ratio } = htmlPdfGeometry(
      sourceWidth,
      sourceHeight,
      settings,
    );
    const [{ default: html2canvas }, { PDFDocument, PDFName, PDFString }] =
      await Promise.all([import("html2canvas"), import("pdf-lib")]);
    checkCapture(controller.signal);
    const pdf = await PDFDocument.create();
    const pageContentHeight = (pageHeight - margin * 2) / ratio;
    const pageCount = settings.oneLongPage
      ? 1
      : Math.ceil(sourceHeight / pageContentHeight);
    if (pageCount > 200)
      throw new Error(
        "This page would create more than 200 PDF pages. Choose a smaller section.",
      );
    const pages = Array.from({ length: pageCount }, () =>
      pdf.addPage([pageWidth, pageHeight]),
    );
    const scale = Math.min(2, 2400 / sourceWidth);
    if (sourceWidth * sourceHeight * scale * scale > 100_000_000)
      throw new Error(
        "This page needs too much image memory. Choose a smaller screen size or a shorter HTML page.",
      );
    const tileHeight = Math.max(
      1,
      Math.min(2048, Math.floor(4000000 / (sourceWidth * scale * scale))),
    );
    view.scrollTo(0, 0);
    let outputBytes = 0;
    for (let y = 0; y < sourceHeight; ) {
      checkCapture(controller.signal);
      const pageIndex = settings.oneLongPage
        ? 0
        : Math.min(pageCount - 1, Math.floor((y + 0.01) / pageContentHeight));
      const pageEnd =
        pageIndex === pageCount - 1
          ? sourceHeight
          : (pageIndex + 1) * pageContentHeight;
      const end = Math.min(sourceHeight, y + tileHeight, pageEnd);
      const height = end - y;
      const canvas = await html2canvas(doc.documentElement, {
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true,
        allowTaint: false,
        scale,
        x: 0,
        y,
        width: sourceWidth,
        height,
        windowWidth: viewportWidth,
        windowHeight: viewportHeight,
        scrollX: 0,
        scrollY: 0,
        onclone: async (clone) => {
          checkCapture(controller.signal);
          const freeze = clone.createElement("style");
          freeze.textContent =
            "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";
          clone.head.append(freeze);
          preserveImageCrops(clone);
          await withDeadline(
            Promise.all(
              Array.from(clone.images)
                .filter((img) => img.src.startsWith("data:"))
                .map((img) => img.decode()),
            ),
            "An embedded website image could not be decoded. Try a smaller page.",
            controller.signal,
          );
        },
      });
      try {
        checkCapture(controller.signal);
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (value) =>
              value
                ? resolve(value)
                : reject(new Error("Could not render this PDF page.")),
            "image/jpeg",
            0.95,
          ),
        );
        checkCapture(controller.signal);
        outputBytes += blob.size;
        if (outputBytes > 128 * 1024 * 1024)
          throw new Error(
            "The PDF is too large to finish in this browser. Choose a smaller screen size.",
          );
        const image = await pdf.embedJpg(await blob.arrayBuffer());
        checkCapture(controller.signal);
        pages[pageIndex].drawImage(image, {
          x: margin,
          y:
            pageHeight - margin - (end - pageIndex * pageContentHeight) * ratio,
          width: sourceWidth * ratio,
          height: height * ratio,
        });
      } finally {
        canvas.width = 1;
        canvas.height = 1;
      }
      y = end;
      onProgress?.(10 + (y / sourceHeight) * 85);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    checkCapture(controller.signal);
    for (const link of Array.from(
      doc.querySelectorAll<HTMLAnchorElement>("a[href]"),
    )) {
      checkCapture(controller.signal);
      let url: URL;
      try {
        url = new URL(link.href);
      } catch {
        continue;
      }
      if (
        !["https:", "http:", "mailto:", "tel:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        continue;
      for (const rect of Array.from(link.getClientRects())) {
        const left = Math.max(0, rect.left),
          right = Math.min(sourceWidth, rect.right);
        if (right <= left || rect.height <= 0) continue;
        for (let i = 0; i < pageCount; i++) {
          const top = Math.max(rect.top, i * pageContentHeight),
            bottom = Math.min(
              rect.bottom,
              (i + 1) * pageContentHeight,
              sourceHeight,
            );
          if (bottom <= top) continue;
          const annotation = pdf.context.obj({
            Type: "Annot",
            Subtype: "Link",
            Rect: [
              margin + left * ratio,
              pageHeight - margin - (bottom - i * pageContentHeight) * ratio,
              margin + right * ratio,
              pageHeight - margin - (top - i * pageContentHeight) * ratio,
            ],
            Border: [0, 0, 0],
            A: { Type: "Action", S: "URI", URI: PDFString.of(url.href) },
          });
          pages[i].node.addAnnot(pdf.context.register(annotation));
        }
      }
    }
    pdf.catalog.set(PDFName.of("PageLayout"), PDFName.of("OneColumn"));
    const bytes = await pdf.save();
    checkCapture(controller.signal);
    if (bytes.byteLength > 128 * 1024 * 1024)
      throw new Error(
        "The PDF exceeds 128MB. Choose a smaller screen size or shorter page.",
      );
    onProgress?.(100);
    return new Blob([bytes as unknown as BlobPart], {
      type: "application/pdf",
    });
  } catch (error) {
    if (timedOut && !signal?.aborted)
      throw new Error(
        "This page took too long to convert. Choose a smaller screen size or use a self-contained HTML file.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
    controller.abort();
    signal?.removeEventListener("abort", abort);
    cleanupFrames();
    view.scrollTo(scrollX, scrollY);
  }
}
