import { loadPdfjs } from "../pdfjs";
import { createOcrWorker, type OcrResult, type OcrWorker } from "./ocr-engine";
import { normalizeOcrText, ocrLanguages, ocrPages } from "./ocr-options";
import { pdfDocumentInputError } from "./conversion-input-errors";
import { safeBaseName } from "./pdf-split-engine";

export interface PdfPowerpointOptions {
  output: "appearance" | "editable";
  recognition: "text" | "auto" | "ocr";
  layout: "source" | "wide" | "standard";
  pages?: string;
  languages?: string[];
  dpi?: 150 | 300;
  /** High-quality JPEG is the default to keep image-heavy decks manageable. */
  imageFormat?: "jpeg" | "png";
  signal?: AbortSignal;
  onStatus?: (message: string) => void;
  onProgress?: (percent: number) => void;
}
export interface SlideTextBox {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  rotate: number;
  rtl: boolean;
}
export interface PdfPowerpointReport {
  page: number;
  /** Recognized segments; appearance mode retains them in speaker notes. */
  textBoxes: number;
  ocr: boolean;
  confidence?: number;
  uncertainWords?: number;
  imageTextNotRecognized: boolean;
  /** The page image is intact, but its optional search text exceeded safe limits. */
  textLayerOmitted?: boolean;
  /** OCR failed; the page artwork and any original selectable text are intact. */
  ocrFailed?: boolean;
}
export interface PdfPowerpointResult {
  blob: Blob;
  filename: string;
  sourcePages: number;
  output: PdfPowerpointOptions["output"];
  reports: PdfPowerpointReport[];
  imageFormat?: "jpeg" | "png";
}
export class PdfPowerpointInputError extends Error {}
export function pdfPowerpointError(error: unknown) {
  if (error instanceof PdfPowerpointInputError) return error.message;
  return pdfDocumentInputError(error);
}
const fail = (message: string): never => {
  throw new PdfPowerpointInputError(message);
};
const clean = (text: string) =>
  text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim();
const isRtl = (text: string) =>
  (text.match(/[\p{Script=Arabic}\p{Script=Hebrew}]/gu)?.length ?? 0) >
  (text.match(/\p{L}/gu)?.length ?? 0) / 2;

/** Coordinates are rendered CropBox points, including inherited native rotation
 * and UserUnit. Text boxes rotate about their centre, as PowerPoint does. */
