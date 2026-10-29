import { loadPdfjs } from "../pdfjs";
import { createOcrWorker, type OcrWorker } from "./ocr-engine";

export interface ReadableOptions {
  pages?: string; ocrScans?: boolean; includePageImages?: boolean;
  signal?: AbortSignal; isCancelled?: () => boolean; onProgress?: (percent: number) => void;
}
export interface ReadableRun { text: string; x: number; y: number; width: number; height: number; url?: string; dir?: string }
export interface ReadableLine { text: string; runs: ReadableRun[]; x: number; y: number; height: number }
export interface ReadablePage { number: number; width: number; height: number; lines: ReadableLine[]; fields: string[]; image?: Uint8Array; ocr: boolean }
export interface ReadableDocument { pages: ReadablePage[]; pageCount: number; warnings: string[] }
export function checkReadable(options: ReadableOptions) {
  if (options.signal?.aborted || options.isCancelled?.()) throw new Error("Processing cancelled.");
}
export function selectedPdfPages(value: string | undefined, count: number): number[] {
  if (!value?.trim()) return Array.from({ length: count }, (_, i) => i + 1);
  const pages = new Set<number>();
  for (const piece of value.split(",")) {
    const match = piece.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    const start = Number(match?.[1]), end = Number(match?.[2] ?? start);
    if (!match || start < 1 || end < start || end > count) throw new Error(`Choose pages between 1 and ${count}, for example ${count >= 5 ? "1-3, 5" : count >= 3 ? "1-3" : "1"}.`);
    for (let n = start; n <= end; n++) pages.add(n);
  }
  return [...pages].sort((a, b) => a - b);
}
export function safeMarkdownUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  try { const url = new URL(value); return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? url.href.replace(/[<>|\\\r\n]/g, char => encodeURIComponent(char)) : undefined; } catch { return; }
}
function appendRun(text: string, run: ReadableRun, previous?: ReadableRun) {
  const gap = previous ? run.x - previous.x - previous.width : 0;
  const space = text && !/\s$/u.test(text) && !/^\s/u.test(run.text) && gap > run.height * .12 && !(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]$/u.test(text) && /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(run.text));
  return text + (space ? " " : "") + run.text;
}
export function groupReadableLines(runs: ReadableRun[]): ReadableLine[] {
  const lines: ReadableLine[] = [];
  for (const run of [...runs].sort((a, b) => a.y - b.y || a.x - b.x)) {
    let line = lines.at(-1);
    if (!line || Math.abs(run.y - line.y) > Math.max(2, Math.min(run.height, line.height) * .4)) {
      line = { text: "", runs: [], x: run.x, y: run.y, height: run.height }; lines.push(line);
    }
    if (!line.runs.some(old => old.text === run.text && Math.abs(old.x - run.x) < .8 && Math.abs(old.y - run.y) < .8)) line.runs.push(run);
    line.height = Math.max(line.height, run.height);
  }
  for (const line of lines) {
    const rtl = line.runs.filter(run => run.dir === "rtl").length > line.runs.length / 2;
    line.runs.sort((a, b) => rtl ? b.x - a.x : a.x - b.x);
    line.x = Math.min(...line.runs.map(run => run.x));
    line.text = line.runs.reduce((text, run, i) => rtl ? text + (text ? " " : "") + run.text : appendRun(text, run, line.runs[i - 1]), "").trim();
  }
  return lines.filter(line => line.text);
}
/** Position-based extraction with explicit limits. Reading order, headings and
 * tables are heuristics, never a promise of semantic or layout reconstruction. */
