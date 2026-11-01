"use client";

import { preserveImageCrops, waitForHtmlAssets } from "./html-to-pdf-engine";

export type HtmlImageFormat = "png" | "jpg" | "webp" | "svg";
export interface HtmlImageSettings {
  format: HtmlImageFormat;
  scale: 1 | 2;
  area: "full" | "viewport";
  quality: number;
}

export function htmlImageGeometry(width: number, fullHeight: number, viewportHeight: number, settings: HtmlImageSettings) {
  if (![width, fullHeight, viewportHeight].every(value => Number.isFinite(value) && value > 0) ||
      !["png", "jpg", "webp", "svg"].includes(settings.format) || ![1, 2].includes(settings.scale) ||
      !["full", "viewport"].includes(settings.area) || !Number.isFinite(settings.quality) || settings.quality < 0.1 || settings.quality > 1) {
    throw new Error("Choose valid image settings.");
  }
  const height = Math.ceil(settings.area === "viewport" ? Math.min(fullHeight, viewportHeight) : fullHeight);
  const scale = settings.format === "svg" ? 1 : settings.scale;
  const outputWidth = Math.ceil(width * scale), outputHeight = Math.ceil(height * scale);
  if (outputWidth > 16384 || outputHeight > 16384 || outputWidth * outputHeight > 32_000_000) {
    throw new Error("This image exceeds 32 megapixels or 16,384 pixels per side. Choose a smaller screen size, 1× resolution or the first screen only.");
  }
  return { width: Math.ceil(width), height, scale, outputWidth, outputHeight };
}

function check(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Conversion cancelled.", "AbortError");
}

async function withAbort<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  check(signal);
  let abort: () => void = () => {};
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      abort = () => reject(new DOMException("Conversion cancelled.", "AbortError"));
      signal.addEventListener("abort", abort, { once: true });
    })]);
  } finally { signal.removeEventListener("abort", abort); }
}

/** Downloaded SVG is inert, self-contained HTML-in-SVG, not a bitmap wrapper.
 * Browser foreignObject support is required; not all vector editors support it. */
