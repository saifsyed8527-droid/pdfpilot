"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type SignatureTab = "draw" | "type" | "upload";

export interface SignatureResult {
  kind: "draw" | "type" | "upload";
  /** For "draw": SVG-ready points relative to a 0,0 origin. For "type": unused. For "upload": unused. */
  points?: { x: number; y: number }[];
  width: number;
  height: number;
  color: string;
  text?: string;
  dataUrl?: string;
  format?: "png" | "jpeg";
}

const RECENT_SIGNATURE_KEY = "pdfpilot-recent-signature";

/** A self-contained modal: it owns its own draw-canvas/typed-preview/upload
 *  state and only reports a finished result upward - the parent editor
 *  doesn't need to know how a signature was produced, only what to place
 *  on the page (see SignatureResult). Kept separate from edit-pdf-client
 *  because none of this needs the editor's page/object state. */
export function SignatureModal({ onInsert, onClose }: { onInsert: (result: SignatureResult) => void; onClose: () => void }) {
  const [tab, setTab] = useState<SignatureTab>("draw");
  const [color, setColor] = useState("#1d4ed8");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pathsRef = useRef<{ x: number; y: number }[][]>([]);
  const currentPathRef = useRef<{ x: number; y: number }[] | null>(null);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [uploadDataUrl, setUploadDataUrl] = useState<string | null>(null);
  const [uploadFormat, setUploadFormat] = useState<"png" | "jpeg">("png");
  const [recent, setRecent] = useState<SignatureResult | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_SIGNATURE_KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch {
      // localStorage can throw in private-browsing contexts; a missing recent signature is harmless.
    }
  }, []);

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const path of pathsRef.current) {
      if (path.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (const p of path.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  };

  useEffect(redraw, [color]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    currentPathRef.current = [getPoint(e)];
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!currentPathRef.current) return;
    currentPathRef.current.push(getPoint(e));
    redraw();
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    const path = currentPathRef.current;
    ctx.moveTo(path[0].x, path[0].y);
    for (const p of path.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const onPointerUp = () => {
    if (currentPathRef.current && currentPathRef.current.length > 1) {
      pathsRef.current.push(currentPathRef.current);
      setHasDrawing(true);
    }
    currentPathRef.current = null;
  };

  const clearDraw = () => {
    pathsRef.current = [];
    setHasDrawing(false);
    redraw();
  };

  const saveRecent = (result: SignatureResult) => {
    try {
      localStorage.setItem(RECENT_SIGNATURE_KEY, JSON.stringify(result));
    } catch {
      // Best-effort convenience only - never block insertion on it.
    }
  };

  const handleInsert = () => {
    if (tab === "draw" && hasDrawing) {
      // Concatenating every stroke into one continuous polyline (rather than
      // a true multi-path shape) is the same single-path model DrawObject
      // already uses for the freehand pencil tool - a multi-stroke
      // signature (e.g. a crossed "t") may show a faint connecting line
      // between strokes, a cosmetic tradeoff, not a functional one: the
      // signature still exports as real, movable, resizable vector content.
      const allPoints = pathsRef.current.flat();
      const minX = Math.min(...allPoints.map((p) => p.x));
      const minY = Math.min(...allPoints.map((p) => p.y));
      const maxX = Math.max(...allPoints.map((p) => p.x));
      const maxY = Math.max(...allPoints.map((p) => p.y));
      const points = allPoints.map((p) => ({ x: p.x - minX, y: p.y - minY }));
      const result: SignatureResult = { kind: "draw", points, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY), color };
      saveRecent(result);
      onInsert(result);
    } else if (tab === "type" && typedText.trim()) {
      const result: SignatureResult = { kind: "type", text: typedText.trim(), width: Math.max(120, typedText.length * 16), height: 44, color };
      saveRecent(result);
      onInsert(result);
    } else if (tab === "upload" && uploadDataUrl) {
      const result: SignatureResult = { kind: "upload", dataUrl: uploadDataUrl, format: uploadFormat, width: 220, height: 100, color };
      saveRecent(result);
      onInsert(result);
    }
  };

  const canInsert = (tab === "draw" && hasDrawing) || (tab === "type" && typedText.trim().length > 0) || (tab === "upload" && !!uploadDataUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold tracking-tight">Add signature</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-950/50">
          {(["draw", "type", "upload"] as SignatureTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-lg py-1.5 text-sm font-medium capitalize transition",
                tab === t ? "bg-white text-slate-950 shadow dark:bg-slate-800 dark:text-white" : "text-slate-500"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "draw" && (
          <div className="space-y-3">
            <canvas
              ref={canvasRef}
              width={400}
              height={150}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="w-full touch-none rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/40"
              style={{ aspectRatio: "400 / 150" }}
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {["#1d4ed8", "#000000", "#dc2626"].map((c) => (
                  <button key={c} type="button" onClick={() => setColor(c)} aria-label={c} style={{ backgroundColor: c }} className={cn("h-6 w-6 rounded-full border-2", color === c ? "border-orange-500" : "border-white dark:border-slate-900")} />
                ))}
              </div>
              <button type="button" onClick={clearDraw} className="text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-900 dark:hover:text-white">
                Clear
              </button>
            </div>
          </div>
        )}

        {tab === "type" && (
          <div className="space-y-3">
            <input
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder="Your name"
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 dark:border-slate-700 dark:bg-slate-900"
            />
            <div className="flex h-24 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/40">
              <span style={{ fontFamily: "'Brush Script MT', cursive, serif", fontStyle: "italic", fontSize: 30, color }}>{typedText || "Preview"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {["#1d4ed8", "#000000", "#dc2626"].map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} aria-label={c} style={{ backgroundColor: c }} className={cn("h-6 w-6 rounded-full border-2", color === c ? "border-orange-500" : "border-white dark:border-slate-900")} />
              ))}
            </div>
          </div>
        )}

        {tab === "upload" && (
          <div className="space-y-3">
            {uploadDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- locally chosen file preview, not an optimizable remote asset
              <img src={uploadDataUrl} alt="" className="mx-auto h-24 rounded-xl border border-slate-200 bg-slate-50 object-contain dark:border-slate-700 dark:bg-slate-950/40" />
            ) : (
              <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-center dark:border-slate-700 dark:bg-slate-950/40">
                <span className="text-sm font-medium">Choose an image</span>
                <span className="text-xs text-muted-foreground">PNG with transparency works best</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setUploadFormat(f.type === "image/png" ? "png" : "jpeg");
                    const reader = new FileReader();
                    reader.onload = () => setUploadDataUrl(reader.result as string);
                    reader.readAsDataURL(f);
                  }}
                />
              </label>
            )}
            {uploadDataUrl && (
              <button type="button" onClick={() => setUploadDataUrl(null)} className="text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-900 dark:hover:text-white">
                Choose a different image
              </button>
            )}
          </div>
        )}

        {recent && (
          <button
            type="button"
            onClick={() => onInsert(recent)}
            className="mt-3 w-full rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-600 transition hover:border-orange-300 hover:bg-orange-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-orange-950/20"
          >
            Use my last signature
          </button>
        )}

        <button
          type="button"
          onClick={handleInsert}
          disabled={!canInsert}
          className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-slate-950 text-sm font-semibold text-white shadow-lg transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Insert signature
        </button>
      </div>
    </div>
  );
}