export async function readPdfDocument(file: Blob, options: ReadableOptions = {}): Promise<ReadableDocument> {
  checkReadable(options);
  if (file.size > 100 * 1024 * 1024) throw new Error("Choose a PDF of 100MB or smaller.");
  const pdfjs = await loadPdfjs(), data = new Uint8Array(await file.arrayBuffer()); checkReadable(options);
  const task = pdfjs.getDocument({ data }); let password = false;
  task.onPassword = () => { password = true; void task.destroy(); };
  let render: import("pdfjs-dist").RenderTask | undefined, worker: OcrWorker | undefined;
  const abort = () => { render?.cancel(); void task.destroy(); };
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    const pdf = await task.promise; checkReadable(options);
    if (pdf.isPureXfa) throw new Error("Export this XFA form as a standard PDF first.");
    if (pdf.numPages > 1000) throw new Error("Split PDFs longer than 1,000 pages before extracting text.");
    const selected = selectedPdfPages(options.pages, pdf.numPages);
    if (selected.length > 200) throw new Error("Choose up to 200 pages at a time, using the page range option.");
    const pages: ReadablePage[] = [], warnings: string[] = []; let characters = 0, imageBytes = 0;
    for (const number of selected) {
      checkReadable(options);
      const page = await pdf.getPage(number), viewport = page.getViewport({ scale: 1 });
      if (Math.max(viewport.width, viewport.height) > 14400 || Math.min(viewport.width, viewport.height) <= 0) throw new Error("A page has unsupported dimensions. Export it at a standard page size first.");
      const content = await page.getTextContent(), annotations = await page.getAnnotations(); checkReadable(options);
      if (content.items.length > 100_000) throw new Error(`Page ${number} contains too many text objects. Split or simplify it first.`);
      const links = annotations.flatMap(annotation => {
        const url = safeMarkdownUrl(annotation.url);
        if (annotation.subtype !== "Link" || !url || !Array.isArray(annotation.rect)) return [];
        const [a,b,c,d,e,f] = viewport.transform, [x0,y0,x1,y1] = annotation.rect;
        const points = [[x0,y0],[x1,y1],[x0,y1],[x1,y0]].map(([x,y]) => [a*x+c*y+e,b*x+d*y+f]);
        return [{ url, left: Math.min(...points.map(p=>p[0])), right: Math.max(...points.map(p=>p[0])), top: Math.min(...points.map(p=>p[1])), bottom: Math.max(...points.map(p=>p[1])) }];
      });
      const runs: ReadableRun[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const [a,b,c,d,x,y] = pdfjs.Util.transform(viewport.transform, item.transform);
        const baseline = Math.hypot(a,b) || 1, vertical = Math.hypot(c,d) || 1;
        const height = item.height || vertical, width = item.width;
        const points = [[x,y],[x+a/baseline*width,y+b/baseline*width]];
        points.push(...points.map(([px,py])=>[px+c/vertical*height,py+d/vertical*height]));
        const left = Math.min(...points.map(p=>p[0])), right = Math.max(...points.map(p=>p[0]));
        const top = Math.min(...points.map(p=>p[1])), bottom = Math.max(...points.map(p=>p[1]));
        if (right < 0 || left > viewport.width || bottom < 0 || top > viewport.height) continue;
        const link = links.find(l => (left+right)/2 >= l.left-2 && (left+right)/2 <= l.right+2 && (top+bottom)/2 >= l.top-2 && (top+bottom)/2 <= l.bottom+2);
        runs.push({ text: item.str.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ""), x:left, y:top, width:right-left, height, url:link?.url, dir:item.dir });
      }
      let lines = groupReadableLines(runs), ocr = false; let image: Uint8Array | undefined;
      const fields = annotations.flatMap(a => {
        if (a.subtype !== "Widget" || !["Tx","Ch"].includes(a.fieldType)) return [];
        const value = Array.isArray(a.fieldValue) ? a.fieldValue.join(", ") : a.fieldValue;
        return typeof value === "string" && value ? [`${a.fieldName || "Form field"}: ${value}`] : [];
      });
      if (options.includePageImages || (!lines.length && options.ocrScans)) {
        const scale = Math.min(options.ocrScans && !lines.length ? 2 : 1.5, Math.sqrt(8_000_000 / (viewport.width * viewport.height)));
        const view = page.getViewport({ scale }), canvas = document.createElement("canvas");
        canvas.width = Math.ceil(view.width); canvas.height = Math.ceil(view.height);
        try {
          render = page.render({ canvas, viewport:view, background:"rgb(255,255,255)" }); await render.promise; render = undefined; checkReadable(options);
          if (!lines.length && options.ocrScans) {
            worker ??= await createOcrWorker(options.signal);
            const result = await worker.recognize(canvas, p=>options.onProgress?.((pages.length + p/100*.8) / selected.length * 95)); checkReadable(options);
            lines = groupReadableLines((result.words ?? []).map(word=>({ text:word.text, x:word.bbox.x0/scale, y:word.bbox.y0/scale, width:(word.bbox.x1-word.bbox.x0)/scale, height:(word.bbox.y1-word.bbox.y0)/scale })));
            if (!lines.length && result.text.trim()) lines = result.text.trim().split(/\n+/).map((text,i)=>({ text, runs:[{text,x:0,y:i*16,width:0,height:12}], x:0,y:i*16,height:12 }));
            ocr = true; warnings.push(`Page ${number}: English OCR was used; check names, numbers and punctuation against the PDF.`);
          }
          if (options.includePageImages) {
            const base64 = canvas.toDataURL("image/png").split(",")[1]; imageBytes += base64.length * .75;
            if (imageBytes > 80 * 1024 * 1024) throw new Error("Page images exceed 80MB. Choose fewer pages or turn off page images.");
            image = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
          }
        } finally { canvas.width = 0; canvas.height = 0; }
      }
      if (!lines.length && !fields.length) warnings.push(`Page ${number}: no text was extracted. It may be blank or scanned${options.ocrScans ? " with unrecognized text" : "; enable English OCR for scanned pages"}.`);
      characters += lines.reduce((total,line)=>total+line.text.length,0) + fields.join("").length;
      if (characters > 2_000_000) throw new Error("The selected pages exceed two million text characters. Choose a smaller page range.");
      pages.push({ number, width:viewport.width, height:viewport.height, lines, fields, image, ocr }); page.cleanup();
      options.onProgress?.(pages.length/selected.length*95);
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    checkReadable(options); return { pages, pageCount:pdf.numPages, warnings };
  } catch (error) {
    checkReadable(options);
    if (password) throw new Error("This PDF needs a password. Unlock your authorized copy before continuing.");
    throw error;
  } finally { options.signal?.removeEventListener("abort",abort); await worker?.terminate(); await task.destroy(); }
}
