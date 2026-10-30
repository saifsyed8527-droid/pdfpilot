"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FileToolLayout } from "./FileToolLayout";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { convertImageFormat, getImageDimensions, preferredOutputFormat, rotateAndFlipImage, type OutputImageFormat, type RotationDegrees } from "@/lib/engines/image-engine";
import { createImageGif, type GifOptions } from "@/lib/engines/image-gif-engine";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";

type Item = { file: File; width: number; height: number; rotate: 0 | RotationDegrees; flipHorizontal: boolean; flipVertical: boolean };
type Output = { blob: Blob; name: string; width: number; height: number };
type Result = { blob: Blob; name: string; items: Omit<Output, "blob">[] };
type Target = "all" | "selected" | "portrait" | "landscape";
const accept = { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"], "image/gif": [".gif"], "image/bmp": [".bmp"] };
const inputClass = "h-11 w-full min-w-0 rounded-xl border bg-background px-3";
const extension = (type: string) => type === "image/jpeg" ? "jpg" : type === "image/webp" ? "webp" : type === "image/gif" ? "gif" : "png";
const dimensions = (item: Item) => item.rotate === 90 || item.rotate === 270 ? { width: item.height, height: item.width } : { width: item.width, height: item.height };
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1 text-sm font-medium"><span>{label}</span>{children}</label>; }
function useBlobUrl(blob: Blob | null) {
  const [url, setUrl] = useState("");
  useEffect(() => { if (!blob) { setUrl(""); return; } const next = URL.createObjectURL(blob); setUrl(next); return () => URL.revokeObjectURL(next); }, [blob]);
  return url;
}

export function ImageConvertRotateTools({ mode, faqs, related }: { mode: "convert" | "rotate"; faqs: FaqInput[]; related: ResolvedEntity[] }) {
  const [items, setItems] = useState<Item[]>([]), [selected, setSelected] = useState(0), [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false), [pending, setPending] = useState<File | null>(null), [error, setError] = useState("");
  const [format, setFormat] = useState<OutputImageFormat | "image/gif" | "same">(mode === "rotate" ? "same" : "image/png");
  const [quality, setQuality] = useState(.92), [target, setTarget] = useState<Target>("all");
  const [gifAnimated, setGifAnimated] = useState(false);
  const [gif, setGif] = useState<GifOptions>({ width: 800, height: 600, delay: 500, repeat: 0, fit: "contain", background: "#ffffff" });
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null), [previewBusy, setPreviewBusy] = useState(false), [previewError, setPreviewError] = useState("");
  const generation = useRef(0), controller = useRef<AbortController | null>(null), previousPreviewFile = useRef<File | null>(null);
  const { processing, progress, run, cancel } = useProcessingTask();
  const item = items[selected], isGif = mode === "convert" && format === "image/gif";
  const sourceUrl = useBlobUrl(item?.file ?? null), previewUrl = useBlobUrl(previewBlob), resultUrl = useBlobUrl(result?.items.length === 1 ? result.blob : null);
  const stop = () => { generation.current++; controller.current?.abort(); cancel(); setLoading(false); setPending(null); };
  useEffect(() => () => { generation.current++; controller.current?.abort(); cancel(); }, [cancel]);
  const reset = () => { stop(); setItems([]); setSelected(0); setResult(null); setPreviewBlob(null); setError(""); };
  const select = async (files: File[]) => {
    if (!files.length) return;
    stop(); const id = ++generation.current;
    if (items.length + files.length > 30 || [...items.map(i => i.file), ...files].reduce((sum, file) => sum + file.size, 0) > 200 * 1024 * 1024) { setError("Choose up to 30 images, with a combined size below 200MB."); return; }
    setLoading(true); setPending(files[0]); setError(""); setResult(null);
    try {
      const added: Item[] = [];
      for (const file of files) {
        const stable = new File([await file.arrayBuffer()], file.name, { type: file.type, lastModified: file.lastModified });
        if (id !== generation.current) return;
        added.push({ file: stable, ...await getImageDimensions(stable), rotate: 0, flipHorizontal: false, flipVertical: false });
      }
      if (id !== generation.current) return;
      setItems([...items, ...added]); setSelected(items.length);
      if (!items.length) { const first = added[0], scale = Math.min(1, 1280 / Math.max(first.width, first.height)); setGif(old => ({ ...old, width: Math.max(1, Math.round(first.width * scale)), height: Math.max(1, Math.round(first.height * scale)) })); }
    } catch (e) { if (id === generation.current) setError(e instanceof Error ? e.message : "Choose a valid image."); }
    finally { if (id === generation.current) { setLoading(false); setPending(null); } }
  };
  const matches = (entry: Item, index: number) => target === "all" || (target === "selected" ? index === selected : target === "portrait" ? entry.height > entry.width : entry.width > entry.height);
  const changeRotation = (change: "left" | "right" | "horizontal" | "vertical") => setItems(old => old.map((entry, index) => !matches(entry, index) ? entry : { ...entry,
    rotate: change === "left" || change === "right" ? ((entry.rotate + (change === "right" ? 90 : 270)) % 360) as Item["rotate"] : entry.rotate,
    flipHorizontal: change === "horizontal" ? !entry.flipHorizontal : entry.flipHorizontal,
    flipVertical: change === "vertical" ? !entry.flipVertical : entry.flipVertical,
  }));
  const move = (direction: number) => { const next = selected + direction; if (next < 0 || next >= items.length) return; const list = [...items]; [list[selected], list[next]] = [list[next], list[selected]]; setItems(list); setSelected(next); };
  useEffect(() => {
    if (mode !== "rotate" || !item || result || processing || loading) return;
    if (previousPreviewFile.current !== item.file) { previousPreviewFile.current = item.file; setPreviewBlob(null); }
    const abort = new AbortController(); setPreviewBusy(true); setPreviewError("");
    rotateAndFlipImage(item.file, { ...item, rotate: item.rotate || undefined }, "image/png", 1, abort.signal, 900).then(blob => { if (!abort.signal.aborted) setPreviewBlob(blob); }).catch(e => { if (!abort.signal.aborted) { setPreviewBlob(null); setPreviewError(e instanceof Error ? e.message : "Could not prepare preview."); } }).finally(() => { if (!abort.signal.aborted) setPreviewBusy(false); });
    return () => abort.abort();
  }, [mode, item, result, processing, loading]);
  const process = () => {
    if (!items.length) return;
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort; setResult(null); setError("");
    void run(async (setProgress, isCancelled) => {
      const outputs: Output[] = [], names = new Set<string>(); let total = 0;
      if (isGif && gifAnimated) {
        if (items.length < 2) throw new Error("Select at least two images to create an animated GIF.");
        const blob = await createImageGif(items.map(i => i.file), gif, abort.signal, setProgress);
        outputs.push({ blob, name: "animated-images.gif", width: gif.width, height: gif.height });
      } else for (let i = 0; i < items.length; i++) {
        if (isCancelled() || abort.signal.aborted) return;
        const source = items[i], type = format === "same" ? preferredOutputFormat(source.file) : format;
        const blob = type === "image/gif" ? await createImageGif([source.file], { ...gif, repeat: -1 }, abort.signal) : mode === "rotate" ? await rotateAndFlipImage(source.file, { ...source, rotate: source.rotate || undefined }, type, quality, abort.signal) : await convertImageFormat(source.file, type, quality, abort.signal);
        total += blob.size; if (total > 200 * 1024 * 1024) throw new Error("Results exceed 200MB. Use fewer images or a smaller output size.");
        const base = source.file.name.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}_. -]/gu, "_").slice(0, 100) || "image";
        let suffix = 1, name = `${base}-${mode}.${extension(type)}`; while (names.has(name)) name = `${base}-${mode}-${++suffix}.${extension(type)}`; names.add(name);
        const dims = isGif ? gif : mode === "rotate" ? dimensions(source) : source;
        outputs.push({ blob, name, width: dims.width, height: dims.height }); setProgress((i + 1) / items.length * 95);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (isCancelled() || abort.signal.aborted) return;
      let blob = outputs[0].blob, name = outputs[0].name;
      if (outputs.length > 1) {
        const { zipSync } = await import("fflate"), entries: Record<string, Uint8Array> = Object.create(null);
        for (const output of outputs) { if (isCancelled() || abort.signal.aborted) return; entries[output.name] = new Uint8Array(await output.blob.arrayBuffer()); }
        blob = new Blob([new Uint8Array(zipSync(entries, { level: 0 })).buffer], { type: "application/zip" }); name = `${mode}-images.zip`;
      }
      if (isCancelled() || abort.signal.aborted) return;
      setProgress(100); setResult({ blob, name, items: outputs.map(({ name, width, height }) => ({ name, width, height })) });
    }, { toolName: `${mode}-image`, successMessage: "Your images are ready", errorTitle: "Could not process images", onError: e => { const message = e instanceof Error ? e.message : "Check your images and options."; setError(message); return message; } });
  };
  const preview = item && <div className="space-y-4">
    <p className="text-sm text-muted-foreground">{item.width} × {item.height}px{mode === "rotate" && ` → ${dimensions(item).width} × ${dimensions(item).height}px · ${item.rotate}°${item.flipHorizontal ? " · horizontal flip" : ""}${item.flipVertical ? " · vertical flip" : ""}`}{isGif && ` → ${gif.width} × ${gif.height}px`}</p>
    <div className="relative mx-auto overflow-hidden rounded-xl" style={isGif ? { width: "100%", maxWidth: Math.min(900, 650 * (gif.width > 0 && gif.height > 0 ? gif.width / gif.height : 1)), aspectRatio: gif.width > 0 && gif.height > 0 ? gif.width / gif.height : 1, background: gif.background } : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local source or rendered rotation preview */}
      <img src={mode === "rotate" && previewUrl ? previewUrl : sourceUrl} alt={mode === "rotate" ? "Rotation preview" : "Conversion preview"} className={isGif ? "absolute inset-0 h-full w-full" : "mx-auto max-h-[650px] max-w-full"} style={isGif ? { objectFit: gif.fit === "stretch" ? "fill" : gif.fit } : undefined} />
      {previewBusy && <span role="status" className="absolute bottom-2 left-2 rounded-lg bg-white/90 p-2 text-xs text-slate-900">Updating preview…</span>}
    </div>
    {items.length > 1 && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { setItems(items.filter((_, i) => i !== selected)); setSelected(0); }}>Remove selected image</Button>{mode === "convert" && <><Button variant="outline" disabled={selected === 0} onClick={() => move(-1)}>Move earlier</Button><Button variant="outline" disabled={selected === items.length - 1} onClick={() => move(1)}>Move later</Button></>}</div>}
    {mode === "rotate" && <ul className="space-y-2 text-sm">{items.map((entry, index) => <li key={index} className="break-all rounded-lg bg-muted p-2">{index + 1}. {entry.file.name}: {entry.rotate}°{entry.flipHorizontal ? " · horizontal flip" : ""}{entry.flipVertical ? " · vertical flip" : ""}</li>)}</ul>}
  </div>;
  return <FileToolLayout toolSlug={`${mode}-image`} files={loading ? [pending] : items.map(i => i.file)} accept={accept} multiple onFilesSelected={select} selectedFileIndex={selected} onSelectedFileChange={setSelected} landingError={error} result={result} processing={processing || loading} progress={loading ? undefined : progress} onCancel={stop} onReset={reset} onDownload={() => { if (result) downloadBlob(result.blob, result.name); }} preview={preview} faqs={faqs} related={related}>
    {result ? <div className="space-y-5 text-center"><h2 className="text-2xl font-bold">Your {result.items.length === 1 ? "image is" : "images are"} ready</h2><p className="break-all text-sm text-muted-foreground">{result.name}</p>{resultUrl && <div>
      {/* eslint-disable-next-line @next/next/no-img-element -- local output, including animated GIF preview */}
      <img src={resultUrl} alt="Processed image" className="mx-auto max-h-96 max-w-full rounded-xl border" /></div>}
      <ul className="space-y-2 text-left text-sm">{result.items.map(output => <li key={output.name} className="break-all rounded-xl bg-muted p-3">{output.name} · {output.width} × {output.height}px</li>)}</ul><div className="flex flex-wrap justify-center gap-3"><Button onClick={() => downloadBlob(result.blob, result.name)}>Download {result.items.length > 1 ? "ZIP" : "image"}</Button><Button variant="outline" onClick={() => setResult(null)}>Adjust options</Button><Button variant="outline" onClick={reset}>Start over</Button></div></div> : <>
      {mode === "rotate" && <>
        <Field label="Apply rotation and flip to"><select aria-label="Apply rotation and flip to" value={target} onChange={e => setTarget(e.target.value as Target)} className={inputClass}><option value="all">All images</option><option value="selected">Selected image</option><option value="portrait">Portrait images</option><option value="landscape">Landscape images</option></select></Field>
        <p className="text-xs text-muted-foreground">{items.filter(matches).length} images match this selection. Portrait and landscape use original dimensions; square images are included under All.</p>
        <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => changeRotation("left")}>Rotate left 90°</Button><Button variant="outline" onClick={() => changeRotation("right")}>Rotate right 90°</Button><Button variant="outline" onClick={() => changeRotation("horizontal")}>Flip horizontally</Button><Button variant="outline" onClick={() => changeRotation("vertical")}>Flip vertically</Button></div>
        <Button variant="outline" onClick={() => setItems(old => old.map(entry => ({ ...entry, rotate: 0, flipHorizontal: false, flipVertical: false })))}>Reset all changes</Button>
        <p className="text-xs text-muted-foreground">Flips use the original image axes, followed by the selected rotation. The preview shows the final result.</p>
      </>}
      <Field label="Output format"><select aria-label="Output format" value={format} onChange={e => setFormat(e.target.value as typeof format)} className={inputClass}>{mode === "rotate" && <option value="same">Same as original</option>}<option value="image/png">PNG</option><option value="image/jpeg">JPG</option><option value="image/webp">WEBP</option>{mode === "convert" && <option value="image/gif">GIF</option>}</select></Field>
      {!isGif && format !== "image/png" && <Field label={`JPG / WEBP quality: ${Math.round(quality * 100)}%`}><input aria-label="Output quality" type="range" min={10} max={100} value={quality * 100} onChange={e => setQuality(Number(e.target.value) / 100)} className="w-full" /></Field>}
      {isGif && <>
        <div className="grid grid-cols-2 gap-2"><Button variant={gifAnimated ? "outline" : "default"} aria-pressed={!gifAnimated} onClick={() => setGifAnimated(false)}>Static GIF</Button><Button variant={gifAnimated ? "default" : "outline"} aria-pressed={gifAnimated} onClick={() => setGifAnimated(true)}>Animated GIF</Button></div>
        <p className="text-xs text-muted-foreground">{gifAnimated ? "Images become frames in the order shown. Use Move earlier/later to change the order. Select at least two images." : "Each image becomes a separate GIF. Multiple results download as a ZIP."}</p>
        <div className="grid grid-cols-2 gap-3">{(["width", "height"] as const).map(key => <Field key={key} label={`GIF ${key} (px)`}><input aria-label={`GIF ${key} (px)`} type="number" min={1} max={2048} value={gif[key]} onChange={e => setGif({ ...gif, [key]: Number(e.target.value) })} className={inputClass} /></Field>)}</div>
        <Field label="Fit images"><select aria-label="Fit images" value={gif.fit} onChange={e => setGif({ ...gif, fit: e.target.value as GifOptions["fit"] })} className={inputClass}><option value="contain">Fit inside — keep full image</option><option value="cover">Fill frame — crop edges</option><option value="stretch">Stretch to frame</option></select></Field>
        <Field label="GIF background"><input aria-label="GIF background" type="color" value={gif.background} onChange={e => setGif({ ...gif, background: e.target.value })} className={inputClass} /></Field>
        {gifAnimated && <><Field label="Frame duration (milliseconds)"><input aria-label="Frame duration (milliseconds)" type="number" min={20} max={60000} step={10} value={gif.delay} onChange={e => setGif({ ...gif, delay: Number(e.target.value) })} className={inputClass} /></Field><Field label="Repeat animation"><select aria-label="Repeat animation" value={gif.repeat} onChange={e => setGif({ ...gif, repeat: Number(e.target.value) })} className={inputClass}><option value={0}>Forever</option><option value={-1}>Play once</option><option value={1}>Repeat once</option><option value={2}>Repeat twice</option><option value={4}>Repeat four times</option></select></Field></>}
        <p className="text-xs text-muted-foreground">GIF uses up to 256 colors per frame and the selected solid background. Up to 2,048px per side, four megapixels per frame and 40 megapixels per animation.</p>
      </>}
      <p className="text-xs text-muted-foreground">Files stay on your device. Up to 30 images and 200MB per batch, 40 megapixels per source. GIF input uses its first frame. JPG uses a white background for transparency. Re-encoding removes metadata.</p>
      {previewError && <p role="alert" className="text-sm text-red-700">{previewError}</p>}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <Button size="lg" className="w-full" disabled={!items.length || (mode === "rotate" && (previewBusy || !!previewError)) || (isGif && gifAnimated && items.length < 2)} onClick={process}>{mode === "rotate" ? "Rotate images" : gifAnimated && isGif ? "Create animated GIF" : "Convert images"}</Button>
    </>}
  </FileToolLayout>;
}
