"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FileToolLayout } from "@/components/tool/FileToolLayout";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { getImageDimensions, type CropRegion, type OutputImageFormat } from "@/lib/engines/image-engine";
import { initialPhotoState, newPhotoLayer, PHOTO_FILTERS, PHOTO_STICKERS, renderPhoto, type PhotoLayer, type PhotoSettings, type PhotoState } from "@/lib/engines/photo-editor-engine";

import { changeMemeLayout, createMemeTemplate, initialMemeState, MEME_BOTTOM, MEME_TOP, MEME_TEMPLATES, type MemeTemplateId } from "@/lib/engines/meme-engine";

const accept = { "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"], "image/webp": [".webp"], "image/gif": [".gif"], "image/bmp": [".bmp"] };
const inputClass = "h-11 w-full min-w-0 rounded-xl border bg-background px-3";
type History = { past: PhotoState[]; current: PhotoState; future: PhotoState[] };
type Result = { blob: Blob; name: string; width: number; height: number };
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1 text-sm font-medium"><span>{label}</span>{children}</label>; }
function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} />{label}</label>; }
function ColorInput({ label, value, change }: { label: string; value: string; change: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return <div className="flex gap-2"><input aria-label={`${label} picker`} type="color" value={value} onInput={e => change(e.currentTarget.value)} className="h-11 w-14 shrink-0 rounded-xl border bg-background p-1" /><input aria-label={label} value={draft} maxLength={7} spellCheck={false} onChange={e => { setDraft(e.target.value); if (/^#[0-9a-f]{6}$/i.test(e.target.value)) change(e.target.value); }} onBlur={() => setDraft(value)} className={inputClass} /></div>;
}
function useBlobUrl(blob: Blob | null) { const [url, setUrl] = useState(""); useEffect(() => { if (!blob) { setUrl(""); return; } const next = URL.createObjectURL(blob); setUrl(next); return () => URL.revokeObjectURL(next); }, [blob]); return url; }
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function PhotoEditorClient({ variant = "photo" }: { variant?: "photo" | "meme" }) {
  const isMeme = variant === "meme", toolSlug = isMeme ? "meme-generator" : "photo-editor", readyMessage = isMeme ? "Your meme is ready" : "Your edited photo is ready";
  const [templateSearch, setTemplateSearch] = useState("");
  const [file, setFile] = useState<File | null>(null), [source, setSource] = useState({ width: 1, height: 1 });
  const [history, setHistory] = useState<History | null>(null), [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"Adjust" | "Crop" | "Layers" | "Draw">("Adjust");
  const [loading, setLoading] = useState(false), [pending, setPending] = useState<File | null>(null), [error, setError] = useState("");
  const [preview, setPreview] = useState<Blob | null>(null), [previewBusy, setPreviewBusy] = useState(false), [previewError, setPreviewError] = useState("");
  const [overlayLoading, setOverlayLoading] = useState(false), [result, setResult] = useState<Result | null>(null);
  const [format, setFormat] = useState<OutputImageFormat>("image/png"), [quality, setQuality] = useState(.92), [aspect, setAspect] = useState(true), [zoom, setZoom] = useState(100);
  const [cropDraft, setCropDraft] = useState<CropRegion>({ x: 0, y: 0, width: 1, height: 1 });
  const [brushColor, setBrushColor] = useState("#ef4444"), [brushWidth, setBrushWidth] = useState(.015), [highlight, setHighlight] = useState(false);
  const [stroke, setStroke] = useState<{ x: number; y: number }[]>([]);
  const generation = useRef(0), controller = useRef<AbortController | null>(null), overlayInput = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null), latest = useRef<PhotoState | null>(null), strokeRef = useRef<{ x: number; y: number }[]>([]);
  const drag = useRef<{ x: number; y: number; layer: PhotoLayer; handle: string; width: number; height: number } | null>(null);
  const cropDrag = useRef<{ x: number; y: number } | null>(null);
  const { processing, progress, run, cancel } = useProcessingTask();
  const state = history?.current ?? null, s = state?.settings, layer = state?.layers.find(l => l.id === selectedId);
  latest.current = state;
  const sourceUrl = useBlobUrl(file), previewUrl = useBlobUrl(preview), resultUrl = useBlobUrl(result?.blob ?? null);
  const commit = (next: PhotoState) => { setError(""); setHistory(old => old ? { past: [...old.past.slice(-29), old.current], current: next, future: [] } : { past: [], current: next, future: [] }); };
  const patchSettings = (patch: Partial<PhotoSettings>) => { if (state) commit({ ...state, settings: { ...state.settings, ...patch } }); };
  const patchLayer = (patch: Partial<PhotoLayer>) => { if (state && layer && !layer.locked) commit({ ...state, layers: state.layers.map(l => l.id === layer.id ? { ...l, ...patch } : l) }); };
  const undo = () => setHistory(old => old?.past.length ? { past: old.past.slice(0, -1), current: old.past.at(-1)!, future: [old.current, ...old.future].slice(0, 30) } : old);
  const redo = () => setHistory(old => old?.future.length ? { past: [...old.past, old.current].slice(-30), current: old.future[0], future: old.future.slice(1) } : old);
  const stop = () => { generation.current++; controller.current?.abort(); cancel(); setLoading(false); setPending(null); setOverlayLoading(false); };
  useEffect(() => () => { generation.current++; controller.current?.abort(); cancel(); }, [cancel]);
  const reset = () => { stop(); setFile(null); setHistory(null); setPreview(null); setResult(null); setSelectedId(null); setError(""); setStroke([]); strokeRef.current = []; };
  const selectFile = async (files: File[]) => {
    if (!files[0]) return;
    stop(); const id = ++generation.current; setLoading(true); setPending(files[0]); setError(""); setResult(null);
    try {
      const stable = new File([await files[0].arrayBuffer()], files[0].name, { type: files[0].type }), dims = await getImageDimensions(stable), next = isMeme ? initialMemeState(dims.width, dims.height) : initialPhotoState(dims.width, dims.height);
      if (id !== generation.current) return;
      setFile(stable); setSource(dims); setHistory({ past: [], current: next, future: [] }); setCropDraft(next.settings.crop); setPreview(null); setSelectedId(isMeme ? MEME_TOP : null); setTab(isMeme ? "Layers" : "Adjust"); setZoom(100); setStroke([]); strokeRef.current = [];
    } catch (e) { if (id === generation.current) setError(e instanceof Error ? e.message : "Choose a valid photo."); }
    finally { if (id === generation.current) { setLoading(false); setPending(null); } }
  };
  const chooseTemplate = async (id: MemeTemplateId) => {
    stop(); const version = ++generation.current, abort = new AbortController(); controller.current = abort; setLoading(true); setError("");
    try { const template = await createMemeTemplate(id, abort.signal); if (version === generation.current) await selectFile([template]); }
    catch (e) { if (version === generation.current) { setLoading(false); setError(e instanceof Error ? e.message : "Could not create template."); } }
  };
  const changePlacement = (outside: boolean) => { if (!state) return; try { commit(changeMemeLayout(state, outside)); } catch (e) { setError(e instanceof Error ? e.message : "Reduce the output size first."); } };
  const captionFields = isMeme && state && <div className="space-y-3">
    <div className="grid grid-cols-2 gap-2"><Button variant={s?.captionSpace ? "outline" : "default"} aria-pressed={!s?.captionSpace} onClick={() => changePlacement(false)}>Text inside</Button><Button variant={s?.captionSpace ? "default" : "outline"} aria-pressed={!!s?.captionSpace} onClick={() => changePlacement(true)}>Text outside</Button></div>
    {[MEME_TOP, MEME_BOTTOM].map((id, index) => { const caption = state.layers.find(l => l.id === id); return caption && <Field key={id} label={index ? "Bottom caption" : "Top caption"}><textarea aria-label={index ? "Bottom caption text" : "Top caption text"} value={caption.text} disabled={caption.locked} maxLength={2000} rows={2} onChange={e => commit({ ...state, layers: state.layers.map(l => l.id === id ? { ...l, text: e.target.value } : l) })} className="w-full rounded-xl border bg-background p-3" /><Button size="sm" variant="outline" onClick={() => { setSelectedId(id); setTab("Layers"); }}>Style {index ? "bottom" : "top"} caption</Button></Field>; })}
    {!!s?.captionSpace && <Field label="Caption band color"><ColorInput label="Caption band color" value={s.captionBackground ?? "#ffffff"} change={value => patchSettings({ captionBackground: value })} /></Field>}
  </div>;
  const templates = isMeme && <section className="mx-auto mb-8 w-[calc(100%-2rem)] max-w-3xl rounded-3xl border bg-background p-5" aria-label="Original meme templates"><h2 className="text-center text-xl font-bold">Or start with a template</h2><p className="my-2 text-center text-sm text-muted-foreground">Original backdrops. Add your captions, or upload your own meme image above.</p><input aria-label="Search meme templates" placeholder="Search templates" value={templateSearch} onChange={e => setTemplateSearch(e.target.value)} className={`${inputClass} my-3`} /><div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{MEME_TEMPLATES.filter(t => `${t.name} ${t.description}`.toLowerCase().includes(templateSearch.toLowerCase().trim())).map(t => <button key={t.id} onClick={() => void chooseTemplate(t.id)} className="rounded-xl border p-4 text-center hover:bg-muted"><span aria-hidden className="mb-3 block text-5xl">{t.emoji}</span><span className="block font-semibold">{t.name}</span><span className="text-xs text-muted-foreground">{t.description}</span></button>)}</div></section>;
  useEffect(() => {
    if (!file || !state || result || loading || processing) return;
    const abort = new AbortController(); setPreviewBusy(true); setPreviewError("");
    const timer = setTimeout(() => { renderPhoto(file, state, "image/png", 1, abort.signal, 1000).then(blob => { if (!abort.signal.aborted) setPreview(blob); }).catch(e => { if (!abort.signal.aborted) setPreviewError(e instanceof Error ? e.message : "Check the photo options."); }).finally(() => { if (!abort.signal.aborted) setPreviewBusy(false); }); }, 100);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [file, state, result, loading, processing]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!state || processing || result || event.target instanceof HTMLElement && (event.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName))) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [state, processing, result]);
  const add = (next: PhotoLayer) => { const current = latest.current; if (!current) return; if (current.layers.length >= 60) { setError("Use up to 60 layers. Delete unused layers first."); return; } commit({ ...current, layers: [...current.layers, next] }); setSelectedId(next.id); setTab("Layers"); };
  const addKind = (kind: PhotoLayer["kind"]) => add(newPhotoLayer(kind, crypto.randomUUID()));
  const uploadOverlay = async (input?: File) => {
    if (!input || overlayLoading) return;
    const id = generation.current; setOverlayLoading(true); setError("");
    try {
      if (input.size > 5 * 1024 * 1024) throw new Error("Choose an overlay image smaller than 5MB.");
      const stable = new File([await input.arrayBuffer()], input.name, { type: input.type }), dims = await getImageDimensions(stable);
      if (dims.width * dims.height > 5_000_000) throw new Error("Use overlay images below five megapixels.");
      if (id !== generation.current || !latest.current) return;
      const current = latest.current.settings, next = newPhotoLayer("image", crypto.randomUUID());
      next.image = stable; next.name = input.name; next.width = .4; next.height = .4 * current.width / current.height * dims.height / dims.width;
      if (next.height > .8) { next.width *= .8 / next.height; next.height = .8; } next.x = (1 - next.width) / 2; next.y = (1 - next.height) / 2; add(next);
    } catch (e) { if (id === generation.current) setError(e instanceof Error ? e.message : "Choose a valid overlay image."); }
    finally { if (id === generation.current) setOverlayLoading(false); if (overlayInput.current) overlayInput.current.value = ""; }
  };
  const removeLayer = () => { if (state && layer && !layer.locked) { commit({ ...state, layers: state.layers.filter(l => l.id !== layer.id) }); setSelectedId(null); } };
  const reorder = (direction: number) => { if (!state || !layer || layer.locked) return; const index = state.layers.indexOf(layer), next = index + direction; if (next < 0 || next >= state.layers.length) return; const layers = [...state.layers]; [layers[index], layers[next]] = [layers[next], layers[index]]; commit({ ...state, layers }); };
  const layerDown = (event: PointerEvent<HTMLDivElement>, selected: PhotoLayer) => {
    if (!state || selected.locked || tab === "Draw") return;
    event.preventDefault(); event.stopPropagation(); setSelectedId(selected.id); setTab("Layers"); event.currentTarget.setPointerCapture(event.pointerId);
    const rect = canvasRef.current!.getBoundingClientRect(); drag.current = { x: event.clientX, y: event.clientY, layer: selected, handle: (event.target as HTMLElement).dataset.handle ?? "move", width: rect.width, height: rect.height };
    commit(state);
  };
  const layerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d) return;
    const dx = (event.clientX - d.x) / d.width, dy = (event.clientY - d.y) / d.height;
    let patch: Partial<PhotoLayer>;
    if (d.handle === "move") patch = { x: clamp(d.layer.x + dx, -.95, .95), y: clamp(d.layer.y + dy, -.95, .95) };
    else {
      const angle = d.layer.rotation * Math.PI / 180, localX = (dx * d.width * Math.cos(angle) + dy * d.height * Math.sin(angle)) / d.width, localY = (-dx * d.width * Math.sin(angle) + dy * d.height * Math.cos(angle)) / d.height;
      let width = clamp(d.layer.width + localX, .01, 2), height = clamp(d.layer.height + localY, .01, 2);
      if (d.layer.kind === "image" || d.layer.kind === "sticker") { const scale = Math.max(width / d.layer.width, height / d.layer.height); width = Math.min(2, d.layer.width * scale); height = Math.min(2, d.layer.height * scale); }
      patch = { width, height };
    }
    setHistory(old => old ? { ...old, current: { ...old.current, layers: old.current.layers.map(l => l.id === d.layer.id ? { ...l, ...patch } : l) } } : old);
  };
  const point = (event: PointerEvent<HTMLDivElement>) => { const r = event.currentTarget.getBoundingClientRect(); return { x: clamp((event.clientX - r.left) / r.width, 0, 1), y: clamp((event.clientY - r.top) / r.height, 0, 1) }; };
  const drawDown = (event: PointerEvent<HTMLDivElement>) => { if (tab !== "Draw" || !state || state.layers.length >= 60) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); const p = point(event); strokeRef.current = [p]; setStroke([p]); };
  const drawMove = (event: PointerEvent<HTMLDivElement>) => { if (!strokeRef.current.length || strokeRef.current.length >= 4000) return; const p = point(event), last = strokeRef.current.at(-1)!; if (Math.hypot(last.x - p.x, last.y - p.y) < .001) return; strokeRef.current = [...strokeRef.current, p]; setStroke(strokeRef.current); };
  const finishStroke = () => {
    const points = strokeRef.current; strokeRef.current = []; setStroke([]); if (!points.length || !s) return;
    const minX = Math.min(...points.map(p => p.x)), minY = Math.min(...points.map(p => p.y)), maxX = Math.max(...points.map(p => p.x)), maxY = Math.max(...points.map(p => p.y));
    const layer = newPhotoLayer("draw", crypto.randomUUID()); layer.x = minX; layer.y = minY; layer.width = Math.max(.001, maxX - minX); layer.height = Math.max(.001, maxY - minY); layer.color = brushColor; layer.lineWidth = brushWidth; layer.opacity = highlight ? .35 : 1; layer.name = highlight ? "Highlighter" : "Drawing"; layer.points = points.map(p => ({ x: clamp((p.x - minX) / layer.width, 0, 1), y: clamp((p.y - minY) / layer.height, 0, 1) }));
    add(layer); setTab("Draw");
  };
  const setOutputSize = (key: "width" | "height", value: number) => { if (!s) return; const patch = { [key]: value }; if (aspect && value > 0) { if (key === "width") patch.height = Math.max(1, Math.round(value * s.height / s.width)); else patch.width = Math.max(1, Math.round(value * s.width / s.height)); } patchSettings(patch); };
  const rotate = (delta: number) => { if (s) patchSettings({ rotate: ((s.rotate + delta + 360) % 360) as PhotoSettings["rotate"], width: Math.max(1, Math.round(s.height * (1 - 2 * (s.captionSpace ?? 0)))), height: Math.max(1, Math.round(s.width / (1 - 2 * (s.captionSpace ?? 0)))) }); };
  const applyCrop = () => { if (!s) return; const c = cropDraft; if (![c.x, c.y, c.width, c.height].every(Number.isInteger) || c.x < 0 || c.y < 0 || c.width <= 0 || c.height <= 0 || c.x + c.width > source.width || c.y + c.height > source.height) { setError("Keep the crop inside the original photo."); return; } const swapped = s.rotate === 90 || s.rotate === 270; patchSettings({ crop: c, width: swapped ? c.height : c.width, height: Math.max(1, Math.round((swapped ? c.width : c.height) / (1 - 2 * (s.captionSpace ?? 0)))) }); setTab("Adjust"); };
  const save = () => {
    if (!file || !state) return;
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort; setError("");
    void run(async (setProgress, isCancelled) => {
      setProgress(10); const blob = await renderPhoto(file, state, format, quality, abort.signal);
      if (isCancelled() || abort.signal.aborted) return;
      const extension = format === "image/jpeg" ? "jpg" : format === "image/webp" ? "webp" : "png";
      const name = (file.name.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}_. -]/gu, "_").slice(0, 100) || "photo") + `-${isMeme ? "meme" : "edited"}.${extension}`;
      setProgress(100); setResult({ blob, name, width: state.settings.width, height: state.settings.height });
    }, { toolName: toolSlug, successMessage: readyMessage, errorTitle: isMeme ? "Could not generate meme" : "Could not save photo", onError: e => { const message = e instanceof Error ? e.message : "Check the photo and options."; setError(message); return message; } });
  };
  const workspacePreview = state && s && <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2"><Button variant="outline" disabled={!history?.past.length} onClick={undo}>Undo</Button><Button variant="outline" disabled={!history?.future.length} onClick={redo}>Redo</Button><select aria-label="Preview zoom" value={zoom} onChange={e => setZoom(Number(e.target.value))} className="h-10 rounded-xl border bg-background px-3"><option value={100}>Fit</option><option value={150}>150%</option><option value={200}>200%</option></select><span className="text-sm text-muted-foreground">{s.width} × {s.height}px</span></div>
    {tab === "Crop" ? <div className="relative mx-auto w-full max-w-[900px] touch-none overflow-hidden" style={{ aspectRatio: source.width / source.height }} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); cropDrag.current = point(e); }} onPointerMove={e => { const start = cropDrag.current; if (!start) return; const p = point(e); setCropDraft({ x: Math.floor(Math.min(start.x, p.x) * source.width), y: Math.floor(Math.min(start.y, p.y) * source.height), width: Math.max(1, Math.floor(Math.abs(start.x - p.x) * source.width)), height: Math.max(1, Math.floor(Math.abs(start.y - p.y) * source.height)) }); }} onPointerUp={() => { cropDrag.current = null; }} onPointerCancel={() => { cropDrag.current = null; }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- original local photo and interactive crop area */}
      <img src={sourceUrl || undefined} alt="Original photo to crop" draggable={false} className="absolute inset-0 h-full w-full" /><div className="pointer-events-none absolute border-2 border-emerald-400" style={{ left: `${cropDraft.x / source.width * 100}%`, top: `${cropDraft.y / source.height * 100}%`, width: `${cropDraft.width / source.width * 100}%`, height: `${cropDraft.height / source.height * 100}%`, boxShadow: "0 0 0 9999px rgba(0,0,0,.4)" }} />
    </div> : <div className="max-w-full overflow-auto rounded-xl border bg-slate-100" style={{ maxHeight: 750 }}>
      <div ref={canvasRef} className="relative mx-auto touch-none" style={{ width: `${zoom}%`, maxWidth: zoom === 100 ? Math.min(1000, 700 * s.width / s.height) : undefined, aspectRatio: s.width > 0 && s.height > 0 ? s.width / s.height : 1, backgroundImage: "linear-gradient(45deg,#ddd 25%,transparent 25%),linear-gradient(-45deg,#ddd 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ddd 75%),linear-gradient(-45deg,transparent 75%,#ddd 75%)", backgroundSize: "20px 20px", backgroundPosition: "0 0,0 10px,10px -10px,-10px 0px" }} onPointerDown={drawDown} onPointerMove={drawMove} onPointerUp={finishStroke} onPointerCancel={() => { strokeRef.current = []; setStroke([]); }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- locally rendered composite preview */}
        <img src={previewUrl || sourceUrl || undefined} alt="Edited photo preview" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />
        {tab !== "Draw" && state.layers.filter(l => !l.hidden).map(l => <div key={l.id} role="button" tabIndex={0} aria-label={`Select layer ${l.name}`} className={`absolute ${l.locked ? "pointer-events-none" : "cursor-move"} ${l.id === selectedId ? "border-2 border-blue-500" : "hover:border hover:border-blue-300"}`} style={{ left: `${l.x * 100}%`, top: `${l.y * 100}%`, width: `${l.width * 100}%`, height: `${l.height * 100}%`, transform: `rotate(${l.rotation}deg)` }} onPointerDown={e => layerDown(e, l)} onPointerMove={layerMove} onPointerUp={e => { e.stopPropagation(); drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onKeyDown={e => { if (l.locked) return; if (e.key === "Enter") { setSelectedId(l.id); setTab("Layers"); } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Delete", "Backspace"].includes(e.key)) { e.preventDefault(); setSelectedId(l.id); if (e.key === "Delete" || e.key === "Backspace") commit({ ...state, layers: state.layers.filter(entry => entry.id !== l.id) }); else { const step = e.shiftKey ? 10 : 1; commit({ ...state, layers: state.layers.map(entry => entry.id === l.id ? { ...entry, x: clamp(entry.x + (e.key === "ArrowRight" ? step / s.width : e.key === "ArrowLeft" ? -step / s.width : 0), -.95, .95), y: clamp(entry.y + (e.key === "ArrowDown" ? step / s.height : e.key === "ArrowUp" ? -step / s.height : 0), -.95, .95) } : entry) }); } } }}>
          {l.id === selectedId && !l.locked && <span data-handle="resize" aria-hidden className="absolute -bottom-2 -right-2 h-5 w-5 cursor-se-resize rounded-sm border-2 border-white bg-blue-500" />}
        </div>)}
        {stroke.length > 0 && <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${s.width} ${s.height}`}><polyline points={stroke.map(p => `${p.x * s.width},${p.y * s.height}`).join(" ")} fill="none" stroke={brushColor} strokeWidth={brushWidth * Math.min(s.width, s.height)} strokeLinecap="round" strokeLinejoin="round" opacity={highlight ? .35 : 1} /></svg>}
      </div>
    </div>}
    {previewBusy && <p role="status" className="text-xs text-muted-foreground">Updating preview…</p>}
    <p className="text-xs text-muted-foreground">{tab === "Crop" ? "Drag across the original photo to select a crop, or enter exact pixel coordinates." : tab === "Draw" ? "Draw on the photo. Each stroke becomes its own editable layer." : "Select a layer to move it or drag its corner to resize. Arrow keys move by 1px; Shift + arrows by 10px. Undo: Ctrl/⌘ Z."}</p>
  </div>;
  return <FileToolLayout toolSlug={toolSlug} landingExtra={templates} files={loading ? [pending] : [file]} accept={accept} onFilesSelected={selectFile} landingError={error} result={result} processing={processing || loading} progress={loading ? undefined : progress} onCancel={stop} onReset={reset} onDownload={() => { if (result) downloadBlob(result.blob, result.name); }} preview={workspacePreview} faqs={[
    ...(isMeme ? [{ question: "How do meme captions work?", answer: "Edit the top and bottom captions, choose text inside the photo or outside on separate bands, and adjust fonts, outline, color, opacity, position and size in Layers. Add extra text or images freely. Three original templates are included; you can upload your own. GIF inputs use their first frame." }] : []),
    { question: "What can I edit?", answer: "Adjust light and colors, crop, resize, rotate, add editable text, drawings, shapes, stickers and image layers, then add a frame or rounded corners. Everything runs on your device." },
    { question: "Which files and sizes are supported?", answer: "JPG, PNG, WEBP, GIF (first frame) and BMP, up to 100MB and 20 megapixels. Export PNG, JPG or WEBP. Image overlays are limited to 5MB and five megapixels; use up to 60 layers." },
    { question: "Do layers remain editable in the downloaded image?", answer: "The download is a flattened image. Keep the page open to adjust layers and download again. Re-encoding removes metadata. PNG/WEBP support transparent corners; JPG fills transparency with white." },
  ]} related={[]}>
    {result ? <div className="space-y-5 text-center"><h2 className="text-2xl font-bold">{readyMessage}</h2><p className="break-all text-sm text-muted-foreground">{result.name} · {result.width} × {result.height}px</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- local completed photo */}
      <img src={resultUrl || undefined} alt="Saved photo" className="mx-auto max-h-[500px] max-w-full rounded-xl border" /><div className="flex flex-wrap justify-center gap-3"><Button onClick={() => downloadBlob(result.blob, result.name)}>Download image</Button><Button variant="outline" onClick={() => setResult(null)}>Adjust edits</Button><Button variant="outline" onClick={reset}>Start over</Button></div></div> : state && s && <>
      {captionFields}
      <div className="grid grid-cols-2 gap-2">{(["Adjust", "Crop", "Layers", "Draw"] as const).map(name => <Button key={name} variant={tab === name ? "default" : "outline"} aria-pressed={tab === name} onClick={() => { if (name === "Crop") setCropDraft(s.crop); setTab(name); }}>{name}</Button>)}</div>
      {tab === "Adjust" && <>
        <Field label="Filter"><select aria-label="Photo filter" value={s.filter} onChange={e => patchSettings({ filter: e.target.value as PhotoSettings["filter"] })} className={inputClass}>{PHOTO_FILTERS.map(filter => <option key={filter} value={filter}>{filter.replace("-", " ")}</option>)}</select></Field>
        {(["brightness", "contrast", "saturation"] as const).map(key => <Field key={key} label={`${key[0].toUpperCase() + key.slice(1)}: ${s[key]}`}><input aria-label={`Photo ${key}`} type="range" min={-100} max={100} value={s[key]} onChange={e => patchSettings({ [key]: Number(e.target.value) })} className="w-full" /></Field>)}
        <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => rotate(-90)}>Rotate left</Button><Button variant="outline" onClick={() => rotate(90)}>Rotate right</Button><Button variant={s.flipHorizontal ? "default" : "outline"} aria-pressed={s.flipHorizontal} onClick={() => patchSettings({ flipHorizontal: !s.flipHorizontal })}>Flip horizontal</Button><Button variant={s.flipVertical ? "default" : "outline"} aria-pressed={s.flipVertical} onClick={() => patchSettings({ flipVertical: !s.flipVertical })}>Flip vertical</Button></div>
        <p className="text-xs text-muted-foreground">Crop and rotation change the base photo. Layers keep their relative positions on the output canvas.</p>
        <div className="grid grid-cols-2 gap-3">{(["width", "height"] as const).map(key => <Field key={key} label={`Output ${key} (px)`}><input aria-label={`Output ${key} (px)`} type="number" min={1} max={16384} value={s[key]} onChange={e => setOutputSize(key, Number(e.target.value))} className={inputClass} /></Field>)}</div><Check label="Maintain aspect ratio" value={aspect} onChange={setAspect} />
        <div className="flex flex-wrap gap-2">{[25, 50, 75].map(percent => <Button key={percent} variant="outline" onClick={() => patchSettings({ width: Math.max(1, Math.round(s.width * percent / 100)), height: Math.max(1, Math.round(s.height * percent / 100)) })}>{percent}% size</Button>)}</div>
        <Check label="Solid background" value={s.background !== "transparent"} onChange={checked => patchSettings({ background: checked ? "#ffffff" : "transparent" })} />{s.background !== "transparent" && <Field label="Photo background"><ColorInput label="Photo background" value={s.background} change={value => patchSettings({ background: value })} /></Field>}
        <Field label={`Rounded corners: ${Math.round(s.corners * 100)}%`}><input aria-label="Rounded corners" type="range" min={0} max={50} value={s.corners * 100} onChange={e => patchSettings({ corners: Number(e.target.value) / 100 })} className="w-full" /></Field>
        <Field label="Frame"><select aria-label="Photo frame" value={s.frame} onChange={e => patchSettings({ frame: e.target.value as PhotoSettings["frame"] })} className={inputClass}>{["none", "solid", "double", "polaroid"].map(frame => <option key={frame} value={frame}>{frame}</option>)}</select></Field>
        {s.frame !== "none" && <><Field label="Frame color"><ColorInput label="Frame color" value={s.frameColor} change={value => patchSettings({ frameColor: value })} /></Field><Field label={`Frame width: ${Math.round(s.frameWidth * 100)}%`}><input aria-label="Frame width" type="range" min={1} max={25} value={s.frameWidth * 100} onChange={e => patchSettings({ frameWidth: Number(e.target.value) / 100 })} className="w-full" /></Field></>}
        <Button variant="outline" onClick={() => { const clean = initialPhotoState(source.width, source.height); commit({ ...state, settings: clean.settings, layers: isMeme ? changeMemeLayout(state, false).layers : state.layers }); }}>Reset photo adjustments</Button>
      </>}
      {tab === "Crop" && <><div className="grid grid-cols-2 gap-3">{(["x", "y", "width", "height"] as const).map(key => <Field key={key} label={`Crop ${key} (px)`}><input aria-label={`Photo crop ${key} (px)`} type="number" min={key === "x" || key === "y" ? 0 : 1} value={cropDraft[key]} onChange={e => setCropDraft({ ...cropDraft, [key]: Number(e.target.value) })} className={inputClass} /></Field>)}</div><div className="flex flex-wrap gap-2">{[["Square", 1], ["4:3", 4 / 3], ["16:9", 16 / 9]].map(([name, ratio]) => <Button key={name} variant="outline" onClick={() => { const width = Math.min(source.width, Math.floor(source.height * Number(ratio))), height = Math.round(width / Number(ratio)); setCropDraft({ x: Math.floor((source.width - width) / 2), y: Math.floor((source.height - height) / 2), width, height }); }}>{name}</Button>)}<Button variant="outline" onClick={() => setCropDraft({ x: 0, y: 0, ...source })}>Full photo</Button></div><Button onClick={applyCrop}>Apply crop</Button></>}
      {tab === "Draw" && <><Field label="Brush color"><ColorInput label="Brush color" value={brushColor} change={value => setBrushColor(value)} /></Field><Field label={`Brush size: ${Math.max(1, Math.round(brushWidth * Math.min(s.width, s.height)))}px`}><input aria-label="Brush size" type="range" min={.002} max={.1} step={.001} value={brushWidth} onChange={e => setBrushWidth(Number(e.target.value))} className="w-full" /></Field><Check label="Highlighter" value={highlight} onChange={setHighlight} /><p className="text-xs text-muted-foreground">Draw with a mouse or touch. Use Undo to remove the last stroke; use Layers to move or delete earlier strokes.</p></>}
      {tab === "Layers" && <>
        <div className="grid grid-cols-2 gap-2"><Button variant="outline" disabled={state.layers.length >= 60} onClick={() => addKind("text")}>Add text</Button><Button variant="outline" disabled={state.layers.length >= 60} onClick={() => addKind("shape")}>Add shape</Button><Button variant="outline" disabled={state.layers.length >= 60} onClick={() => addKind("sticker")}>Add sticker</Button><Button variant="outline" disabled={state.layers.length >= 60 || overlayLoading} onClick={() => overlayInput.current?.click()}>{overlayLoading ? "Reading image…" : "Add image"}</Button><input ref={overlayInput} type="file" accept="image/png,image/jpeg,image/webp" aria-label="Overlay image" className="hidden" onChange={e => void uploadOverlay(e.target.files?.[0])} /></div>
        <div className="max-h-56 space-y-1 overflow-auto" aria-label="Photo layers">{[...state.layers].reverse().map(l => <button key={l.id} onClick={() => setSelectedId(l.id)} aria-pressed={l.id === selectedId} className={`w-full truncate rounded-lg border px-3 py-2 text-left text-sm ${l.id === selectedId ? "bg-slate-900 text-white" : ""}`}>{l.name}{l.hidden ? " · hidden" : ""}{l.locked ? " · locked" : ""}</button>)}</div>
        {layer && <>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => commit({ ...state, layers: state.layers.map(l => l.id === layer.id ? { ...l, hidden: !l.hidden } : l) })}>{layer.hidden ? "Show layer" : "Hide layer"}</Button><Button variant="outline" onClick={() => commit({ ...state, layers: state.layers.map(l => l.id === layer.id ? { ...l, locked: !l.locked } : l) })}>{layer.locked ? "Unlock layer" : "Lock layer"}</Button></div>
          <fieldset disabled={layer.locked} className="space-y-4 disabled:opacity-60">
            {layer.kind === "text" && <><Field label="Text"><textarea aria-label="Photo text" value={layer.text} maxLength={2000} rows={3} onChange={e => patchLayer({ text: e.target.value, name: e.target.value.slice(0, 24) || "Text" })} className="w-full rounded-xl border bg-background p-3" /></Field><Field label="Font"><select aria-label="Photo text font" value={layer.font} onChange={e => patchLayer({ font: e.target.value as PhotoLayer["font"] })} className={inputClass}>{["sans-serif", "serif", "monospace", "cursive", "impact"].map(font => <option key={font}>{font}</option>)}</select></Field><Field label="Text size (px)"><input aria-label="Photo text size (px)" type="number" min={1} max={Math.min(s.width, s.height)} value={Math.max(1, Math.round(layer.fontSize * Math.min(s.width, s.height)))} onChange={e => patchLayer({ fontSize: Number(e.target.value) / Math.min(s.width, s.height) })} className={inputClass} /></Field><div className="flex gap-2">{(["bold", "italic", "underline"] as const).map(style => <Button key={style} variant={layer[style] ? "default" : "outline"} aria-pressed={layer[style]} onClick={() => patchLayer({ [style]: !layer[style] })}>{style[0].toUpperCase() + style.slice(1)}</Button>)}</div><Field label="Text alignment"><select aria-label="Photo text alignment" value={layer.align} onChange={e => patchLayer({ align: e.target.value as PhotoLayer["align"] })} className={inputClass}>{["left", "center", "right"].map(align => <option key={align}>{align}</option>)}</select></Field><Check label="Text outline" value={(layer.outlineWidth ?? 0) > 0} onChange={checked => patchLayer({ outlineWidth: checked ? .008 : 0 })} />{(layer.outlineWidth ?? 0) > 0 && <><Field label="Outline color"><ColorInput label="Text outline color" value={layer.outlineColor ?? "#000000"} change={value => patchLayer({ outlineColor: value })} /></Field><Field label={`Outline width: ${Math.round((layer.outlineWidth ?? 0) * Math.min(s.width, s.height) * 10) / 10}px`}><input aria-label="Text outline width" type="range" min={.001} max={.05} step={.001} value={layer.outlineWidth} onChange={e => patchLayer({ outlineWidth: Number(e.target.value) })} className="w-full" /></Field></>}</>}
            {layer.kind === "shape" && <Field label="Shape"><select aria-label="Photo shape" value={layer.shape} onChange={e => patchLayer({ shape: e.target.value as PhotoLayer["shape"] })} className={inputClass}>{["rectangle", "ellipse", "triangle", "star", "line", "arrow"].map(shape => <option key={shape}>{shape}</option>)}</select></Field>}
            {layer.kind === "sticker" && <div className="grid grid-cols-6 gap-1">{PHOTO_STICKERS.map(sticker => <button key={sticker} aria-label={`Sticker ${sticker}`} aria-pressed={layer.text === sticker} onClick={() => patchLayer({ text: sticker, name: `Sticker ${sticker}` })} className={`rounded-lg border p-2 text-xl ${layer.text === sticker ? "bg-emerald-100" : ""}`}>{sticker}</button>)}</div>}
            {["text", "shape", "draw"].includes(layer.kind) && <Field label="Layer color"><ColorInput label="Layer color" value={layer.color} change={value => patchLayer({ color: value })} /></Field>}
            {["text", "shape"].includes(layer.kind) && <><Check label="Fill / text background" value={layer.fill !== "transparent"} onChange={checked => patchLayer({ fill: checked ? "#ffffff" : "transparent" })} />{layer.fill !== "transparent" && <Field label="Fill color"><ColorInput label="Layer fill color" value={layer.fill} change={value => patchLayer({ fill: value })} /></Field>}</>}
            {["shape", "draw"].includes(layer.kind) && <Field label="Line width (px)"><input aria-label="Layer line width (px)" type="number" min={1} max={Math.min(s.width, s.height) * .2} value={Math.max(1, Math.round(layer.lineWidth * Math.min(s.width, s.height)))} onChange={e => patchLayer({ lineWidth: Number(e.target.value) / Math.min(s.width, s.height) })} className={inputClass} /></Field>}
            <div className="grid grid-cols-2 gap-3">{(["x", "y", "width", "height"] as const).map(key => <Field key={key} label={`${key[0].toUpperCase() + key.slice(1)} (%)`}><input aria-label={`Layer ${key} (%)`} type="number" min={key === "x" || key === "y" ? -100 : 1} max={key === "x" || key === "y" ? 100 : 200} value={Math.round(layer[key] * 1000) / 10} onChange={e => patchLayer({ [key]: Number(e.target.value) / 100 })} className={inputClass} /></Field>)}</div>
            <Field label="Layer rotation"><input aria-label="Layer rotation" type="number" min={-180} max={180} value={layer.rotation} onChange={e => patchLayer({ rotation: Number(e.target.value) })} className={inputClass} /></Field><Field label={`Opacity: ${Math.round(layer.opacity * 100)}%`}><input aria-label="Layer opacity" type="range" min={0} max={100} value={layer.opacity * 100} onChange={e => patchLayer({ opacity: Number(e.target.value) / 100 })} className="w-full" /></Field>
            <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => reorder(1)}>Bring forward</Button><Button variant="outline" onClick={() => reorder(-1)}>Send backward</Button><Button variant="outline" disabled={state.layers.length >= 60} onClick={() => add({ ...layer, id: crypto.randomUUID(), name: `${layer.name} copy`, x: clamp(layer.x + .03, -.95, .95), y: clamp(layer.y + .03, -.95, .95) })}>Duplicate layer</Button><Button variant="outline" onClick={removeLayer}>Delete layer</Button></div>
          </fieldset>
        </>}
      </>}
      <hr /><Field label="Save as"><select aria-label="Photo output format" value={format} onChange={e => setFormat(e.target.value as OutputImageFormat)} className={inputClass}><option value="image/png">PNG — transparency</option><option value="image/jpeg">JPG — white background</option><option value="image/webp">WEBP</option></select></Field>{format !== "image/png" && <Field label={`Quality: ${Math.round(quality * 100)}%`}><input aria-label="Photo output quality" type="range" min={10} max={100} value={quality * 100} onChange={e => setQuality(Number(e.target.value) / 100)} className="w-full" /></Field>}
      <p className="text-xs text-muted-foreground">Edits stay on your device. The download is a flattened image; keep this page open to adjust layers. Re-encoding removes metadata. GIF uses its first frame. Fonts and emoji follow your browser.</p>
      {previewError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{previewError}</p>}{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <Button size="lg" className="w-full" disabled={overlayLoading || previewBusy || !!previewError} onClick={save}>{isMeme ? "Generate meme" : "Save photo"}</Button>
    </>}
  </FileToolLayout>;
}