export function sanitizeSnapshotSvg(svg: string, parser: DOMParser = new DOMParser()): string {
  const doc = parser.parseFromString(svg, "image/svg+xml");
  if (doc.querySelector("parsererror") || doc.documentElement.localName !== "svg") throw new Error("Could not create a valid SVG image.");
  doc.querySelectorAll("script,iframe,object,embed,link,meta,base,animate,animateMotion,animateTransform,set,video,audio,source").forEach(node => node.remove());
  for (const node of Array.from(doc.querySelectorAll("*"))) {
    for (const attribute of Array.from(node.attributes)) {
      if (/^on/i.test(attribute.name) || ["srcdoc", "srcset", "action", "formaction", "ping", "target"].includes(attribute.name)) node.removeAttribute(attribute.name);
      if (["src", "href", "xlink:href"].includes(attribute.name)) {
        if (node.localName === "a") node.removeAttribute(attribute.name);
        else if (!/^(#|data:(image\/|font\/|application\/(font|x-font|octet-stream)))/i.test(attribute.value)) {
          throw new Error("Some website assets could not be embedded in SVG. Refresh the preview or choose PNG.");
        }
      }
    }
    const css = node.localName === "style" ? node.textContent || "" : node.getAttribute("style") || "";
    const urls = Array.from(css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi), match => match[2].trim());
    if (/@import\b/i.test(css) || urls.some(url => url && !/^(data:|#)/i.test(url))) {
      throw new Error("Some SVG fonts or backgrounds could not be embedded. Refresh the preview or choose PNG.");
    }
  }
  return new XMLSerializer().serializeToString(doc);
}

async function captureSvg(element: HTMLElement, width: number, height: number, signal: AbortSignal): Promise<Blob> {
  const [{ toSvg }, { embedResources }] = await Promise.all([
    import("@/lib/vendor/html-to-image"), import("@/lib/vendor/html-to-image/embed-resources"),
  ]);
  check(signal);
  const options = { includeQueryParams: true, fetchRequestInit: { signal, credentials: "omit" as RequestCredentials }, preferredFontFormat: "woff2" };
  // Collect from the source document, not the application's document. An iframe
  // has different Element constructors, so upstream used-font traversal can miss it.
  const fonts: string[] = [];
  const readRules = async (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      check(signal);
      if (rule.type === 5) fonts.push(await embedResources(rule.cssText, rule.parentStyleSheet?.href || element.ownerDocument.baseURI, options));
      else if ("cssRules" in rule) await readRules((rule as CSSGroupingRule).cssRules);
      else if (rule.type === 3 && (rule as CSSImportRule).styleSheet) await readRules((rule as CSSImportRule).styleSheet!.cssRules);
    }
  };
  for (const sheet of Array.from(element.ownerDocument.styleSheets)) {
    try { await readRules(sheet.cssRules); } catch (error) {
      check(signal);
      throw new Error(`Could not embed a website font or stylesheet. Choose PNG or use a self-contained HTML file. ${error instanceof Error ? error.message : ""}`);
    }
  }
  const uri = await toSvg(element.ownerDocument.documentElement, {
    ...options, width, height, backgroundColor: "#ffffff", fontEmbedCSS: fonts.join("\n"),
    style: { width: `${width}px`, height: `${height}px`, overflow: "hidden" },
    filter: node => {
      check(signal);
      return !["HEAD", "SCRIPT", "STYLE", "LINK", "META", "IFRAME", "OBJECT", "EMBED", "VIDEO", "AUDIO", "SOURCE"].includes(node.nodeName);
    },
  });
  check(signal);
  const svg = sanitizeSnapshotSvg(decodeURIComponent(uri.slice(uri.indexOf(",") + 1)));
  return new Blob([svg], { type: "image/svg+xml" });
}

export async function captureHtmlElementToImage(element: HTMLElement, settings: HtmlImageSettings, onProgress?: (value: number) => void, signal?: AbortSignal): Promise<{ blob: Blob; width: number; height: number }> {
  check(signal);
  const doc = element.ownerDocument, view = doc.defaultView;
  if (!view) throw new Error("Please wait for the HTML preview to load.");
  if (doc.querySelectorAll("*").length > 6000) throw new Error("This page is too complex to capture in this browser. Use a smaller HTML page.");
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 90_000);
  const scrollX = view.scrollX, scrollY = view.scrollY;
  let canvas: HTMLCanvasElement | undefined;
  try {
    await withAbort(waitForHtmlAssets(doc), controller.signal);
    check(controller.signal);
    const viewportWidth = view.innerWidth, viewportHeight = view.innerHeight;
    const geometry = htmlImageGeometry(settings.area === "viewport" ? viewportWidth : Math.max(doc.documentElement.clientWidth, element.scrollWidth), Math.max(element.scrollHeight, doc.documentElement.scrollHeight), viewportHeight, settings);
    view.scrollTo(0, 0);
    onProgress?.(10);
    let blob: Blob;
    if (settings.format === "svg") {
      blob = await withAbort(captureSvg(element, geometry.width, geometry.height, controller.signal), controller.signal);
    } else {
      const { default: html2canvas } = await import("html2canvas");
      canvas = document.createElement("canvas");
      canvas.width = geometry.outputWidth; canvas.height = geometry.outputHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser could not create an image. Choose a smaller screen size.");
      context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
      const tileHeight = Math.max(1, Math.min(1024, Math.floor(4_000_000 / (geometry.width * geometry.scale ** 2))));
      for (let y = 0; y < geometry.height; y += tileHeight) {
        check(controller.signal);
        const height = Math.min(tileHeight, geometry.height - y);
        const tile = await html2canvas(doc.documentElement, {
          backgroundColor: "#ffffff", logging: false, useCORS: true, allowTaint: false,
          scale: geometry.scale, x: 0, y, width: geometry.width, height,
          windowWidth: viewportWidth, windowHeight: viewportHeight, scrollX: 0, scrollY: 0,
          onclone: clone => {
            check(controller.signal);
            const freeze = clone.createElement("style");
            freeze.textContent = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";
            clone.head.append(freeze); preserveImageCrops(clone);
          },
        });
        try { check(controller.signal); context.drawImage(tile, 0, y * geometry.scale); }
        finally { tile.width = 1; tile.height = 1; }
        onProgress?.(10 + (y + height) / geometry.height * 80);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      check(controller.signal);
      const type = settings.format === "jpg" ? "image/jpeg" : `image/${settings.format}`;
      blob = await new Promise<Blob>((resolve, reject) => canvas!.toBlob(value => value ? resolve(value) : reject(new Error("Could not encode this image. Choose a smaller screen size.")), type, settings.quality));
      if (blob.type !== type) throw new Error("This browser cannot export that format. Please choose PNG or JPG.");
    }
    check(controller.signal);
    if (blob.size > 60 * 1024 * 1024) throw new Error("This image exceeds 60MB. Choose a smaller screen size or JPG.");
    onProgress?.(100);
    return { blob, width: geometry.outputWidth, height: geometry.outputHeight };
  } catch (error) {
    if (timedOut && !signal?.aborted) throw new Error("This page took too long to capture. Choose a smaller screen size or use a self-contained HTML file.");
    throw error;
  } finally {
    clearTimeout(timer); controller.abort(); signal?.removeEventListener("abort", abort);
    if (canvas) { canvas.width = 1; canvas.height = 1; }
    view.scrollTo(scrollX, scrollY);
  }
}
