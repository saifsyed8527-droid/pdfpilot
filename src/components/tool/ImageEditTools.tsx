"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FileToolLayout } from "./FileToolLayout";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { cropImage, getImageDimensions, preferredOutputFormat, resizeImage, resizedDimensions, type CropRegion, type OutputImageFormat } from "@/lib/engines/image-engine";
import { watermarkImage, type ImageWatermarkLayer } from "@/lib/engines/image-watermark-engine";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";

type Mode = "resize" | "crop" | "watermark";
type Item = { file: File; width: number; height: number };
type Result = { blob: Blob; name: string; items: { name: string; width: number; height: number; size: number }[] };
const extension = (format: string) => format === "image/jpeg" ? "jpg" : format === "image/webp" ? "webp" : "png";
const inputClass = "h-11 w-full min-w-0 rounded-xl border bg-background px-3";
const imageAccept = { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"], "image/gif": [".gif"], "image/bmp": [".bmp"] };
function useBlobUrl(blob: Blob | null) {
  const [url, setUrl] = useState("");
  useEffect(() => { if (!blob) { setUrl(""); return; } const next = URL.createObjectURL(blob); setUrl(next); return () => URL.revokeObjectURL(next); }, [blob]);
  return url;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1 text-sm font-medium"><span>{label}</span>{children}</label>; }
function Toggle({ label, value, change }: { label: string; value: boolean; change: (value: boolean) => void }) { return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value} onChange={e => change(e.target.checked)} />{label}</label>; }
const defaultLayer = (kind: "text" | "image", image?: File): ImageWatermarkLayer => ({ id: crypto.randomUUID(), kind, image, text: "SAMPLE", x: .5, y: .5, width: .45, fontSize: .08, font: "sans-serif", bold: true, italic: false, underline: false, color: "#ffffff", background: "transparent", opacity: .7, rotation: 0, tiled: false });

export function ImageEditTools({ mode, faqs, related }: { mode: Mode; faqs: FaqInput[]; related: ResolvedEntity[] }) {
  const [items, setItems] = useState<Item[]>([]), [selected, setSelected] = useState(0), [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false), [pending, setPending] = useState<File | null>(null), [error, setError] = useState("");
  const [format, setFormat] = useState<OutputImageFormat | "same">("same"), [quality, setQuality] = useState(.92);
  const [resizeMode, setResizeMode] = useState<"pixels" | "percentage">("pixels"), [width, setWidth] = useState(""), [height, setHeight] = useState("");
  const [percentage, setPercentage] = useState(50), [aspect, setAspect] = useState(true), [noEnlarge, setNoEnlarge] = useState(false);
  const [crop, setCrop] = useState<CropRegion>({ x: 0, y: 0, width: 1, height: 1 });
  const [layers, setLayers] = useState<ImageWatermarkLayer[]>([]), [layerIndex, setLayerIndex] = useState(0);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null), [previewBusy, setPreviewBusy] = useState(false), [previewError, setPreviewError] = useState("");
  const [previewPositions, setPreviewPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [history, setHistory] = useState<ImageWatermarkLayer[][]>([]);
  const [logoLoading, setLogoLoading] = useState(false);
  const latestLayers = useRef(layers); latestLayers.current = layers;
  const lastPreviewFile = useRef<File | null>(null);
  const generation = useRef(0), controller = useRef<AbortController | null>(null), logoInput = useRef<HTMLInputElement>(null);
  const { processing, progress, run, cancel } = useProcessingTask();
  const item = items[Math.min(selected, items.length - 1)], layer = layers[layerIndex];
  const sourceUrl = useBlobUrl(item?.file ?? null), markedUrl = useBlobUrl(previewBlob), resultUrl = useBlobUrl(result?.items.length === 1 ? result.blob : null);
  const slug = mode === "watermark" ? "image-watermark" : `${mode}-image`;
  const title = mode === "resize" ? "Resize images" : mode === "crop" ? "Crop image" : "Watermark images";
  const stop = () => { generation.current++; controller.current?.abort(); cancel(); setLoading(false); setLogoLoading(false); setPending(null); };
  useEffect(() => () => { generation.current++; controller.current?.abort(); cancel(); }, [cancel]);
  const reset = () => { stop(); setItems([]); setSelected(0); setResult(null); setError(""); setPreviewBlob(null); setLayers([]); setHistory([]); };
  const select = async (files: File[]) => {
    if (!files.length) return;
    stop(); const id = ++generation.current, previous = mode === "crop" ? [] : items;
    if (previous.length + files.length > 30 || [...previous.map(i => i.file), ...files].reduce((n, f) => n + f.size, 0) > 200 * 1024 * 1024) { toast.error("Choose up to 30 images, with a combined size below 200MB."); return; }
    setLoading(true); setPending(files[0]); setError(""); setResult(null);
    try {
      const added: Item[] = [];
      for (const file of files) {
        const stable = new File([await file.arrayBuffer()], file.name, { type: file.type, lastModified: file.lastModified });
        if (id !== generation.current) return;
        added.push({ file: stable, ...await getImageDimensions(stable) });
      }
      if (id !== generation.current) return;
      setItems([...previous, ...added]); setSelected(previous.length);
      if (!previous.length) { setWidth(String(added[0].width)); setHeight(String(added[0].height)); setCrop({ x: 0, y: 0, width: added[0].width, height: added[0].height }); }
      if (mode === "watermark" && !layers.length) { setLayers([defaultLayer("text")]); setLayerIndex(0); }
    } catch (e) { if (id === generation.current) { const message = e instanceof Error ? e.message : "Choose a valid image."; setError(message); toast.error("Could not read image", { description: message }); } }
    finally { if (id === generation.current) { setLoading(false); setPending(null); } }
  };
  const target = { maintainAspectRatio: aspect, noEnlarge, ...(resizeMode === "percentage" ? { percentage } : { width: width === "" ? undefined : Number(width), height: height === "" ? undefined : Number(height) }) };
  let dimensions: { width: number; height: number } | null = null, sizeError = "";
  if (item && mode === "resize") { try { dimensions = resizedDimensions(item, target); } catch (e) { sizeError = e instanceof Error ? e.message : "Check dimensions."; } }
  const changeDimension = (key: "width" | "height", value: string) => {
    if (key === "width") setWidth(value); else setHeight(value);
    if (aspect && item && value && Number(value) > 0) { if (key === "width") setHeight(String(Math.max(1, Math.round(Number(value) * item.height / item.width)))); else setWidth(String(Math.max(1, Math.round(Number(value) * item.width / item.height)))); }
  };
  const updateLayers = (next: ImageWatermarkLayer[]) => { setHistory(old => [...old.slice(-29), layers]); setLayers(next); };
  const patchLayer = (patch: Partial<ImageWatermarkLayer>) => updateLayers(layers.map((entry, i) => i === layerIndex ? { ...entry, ...patch } : entry));
  const addLogo = async (file?: File) => {
    if (!file || layers.length >= 10 || logoLoading) return;
    const id = generation.current; setError(""); setLogoLoading(true);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("Choose a logo smaller than 5MB.");
      const stable = new File([await file.arrayBuffer()], file.name, { type: file.type }), dims = await getImageDimensions(stable);
      if (dims.width * dims.height > 5_000_000) throw new Error("Choose a logo below five megapixels.");
      if (id !== generation.current) return;
      const current = latestLayers.current;
      if (current.length >= 10) throw new Error("Use up to ten watermarks.");
      setHistory(old => [...old.slice(-29), current]); setLayers([...current, defaultLayer("image", stable)]); setLayerIndex(current.length);
    } catch (e) { if (id === generation.current) setError(e instanceof Error ? e.message : "Choose a valid logo."); }
    finally { if (id === generation.current) setLogoLoading(false); if (logoInput.current) logoInput.current.value = ""; }
  };
  useEffect(() => {
    if (mode !== "watermark" || !item || result || processing) return;
    if (lastPreviewFile.current !== item.file) { setPreviewBlob(null); setPreviewPositions({}); lastPreviewFile.current = item.file; }
    const abort = new AbortController(); setPreviewBusy(true); setPreviewError("");
    const positions: Record<string, { x: number; y: number }> = {};
    const timeout = setTimeout(() => { watermarkImage(item.file, layers, "image/png", 1, abort.signal, 900, (id, x, y) => { positions[id] = { x, y }; }).then(blob => { if (!abort.signal.aborted) { setPreviewBlob(blob); setPreviewPositions(positions); } }).catch(e => { if (!abort.signal.aborted) { setPreviewBlob(null); setPreviewError(e instanceof Error ? e.message : "Check watermark options."); } }).finally(() => { if (!abort.signal.aborted) setPreviewBusy(false); }); }, 180);
    return () => { clearTimeout(timeout); abort.abort(); };
  }, [mode, item, layers, result, processing]);
  const process = () => {
    if (!items.length) return;
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort; setError(""); setResult(null);
    void run(async (setProgress, isCancelled) => {
      const outputs: { blob: Blob; name: string; width: number; height: number; size: number }[] = [], names = new Set<string>();
      let total = 0;
      for (let i = 0; i < items.length; i++) {
        if (isCancelled() || abort.signal.aborted) return;
        const source = items[i], type = format === "same" ? preferredOutputFormat(source.file) : format;
        const blob = mode === "resize" ? await resizeImage(source.file, target, type, quality, abort.signal) : mode === "crop" ? await cropImage(source.file, crop, type, quality, abort.signal) : await watermarkImage(source.file, layers, type, quality, abort.signal);
        total += blob.size; if (total > 200 * 1024 * 1024) throw new Error("The result is larger than 200MB. Use a smaller batch or smaller dimensions.");
        const base = source.file.name.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}_. -]/gu, "_").slice(0, 100) || "image";
        let suffix = 1, name = `${base}-${mode}.${extension(type)}`; while (names.has(name)) name = `${base}-${mode}-${++suffix}.${extension(type)}`; names.add(name);
        const dims = mode === "resize" ? resizedDimensions(source, target) : mode === "crop" ? crop : source;
        outputs.push({ blob, name, width: dims.width, height: dims.height, size: blob.size }); setProgress((i + 1) / items.length * 90);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (isCancelled() || abort.signal.aborted) return;
      let blob = outputs[0].blob, name = outputs[0].name;
      if (outputs.length > 1) {
        const { zipSync } = await import("fflate"), entries: Record<string, Uint8Array> = Object.create(null);
        for (const output of outputs) { if (isCancelled()) return; entries[output.name] = new Uint8Array(await output.blob.arrayBuffer()); }
        blob = new Blob([new Uint8Array(zipSync(entries, { level: 0 })).buffer], { type: "application/zip" }); name = `${mode}-images.zip`;
      }
      if (isCancelled() || abort.signal.aborted) return; setProgress(100); setResult({ blob, name, items: outputs.map(({ name, width, height, size }) => ({ name, width, height, size })) });
    }, { toolName: slug, successMessage: "Your images are ready", errorTitle: "Could not process image", onError: e => { const message = e instanceof Error ? e.message : "Check the image and options."; setError(message); return message; } });
  };
  const drag = useRef<{ startX: number; startY: number; crop: CropRegion; handle: string; width: number; height: number } | null>(null);
  const watermarkDrag = useRef<{ startX: number; startY: number; x: number; y: number; width: number; height: number } | null>(null);
  const cropPointer = (e: PointerEvent<HTMLDivElement>) => {
    if (!item || mode !== "crop") return;
    const rect = e.currentTarget.getBoundingClientRect(), handle = (e.target as HTMLElement).dataset.handle ?? "move";
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { startX: e.clientX, startY: e.clientY, crop, handle, width: rect.width, height: rect.height };
  };
  const cropMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d || !item) return;
    const dx = Math.round((e.clientX - d.startX) / d.width * item.width), dy = Math.round((e.clientY - d.startY) / d.height * item.height), old = d.crop;
    if (d.handle === "move") setCrop({ ...old, x: Math.max(0, Math.min(item.width - old.width, old.x + dx)), y: Math.max(0, Math.min(item.height - old.height, old.y + dy)) });
    else {
      const left = d.handle.includes("w") ? Math.max(0, Math.min(old.x + old.width - 1, old.x + dx)) : old.x;
      const top = d.handle.includes("n") ? Math.max(0, Math.min(old.y + old.height - 1, old.y + dy)) : old.y;
      const right = d.handle.includes("e") ? Math.min(item.width, Math.max(left + 1, old.x + old.width + dx)) : old.x + old.width;
      const bottom = d.handle.includes("s") ? Math.min(item.height, Math.max(top + 1, old.y + old.height + dy)) : old.y + old.height;
      setCrop({ x: left, y: top, width: right - left, height: bottom - top });
    }
  };
  const preview = item && <div className="space-y-4">
    <p className="text-sm text-muted-foreground">{item.width} × {item.height}px{dimensions && ` → ${dimensions.width} × ${dimensions.height}px`}</p>
    {mode === "crop" ? <div className="relative mx-auto w-full max-w-[900px] touch-none overflow-hidden" style={{ aspectRatio: item.width / item.height }} onPointerDown={cropPointer} onPointerMove={cropMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local image with an exact pixel selection overlay */}
      <img src={sourceUrl} alt="Image to crop" draggable={false} className="absolute inset-0 h-full w-full" />
      <div role="button" tabIndex={0} aria-label="Move crop area with arrow keys" className="absolute cursor-move border-2 border-emerald-400 outline-none focus:border-blue-600" style={{ left: `${crop.x / item.width * 100}%`, top: `${crop.y / item.height * 100}%`, width: `${crop.width / item.width * 100}%`, height: `${crop.height / item.height * 100}%`, boxShadow: "0 0 0 9999px rgba(0,0,0,.45)" }} onKeyDown={e => { if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return; e.preventDefault(); const step = e.shiftKey ? 10 : 1; setCrop({ ...crop, x: Math.max(0, Math.min(item.width - crop.width, crop.x + (e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0))), y: Math.max(0, Math.min(item.height - crop.height, crop.y + (e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0))) }); }}>
        {[["nw", "left-0 top-0"], ["ne", "right-0 top-0"], ["sw", "left-0 bottom-0"], ["se", "right-0 bottom-0"]].map(([handle, position]) => <span key={handle} data-handle={handle} aria-hidden className={`absolute h-5 w-5 border-2 border-white bg-emerald-500 ${position}`} />)}
      </div>
    </div> : <div className="relative mx-auto overflow-hidden rounded-xl bg-slate-100" style={{ maxWidth: Math.min(900, 650 * (dimensions?.width ?? item.width) / (dimensions?.height ?? item.height)) }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local source or rendered watermark preview */}
      <img src={mode === "watermark" && markedUrl ? markedUrl : sourceUrl} alt={mode === "watermark" ? "Watermark preview" : "Resize preview"} draggable={false} className="mx-auto block w-full" style={mode === "resize" && dimensions ? { aspectRatio: dimensions.width / dimensions.height, objectFit: "fill" } : undefined} />
      {mode === "watermark" && layer && !layer.tiled && <button type="button" aria-label="Move selected watermark" title="Drag to move watermark; arrow keys also work" className="absolute -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border-2 border-white bg-emerald-700 px-2 py-1 text-white shadow" style={{ left: `${(watermarkDrag.current ? layer.x : previewPositions[layer.id]?.x ?? layer.x) * 100}%`, top: `${(watermarkDrag.current ? layer.y : previewPositions[layer.id]?.y ?? layer.y) * 100}%` }} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); const r = e.currentTarget.parentElement!.getBoundingClientRect(); watermarkDrag.current = { startX: e.clientX, startY: e.clientY, x: previewPositions[layer.id]?.x ?? layer.x, y: previewPositions[layer.id]?.y ?? layer.y, width: r.width, height: r.height }; setHistory(old => [...old.slice(-29), layers]); }} onPointerMove={e => { const d = watermarkDrag.current; if (!d) return; const x = Math.max(0, Math.min(1, d.x + (e.clientX - d.startX) / d.width)), y = Math.max(0, Math.min(1, d.y + (e.clientY - d.startY) / d.height)); setLayers(old => old.map((entry, i) => i === layerIndex ? { ...entry, x, y } : entry)); }} onPointerUp={() => { watermarkDrag.current = null; }} onPointerCancel={() => { watermarkDrag.current = null; }} onKeyDown={e => { if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return; e.preventDefault(); const step = e.shiftKey ? .1 : .01; patchLayer({ x: Math.max(0, Math.min(1, layer.x + (e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0))), y: Math.max(0, Math.min(1, layer.y + (e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0))) }); }}>✥</button>}
      {mode === "watermark" && previewBusy && <span role="status" className="absolute bottom-2 left-2 rounded-lg bg-white/90 px-3 py-2 text-xs text-slate-900">Updating preview…</span>}
    </div>}
    {mode === "crop" && <p className="text-xs text-muted-foreground">Drag the area or its corners. Arrow keys move it by 1px; Shift + arrows move it by 10px.</p>}
    {items.length > 1 && <Button variant="outline" onClick={() => { setItems(items.filter((_, i) => i !== selected)); setSelected(0); }}>Remove selected image</Button>}
  </div>;
  return <FileToolLayout toolSlug={slug} files={loading ? [pending] : items.map(i => i.file)} accept={imageAccept} multiple={mode !== "crop"} landingError={error} onFilesSelected={select} selectedFileIndex={selected} onSelectedFileChange={setSelected} result={result} processing={processing || loading} progress={loading ? undefined : progress} onCancel={stop} onReset={reset} onDownload={() => { if (result) downloadBlob(result.blob, result.name); }} preview={preview} faqs={faqs} related={related}>
    {result ? <div className="space-y-5 text-center"><h2 className="text-2xl font-bold">Your {result.items.length === 1 ? "image is" : "images are"} ready</h2><p className="text-sm text-muted-foreground">{result.name}</p>{resultUrl && <div>
      {/* eslint-disable-next-line @next/next/no-img-element -- local output preview */}
      <img src={resultUrl} alt="Processed image" className="mx-auto max-h-96 max-w-full rounded-xl border" /></div>}
      <ul className="space-y-2 text-left text-sm">{result.items.map(output => <li key={output.name} className="break-all rounded-xl bg-muted p-3">{output.name} · {output.width} × {output.height}px · {(output.size / 1024).toFixed(1)}KB</li>)}</ul><div className="flex flex-wrap justify-center gap-3"><Button onClick={() => downloadBlob(result.blob, result.name)}>Download {result.items.length > 1 ? "ZIP" : "image"}</Button><Button variant="outline" onClick={() => setResult(null)}>Adjust options</Button><Button variant="outline" onClick={reset}>Start over</Button></div></div> : <>
      {mode === "resize" && <><div className="grid grid-cols-2 gap-2">{["pixels", "percentage"].map(value => <Button key={value} variant={resizeMode === value ? "default" : "outline"} aria-pressed={resizeMode === value} onClick={() => setResizeMode(value as typeof resizeMode)}>By {value}</Button>)}</div>{resizeMode === "pixels" ? <><div className="grid grid-cols-2 gap-3"><Field label="Width (px)"><input aria-label="Width (px)" type="number" min={1} max={16384} value={width} onChange={e => changeDimension("width", e.target.value)} className={inputClass} /></Field><Field label="Height (px)"><input aria-label="Height (px)" type="number" min={1} max={16384} value={height} onChange={e => changeDimension("height", e.target.value)} className={inputClass} /></Field></div><Toggle label="Maintain aspect ratio" value={aspect} change={setAspect} /><p className="text-xs text-muted-foreground">With aspect ratio on, each image fits inside the width and height above.</p></> : <><Field label="Size (% of original)"><input aria-label="Size (% of original)" type="number" min={1} max={400} value={percentage} onChange={e => setPercentage(Number(e.target.value))} className={inputClass} /></Field><div className="grid grid-cols-3 gap-2">{[75, 50, 25].map(value => <Button key={value} variant="outline" onClick={() => setPercentage(value)}>{100 - value}% smaller</Button>)}</div></>}<Toggle label="Do not enlarge smaller images" value={noEnlarge} change={setNoEnlarge} />{sizeError && <p role="alert" className="text-sm text-red-700">{sizeError}</p>}</>}
      {mode === "crop" && item && <><div className="grid grid-cols-2 gap-3">{(["x", "y", "width", "height"] as const).map(key => <Field key={key} label={`${key === "x" ? "X from left" : key === "y" ? "Y from top" : key === "width" ? "Width" : "Height"} (px)`}><input aria-label={`Crop ${key} (px)`} type="number" min={key === "x" || key === "y" ? 0 : 1} value={crop[key]} onChange={e => setCrop({ ...crop, [key]: Number(e.target.value) })} className={inputClass} /></Field>)}</div><div className="flex flex-wrap gap-2">{[["Square", 1], ["4:3", 4 / 3], ["16:9", 16 / 9]].map(([label, ratio]) => <Button key={label} variant="outline" onClick={() => { const w = Math.min(item.width, Math.floor(item.height * Number(ratio))), h = Math.round(w / Number(ratio)); setCrop({ x: Math.floor((item.width - w) / 2), y: Math.floor((item.height - h) / 2), width: w, height: h }); }}>{label}</Button>)}<Button variant="outline" onClick={() => setCrop({ x: 0, y: 0, width: item.width, height: item.height })}>Full image</Button></div></>}
      {mode === "watermark" && <><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={layers.length >= 10} onClick={() => { updateLayers([...layers, defaultLayer("text")]); setLayerIndex(layers.length); }}>Add text</Button><Button variant="outline" disabled={layers.length >= 10 || logoLoading} onClick={() => logoInput.current?.click()}>{logoLoading ? "Reading logo…" : "Add logo"}</Button><input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label="Logo image" onChange={e => void addLogo(e.target.files?.[0])} /><Button variant="outline" disabled={!history.length} onClick={() => { const old = history.at(-1)!; setLayers(old); setHistory(history.slice(0, -1)); setLayerIndex(Math.min(layerIndex, old.length - 1)); }}>Undo</Button></div><div className="flex flex-wrap gap-2">{layers.map((entry, index) => <button key={entry.id} aria-pressed={index === layerIndex} onClick={() => setLayerIndex(index)} className={`max-w-full truncate rounded-lg border px-3 py-2 text-sm ${index === layerIndex ? "bg-slate-900 text-white" : ""}`}>{index + 1}. {entry.kind === "text" ? entry.text.slice(0, 18) || "Text" : "Logo"}</button>)}</div>{layer && <>
        {layer.kind === "text" && <><Field label="Watermark text"><textarea aria-label="Watermark text" value={layer.text} maxLength={1000} rows={3} onChange={e => patchLayer({ text: e.target.value })} className="w-full rounded-xl border bg-background p-3" /></Field><Field label="Font"><select aria-label="Font" value={layer.font} onChange={e => patchLayer({ font: e.target.value as typeof layer.font })} className={inputClass}><option value="sans-serif">Sans serif</option><option value="serif">Serif</option><option value="monospace">Monospace</option></select></Field><div className="flex gap-2">{(["bold", "italic", "underline"] as const).map(style => <Button key={style} variant={layer[style] ? "default" : "outline"} aria-pressed={layer[style]} onClick={() => patchLayer({ [style]: !layer[style] })}>{style[0].toUpperCase() + style.slice(1)}</Button>)}</div><Field label="Text color"><input aria-label="Text color" type="color" value={layer.color} onChange={e => patchLayer({ color: e.target.value })} className={inputClass} /></Field><Field label="Text size (% of image)"><input aria-label="Text size (% of image)" type="number" min={1} max={50} value={Math.round(layer.fontSize * 100)} onChange={e => patchLayer({ fontSize: Number(e.target.value) / 100 })} className={inputClass} /></Field></>}
        <Field label={layer.kind === "text" ? "Maximum width (%)" : "Logo width (%)"}><input aria-label="Watermark width (%)" type="range" min={1} max={100} value={layer.width * 100} onChange={e => patchLayer({ width: Number(e.target.value) / 100 })} className="w-full" /></Field>
        <Toggle label="Background behind watermark" value={layer.background !== "transparent"} change={checked => patchLayer({ background: checked ? "#000000" : "transparent" })} />{layer.background !== "transparent" && <Field label="Background color"><input aria-label="Background color" type="color" value={layer.background} onChange={e => patchLayer({ background: e.target.value })} className={inputClass} /></Field>}
        <Field label={`Opacity: ${Math.round(layer.opacity * 100)}%`}><input aria-label="Watermark opacity" type="range" min={5} max={100} value={layer.opacity * 100} onChange={e => patchLayer({ opacity: Number(e.target.value) / 100 })} className="w-full" /></Field>
        <Field label="Rotation (degrees)"><input aria-label="Watermark rotation" type="number" min={-180} max={180} value={layer.rotation} onChange={e => patchLayer({ rotation: Number(e.target.value) })} className={inputClass} /></Field>
        <Toggle label="Repeat across image" value={layer.tiled} change={tiled => patchLayer({ tiled })} />
        {!layer.tiled && <><div className="grid grid-cols-3 gap-1" aria-label="Watermark position">{[.1, .5, .9].flatMap((y, row) => [.1, .5, .9].map((x, col) => <Button key={`${x}-${y}`} variant={layer.x === x && layer.y === y ? "default" : "outline"} aria-label={`${["Top", "Middle", "Bottom"][row]} ${["left", "center", "right"][col]}`} onClick={() => patchLayer({ x, y })}>{["↖", "↑", "↗", "←", "•", "→", "↙", "↓", "↘"][row * 3 + col]}</Button>))}</div><div className="grid grid-cols-2 gap-3">{(["x", "y"] as const).map(key => <Field key={key} label={`${key.toUpperCase()} position (%)`}><input aria-label={`${key.toUpperCase()} position (%)`} type="number" min={0} max={100} value={Math.round(layer[key] * 100)} onChange={e => patchLayer({ [key]: Number(e.target.value) / 100 })} className={inputClass} /></Field>)}</div></>}
        <Button variant="outline" onClick={() => { updateLayers(layers.filter((_, index) => index !== layerIndex)); setLayerIndex(Math.max(0, layerIndex - 1)); }}>Delete watermark</Button>
      </>}{previewError && <p role="alert" className="text-sm text-red-700">{previewError}</p>}</>}
      <Field label="Output format"><select aria-label="Output format" value={format} onChange={e => setFormat(e.target.value as typeof format)} className={inputClass}><option value="same">Same as original</option><option value="image/png">PNG</option><option value="image/jpeg">JPG</option><option value="image/webp">WEBP</option></select></Field>
      {format !== "image/png" && <Field label={`JPG / WEBP quality: ${Math.round(quality * 100)}%`}><input aria-label="Output quality" type="range" min={10} max={100} value={quality * 100} onChange={e => setQuality(Number(e.target.value) / 100)} className="w-full" /></Field>}
      <p className="text-xs leading-5 text-muted-foreground">Files stay on your device. Up to 40 megapixels per image. GIF uses its first frame; GIF and BMP save as PNG. JPG uses a white background for transparency. Re-encoding removes metadata.</p>
      {mode !== "crop" && <p className="text-xs text-muted-foreground">The same settings apply to every selected image. Multiple results download together as a ZIP.</p>}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <Button size="lg" className="w-full" disabled={!items.length || !!sizeError || (mode === "watermark" && (!layers.length || !!previewError || previewBusy || logoLoading))} onClick={process}>{title}</Button>
    </>}
  </FileToolLayout>;
}