export function nativeSlideText(
  content: Awaited<
    ReturnType<import("pdfjs-dist").PDFPageProxy["getTextContent"]>
  >,
  view: ReturnType<import("pdfjs-dist").PDFPageProxy["getViewport"]>,
  transform: (a: number[], b: number[]) => number[],
): SlideTextBox[] {
  if (content.items.length > 100_000)
    fail("A page has too many text objects. Choose a simpler PDF.");
  const boxes: SlideTextBox[] = [];
  for (const item of content.items) {
    if (!("str" in item)) continue;
    const text = clean(item.str);
    if (!text) continue;
    const [a, b, c, d, x, y] = transform(view.transform, item.transform);
    const fontSize = Math.hypot(c, d),
      width =
        Math.abs(item.width) * Math.hypot(view.transform[0], view.transform[1]);
    if (
      ![a, b, c, d, x, y, fontSize, width].every(Number.isFinite) ||
      fontSize <= 0 ||
      width <= 0
    )
      continue;
    const norm = Math.hypot(a, b) || fontSize,
      ux = a / norm,
      uy = b / norm;
    const style = content.styles[item.fontName];
    const ascent = Number.isFinite(style?.ascent) ? style.ascent : 0.8;
    const topX = x + c * ascent,
      topY = y + d * ascent,
      height = fontSize * 1.2;
    const corners = [
      [topX, topY],
      [topX + ux * width, topY + uy * width],
      [topX - uy * height, topY + ux * height],
      [topX + ux * width - uy * height, topY + uy * width + ux * height],
    ];
    if (
      Math.max(...corners.map((p) => p[0])) < 0 ||
      Math.min(...corners.map((p) => p[0])) > view.width ||
      Math.max(...corners.map((p) => p[1])) < 0 ||
      Math.min(...corners.map((p) => p[1])) > view.height
    )
      continue;
    const cx = topX + (ux * width) / 2 - (uy * height) / 2,
      cy = topY + (uy * width) / 2 + (ux * height) / 2;
    const box = {
      text,
      x: cx - width / 2,
      y: cy - height / 2,
      width,
      height,
      fontSize,
      rotate: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360,
      rtl: item.dir === "rtl" || isRtl(text),
    };
    if (
      !boxes
        .slice(-8)
        .some(
          (old) =>
            old.text === text &&
            Math.abs(old.x - box.x) < 0.8 &&
            Math.abs(old.y - box.y) < 0.8 &&
            Math.abs(old.rotate - box.rotate) < 0.1,
        )
    )
      boxes.push(box);
    if (boxes.length > 10_000)
      fail("A page exceeds 10,000 editable text boxes. Choose a simpler PDF.");
  }
  return boxes;
}
export function ocrSlideText(
  result: OcrResult,
  sx: number,
  sy: number,
  languages: string[],
  native: SlideTextBox[] = [],
): SlideTextBox[] {
  const words = result.words ?? [];
  if (words.length > 100_000)
    fail("A page has too many recognized words. Choose a simpler PDF.");
  if (words.length * native.length > 5_000_000)
    fail("This page has too much overlapping text to combine safely.");
  const lines = new Map<number, typeof words>();
  words.forEach((word, index) => {
    if (!clean(word.text) || !Object.values(word.bbox).every(Number.isFinite))
      return;
    // Native PDF text is authoritative. Never replace it with an OCR guess,
    // even when the user asks to recognize additional text inside pictures.
    const x = ((word.bbox.x0 + word.bbox.x1) / 2) * sx;
    const y = ((word.bbox.y0 + word.bbox.y1) / 2) * sy;
    if (native.some(box => {
      const angle = box.rotate * Math.PI / 180;
      const dx = x - box.x - box.width / 2;
      const dy = y - box.y - box.height / 2;
      return Math.abs(dx * Math.cos(angle) + dy * Math.sin(angle)) <= box.width / 2 + 2 &&
        Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle)) <= box.height / 2 + 2;
    })) return;
    const key = word.line ?? index,
      line = lines.get(key) ?? [];
    line.push(word);
    lines.set(key, line);
  });
  const boxes: SlideTextBox[] = [];
  for (const line of lines.values()) {
    const text = clean(
      normalizeOcrText(line.map((word) => word.text).join(" "), languages),
    );
    const left = Math.min(...line.map((word) => word.bbox.x0)),
      top = Math.min(...line.map((word) => word.bbox.y0));
    const width = (Math.max(...line.map((word) => word.bbox.x1)) - left) * sx,
      inkHeight = (Math.max(...line.map((word) => word.bbox.y1)) - top) * sy;
    if (width <= 0 || inkHeight <= 0) continue;
    boxes.push({
      text,
      x: left * sx,
      y: top * sy - inkHeight * 0.16,
      width,
      height: inkHeight * 1.4,
      fontSize: inkHeight * 1.12,
      rotate: 0,
      rtl: isRtl(text),
    });
  }
  if (boxes.length > 10_000)
    fail("A page exceeds 10,000 recognized text lines. Choose a simpler page.");
  return boxes;
}
export function slideFit(
  width: number,
  height: number,
  slideWidth: number,
  slideHeight: number,
) {
  const scale = Math.min(slideWidth / width, slideHeight / height);
  return {
    x: (slideWidth - width * scale) / 2,
    y: (slideHeight - height * scale) / 2,
    scale,
  };
}

