"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { FileToolLayout } from "@/components/tool/FileToolLayout";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { getImageDimensions, type OutputImageFormat } from "@/lib/engines/image-engine";
import { createCutoutZip, initialCutoutOptions, removeImageBackgrounds, renderCutout, type BackgroundMode, type CutoutOptions, type MaskStroke, type SubjectMask } from "@/lib/engines/background-removal-engine";

const accept = { "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"], "image/webp": [".webp"], "image/gif": [".gif"], "image/bmp": [".bmp"] };
const field = "h-11 w-full rounded-xl border bg-background px-3";
const checker = { backgroundImage: "repeating-conic-gradient(#e2e8f0 0% 25%, #ffffff 0% 50%)", backgroundSize: "20px 20px" };
interface Item { id: string; file: File; width: number; height: number; mask?: SubjectMask; strokes: MaskStroke[]; past: MaskStroke[][]; future: MaskStroke[][] }
interface Result { blob: Blob; name: string; images: { name: string; blob: Blob; width: number; height: number }[] }
function useUrl(blob?: Blob | null) { const [url, setUrl] = useState(""); useEffect(() => { if (!blob) { setUrl(""); return; } const value = URL.createObjectURL(blob); setUrl(value); return () => URL.revokeObjectURL(value); }, [blob]); return url; }

