"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileToolLayout } from "@/components/tool/FileToolLayout";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { getImageDimensions, type OutputImageFormat } from "@/lib/engines/image-engine";
import { createCutoutZip as createImageZip } from "@/lib/engines/background-removal-engine";
import { encodeUpscaledImage, upscaleImages, validateUpscaleSize, type UpscaleFactor, type UpscaledImage } from "@/lib/engines/upscale-image-engine";

const accept = { "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"], "image/webp": [".webp"], "image/gif": [".gif"], "image/bmp": [".bmp"] };
const field = "h-11 w-full rounded-xl border bg-background px-3";
const checker = { backgroundImage: "repeating-conic-gradient(#e2e8f0 0% 25%, #ffffff 0% 50%)", backgroundSize: "20px 20px" };
interface Item { id: string; file: File; width: number; height: number; image?: UpscaledImage }
interface Result { blob: Blob; name: string; images: { blob: Blob; name: string; width: number; height: number }[] }
function useUrl(blob?: Blob | null) { const [url, setUrl] = useState(""); useEffect(() => { if (!blob) { setUrl(""); return; } const value = URL.createObjectURL(blob); setUrl(value); return () => URL.revokeObjectURL(value); }, [blob]); return url; }

export function UpscaleImageClient() {
  const [items, setItems] = useState<Item[]>([]), [selected, setSelected] = useState(0), [factor, setFactor] = useState<UpscaleFactor>(2);
  const [format, setFormat] = useState<OutputImageFormat>("image/png"), [quality, setQuality] = useState(.94), [compatibility, setCompatibility] = useState(false);
  const [busy, setBusy] = useState<"loading" | "upscaling" | null>(null), [busyPercent, setBusyPercent] = useState(0), [message, setMessage] = useState("");
  const [error, setError] = useState(""), [pending, setPending] = useState<File | null>(null), [result, setResult] = useState<Result | null>(null);
  const [view, setView] = useState<"compare" | "original" | "enlarged">("compare"), [compare, setCompare] = useState(50), [zoom, setZoom] = useState(100);
  const generation = useRef(0), controller = useRef<AbortController | null>(null);
  const { processing, progress, run, cancel } = useProcessingTask();
  const item = items[Math.min(selected, items.length - 1)], enlarged = item?.image?.factor === factor ? item.image : undefined;
  const sourceUrl = useUrl(item?.file), enlargedUrl = useUrl(enlarged?.blob), resultUrl = useUrl(result?.images[0]?.blob);
  const readyCount = items.filter(i => i.image?.factor === factor).length;
  const stop = () => { generation.current++; controller.current?.abort(); cancel(); setBusy(null); setPending(null); };
  useEffect(() => () => { generation.current++; controller.current?.abort(); cancel(); }, [cancel]);
  useEffect(() => { setView("compare"); setZoom(100); setCompare(50); }, [item?.id, factor]);
  const reset = () => { stop(); setItems([]); setSelected(0); setResult(null); setError(""); setMessage(""); };
  const cancelWork = () => { stop(); setMessage("Processing cancelled. Completed images are kept; retry to continue with unfinished images."); };
  const selectFiles = async (files: File[]) => {
    if (!files.length) return; stop(); const version = ++generation.current; setBusy("loading"); setPending(files[0]); setError(""); setMessage("");
    try {
      if (items.length + files.length > 10 || [...items.map(i => i.file), ...files].reduce((sum, f) => sum + f.size, 0) > 200 * 1024 * 1024) throw new Error("Choose up to 10 images and 200MB combined.");
      const added: Item[] = [];
      for (const file of files) {
        if (file.size > 100 * 1024 * 1024) throw new Error("Each image must be 100MB or smaller.");
        const stable = new File([await file.arrayBuffer()], file.name, { type: file.type }), dimensions = await getImageDimensions(stable);
        validateUpscaleSize(dimensions.width, dimensions.height, 2);
        if (version !== generation.current) return;
        added.push({ id: crypto.randomUUID(), file: stable, ...dimensions });
      }
      if (version === generation.current) { setItems([...items, ...added]); setSelected(items.length); setResult(null); }
    } catch (e) { if (version === generation.current) setError(e instanceof Error ? e.message : "Choose a valid image."); }
    finally { if (version === generation.current) { setBusy(null); setPending(null); } }
  };
  const exportImages = (ready: Item[]) => {
    const abort = new AbortController(); controller.current = abort; setError(""); setMessage("");
    void run(async (setProgress, cancelled) => {
      const outputs: Result["images"] = []; let bytes = 0;
      for (const [index, value] of ready.entries()) {
        if (!value.image || value.image.factor !== factor) throw new Error(`Enlarge ${value.file.name} at ${factor}× first.`);
        const blob = await encodeUpscaledImage(value.image, format, quality, abort.signal);
        if (cancelled() || abort.signal.aborted) return;
        bytes += blob.size; if (bytes > 200 * 1024 * 1024) throw new Error("Results exceed 200MB. Download fewer images at a time.");
        const ext = format === "image/png" ? "png" : format === "image/jpeg" ? "jpg" : "webp", base = value.file.name.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}_. -]/gu, "_").slice(0, 100) || "image";
        outputs.push({ blob, name: `${base}-${factor}x.${ext}`, width: value.image.width, height: value.image.height }); setProgress((index + 1) / ready.length * 90);
      }
      const blob = outputs.length === 1 ? outputs[0].blob : await createImageZip(outputs, abort.signal);
      if (cancelled() || abort.signal.aborted) return;
      setProgress(100); setResult({ blob, name: outputs.length === 1 ? outputs[0].name : `upscaled-images-${factor}x.zip`, images: outputs });
    }, { toolName: "upscale-image", successMessage: "Your enlarged images are ready", errorTitle: "Could not save images", onError: e => { const message = e instanceof Error ? e.message : "Please check the image settings."; setError(message); return message; } });
  };
  const processImages = async (download: boolean) => {
    if (!items.length || busy) return; stop(); const version = ++generation.current, abort = new AbortController(); controller.current = abort; setError(""); setMessage("");
    const targets = items.filter(i => i.image?.factor !== factor);
    if (!targets.length) { if (download) exportImages(items); return; }
    setBusy("upscaling"); setBusyPercent(0); let ready = items;
    try {
      for (const value of targets) validateUpscaleSize(value.width, value.height, factor);
      await upscaleImages(targets.map(i => i.file), factor, compatibility, abort.signal, (percent, message) => { if (version === generation.current) { setBusyPercent(percent); setMessage(message); } }, (index, image) => {
        if (version !== generation.current) return;
        const retainedBytes = ready.reduce((sum, value) => sum + (value.id === targets[index].id ? 0 : value.image?.blob.size || 0), 0);
        if (retainedBytes + image.blob.size > 200 * 1024 * 1024) throw new Error("Enlarged images exceed 200MB combined. Download completed images, then remove some images before continuing.");
        ready = ready.map(i => i.id === targets[index].id ? { ...i, image } : i); setItems(ready);
      });
      if (version !== generation.current) return;
      setBusy(null); setMessage(""); if (download) exportImages(ready);
    } catch (e) { if (version === generation.current) { setError(e instanceof Error ? e.message : "Upscaling failed. Please retry."); setMessage(""); } }
    finally { if (version === generation.current) setBusy(null); }
  };
  const preview = item && <div className="space-y-3">
    <div className="flex flex-wrap gap-2"><select aria-label="Upscale preview view" className={field + " !w-auto"} value={view} onChange={e => setView(e.target.value as typeof view)}><option value="compare">Before / after</option><option value="original">Original</option><option value="enlarged">Enlarged</option></select><select aria-label="Upscale preview zoom" className={field + " !w-auto"} value={zoom} onChange={e => setZoom(Number(e.target.value))}><option value={100}>Fit</option><option value={200}>200%</option><option value={300}>300%</option></select></div>
    <div className="max-h-[750px] max-w-full overflow-auto rounded-xl border" style={checker}>
      <div role="img" aria-label="Image enlargement comparison" className="relative mx-auto" style={{ width: `${zoom}%`, maxWidth: zoom === 100 ? Math.min(1000, 650 * item.width / item.height) : undefined, aspectRatio: item.width / item.height }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- local source and actual AI output */}
        <img src={(view === "original" ? sourceUrl : enlargedUrl || sourceUrl) || undefined} alt={view === "original" || !enlarged ? "Original image" : `${factor}× enlarged image`} draggable={false} className="absolute inset-0 h-full w-full" />
        {view === "compare" && enlargedUrl && <>
          {/* eslint-disable-next-line @next/next/no-img-element -- before/after of user-selected local image */}
          <img src={sourceUrl || undefined} alt="Before enlargement" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" style={{ clipPath: `inset(0 ${100 - compare}% 0 0)` }} />
          <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${compare}%` }} /><span className="pointer-events-none absolute left-2 top-2 rounded bg-slate-900/80 px-2 py-1 text-xs text-white">Before</span><span className="pointer-events-none absolute right-2 top-2 rounded bg-slate-900/80 px-2 py-1 text-xs text-white">After · {factor}×</span>
        </>}
      </div>
    </div>
    {view === "compare" && enlarged && <label className="block text-sm">Before / after<input type="range" aria-label="Before after enlargement comparison" min={0} max={100} value={compare} onChange={e => setCompare(Number(e.target.value))} className="mt-2 w-full" /></label>}
    <p className="text-sm">{item.width} × {item.height}px → {item.width * factor} × {item.height * factor}px{enlarged ? " · Ready" : ""}</p>
  </div>;
  return <FileToolLayout toolSlug="upscale-image" files={busy === "loading" ? [pending] : items.map(i => i.file)} accept={accept} multiple selectedFileIndex={selected} onSelectedFileChange={setSelected} onFilesSelected={selectFiles} landingError={error} result={result} processing={processing || busy === "loading"} progress={busy === "loading" ? 0 : progress} onCancel={cancelWork} onReset={reset} onDownload={() => { if (result) downloadBlob(result.blob, result.name); }} preview={preview} faqs={[
    { question: "Is this AI enlargement or ordinary resizing?", answer: "An image restoration model estimates finer details at 2× resolution. 4× uses two AI passes. Compare before and after, especially around text and faces: estimated detail can differ from the original scene. Use Resize Image when you only need exact dimensions." },
    { question: "Are full-size downloads free and private?", answer: "Yes. There is no account, watermark or paid API. A model and its processing files download the first time you start; your images stay in your browser. Large images can take several minutes. Cancel stops processing and keeps completed images." },
    { question: "Which files and sizes are supported?", answer: "JPG, PNG, WEBP, BMP and the first frame of GIF. Up to 10 images, 100MB each and 200MB combined. Each enlarged result may be up to 16 megapixels and 8,192 pixels per side: at most 4MP input for 2× or 1MP input for 4×. PNG and WEBP keep transparency; JPG uses white. Multiple results download in one ZIP." },
  ]} related={[]}>
    {result ? <div className="space-y-5 text-center"><h2 className="text-2xl font-bold">Your enlarged images are ready</h2><p>{result.images.length} image{result.images.length === 1 ? "" : "s"} · {factor}× · full-size download</p><div className="mx-auto max-w-xl overflow-hidden rounded-xl border" style={checker}>
      {/* eslint-disable-next-line @next/next/no-img-element -- actual saved image */}
      <img src={resultUrl || undefined} alt="Saved enlarged image" className="mx-auto max-h-[500px] max-w-full" /></div>
      <ul className="space-y-2 text-left text-sm">{result.images.map((image, index) => <li key={index} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted p-3"><span className="break-all">{image.name} · {image.width} × {image.height}px</span><Button variant="outline" onClick={() => downloadBlob(image.blob, image.name)}>Download image {index + 1}</Button></li>)}</ul><div className="flex flex-wrap justify-center gap-3"><Button onClick={() => downloadBlob(result.blob, result.name)}>Download {result.images.length > 1 ? "ZIP" : "image"} again</Button><Button variant="outline" onClick={() => setResult(null)}>Compare and adjust</Button><Button variant="outline" onClick={reset}>Start over</Button></div></div> : item && <>
      {busy === "upscaling" && <div role="status" className="space-y-3 rounded-xl bg-violet-50 p-4 text-sm text-violet-950"><p>{message}</p><progress aria-label="Image upscaling progress" value={busyPercent} max={100} className="w-full" /><Button variant="outline" onClick={cancelWork}>Cancel upscaling</Button></div>}
      <fieldset disabled={!!busy} className="space-y-4 disabled:opacity-60">
        <div className="space-y-2"><p className="text-sm font-medium">Enlarge image</p><div className="grid grid-cols-2 gap-2">{([2, 4] as const).map(value => <Button key={value} variant={factor === value ? "default" : "outline"} aria-pressed={factor === value} onClick={() => { setFactor(value); setError(""); setMessage(""); }}>{value}× larger</Button>)}</div></div>
        <p className="text-xs text-muted-foreground">Each image keeps its proportions. Full-size results are free, with no watermark. Large images can take several minutes.</p>
        <Button variant="outline" className="w-full" onClick={() => void processImages(false)} disabled={readyCount === items.length}>Preview enlargement</Button>
        <label className="block space-y-1 text-sm font-medium">Save as<select aria-label="Upscale output format" value={format} onChange={e => setFormat(e.target.value as OutputImageFormat)} className={field}><option value="image/png">PNG — transparent</option><option value="image/webp">WEBP — transparent</option><option value="image/jpeg">JPG — white background</option></select></label>
        {format !== "image/png" && <label className="block space-y-1 text-sm font-medium">Quality: {Math.round(quality * 100)}%<input aria-label="Upscale output quality" type="range" min={10} max={100} value={Math.round(quality * 100)} onChange={e => setQuality(Number(e.target.value) / 100)} className="w-full" /></label>}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={compatibility} onChange={e => setCompatibility(e.target.checked)} className="mt-1" />Use compatibility mode (slower)</label>
        <p className="text-xs text-muted-foreground">Turn this on if processing fails on your device. Completed images stay ready.</p>
        <Button variant="outline" onClick={() => { setItems(items.filter(i => i.id !== item.id)); setSelected(Math.max(0, selected - 1)); setError(""); }}>Remove this image</Button>
      </fieldset>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!busy && message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
      <Button size="lg" className="w-full" disabled={!!busy} onClick={() => void processImages(true)}>{readyCount === items.length ? "Download enlarged images" : `Upscale ${items.length === 1 ? "image" : "images"}`}</Button>
      {!!readyCount && readyCount < items.length && <Button variant="outline" disabled={!!busy} className="w-full" onClick={() => exportImages(items.filter(i => i.image?.factor === factor))}>Download completed images ({readyCount})</Button>}
      <p className="text-xs text-muted-foreground">{readyCount} of {items.length} images ready at {factor}×. Check text, faces and fine details before sharing.</p>
    </>}
  </FileToolLayout>;
}