export async function convertPdfToPowerpoint(
  file: File,
  options: PdfPowerpointOptions,
): Promise<PdfPowerpointResult> {
  if (!file.size || file.size > 100 * 1024 * 1024)
    fail("Choose a non-empty PDF up to 100MB.");
  if (
    !["appearance", "editable"].includes(options.output) ||
    !["text", "auto", "ocr"].includes(options.recognition) ||
    !["source", "wide", "standard"].includes(options.layout)
  )
    fail("Choose a supported output, recognition mode and slide size.");
  const imageFormat = options.imageFormat ?? "jpeg";
  if (!["jpeg", "png"].includes(imageFormat)) fail("Choose JPEG or PNG page images.");
  const dpi = options.dpi ?? 150;
  if (![150, 300].includes(dpi)) fail("Choose 150 or 300 DPI.");
  let languages: string[];
  try {
    languages =
      options.recognition === "text"
        ? ["eng"]
        : ocrLanguages(options.languages);
  } catch (error) {
    return fail((error as Error).message);
  }
  const controller = new AbortController();
  const externalAbort = () => controller.abort();
  options.signal?.addEventListener("abort", externalAbort, { once: true });
  let loading: import("pdfjs-dist").PDFDocumentLoadingTask | undefined,
    rendering: import("pdfjs-dist").RenderTask | undefined,
    worker: OcrWorker | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined,
    timedOut = false;
  const check = () => {
    if (timedOut) fail("A page took too long. Try fewer pages or 150 DPI.");
    if (controller.signal.aborted || options.signal?.aborted)
      throw new DOMException("Conversion cancelled", "AbortError");
  };
  const heartbeat = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 180_000);
  };
  const stop = () => {
    rendering?.cancel();
    void loading?.destroy().catch(() => {});
  };
  controller.signal.addEventListener("abort", stop, { once: true });
  const reports: PdfPowerpointReport[] = [];
  let characters = 0,
    textBoxes = 0,
    imageBytes = 0,
    ocrUnavailable = false;
  try {
    check();
    heartbeat();
    options.onStatus?.("Reading PDF pages…");
    const lib = await loadPdfjs(),
      data = await file.arrayBuffer();
    check();
    loading = lib.getDocument({
      data,
      stopAtErrors: true,
      useSystemFonts: false,
      isOffscreenCanvasSupported: false,
      isImageDecoderSupported: false,
      cMapUrl: "/pdfjs-assets/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/pdfjs-assets/standard_fonts/",
      wasmUrl: "/pdfjs-assets/wasm/",
    });
    const pdf = await loading.promise;
    check();
    if (pdf.isPureXfa) fail("Export this XFA form as a standard PDF first.");
    let selected: number[];
    try {
      selected = ocrPages(options.pages, pdf.numPages);
    } catch (error) {
      return fail((error as Error).message);
    }
    const PptxGenJS = (await import("pptxgenjs")).default,
      pptx = new PptxGenJS();
    pptx.author = "PDF Pilot";
    pptx.subject = "Converted from PDF";
    pptx.title = safeBaseName(file.name);
    pptx.company = "PDF Pilot";
    let slideWidth = 0,
      slideHeight = 0;
    for (const [index, zero] of selected.entries()) {
      check();
      heartbeat();
      const number = zero + 1;
      options.onStatus?.(
        `Creating slide ${index + 1} of ${selected.length} · PDF page ${number}…`,
      );
      const page = await pdf.getPage(number);
      let canvas: HTMLCanvasElement | undefined;
      try {
        const view = page.getViewport({ scale: 1 });
        if (
          ![view.width, view.height].every((v) => Number.isFinite(v) && v > 0)
        )
          fail(`Page ${number} has invalid dimensions.`);
        if (!index) {
          if (options.layout === "wide") {
            slideWidth = 960;
            slideHeight = 540;
          } else if (options.layout === "standard") {
            slideWidth = 720;
            slideHeight = 540;
          } else {
            const factor = Math.min(
              1,
              4032 / Math.max(view.width, view.height),
            );
            slideWidth = view.width * factor;
            slideHeight = view.height * factor;
            const grow = Math.max(1, 72 / Math.min(slideWidth, slideHeight));
            slideWidth *= grow;
            slideHeight *= grow;
            if (Math.max(slideWidth, slideHeight) > 4032)
              fail(
                "This page is too narrow for a PowerPoint slide. Choose Widescreen or Standard size.",
              );
          }
          pptx.defineLayout({
            name: "PDF_PAGE",
            width: slideWidth / 72,
            height: slideHeight / 72,
          });
          pptx.layout = "PDF_PAGE";
        }
        let boxes: SlideTextBox[] = [],
          containsImages = false,
          textLayerOmitted = false;
        {
          try {
            const content = await page.getTextContent();
            check();
            boxes = nativeSlideText(content, view, lib.Util.transform);
            const ops = await page.getOperatorList();
            check();
            const imageOps = new Set([
              lib.OPS.paintImageXObject,
              lib.OPS.paintInlineImageXObject,
              lib.OPS.paintImageMaskXObject,
              lib.OPS.paintImageXObjectRepeat,
            ]);
            containsImages = ops.fnArray.some((value) => imageOps.has(value));
          } catch (error) {
            check();
            // Search text is optional in appearance mode. A complex or
            // unreadable text layer must not discard a renderable page.
            if (options.output !== "appearance")
              throw error;
            boxes = [];
            textLayerOmitted = true;
          }
        }
        const useOcr =
          options.recognition === "ocr" ||
          (!boxes.length && options.recognition === "auto");
        if (
          options.output === "editable" &&
          options.recognition === "text" &&
          !boxes.length
        )
          fail(
            `No selectable text on page ${number}. Choose Auto or Free OCR, or keep page appearance.`,
          );
        if (options.output === "appearance" || useOcr) {
          const renderView = page.getViewport({ scale: dpi / 72 }),
            width = Math.ceil(renderView.width),
            height = Math.ceil(renderView.height);
          if (
            ![width, height].every(
              (v) => Number.isFinite(v) && v > 0 && v <= 8192,
            ) ||
            width * height > 16_000_000
          )
            fail(
              `Page ${number} exceeds the 16-megapixel limit. Try 150 DPI or a smaller source page.`,
            );
          canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          rendering = page.render({
            canvas,
            viewport: renderView,
            background: "#ffffff",
            annotationMode: lib.AnnotationMode.ENABLE,
          });
          await rendering.promise;
          rendering = undefined;
          check();
        }
        let confidence: number | undefined, uncertainWords: number | undefined;
        let ocrFailed = false, ocrCompleted = false;
        if (useOcr) {
          try {
            if (ocrUnavailable) throw new Error("OCR is unavailable for this conversion.");
            options.onStatus?.(`Recognizing text on page ${number}…`);
            worker ??= await createOcrWorker(controller.signal, {
              languages,
              segmentation: "sparse",
            });
            check();
            const recognized = await worker.recognize(canvas!, (percent) => {
              if (!controller.signal.aborted)
                options.onProgress?.(
                  5 + ((index + (percent / 100) * 0.85) / selected.length) * 85,
                );
            });
            check();
            boxes = [...boxes, ...ocrSlideText(
              recognized,
              view.width / canvas!.width,
              view.height / canvas!.height,
              languages,
              boxes,
            )];
            if (boxes.length) textLayerOmitted = false;
            ocrCompleted = true;
            confidence = recognized.confidence;
            uncertainWords =
              recognized.words?.filter(
                (word) => word.confidence !== undefined && word.confidence < 60,
              ).length ?? 0;
          } catch (error) {
            check();
            if (options.output !== "appearance") throw error;
            // Optional search text cannot discard a successfully rendered page.
            // Avoid restarting a broken model/worker on every remaining page.
            ocrUnavailable = true;
            ocrFailed = true;
            await worker?.terminate();
            worker = undefined;
          }
        }
        const pageCharacters = boxes.reduce((sum, box) => sum + box.text.length, 0);
        if (boxes.length > 10_000 || characters + pageCharacters > 2_000_000 || textBoxes + boxes.length > 50_000) {
          if (options.output !== "appearance")
            fail(
              "The selection exceeds two million characters or 50,000 text boxes. Choose fewer pages.",
            );
          boxes = [];
          textLayerOmitted = true;
        } else {
          characters += pageCharacters;
          textBoxes += boxes.length;
        }
        const slide = pptx.addSlide();
        slide.background = { color: "FFFFFF" };
        const fit = slideFit(view.width, view.height, slideWidth, slideHeight);
        // Appearance slides contain only the source picture. Quick Look can
        // expose transparent text and reuse earlier pictures when additional
        // drawing objects are present. Keep native/OCR text in notes instead.
        for (const box of options.output === "editable" ? boxes : []) {
          slide.addText(box.text, {
            x: (fit.x + box.x * fit.scale) / 72,
            y: (fit.y + box.y * fit.scale) / 72,
            w: Math.max(0.01, (box.width * fit.scale) / 72),
            h: Math.max(0.01, (box.height * fit.scale) / 72),
            fontSize: Math.max(1, Math.min(400, box.fontSize * fit.scale)),
            fontFace: "Arial",
            color: "000000",
            margin: 0,
            align: box.rtl ? "right" : "left",
            rtlMode: box.rtl,
            valign: "top",
            rotate: box.rotate,
            wrap: false,
            breakLine: false,
            paraSpaceAfter: 0,
            paraSpaceBefore: 0,
          });
        }
        if (options.output === "appearance") {
          const image = canvas!.toDataURL(`image/${imageFormat}`, 0.98);
          imageBytes += image.length * 0.75;
          if (imageBytes > 200 * 1024 * 1024)
            fail("Slide images exceed 200MB. Choose fewer pages or 150 DPI.");
          slide.addImage({
            data: image,
            objectName: `PDF page ${number}`,
            altText: `Original PDF page ${number}`,
            x: fit.x / 72,
            y: fit.y / 72,
            w: (view.width * fit.scale) / 72,
            h: (view.height * fit.scale) / 72,
          });
        }
        slide.addNotes(
          `Source PDF page ${number}. ${options.output === "appearance" ? "Original page image. Extracted text is saved in these speaker notes; visible page content is not individually editable." : "Editable text on a plain background. Pictures, original fonts, colors, charts and layout details are not reconstructed."}${ocrCompleted ? " OCR text needs proofreading." : ""}${ocrFailed ? " OCR was unavailable; the page image and original selectable text are preserved." : ""}${textLayerOmitted ? " Extracted text could not be added; the page image is preserved." : ""}\n\n${boxes.map((box) => box.text).join("\n")}`,
        );
        reports.push({
          page: number,
          textBoxes: boxes.length,
          ocr: ocrCompleted,
          confidence,
          uncertainWords,
          imageTextNotRecognized: containsImages && !ocrCompleted,
          ...(textLayerOmitted ? { textLayerOmitted: true } : {}),
          ...(ocrFailed ? { ocrFailed: true } : {}),
        });
        options.onProgress?.(5 + ((index + 1) / selected.length) * 85);
      } finally {
        if (canvas) canvas.width = canvas.height = 0;
        page.cleanup();
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    check();
    if (options.output === "editable" && !textBoxes)
      fail(
        "No text was recognized. Check document languages or keep page appearance.",
      );
    heartbeat();
    options.onStatus?.("Packaging PowerPoint file…");
    const archive = (await pptx.write({ outputType: "uint8array" })) as Uint8Array;
    check();
    // PptxGenJS 4.0.1 ignores compression when outputType is supplied.
    // DEFLATE reduces file size and avoids the extensive image reuse observed
    // with stored archives in Quick Look. Image bytes remain unchanged.
    const { unzipSync, zipSync, strFromU8, strToU8 } = await import("fflate");
    const parts = unzipSync(archive);
    if (options.output === "appearance") {
      // Quick Look intermittently reuses pictures attached directly to slides.
      // Each page gets its own picture-bearing layout instead. A shared empty
      // layout, reordered layers or unique image names alone did not fix this.
      const layoutTemplate = strFromU8(parts["ppt/slideLayouts/slideLayout1.xml"]);
      const layoutRelations = strFromU8(parts["ppt/slideLayouts/_rels/slideLayout1.xml.rels"]);
      let contentTypes = strFromU8(parts["[Content_Types].xml"]);
      let master = strFromU8(parts["ppt/slideMasters/slideMaster1.xml"]);
      let masterRelations = strFromU8(parts["ppt/slideMasters/_rels/slideMaster1.xml.rels"]);
      for (let index = 1; index <= selected.length; index++) {
        const slidePath = `ppt/slides/slide${index}.xml`;
        const relPath = `ppt/slides/_rels/slide${index}.xml.rels`;
        const slideXml = strFromU8(parts[slidePath]);
        const imageId = slideXml.match(/<a:blip r:embed="([^"]+)"/)![1];
        const relXml = strFromU8(parts[relPath]);
        const relation = relXml.match(new RegExp(`<Relationship[^>]+Id="${imageId}"[^>]+>`))![0];
        const oldTarget = relation.match(/Target="\.\.\/media\/([^"]+)"/)![1];
        const imageName = `pdf_page_${String(index).padStart(4, "0")}.${imageFormat === "jpeg" ? "jpeg" : "png"}`;
        const id = `rId${10_000 + index}`;
        const updatedSlide = slideXml
          .replace(/<p:cNvPr id="(\d+)"/g, (_, value) => `<p:cNvPr id="${index * 100_000 + Number(value)}"`)
          .replace(`r:embed="${imageId}"`, `r:embed="${id}"`);
        const imageRelation = relation
          .replace(`Id="${imageId}"`, `Id="${id}"`)
          .replace(`../media/${oldTarget}`, `../media/${imageName}`);
        const picture = updatedSlide.match(/<p:pic>[\s\S]*?<\/p:pic>/)![0];
        const layoutName = `page${index}.xml`;
        parts[slidePath] = strToU8(updatedSlide.replace(picture, ""));
        parts[relPath] = strToU8(relXml.replace(relation, "")
          .replace("../slideLayouts/slideLayout1.xml", `../slideLayouts/${layoutName}`));
        parts[`ppt/slideLayouts/${layoutName}`] = strToU8(layoutTemplate
          .replace("</p:spTree>", `${picture}</p:spTree>`));
        parts[`ppt/slideLayouts/_rels/${layoutName}.rels`] = strToU8(layoutRelations
          .replace("</Relationships>", `${imageRelation}</Relationships>`));
        contentTypes = contentTypes.replace("</Types>",
          `<Override PartName="/ppt/slideLayouts/${layoutName}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/></Types>`);
        master = master.replace("</p:sldLayoutIdLst>",
          `<p:sldLayoutId id="${2_147_484_000 + index}" r:id="rId${50_000 + index}"/></p:sldLayoutIdLst>`);
        masterRelations = masterRelations.replace("</Relationships>",
          `<Relationship Id="rId${50_000 + index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/${layoutName}"/></Relationships>`);
        const image = parts[`ppt/media/${oldTarget}`];
        parts[`ppt/media/${imageName}`] = image;
        delete parts[`ppt/media/${oldTarget}`];
      }
      parts["[Content_Types].xml"] = strToU8(contentTypes);
      parts["ppt/slideMasters/slideMaster1.xml"] = strToU8(master);
      parts["ppt/slideMasters/_rels/slideMaster1.xml.rels"] = strToU8(masterRelations);
    }
    const packed = zipSync(parts, { level: 1 });
    const blob = new Blob([packed.buffer as ArrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
    check();
    if (blob.size > 128 * 1024 * 1024)
      fail("The PowerPoint file exceeds 128MB. Choose fewer pages or 150 DPI.");
    options.onProgress?.(100);
    return {
      blob,
      filename: `${safeBaseName(file.name)}.pptx`,
      sourcePages: pdf.numPages,
      output: options.output,
      reports,
      ...(options.output === "appearance" ? { imageFormat } : {}),
    };
  } catch (error) {
    check();
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", externalAbort);
    controller.signal.removeEventListener("abort", stop);
    rendering?.cancel();
    try {
      await worker?.terminate();
    } finally {
      await loading?.destroy().catch(() => {});
    }
  }
}