export function RemoveBackgroundClient() {
  const [items, setItems] = useState<Item[]>([]), [selected, setSelected] = useState(0), [mode, setMode] = useState<BackgroundMode>("fast");
  const [options, setOptions] = useState<CutoutOptions>(initialCutoutOptions), [format, setFormat] = useState<OutputImageFormat>("image/png");
  const [busy, setBusy] = useState<"loading" | "detecting" | null>(null), [busyPercent, setBusyPercent] = useState(0), [busyMessage, setBusyMessage] = useState("");
  const [error, setError] = useState(""), [previewError, setPreviewError] = useState(""), [pending, setPending] = useState<File | null>(null), [result, setResult] = useState<Result | null>(null);
  const [preview, setPreview] = useState<Blob | null>(null), [previewBusy, setPreviewBusy] = useState(false), [compare, setCompare] = useState(50), [view, setView] = useState<"compare" | "cutout" | "original">("compare");
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [brush, setBrush] = useState<"off" | "erase" | "restore">("off"), [diameter, setDiameter] = useState(.06), [draft, setDraft] = useState<MaskStroke | null>(null), [zoom, setZoom] = useState(100);
  const generation = useRef(0), controller = useRef<AbortController | null>(null), drawing = useRef<MaskStroke | null>(null), area = useRef<HTMLDivElement>(null);
  const { processing, progress, run, cancel } = useProcessingTask();
  const item = items[Math.min(selected, items.length - 1)], sourceUrl = useUrl(item?.file), previewUrl = useUrl(preview), resultUrl = useUrl(result?.images[0]?.blob);
  const stop = () => { generation.current++; controller.current?.abort(); cancel(); setBusy(null); setPending(null); };
  useEffect(() => () => { generation.current++; controller.current?.abort(); cancel(); }, [cancel]);
  const reset = () => { stop(); setItems([]); setSelected(0); setResult(null); setPreview(null); setError(""); setPreviewError(""); };
  const changeStrokes = (strokes: MaskStroke[]) => { if (!item) return; setItems(old => old.map(i => i.id === item.id ? { ...i, past: [...i.past.slice(-29), i.strokes], strokes, future: [] } : i)); };
  const undo = () => { if (!item) return; setItems(old => old.map(i => i.id === item.id && i.past.length ? { ...i, strokes: i.past.at(-1)!, past: i.past.slice(0, -1), future: [i.strokes, ...i.future].slice(0, 30) } : i)); };
  const redo = () => { if (!item) return; setItems(old => old.map(i => i.id === item.id && i.future.length ? { ...i, strokes: i.future[0], past: [...i.past, i.strokes].slice(-30), future: i.future.slice(1) } : i)); };
  const selectFiles = async (files: File[]) => {
    if (!files.length) return; stop(); const version = ++generation.current; setBusy("loading"); setPending(files[0]); setError("");
    try {
      if (items.length + files.length > 10 || [...items.map(i => i.file), ...files].reduce((n, f) => n + f.size, 0) > 200 * 1024 * 1024) throw new Error("Choose up to 10 images and 200MB combined.");
      const added: Item[] = [];
      for (const file of files) {
        if (file.size > 100 * 1024 * 1024) throw new Error("Each image must be 100MB or smaller.");
        const stable = new File([await file.arrayBuffer()], file.name, { type: file.type }), dims = await getImageDimensions(stable);
        if (dims.width * dims.height > 20_000_000) throw new Error("Each image must be below 20 megapixels.");
        if (version !== generation.current) return;
        added.push({ id: crypto.randomUUID(), file: stable, ...dims, strokes: [], past: [], future: [] });
      }
      if (version === generation.current) { setItems([...items, ...added]); setSelected(items.length); setResult(null); }
    } catch (e) { if (version === generation.current) setError(e instanceof Error ? e.message : "Choose a valid image."); }
    finally { if (version === generation.current) { setBusy(null); setPending(null); } }
  };
  useEffect(() => { setPreview(null); setPreviewError(""); setBrush("off"); setView("compare"); setZoom(100); setDraft(null); drawing.current = null; }, [item?.id]);
  useEffect(() => {
    if (!item?.mask || busy || processing || result) { setPreviewBusy(false); return; }
    const abort = new AbortController(); setPreviewBusy(true); setPreviewError("");
    const timer = setTimeout(() => { renderCutout(item.file, item.mask!, item.strokes, options, "image/png", abort.signal, 1000).then(blob => { if (!abort.signal.aborted) setPreview(blob); }).catch(e => { if (!abort.signal.aborted) setPreviewError(e instanceof Error ? e.message : "Could not display the cutout."); }).finally(() => { if (!abort.signal.aborted) setPreviewBusy(false); }); }, 60);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [item, options, busy, processing, result, previewAttempt]);
  const exportImages = (ready: Item[]) => {
    const abort = new AbortController(); controller.current = abort; setError("");
    void run(async (setProgress, cancelled) => {
      const outputs: Result["images"] = []; let bytes = 0;
      for (const [index, value] of ready.entries()) {
        if (!value.mask) throw new Error(`Create a cutout for ${value.file.name} first.`);
        const blob = await renderCutout(value.file, value.mask, value.strokes, options, format, abort.signal);
        if (cancelled() || abort.signal.aborted) return;
        bytes += blob.size; if (bytes > 200 * 1024 * 1024) throw new Error("Results exceed 200MB. Export fewer images at a time.");
        const ext = format === "image/png" ? "png" : format === "image/jpeg" ? "jpg" : "webp", base = value.file.name.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}_. -]/gu, "_").slice(0, 100) || "image";
        outputs.push({ blob, name: `${base}-cutout.${ext}`, width: value.width, height: value.height }); setProgress((index + 1) / ready.length * 90);
      }
      const blob = outputs.length === 1 ? outputs[0].blob : await createCutoutZip(outputs, abort.signal);
      if (cancelled() || abort.signal.aborted) return;
      setProgress(100); setResult({ blob, name: outputs.length === 1 ? outputs[0].name : "background-removed-images.zip", images: outputs });
    }, { toolName: "remove-background", successMessage: "Your cutouts are ready", errorTitle: "Could not save images", onError: e => { const message = e instanceof Error ? e.message : "Please check the image settings."; setError(message); return message; } });
  };
  const createMasks = async (download: boolean, redoSelected = false) => {
    if (!items.length || busy) return; stop(); const version = ++generation.current, abort = new AbortController(); controller.current = abort; setError("");
    const targets = redoSelected && item ? [item] : items.filter(i => !i.mask);
    if (!targets.length) { if (download) exportImages(items); return; }
    setBusy("detecting"); setBusyPercent(0); setBusyMessage("Preparing background removal…");
    let ready = items;
    try {
      await removeImageBackgrounds(targets.map(i => i.file), mode, abort.signal, (percent, message) => { if (version === generation.current) { setBusyPercent(percent); setBusyMessage(message); } }, (index, mask) => {
        if (version !== generation.current) return;
        ready = ready.map(i => i.id === targets[index].id ? { ...i, mask, strokes: [], past: [], future: [] } : i); setItems(ready);
      });
      if (version !== generation.current) return;
      setBusy(null); if (download) exportImages(ready);
    } catch (e) { if (version === generation.current) setError(e instanceof Error ? e.message : "Background removal failed. Please retry."); }
    finally { if (version === generation.current) setBusy(null); }
  };
  const pointerPoint = (event: PointerEvent<HTMLDivElement>) => { const r = event.currentTarget.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (event.clientY - r.top) / r.height)) }; };
  const brushDown = (event: PointerEvent<HTMLDivElement>) => {
    if (brush === "off" || !item?.mask || busy || previewBusy) return;
    if (item.strokes.length >= 200 || item.strokes.reduce((sum, s) => sum + s.points.length, 0) >= 19000) { setError("This image has reached the brush limit. Undo or reset brush edits to continue."); return; }
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); drawing.current = { mode: brush, diameter, points: [pointerPoint(event)] }; setDraft(drawing.current);
  };
  const brushMove = (event: PointerEvent<HTMLDivElement>) => { if (!drawing.current || drawing.current.points.length >= 1000) return; const p = pointerPoint(event), last = drawing.current.points.at(-1)!; if (Math.hypot(p.x - last.x, p.y - last.y) < .001) return; drawing.current = { ...drawing.current, points: [...drawing.current.points, p] }; setDraft(drawing.current); };
  const brushUp = () => { if (drawing.current && item) changeStrokes([...item.strokes, drawing.current]); drawing.current = null; setDraft(null); };
  const chooseBrush = (value: typeof brush) => { setBrush(value); if (value !== "off") setView("cutout"); };
  const workspace = item && <div className="space-y-3">
    <div className="flex flex-wrap gap-2"><select aria-label="Cutout preview view" className={field + " !w-auto"} value={view} onChange={e => { setView(e.target.value as typeof view); setBrush("off"); }}><option value="compare">Before / after</option><option value="cutout">Cutout</option><option value="original">Original</option></select><select aria-label="Cutout preview zoom" className={field + " !w-auto"} value={zoom} onChange={e => setZoom(Number(e.target.value))}><option value={100}>Fit</option><option value={150}>150%</option><option value={200}>200%</option></select></div>
    <div className="max-h-[750px] max-w-full overflow-auto rounded-xl border" style={checker}>
      <div ref={area} role="img" aria-label="Cutout editing canvas" className={`relative mx-auto ${brush !== "off" ? "touch-none cursor-crosshair" : ""}`} style={{ width: `${zoom}%`, maxWidth: zoom === 100 ? Math.min(1000, 650 * item.width / item.height) : undefined, aspectRatio: item.width / item.height }} onPointerDown={brushDown} onPointerMove={brushMove} onPointerUp={brushUp} onPointerCancel={() => { drawing.current = null; setDraft(null); }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- local original and generated cutout */}
        <img src={(view === "original" ? sourceUrl : previewUrl || sourceUrl) || undefined} alt={view === "original" || !item.mask ? "Original image" : "Background removed preview"} draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />
        {view === "compare" && item.mask && previewUrl && <>
          {/* eslint-disable-next-line @next/next/no-img-element -- local before/after comparison */}
          <img src={sourceUrl || undefined} alt="Before background removal" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" style={{ clipPath: `inset(0 ${100 - compare}% 0 0)` }} />
          <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${compare}%` }} /><span className="pointer-events-none absolute left-2 top-2 rounded bg-slate-900/80 px-2 py-1 text-xs text-white">Before</span><span className="pointer-events-none absolute right-2 top-2 rounded bg-slate-900/80 px-2 py-1 text-xs text-white">After</span>
        </>}
        {draft && <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${item.width} ${item.height}`}><polyline points={draft.points.map(p => `${p.x * item.width},${p.y * item.height}`).join(" ")} fill="none" stroke={draft.mode === "erase" ? "#ef4444" : "#06b6d4"} strokeOpacity={.55} strokeWidth={draft.diameter * Math.min(item.width, item.height)} strokeLinecap="round" strokeLinejoin="round" />{draft.points.length === 1 && <circle cx={draft.points[0].x * item.width} cy={draft.points[0].y * item.height} r={draft.diameter * Math.min(item.width, item.height) / 2} fill="#ef4444" opacity={.5} />}</svg>}
      </div>
    </div>
    {view === "compare" && item.mask && <label className="block text-sm">Before / after<input type="range" aria-label="Before after comparison" min={0} max={100} value={compare} onChange={e => setCompare(Number(e.target.value))} className="mt-2 w-full" /></label>}
    {previewBusy && <p role="status" className="text-xs text-muted-foreground">Updating cutout preview…</p>}
    <p className="text-sm">{item.width} × {item.height}px · {item.mask ? `${item.mask.mode === "fast" ? "Fast" : "Detailed"} cutout ready` : "Ready for background removal"}</p>
    {brush !== "off" && <p className="text-xs text-muted-foreground">Paint to {brush === "erase" ? "remove unwanted areas" : "restore the original image"}. Each stroke can be undone.</p>}
  </div>;
  return <FileToolLayout toolSlug="remove-background" files={busy === "loading" ? [pending] : items.map(i => i.file)} accept={accept} multiple selectedFileIndex={selected} onSelectedFileChange={setSelected} onFilesSelected={selectFiles} landingError={error} result={result} processing={processing || busy === "loading"} progress={busy === "loading" ? 0 : progress} onCancel={stop} onReset={reset} onDownload={() => { if (result) downloadBlob(result.blob, result.name); }} preview={workspace} faqs={[
    { question: "Do my images leave my device?", answer: "No. PDFPilot downloads the image model and runs background removal in your browser. Your source images are not uploaded. The model loads only when you start processing; no account or paid API is needed." },
    { question: "Can I fix the automatic cutout?", answer: "Use Preview cutouts, then compare before and after. Erase removes unwanted areas; Restore brings back original pixels. Undo, Redo and Reset brush edits are available. Fine hair, transparent objects and busy backgrounds can need manual correction." },
    { question: "Which images and downloads are supported?", answer: "JPG, PNG, WEBP, BMP and the first frame of GIF. Up to 10 images, 100MB each, 200MB combined and 20 megapixels per image. PNG and WEBP preserve transparency; JPG uses the chosen background or white. Full-size outputs are free, with no watermark. Multiple images download as a ZIP." },
  ]} related={[]}>
    {result ? <div className="space-y-5 text-center"><h2 className="text-2xl font-bold">Your cutouts are ready</h2><p>{result.images.length} image{result.images.length === 1 ? "" : "s"} · full-size download</p>
      <div className="mx-auto max-w-xl overflow-hidden rounded-xl border" style={checker}>
        {/* eslint-disable-next-line @next/next/no-img-element -- actual downloaded cutout */}
        <img src={resultUrl || undefined} alt="Saved background-removed image" className="mx-auto max-h-[500px] max-w-full" />
      </div><ul className="space-y-2 text-left text-sm">{result.images.map((image, index) => <li key={index} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted p-3"><span className="break-all">{image.name} · {image.width} × {image.height}px</span><Button variant="outline" onClick={() => downloadBlob(image.blob, image.name)}>Download image {index + 1}</Button></li>)}</ul><div className="flex flex-wrap justify-center gap-3"><Button onClick={() => downloadBlob(result.blob, result.name)}>Download {result.images.length > 1 ? "ZIP" : "image"} again</Button><Button variant="outline" onClick={() => setResult(null)}>Adjust cutouts</Button><Button variant="outline" onClick={reset}>Start over</Button></div></div> : item && <>
      {busy === "detecting" && <div role="status" className="space-y-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950"><p>{busyMessage}</p><progress aria-label="Background removal progress" value={busyPercent} max={100} className="w-full" /><Button variant="outline" onClick={stop}>Cancel background removal</Button></div>}
      <fieldset disabled={!!busy} className="space-y-4 disabled:opacity-60">
        <label className="block space-y-1 text-sm font-medium">Processing mode<select aria-label="Background removal mode" value={mode} onChange={e => setMode(e.target.value as BackgroundMode)} className={field}><option value="fast">Fast — smaller model</option><option value="detailed">Detailed — larger model</option></select></label>
        <p className="text-xs text-muted-foreground">{mode === "fast" ? "A 4.6MB model plus runtime loads on first use. Works locally on the CPU." : "A 176MB model plus runtime loads on first use. Runs locally and takes more time and memory."} Review edges before sharing.</p>
        <Button variant="outline" className="w-full" onClick={() => void createMasks(false)}>Preview cutouts</Button>
        {item.mask && <><Button variant="outline" className="w-full" onClick={() => void createMasks(false, true)}>Reprocess selected image</Button><p className="text-xs text-muted-foreground">Reprocessing uses the selected mode and clears this image’s brush edits.</p><hr />
          <div className="grid grid-cols-3 gap-2">{(["off", "erase", "restore"] as const).map(value => <Button key={value} variant={brush === value ? "default" : "outline"} aria-pressed={brush === value} onClick={() => chooseBrush(value)}>{value === "off" ? "View" : value === "erase" ? "Erase" : "Restore"}</Button>)}</div>
          <label className="block space-y-1 text-sm font-medium">Brush size: {Math.round(diameter * Math.min(item.width, item.height))}px<input type="range" aria-label="Cutout brush size" min={.005} max={.3} step={.005} value={diameter} onChange={e => setDiameter(Number(e.target.value))} className="w-full" /></label>
          <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!item.past.length} onClick={undo}>Undo</Button><Button variant="outline" disabled={!item.future.length} onClick={redo}>Redo</Button><Button variant="outline" disabled={!item.strokes.length} onClick={() => changeStrokes([])}>Reset brush edits</Button></div>
        </>}
        <label className="block space-y-1 text-sm font-medium">Background<select aria-label="Cutout background" className={field} value={options.background === "transparent" ? "transparent" : "color"} onChange={e => setOptions({ ...options, background: e.target.value === "transparent" ? "transparent" : "#ffffff" })}><option value="transparent">Transparent</option><option value="color">Solid color</option></select></label>
        {options.background !== "transparent" && <label className="block space-y-1 text-sm font-medium">Background color<input aria-label="Cutout background color" type="color" value={options.background} onInput={e => setOptions({ ...options, background: e.currentTarget.value })} className={field} /></label>}
        <label className="block space-y-1 text-sm font-medium">Edge softness: {options.feather}px<input type="range" aria-label="Cutout edge softness" min={0} max={4} step={.5} value={options.feather} onChange={e => setOptions({ ...options, feather: Number(e.target.value) })} className="w-full" /></label>
        <label className="block space-y-1 text-sm font-medium">Save as<select aria-label="Cutout output format" value={format} onChange={e => setFormat(e.target.value as OutputImageFormat)} className={field}><option value="image/png">PNG — transparent</option><option value="image/webp">WEBP — transparent</option><option value="image/jpeg">JPG — solid background</option></select></label>
        <p className="text-xs text-muted-foreground">Background, softness and format apply to all images. JPG uses white when Transparent is selected.</p>
        <Button variant="outline" onClick={() => { setItems(items.filter(i => i.id !== item.id)); setSelected(Math.max(0, selected - 1)); setError(""); }}>Remove this image</Button>
      </fieldset>
      {(error || previewError) && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error || previewError}</p>}
      {previewError && <Button variant="outline" onClick={() => setPreviewAttempt(attempt => attempt + 1)}>Retry preview</Button>}
      <Button size="lg" className="w-full" disabled={!!busy || previewBusy || !!previewError} onClick={() => void createMasks(true)}>{items.every(i => i.mask) ? "Download cutouts" : "Remove background"}</Button>
      <p className="text-xs text-muted-foreground">{items.filter(i => i.mask).length} of {items.length} cutouts ready. Completed cutouts stay available after cancellation or a retry.</p>
    </>}
  </FileToolLayout>;
}
