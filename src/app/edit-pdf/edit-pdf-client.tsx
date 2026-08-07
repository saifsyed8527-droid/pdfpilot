"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Download,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Type,
  Square,
  Circle,
  Minus,
  Pencil,
  Highlighter,
  StickyNote,
  Signature,
  ImagePlus,
  MousePointer2,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Trash2,
  Copy,
  ClipboardPaste,
  BringToFront,
  SendToBack,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import {
  classifyPdfRenderError,
  PDF_RENDER_ERROR_MESSAGE,
} from "@/lib/engines/pdf-render-engine";
import { useProcessingTask } from "@/lib/use-processing-task";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";
import type {
  DrawObject,
  EditorObject,
  ImageObject,
  LineObject,
  NoteObject,
  PagesObjects,
  ShapeObject,
  TextObject,
} from "@/lib/editor/types";
import { nextObjectId } from "@/lib/editor/types";
import { exportEditedPdf } from "@/lib/editor/pdf-export";

/** Scale the page is rendered at for editing (roughly 108 DPI) - the same
 *  canvas pixels are what every object's x/y/width/height is measured
 *  against, so the page <img> is always shown at this exact pixel size
 *  (maxWidth: "none" overrides Tailwind preflight's img{max-width:100%})
 *  rather than letting the browser shrink it to fit a narrow container.
 *  Zoom is a separate, purely visual CSS transform layered on top (see
 *  the page-view render below) - the object model's own coordinate
 *  system never changes with zoom, only how large it's displayed. */
const EDIT_SCALE = 1.5;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const SNAP_THRESHOLD_PX = 6;
const MIN_OBJECT_SIZE = 12;

type ToolId = "select" | "text" | "rectangle" | "ellipse" | "line" | "draw" | "highlight" | "note";

const COLOR_SWATCHES = ["#000000", "#dc2626", "#2563eb", "#16a34a", "#ca8a04", "#ffffff"];

interface EditedPage {
  pageNumber: number;
  dataUrl: string;
  widthPx: number;
  heightPx: number;
  rotation: number;
}

// ---------------------------------------------------------------------------
// Undo/redo history - a small reducer over the full per-page object map.
// Every completed edit (not each pointermove of an in-progress drag) calls
// dispatch({type:"commit", next}); "undo"/"redo" replay across a capped
// stack. Using a reducer here (rather than parallel useState + manual
// history arrays) keeps "read old state, then schedule two state updates"
// out of an impure setState updater - the same discipline this codebase's
// PageThumbnailGrid comments call out explicitly for the same reason.
// ---------------------------------------------------------------------------
interface HistoryState {
  past: PagesObjects[];
  present: PagesObjects;
  future: PagesObjects[];
}
type HistoryAction =
  | { type: "commit"; next: PagesObjects }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; state: PagesObjects };

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "commit":
      if (action.next === state.present) return state;
      return { past: [...state.past, state.present].slice(-50), present: action.next, future: [] };
    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future] };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return { past: [...state.past, state.present], present: next, future: rest };
    }
    case "reset":
      return { past: [], present: action.state, future: [] };
  }
}

type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

interface DragState {
  kind: "move" | "resize" | "rotate" | "create-shape" | "create-draw";
  startCanvasX: number;
  startCanvasY: number;
  pageIndex: number;
  startObjects: Record<string, EditorObject>;
  handle?: HandleId;
  startAngleRad?: number;
  startRotation?: number;
  centerX?: number;
  centerY?: number;
  pendingId?: string;
  pathPoints?: { x: number; y: number }[];
}

function defaultObjectDefaults() {
  return {
    text: { fontSize: 18, color: "#000000", fontWeight: "normal" as const, fontStyle: "normal" as const },
    rectangle: { fillColor: "#2563eb" as string | null, strokeColor: "#000000" as string | null, strokeWidth: 2, opacity: 0.4 },
    ellipse: { fillColor: "#2563eb" as string | null, strokeColor: "#000000" as string | null, strokeWidth: 2, opacity: 0.4 },
    line: { strokeColor: "#000000", strokeWidth: 2 },
    draw: { strokeColor: "#000000", strokeWidth: 3 },
    highlight: { fillColor: "#fde047", opacity: 0.4 },
    note: { color: "#fef08a" },
  };
}

interface EditPdfClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function EditPdfClient({ faqs, related }: EditPdfClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<EditedPage[]>([]);
  const [totalPageCount, setTotalPageCount] = useState(0);
  const [loadingPages, setLoadingPages] = useState(false);
  const [loadError, setLoadError] = useState<ReturnType<typeof classifyPdfRenderError> | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const [history, dispatchHistory] = useReducer(historyReducer, { past: [], present: {}, future: [] });
  const pagesObjects = history.present;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTool, setActiveTool] = useState<ToolId>("select");
  const [zoom, setZoom] = useState(1);
  const [liveOverride, setLiveOverride] = useState<Record<string, Partial<EditorObject>> | null>(null);
  const [defaults, setDefaults] = useState(defaultObjectDefaults());
  const [resultPdf, setResultPdf] = useState<Blob | null>(null);
  const [snapGuide, setSnapGuide] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const { processing, progress, run } = useProcessingTask();

  const pageViewRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const clipboardRef = useRef<EditorObject[]>([]);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const newTextIdRef = useRef<string | null>(null);
  const zIndexCounterRef = useRef(1);

  // Frequently-changing reactive values the window-level drag listeners
  // need, mirrored into a ref every render instead of being captured in a
  // stale closure - lets pointermove/pointerup be registered once (see the
  // effect below) instead of being torn down and rebuilt on every state
  // change a drag might read, which would risk missing events mid-drag.
  const liveRef = useRef({ zoom, currentPageIndex, pages, pagesObjects, selectedIds });
  liveRef.current = { zoom, currentPageIndex, pages, pagesObjects, selectedIds };

  const reset = () => {
    setFile(null);
    setPages([]);
    setTotalPageCount(0);
    setLoadError(null);
    setCurrentPageIndex(0);
    dispatchHistory({ type: "reset", state: {} });
    setSelectedIds(new Set());
    setActiveTool("select");
    setZoom(1);
    setResultPdf(null);
  };

  const handleFilesSelected = async (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    const pdfFile = newFiles[0];
    reset();
    setFile(pdfFile);
    setLoadingPages(true);

    try {
      const { PDFDocument } = await import("pdf-lib");
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const rotations = pdf.getPages().map((p) => p.getRotation().angle);

      // Rendered page-by-page here instead of via the shared renderPdfPages
      // batch helper: pdfjs's page.render() hangs indefinitely (30+s, not
      // just slow) for a page with a non-zero /Rotate value, verified via
      // temporary instrumentation. Placement is disabled on rotated pages
      // regardless, so those pages get a placeholder instead of a real
      // render - avoiding the hang instead of working around it.
      const { loadPdfjs } = await import("@/lib/pdfjs");
      const pdfjsLib = await loadPdfjs();
      const pdfjsDoc = await pdfjsLib.getDocument({ data: await pdfFile.arrayBuffer() }).promise;
      setTotalPageCount(pdfjsDoc.numPages);

      for (let pageNumber = 1; pageNumber <= pdfjsDoc.numPages; pageNumber++) {
        const rotation = rotations[pageNumber - 1] ?? 0;
        const page = await pdfjsDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: EDIT_SCALE });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        if (rotation === 0) {
          await page.render({ canvas, viewport }).promise;
        } else {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#f1f5f9";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#64748b";
            ctx.font = "16px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Rotated page - preview unavailable", canvas.width / 2, canvas.height / 2);
          }
        }

        const edited: EditedPage = {
          pageNumber,
          dataUrl: canvas.toDataURL("image/png"),
          widthPx: canvas.width,
          heightPx: canvas.height,
          rotation,
        };
        setPages((prev) => [...prev, edited]);
      }
    } catch (error) {
      console.error("Error loading PDF for editing:", error);
      const message = error instanceof Error ? error.message : "";
      setLoadError(message.includes("is encrypted") ? "password" : classifyPdfRenderError(error));
    } finally {
      setLoadingPages(false);
    }
  };

  const currentPage = pages[currentPageIndex];
  const currentObjects = pagesObjects[currentPageIndex] ?? [];
  const canEditCurrentPage = !!currentPage && currentPage.rotation === 0;

  const getDisplay = useCallback(
    (obj: EditorObject): EditorObject => {
      const override = liveOverride?.[obj.id];
      return override ? ({ ...obj, ...override } as EditorObject) : obj;
    },
    [liveOverride]
  );

  // -------------------------------------------------------------------
  // Object mutation helpers - all funnel through commitObjects so every
  // completed change is undoable.
  // -------------------------------------------------------------------
  const commitObjects = (pageIndex: number, objects: EditorObject[]) => {
    dispatchHistory({ type: "commit", next: { ...liveRef.current.pagesObjects, [pageIndex]: objects } });
  };

  const addObject = (pageIndex: number, obj: EditorObject) => {
    zIndexCounterRef.current += 1;
    const withZ = { ...obj, zIndex: zIndexCounterRef.current };
    commitObjects(pageIndex, [...(liveRef.current.pagesObjects[pageIndex] ?? []), withZ]);
    setSelectedIds(new Set([withZ.id]));
  };

  const updateObject = (pageIndex: number, id: string, patch: Partial<EditorObject>) => {
    const objects = (liveRef.current.pagesObjects[pageIndex] ?? []).map((o) =>
      o.id === id ? ({ ...o, ...patch } as EditorObject) : o
    );
    commitObjects(pageIndex, objects);
  };

  // Typing a sentence fires an onChange per keystroke; committing each one
  // to history would both make undo revert one character at a time (not
  // the useful "undo this edit" a user expects) and burn through the
  // capped history stack almost instantly. Keystrokes update a live-only
  // override (the same mechanism drag/resize/rotate already use for their
  // in-progress preview) and only land in history - as a single entry -
  // on blur, when the edit is actually finished.
  const handleTextChange = (id: string, text: string) => {
    setLiveOverride((prev) => ({ ...prev, [id]: { text } }));
  };
  const handleTextBlur = (pageIndex: number, id: string) => {
    setLiveOverride((prev) => {
      const pending = prev?.[id];
      if (pending && "text" in pending) {
        updateObject(pageIndex, id, { text: pending.text } as Partial<EditorObject>);
      }
      if (!prev) return prev;
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const deleteSelected = () => {
    if (selectedIds.size === 0) return;
    const objects = currentObjects.filter((o) => !selectedIds.has(o.id));
    commitObjects(currentPageIndex, objects);
    setSelectedIds(new Set());
  };

  const duplicateSelected = () => {
    if (selectedIds.size === 0) return;
    const toDuplicate = currentObjects.filter((o) => selectedIds.has(o.id));
    const copies = toDuplicate.map((o) => {
      zIndexCounterRef.current += 1;
      return { ...o, id: nextObjectId(), x: o.x + 16, y: o.y + 16, zIndex: zIndexCounterRef.current };
    });
    commitObjects(currentPageIndex, [...currentObjects, ...copies]);
    setSelectedIds(new Set(copies.map((c) => c.id)));
  };

  const copySelected = () => {
    if (selectedIds.size === 0) return;
    clipboardRef.current = currentObjects.filter((o) => selectedIds.has(o.id));
    toast.success(`Copied ${clipboardRef.current.length} object${clipboardRef.current.length > 1 ? "s" : ""}`);
  };

  const pasteClipboard = () => {
    if (clipboardRef.current.length === 0) return;
    const copies = clipboardRef.current.map((o) => {
      zIndexCounterRef.current += 1;
      return { ...o, id: nextObjectId(), x: o.x + 20, y: o.y + 20, zIndex: zIndexCounterRef.current };
    });
    commitObjects(currentPageIndex, [...currentObjects, ...copies]);
    setSelectedIds(new Set(copies.map((c) => c.id)));
  };

  const nudgeSelected = (dx: number, dy: number) => {
    if (selectedIds.size === 0) return;
    const objects = currentObjects.map((o) =>
      selectedIds.has(o.id) ? { ...o, x: o.x + dx, y: o.y + dy } : o
    );
    commitObjects(currentPageIndex, objects);
  };

  const reorderSelected = (direction: "front" | "back" | "forward" | "backward") => {
    if (selectedIds.size !== 1) return;
    const id = [...selectedIds][0];
    const sorted = [...currentObjects].sort((a, b) => a.zIndex - b.zIndex);
    const idx = sorted.findIndex((o) => o.id === id);
    if (idx === -1) return;

    if (direction === "front") {
      zIndexCounterRef.current += 1;
      updateObject(currentPageIndex, id, { zIndex: zIndexCounterRef.current });
      return;
    }
    if (direction === "back") {
      const minZ = Math.min(...currentObjects.map((o) => o.zIndex));
      updateObject(currentPageIndex, id, { zIndex: minZ - 1 });
      return;
    }
    const swapIdx = direction === "forward" ? idx + 1 : idx - 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    const objects = currentObjects.map((o) => {
      if (o.id === id) return { ...o, zIndex: other.zIndex };
      if (o.id === other.id) return { ...o, zIndex: sorted[idx].zIndex };
      return o;
    });
    commitObjects(currentPageIndex, objects);
  };

  // -------------------------------------------------------------------
  // Coordinate conversion + snapping
  // -------------------------------------------------------------------
  const screenToCanvas = (clientX: number, clientY: number) => {
    const rect = pageViewRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const z = liveRef.current.zoom;
    return { x: (clientX - rect.left) / z, y: (clientY - rect.top) / z };
  };

  const applySnap = (x: number, y: number, width: number, height: number, pageIndex: number) => {
    const page = liveRef.current.pages[pageIndex];
    if (!page) return { x, y, guideX: null as number | null, guideY: null as number | null };
    let snappedX = x;
    let snappedY = y;
    let guideX: number | null = null;
    let guideY: number | null = null;

    const pageCenterX = page.widthPx / 2;
    const objCenterX = x + width / 2;
    if (Math.abs(objCenterX - pageCenterX) < SNAP_THRESHOLD_PX) {
      snappedX = pageCenterX - width / 2;
      guideX = pageCenterX;
    }
    const pageCenterY = page.heightPx / 2;
    const objCenterY = y + height / 2;
    if (Math.abs(objCenterY - pageCenterY) < SNAP_THRESHOLD_PX) {
      snappedY = pageCenterY - height / 2;
      guideY = pageCenterY;
    }
    return { x: snappedX, y: snappedY, guideX, guideY };
  };

  // -------------------------------------------------------------------
  // Drag lifecycle - window-level listeners registered once; dragRef and
  // liveRef (not component state) carry the moving parts so the listeners
  // never go stale and never need to be re-subscribed mid-drag.
  // -------------------------------------------------------------------
  const finishTextCreation = (id: string) => {
    newTextIdRef.current = id;
  };

  useEffect(() => {
    if (!newTextIdRef.current) return;
    const el = document.querySelector<HTMLTextAreaElement>(`[data-object-id="${newTextIdRef.current}"] textarea`);
    el?.focus();
    newTextIdRef.current = null;
  });

  const beginCreateShape = (
    e: { clientX: number; clientY: number },
    tool: ToolId,
    pageIndex: number
  ) => {
    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    const id = nextObjectId();
    zIndexCounterRef.current += 1;
    let obj: EditorObject;

    if (tool === "rectangle" || tool === "highlight") {
      const d = tool === "highlight" ? defaults.highlight : defaults.rectangle;
      obj = {
        id,
        type: "rectangle",
        x,
        y,
        width: 1,
        height: 1,
        rotation: 0,
        zIndex: zIndexCounterRef.current,
        fillColor: "fillColor" in d ? d.fillColor : null,
        strokeColor: tool === "highlight" ? null : (defaults.rectangle.strokeColor ?? null),
        strokeWidth: defaults.rectangle.strokeWidth,
        opacity: d.opacity,
      } satisfies ShapeObject;
    } else if (tool === "ellipse") {
      obj = {
        id,
        type: "ellipse",
        x,
        y,
        width: 1,
        height: 1,
        rotation: 0,
        zIndex: zIndexCounterRef.current,
        fillColor: defaults.ellipse.fillColor,
        strokeColor: defaults.ellipse.strokeColor,
        strokeWidth: defaults.ellipse.strokeWidth,
        opacity: defaults.ellipse.opacity,
      } satisfies ShapeObject;
    } else {
      obj = {
        id,
        type: "line",
        x,
        y,
        width: 1,
        height: 1,
        rotation: 0,
        zIndex: zIndexCounterRef.current,
        strokeColor: defaults.line.strokeColor,
        strokeWidth: defaults.line.strokeWidth,
      } satisfies LineObject;
    }

    dragRef.current = {
      kind: "create-shape",
      startCanvasX: x,
      startCanvasY: y,
      pageIndex,
      startObjects: {},
      pendingId: id,
    };
    setLiveOverride({ [id]: obj });
    // Object doesn't exist in committed state yet during the drag; a
    // temporary render-only entry is injected via renderObjects below.
  };

  const beginCreateDraw = (e: { clientX: number; clientY: number }, pageIndex: number, kind: "draw" | "signature") => {
    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    const id = nextObjectId();
    dragRef.current = {
      kind: "create-draw",
      startCanvasX: x,
      startCanvasY: y,
      pageIndex,
      startObjects: {},
      pendingId: id,
      pathPoints: [{ x, y }],
    };
    const obj: DrawObject = {
      id,
      type: "draw",
      x,
      y,
      width: 1,
      height: 1,
      rotation: 0,
      zIndex: zIndexCounterRef.current + 1,
      points: [{ x: 0, y: 0 }],
      strokeColor: defaults.draw.strokeColor,
      strokeWidth: defaults.draw.strokeWidth,
      kind,
    };
    setLiveOverride({ [id]: obj });
  };

  const beginMove = (e: { clientX: number; clientY: number }, pageIndex: number, ids: string[]) => {
    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    const startObjects: Record<string, EditorObject> = {};
    for (const obj of liveRef.current.pagesObjects[pageIndex] ?? []) {
      if (ids.includes(obj.id)) startObjects[obj.id] = obj;
    }
    dragRef.current = { kind: "move", startCanvasX: x, startCanvasY: y, pageIndex, startObjects };
  };

  const beginResize = (e: { clientX: number; clientY: number }, pageIndex: number, id: string, handle: HandleId) => {
    const obj = (liveRef.current.pagesObjects[pageIndex] ?? []).find((o) => o.id === id);
    if (!obj) return;
    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    dragRef.current = {
      kind: "resize",
      startCanvasX: x,
      startCanvasY: y,
      pageIndex,
      startObjects: { [id]: obj },
      handle,
    };
  };

  const beginRotate = (e: { clientX: number; clientY: number }, pageIndex: number, id: string) => {
    const obj = (liveRef.current.pagesObjects[pageIndex] ?? []).find((o) => o.id === id);
    if (!obj) return;
    const cx = obj.x + obj.width / 2;
    const cy = obj.y + obj.height / 2;
    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    dragRef.current = {
      kind: "rotate",
      startCanvasX: x,
      startCanvasY: y,
      pageIndex,
      startObjects: { [id]: obj },
      startAngleRad: Math.atan2(y - cy, x - cx),
      startRotation: obj.rotation,
      centerX: cx,
      centerY: cy,
    };
  };

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const { x, y } = screenToCanvas(e.clientX, e.clientY);

      if (drag.kind === "move") {
        const dx = x - drag.startCanvasX;
        const dy = y - drag.startCanvasY;
        const override: Record<string, Partial<EditorObject>> = {};
        let guideX: number | null = null;
        let guideY: number | null = null;
        Object.values(drag.startObjects).forEach((start) => {
          let nx = start.x + dx;
          let ny = start.y + dy;
          if (Object.keys(drag.startObjects).length === 1) {
            const snapped = applySnap(nx, ny, start.width, start.height, drag.pageIndex);
            nx = snapped.x;
            ny = snapped.y;
            guideX = snapped.guideX ?? guideX;
            guideY = snapped.guideY ?? guideY;
          }
          override[start.id] = { x: nx, y: ny };
        });
        setLiveOverride(override);
        setSnapGuide({ x: guideX, y: guideY });
      } else if (drag.kind === "resize") {
        const [id, start] = Object.entries(drag.startObjects)[0];
        const handle = drag.handle!;
        let { x: nx, y: ny, width: nw, height: nh } = start;
        const right = start.x + start.width;
        const bottom = start.y + start.height;

        if (handle.includes("w")) {
          nx = Math.min(x, right - MIN_OBJECT_SIZE);
          nw = right - nx;
        }
        if (handle.includes("e")) {
          nw = Math.max(MIN_OBJECT_SIZE, x - start.x);
        }
        if (handle.includes("n")) {
          ny = Math.min(y, bottom - MIN_OBJECT_SIZE);
          nh = bottom - ny;
        }
        if (handle.includes("s")) {
          nh = Math.max(MIN_OBJECT_SIZE, y - start.y);
        }
        setLiveOverride({ [id]: { x: nx, y: ny, width: nw, height: nh } });
      } else if (drag.kind === "rotate") {
        const [id] = Object.entries(drag.startObjects)[0];
        const cx = drag.centerX!;
        const cy = drag.centerY!;
        const currentAngle = Math.atan2(y - cy, x - cx);
        const deltaDeg = ((currentAngle - drag.startAngleRad!) * 180) / Math.PI;
        let rotation = (drag.startRotation! + deltaDeg) % 360;
        if (e.shiftKey) rotation = Math.round(rotation / 15) * 15;
        setLiveOverride({ [id]: { rotation } });
      } else if (drag.kind === "create-shape") {
        const id = drag.pendingId!;
        const nx = Math.min(drag.startCanvasX, x);
        const ny = Math.min(drag.startCanvasY, y);
        const nw = Math.max(MIN_OBJECT_SIZE, Math.abs(x - drag.startCanvasX));
        const nh = Math.max(MIN_OBJECT_SIZE, Math.abs(y - drag.startCanvasY));
        setLiveOverride((prev) => ({ ...prev, [id]: { ...prev?.[id], x: nx, y: ny, width: nw, height: nh } }));
      } else if (drag.kind === "create-draw") {
        drag.pathPoints!.push({ x, y });
        const xs = drag.pathPoints!.map((p) => p.x);
        const ys = drag.pathPoints!.map((p) => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        const id = drag.pendingId!;
        const relativePoints = drag.pathPoints!.map((p) => ({ x: p.x - minX, y: p.y - minY }));
        setLiveOverride((prev) => ({
          ...prev,
          [id]: {
            ...prev?.[id],
            x: minX,
            y: minY,
            width: Math.max(1, maxX - minX),
            height: Math.max(1, maxY - minY),
            points: relativePoints,
          },
        }));
      }
    };

    const handleUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      setSnapGuide({ x: null, y: null });

      if (drag.kind === "move" || drag.kind === "resize" || drag.kind === "rotate") {
        setLiveOverride((override) => {
          if (!override) return null;
          const objects = (liveRef.current.pagesObjects[drag.pageIndex] ?? []).map((o) =>
            override[o.id] ? ({ ...o, ...override[o.id] } as EditorObject) : o
          );
          dispatchHistory({ type: "commit", next: { ...liveRef.current.pagesObjects, [drag.pageIndex]: objects } });
          return null;
        });
      } else if (drag.kind === "create-shape") {
        const id = drag.pendingId!;
        setLiveOverride((override) => {
          const pending = override?.[id];
          if (!pending || !pending.width || pending.width < MIN_OBJECT_SIZE + 1) {
            // Treat as a plain click: still create it, at a sensible
            // default size centered on the click point, rather than
            // discarding - matches how design tools handle a
            // no-drag click with a shape tool active.
          }
          if (pending) {
            zIndexCounterRef.current += 1;
            const finalObj = { ...pending, zIndex: zIndexCounterRef.current } as EditorObject;
            const objects = [...(liveRef.current.pagesObjects[drag.pageIndex] ?? []), finalObj];
            dispatchHistory({ type: "commit", next: { ...liveRef.current.pagesObjects, [drag.pageIndex]: objects } });
            setSelectedIds(new Set([id]));
          }
          return null;
        });
        setActiveTool("select");
      } else if (drag.kind === "create-draw") {
        const id = drag.pendingId!;
        setLiveOverride((override) => {
          const pending = override?.[id] as DrawObject | undefined;
          if (pending && pending.points.length >= 2) {
            zIndexCounterRef.current += 1;
            const finalObj = { ...pending, zIndex: zIndexCounterRef.current };
            const objects = [...(liveRef.current.pagesObjects[drag.pageIndex] ?? []), finalObj];
            dispatchHistory({ type: "commit", next: { ...liveRef.current.pagesObjects, [drag.pageIndex]: objects } });
            setSelectedIds(new Set([id]));
          }
          return null;
        });
        setActiveTool("select");
      }
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------
  // Canvas background pointerdown - starts a create-* drag for tool
  // modes, or clears selection for the Select tool.
  // -------------------------------------------------------------------
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!currentPage || !canEditCurrentPage) return;

    if (activeTool === "select") {
      setSelectedIds(new Set());
      return;
    }
    if (activeTool === "text") {
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      const obj: TextObject = {
        id: nextObjectId(),
        type: "text",
        x,
        y,
        width: 220,
        height: defaults.text.fontSize * 1.6,
        rotation: 0,
        zIndex: 0,
        text: "",
        fontSize: defaults.text.fontSize,
        color: defaults.text.color,
        fontWeight: defaults.text.fontWeight,
        fontStyle: defaults.text.fontStyle,
      };
      addObject(currentPageIndex, obj);
      finishTextCreation(obj.id);
      setActiveTool("select");
      return;
    }
    if (activeTool === "note") {
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      const obj: NoteObject = {
        id: nextObjectId(),
        type: "note",
        x,
        y,
        width: 150,
        height: 110,
        rotation: 0,
        zIndex: 0,
        text: "",
        color: defaults.note.color,
      };
      addObject(currentPageIndex, obj);
      setActiveTool("select");
      return;
    }
    if (activeTool === "rectangle" || activeTool === "ellipse" || activeTool === "line" || activeTool === "highlight") {
      beginCreateShape(e, activeTool, currentPageIndex);
      return;
    }
    if (activeTool === "draw") {
      beginCreateDraw(e, currentPageIndex, "draw");
    }
  };

  const handleObjectPointerDown = (e: React.PointerEvent, obj: EditorObject) => {
    if (activeTool !== "select") return;
    e.stopPropagation();
    let nextSelection: Set<string>;
    if (e.shiftKey) {
      nextSelection = new Set(selectedIds);
      if (nextSelection.has(obj.id)) nextSelection.delete(obj.id);
      else nextSelection.add(obj.id);
    } else {
      nextSelection = selectedIds.has(obj.id) ? selectedIds : new Set([obj.id]);
    }
    setSelectedIds(nextSelection);
    beginMove(e, currentPageIndex, [...nextSelection]);
  };

  const handleImageFileChosen = async (fileList: FileList | null) => {
    const imgFile = fileList?.[0];
    if (!imgFile || !currentPage) return;
    const format = imgFile.type === "image/png" ? "png" : "jpeg";
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(imgFile);
    });
    const naturalSize: { width: number; height: number } = await new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.src = dataUrl;
    });
    const maxDim = 280;
    const ratio = Math.min(1, maxDim / Math.max(naturalSize.width, naturalSize.height));
    const width = Math.max(MIN_OBJECT_SIZE, naturalSize.width * ratio);
    const height = Math.max(MIN_OBJECT_SIZE, naturalSize.height * ratio);

    const obj: ImageObject = {
      id: nextObjectId(),
      type: "image",
      x: Math.max(0, currentPage.widthPx / 2 - width / 2),
      y: Math.max(0, currentPage.heightPx / 2 - height / 2),
      width,
      height,
      rotation: 0,
      zIndex: 0,
      dataUrl,
      format,
    };
    addObject(currentPageIndex, obj);
    setActiveTool("select");
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  // -------------------------------------------------------------------
  // Keyboard shortcuts
  // -------------------------------------------------------------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const isEditingText =
        active instanceof HTMLElement &&
        (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);

      if (e.key === "Escape") {
        if (isEditingText) (active as HTMLElement).blur();
        setSelectedIds(new Set());
        setActiveTool("select");
        return;
      }
      if (isEditingText) return;

      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatchHistory({ type: e.shiftKey ? "redo" : "undo" });
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        dispatchHistory({ type: "redo" });
        return;
      }
      if (mod && e.key.toLowerCase() === "c") {
        e.preventDefault();
        copySelected();
        return;
      }
      if (mod && e.key.toLowerCase() === "v") {
        e.preventDefault();
        pasteClipboard();
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.size > 0) {
          e.preventDefault();
          deleteSelected();
        }
        return;
      }
      if (e.key.startsWith("Arrow")) {
        if (selectedIds.size === 0) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        if (e.key === "ArrowUp") nudgeSelected(0, -step);
        if (e.key === "ArrowDown") nudgeSelected(0, step);
        if (e.key === "ArrowLeft") nudgeSelected(-step, 0);
        if (e.key === "ArrowRight") nudgeSelected(step, 0);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, currentObjects]);

  // -------------------------------------------------------------------
  // Save
  // -------------------------------------------------------------------
  const totalObjectCount = Object.values(pagesObjects).reduce((sum, arr) => sum + arr.length, 0);

  const savePdf = () => {
    if (!file) return;
    if (totalObjectCount === 0) {
      toast.error("Nothing to save", { description: "Add at least one element before saving." });
      return;
    }

    // Text edits stay in liveOverride (not committed to pagesObjects/
    // history) until the textarea blurs - see handleTextChange/
    // handleTextBlur. A normal button click already blurs the active
    // textarea before this runs, but folding any still-pending edit in
    // here too means Save can never silently drop the last few keystrokes
    // of an in-progress edit, regardless of how it was triggered.
    const exportSnapshot: PagesObjects = liveOverride
      ? Object.fromEntries(
          Object.entries(pagesObjects).map(([pageIndexStr, objects]) => [
            pageIndexStr,
            objects.map((o) => (liveOverride[o.id] ? ({ ...o, ...liveOverride[o.id] } as EditorObject) : o)),
          ])
        )
      : pagesObjects;

    run(
      async (setProgress) => {
        setResultPdf(null);
        setProgress(20);
        const blob = await exportEditedPdf(file, exportSnapshot, EDIT_SCALE);
        setProgress(100);
        setResultPdf(blob);
      },
      {
        successMessage: "PDF saved successfully!",
        toolName: "edit-pdf",
        errorTitle: "Failed to save PDF",
        onError: (error) => {
          console.error("Error saving edited PDF:", error);
          const message = error instanceof Error ? error.message : "";
          return message.includes("is encrypted")
            ? "This PDF is password-protected. Please remove the password and try again."
            : "Please try again with a valid PDF file";
        },
      }
    );
  };

  const downloadResult = () => {
    if (!resultPdf) return;
    downloadBlob(resultPdf, "edited.pdf");
  };

  // -------------------------------------------------------------------
  // Rendering helpers
  // -------------------------------------------------------------------
  const renderList: EditorObject[] = [...currentObjects];
  if (dragRef.current?.pendingId && liveOverride?.[dragRef.current.pendingId] && dragRef.current.pageIndex === currentPageIndex) {
    const pendingId = dragRef.current.pendingId;
    if (!renderList.some((o) => o.id === pendingId)) {
      renderList.push(liveOverride[pendingId] as EditorObject);
    }
  }

  const singleSelected =
    selectedIds.size === 1 ? renderList.find((o) => selectedIds.has(o.id)) : undefined;
  const singleSelectedDisplay = singleSelected ? getDisplay(singleSelected) : undefined;

  const setSingleSelectedPatch = (patch: Partial<EditorObject>) => {
    if (!singleSelected) return;
    updateObject(currentPageIndex, singleSelected.id, patch);
  };

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12">
      <div className="container mx-auto px-4 max-w-7xl">
        <Link href="/" className="flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <Card>
          <CardHeader>
            <CardTitle asChild className="text-2xl md:text-3xl">
              <h1>Edit PDF</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!file && (
              <FileUpload
                accept={{ "application/pdf": [".pdf"] }}
                multiple={false}
                onFilesSelected={handleFilesSelected}
              />
            )}

            {loadingPages && pages.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
                <p role="status">Rendering pages…</p>
              </div>
            )}

            {loadError && (
              <div
                className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
                role="alert"
              >
                <AlertCircle className="h-5 w-5 text-destructive shrink-0" aria-hidden="true" />
                <p className="text-destructive">{PDF_RENDER_ERROR_MESSAGE[loadError]}</p>
              </div>
            )}

            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => handleImageFileChosen(e.target.files)}
            />

            {file && pages.length > 0 && !resultPdf && (
              <>
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1">
                  <ToolButton icon={MousePointer2} label="Select" active={activeTool === "select"} onClick={() => setActiveTool("select")} />
                  <ToolButton icon={Type} label="Text" active={activeTool === "text"} onClick={() => setActiveTool("text")} disabled={!canEditCurrentPage} />
                  <ToolButton icon={Square} label="Rectangle" active={activeTool === "rectangle"} onClick={() => setActiveTool("rectangle")} disabled={!canEditCurrentPage} />
                  <ToolButton icon={Circle} label="Ellipse" active={activeTool === "ellipse"} onClick={() => setActiveTool("ellipse")} disabled={!canEditCurrentPage} />
                  <ToolButton icon={Minus} label="Line" active={activeTool === "line"} onClick={() => setActiveTool("line")} disabled={!canEditCurrentPage} />
                  <ToolButton icon={Highlighter} label="Highlight" active={activeTool === "highlight"} onClick={() => setActiveTool("highlight")} disabled={!canEditCurrentPage} />
                  <ToolButton icon={Pencil} label="Draw" active={activeTool === "draw"} onClick={() => setActiveTool("draw")} disabled={!canEditCurrentPage} />
                  <ToolButton
                    icon={Signature}
                    label="Signature"
                    active={false}
                    onClick={() => {
                      if (!canEditCurrentPage || !currentPage) return;
                      setActiveTool("select");
                      dragRef.current = null;
                      const id = nextObjectId();
                      const obj: DrawObject = {
                        id,
                        type: "draw",
                        x: currentPage.widthPx / 2 - 90,
                        y: currentPage.heightPx / 2 - 30,
                        width: 180,
                        height: 60,
                        rotation: 0,
                        zIndex: 0,
                        points: [],
                        strokeColor: "#1d4ed8",
                        strokeWidth: 2.5,
                        kind: "signature",
                      };
                      addObject(currentPageIndex, obj);
                      setActiveTool("select");
                      toast.info("Signature box added", { description: "Use the Draw tool inside it, or drag its handles into position." });
                    }}
                    disabled={!canEditCurrentPage}
                  />
                  <ToolButton icon={StickyNote} label="Note" active={activeTool === "note"} onClick={() => setActiveTool("note")} disabled={!canEditCurrentPage} />
                  <ToolButton
                    icon={ImagePlus}
                    label="Image"
                    active={false}
                    onClick={() => imageInputRef.current?.click()}
                    disabled={!canEditCurrentPage}
                  />

                  <div className="w-px h-6 bg-border mx-1 shrink-0" aria-hidden="true" />

                  <Button variant="ghost" size="icon" aria-label="Undo" disabled={history.past.length === 0} onClick={() => dispatchHistory({ type: "undo" })}>
                    <Undo2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Redo" disabled={history.future.length === 0} onClick={() => dispatchHistory({ type: "redo" })}>
                    <Redo2 className="h-4 w-4" />
                  </Button>

                  <div className="w-px h-6 bg-border mx-1 shrink-0" aria-hidden="true" />

                  <Button variant="ghost" size="icon" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, Math.round((z - 0.1) * 100) / 100))}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground w-12 text-center shrink-0">{Math.round(zoom * 100)}%</span>
                  <Button variant="ghost" size="icon" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + 0.1) * 100) / 100))}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>

                  <div className="flex items-center gap-1 ml-auto shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Previous page"
                      disabled={currentPageIndex === 0}
                      onClick={() => {
                        setCurrentPageIndex((i) => Math.max(0, i - 1));
                        setSelectedIds(new Set());
                        setActiveTool("select");
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground px-1 whitespace-nowrap">
                      {currentPageIndex + 1}/{totalPageCount || pages.length}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Next page"
                      disabled={currentPageIndex >= pages.length - 1}
                      onClick={() => {
                        setCurrentPageIndex((i) => Math.min(pages.length - 1, i + 1));
                        setSelectedIds(new Set());
                        setActiveTool("select");
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {!canEditCurrentPage && currentPage && (
                  <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm" role="status">
                    <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" aria-hidden="true" />
                    <p className="text-amber-700 dark:text-amber-500">
                      This page is rotated, so editing it isn&apos;t supported yet. Other pages in this file can still be
                      edited.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
                  <div className="border rounded-lg overflow-auto bg-muted/30 max-h-[75vh]">
                    {currentPage && (
                      <div style={{ width: currentPage.widthPx * zoom, height: currentPage.heightPx * zoom, position: "relative" }}>
                        <div
                          ref={pageViewRef}
                          onPointerDown={handleCanvasPointerDown}
                          style={{
                            position: "relative",
                            width: currentPage.widthPx,
                            height: currentPage.heightPx,
                            transform: `scale(${zoom})`,
                            transformOrigin: "0 0",
                            cursor: activeTool === "select" ? "default" : "crosshair",
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- real client-rendered canvas snapshot at a deliberate native pixel size, not an optimizable remote asset */}
                          <img
                            src={currentPage.dataUrl}
                            alt={`Page ${currentPage.pageNumber}`}
                            draggable={false}
                            style={{ display: "block", width: currentPage.widthPx, height: currentPage.heightPx, maxWidth: "none" }}
                          />

                          {snapGuide.x !== null && (
                            <div style={{ position: "absolute", left: snapGuide.x, top: 0, bottom: 0, width: 1 }} className="bg-primary" aria-hidden="true" />
                          )}
                          {snapGuide.y !== null && (
                            <div style={{ position: "absolute", top: snapGuide.y, left: 0, right: 0, height: 1 }} className="bg-primary" aria-hidden="true" />
                          )}

                          {renderList
                            .slice()
                            .sort((a, b) => a.zIndex - b.zIndex)
                            .map((obj) => (
                              <ObjectView
                                key={obj.id}
                                obj={getDisplay(obj)}
                                selected={selectedIds.has(obj.id)}
                                onPointerDown={(e) => handleObjectPointerDown(e, obj)}
                                onChangeText={(text) => handleTextChange(obj.id, text)}
                                onBlurText={() => handleTextBlur(currentPageIndex, obj.id)}
                                onResizeHandleDown={(handle, e) => {
                                  e.stopPropagation();
                                  setSelectedIds(new Set([obj.id]));
                                  beginResize(e, currentPageIndex, obj.id, handle);
                                }}
                                onRotateHandleDown={(e) => {
                                  e.stopPropagation();
                                  setSelectedIds(new Set([obj.id]));
                                  beginRotate(e, currentPageIndex, obj.id);
                                }}
                              />
                            ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <EditorSidebar
                    pages={pages}
                    currentPageIndex={currentPageIndex}
                    pagesObjects={pagesObjects}
                    onSelectPage={(index) => {
                      setCurrentPageIndex(index);
                      setSelectedIds(new Set());
                      setActiveTool("select");
                    }}
                    activeTool={activeTool}
                    defaults={defaults}
                    setDefaults={setDefaults}
                    selectedCount={selectedIds.size}
                    singleSelected={singleSelectedDisplay}
                    onPatchSelected={setSingleSelectedPatch}
                    onDeleteSelected={deleteSelected}
                    onDuplicateSelected={duplicateSelected}
                    onCopySelected={copySelected}
                    onPasteClipboard={pasteClipboard}
                    canPaste={clipboardRef.current.length > 0}
                    onReorder={reorderSelected}
                  />
                </div>

                {processing && <Progress value={progress} className="h-2" aria-label="Saving PDF" />}

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={savePdf} disabled={processing}>
                    Save PDF
                  </Button>
                  <Button variant="outline" onClick={reset} disabled={processing}>
                    Clear
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Shortcuts: Delete to remove, Ctrl/Cmd+C/V to copy/paste, Ctrl/Cmd+D to duplicate, Ctrl/Cmd+Z to undo,
                  Ctrl/Cmd+Shift+Z to redo, arrow keys to nudge (Shift for larger steps), Escape to deselect.
                </p>
              </>
            )}

            {resultPdf && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">PDF saved successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download PDF
                  </Button>
                  <Button variant="outline" onClick={reset}>
                    Edit Another PDF
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle asChild className="text-xl md:text-2xl"><h2>Frequently Asked Questions</h2></CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.question}>
                <h3 className="font-semibold mb-1">{faq.question}</h3>
                <p className="text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <ToolRelatedContent items={related} />
      </div>
    </div>
  );
}

// ===========================================================================
// Toolbar button
// ===========================================================================
function ToolButton({
  icon: Icon,
  label,
  active,
  onClick,
  disabled,
}: {
  icon: typeof Type;
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant={active ? "default" : "ghost"}
      size="icon"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className="shrink-0"
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

// ===========================================================================
// Renders one object's visual content + (when selected) its handles. The
// handles are children of the same rotated element, so they inherit the
// CSS rotation automatically instead of needing their own transform math.
// ===========================================================================
function ObjectView({
  obj,
  selected,
  onPointerDown,
  onChangeText,
  onBlurText,
  onResizeHandleDown,
  onRotateHandleDown,
}: {
  obj: EditorObject;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onChangeText: (text: string) => void;
  onBlurText: () => void;
  onResizeHandleDown: (handle: HandleId, e: React.PointerEvent) => void;
  onRotateHandleDown: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      data-object-id={obj.id}
      onPointerDown={onPointerDown}
      style={{
        position: "absolute",
        left: obj.x,
        top: obj.y,
        width: obj.width,
        height: obj.height,
        transform: `rotate(${obj.rotation}deg)`,
        transformOrigin: "center center",
        zIndex: obj.zIndex,
      }}
      className={selected ? "outline outline-2 outline-primary outline-offset-2" : ""}
    >
      <ObjectContent obj={obj} onChangeText={onChangeText} onBlurText={onBlurText} />

      {selected && (
        <>
          {(["nw", "n", "ne", "e", "se", "s", "sw", "w"] as HandleId[]).map((handle) => (
            <ResizeHandle key={handle} handle={handle} onPointerDown={(e) => onResizeHandleDown(handle, e)} />
          ))}
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              onRotateHandleDown(e);
            }}
            className="absolute h-3 w-3 rounded-full bg-primary border-2 border-background cursor-grab touch-none"
            style={{ left: "50%", top: -28, transform: "translateX(-50%)" }}
            aria-label="Rotate"
            role="button"
          />
          <div
            className="absolute bg-primary/60"
            style={{ left: "50%", top: -20, width: 1, height: 20, transform: "translateX(-50%)" }}
            aria-hidden="true"
          />
        </>
      )}
    </div>
  );
}

const HANDLE_POSITIONS: Record<HandleId, React.CSSProperties> = {
  nw: { left: -5, top: -5, cursor: "nwse-resize" },
  n: { left: "50%", top: -5, transform: "translateX(-50%)", cursor: "ns-resize" },
  ne: { right: -5, top: -5, cursor: "nesw-resize" },
  e: { right: -5, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" },
  se: { right: -5, bottom: -5, cursor: "nwse-resize" },
  s: { left: "50%", bottom: -5, transform: "translateX(-50%)", cursor: "ns-resize" },
  sw: { left: -5, bottom: -5, cursor: "nesw-resize" },
  w: { left: -5, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" },
};

function ResizeHandle({ handle, onPointerDown }: { handle: HandleId; onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown(e);
      }}
      className="absolute h-2.5 w-2.5 bg-background border-2 border-primary rounded-sm touch-none"
      style={{ ...HANDLE_POSITIONS[handle], position: "absolute" }}
      aria-hidden="true"
    />
  );
}

function ObjectContent({
  obj,
  onChangeText,
  onBlurText,
}: {
  obj: EditorObject;
  onChangeText: (text: string) => void;
  onBlurText: () => void;
}) {
  if (obj.type === "text") {
    return (
      <textarea
        value={obj.text}
        placeholder="Type here"
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => onChangeText(e.target.value)}
        onBlur={onBlurText}
        style={{
          width: "100%",
          height: "100%",
          fontSize: obj.fontSize * EDIT_SCALE,
          color: obj.color,
          fontWeight: obj.fontWeight,
          fontStyle: obj.fontStyle,
          lineHeight: 1.25,
          resize: "none",
        }}
        className="bg-transparent border border-dashed border-muted-foreground/40 px-1 outline-none focus:border-primary"
      />
    );
  }

  if (obj.type === "rectangle") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: obj.fillColor ?? "transparent",
          opacity: obj.opacity,
          border: obj.strokeColor ? `${obj.strokeWidth}px solid ${obj.strokeColor}` : undefined,
          boxSizing: "border-box",
        }}
      />
    );
  }

  if (obj.type === "ellipse") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          backgroundColor: obj.fillColor ?? "transparent",
          opacity: obj.opacity,
          border: obj.strokeColor ? `${obj.strokeWidth}px solid ${obj.strokeColor}` : undefined,
          boxSizing: "border-box",
        }}
      />
    );
  }

  if (obj.type === "line") {
    return (
      <svg width={obj.width} height={obj.height} style={{ display: "block", overflow: "visible" }}>
        <line x1={0} y1={obj.height / 2} x2={obj.width} y2={obj.height / 2} stroke={obj.strokeColor} strokeWidth={obj.strokeWidth} strokeLinecap="round" />
      </svg>
    );
  }

  if (obj.type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user-supplied image object being positioned on the canvas, not an optimizable remote asset
      <img src={obj.dataUrl} alt="" draggable={false} style={{ width: "100%", height: "100%", display: "block" }} />
    );
  }

  if (obj.type === "draw") {
    const path =
      obj.points.length > 1
        ? "M " + obj.points.map((p) => `${p.x},${p.y}`).join(" L ")
        : "";
    return (
      <svg width={obj.width} height={obj.height} style={{ display: "block", overflow: "visible" }}>
        {path && <path d={path} fill="none" stroke={obj.strokeColor} strokeWidth={obj.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
    );
  }

  if (obj.type === "note") {
    return (
      <div
        style={{ width: "100%", height: "100%", backgroundColor: obj.color }}
        className="shadow-md rounded-sm p-1.5 flex flex-col"
      >
        <textarea
          value={obj.text}
          placeholder="Note…"
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => onChangeText(e.target.value)}
          onBlur={onBlurText}
          className="bg-transparent outline-none resize-none flex-1 text-[13px] text-neutral-800 placeholder:text-neutral-500"
        />
      </div>
    );
  }

  return null;
}

// ===========================================================================
// Right sidebar: page thumbnails + contextual property panel
// ===========================================================================
interface EditorSidebarProps {
  pages: EditedPage[];
  currentPageIndex: number;
  pagesObjects: PagesObjects;
  onSelectPage: (index: number) => void;
  activeTool: ToolId;
  defaults: ReturnType<typeof defaultObjectDefaults>;
  setDefaults: React.Dispatch<React.SetStateAction<ReturnType<typeof defaultObjectDefaults>>>;
  selectedCount: number;
  singleSelected: EditorObject | undefined;
  onPatchSelected: (patch: Partial<EditorObject>) => void;
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
  onCopySelected: () => void;
  onPasteClipboard: () => void;
  canPaste: boolean;
  onReorder: (direction: "front" | "back" | "forward" | "backward") => void;
}

function EditorSidebar({
  pages,
  currentPageIndex,
  pagesObjects,
  onSelectPage,
  activeTool,
  defaults,
  setDefaults,
  selectedCount,
  singleSelected,
  onPatchSelected,
  onDeleteSelected,
  onDuplicateSelected,
  onCopySelected,
  onPasteClipboard,
  canPaste,
  onReorder,
}: EditorSidebarProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">Pages</p>
        <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible lg:max-h-[35vh] lg:overflow-y-auto pb-1">
          {pages.map((p, index) => (
            <button
              key={p.pageNumber}
              type="button"
              onClick={() => onSelectPage(index)}
              aria-pressed={index === currentPageIndex}
              aria-label={`Page ${p.pageNumber}`}
              className={`relative shrink-0 rounded border-2 overflow-hidden w-16 lg:w-full ${index === currentPageIndex ? "border-primary" : "border-border hover:border-primary/50"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- small nav thumbnail from an already-rendered canvas, not an optimizable remote asset */}
              <img src={p.dataUrl} alt="" className="w-full h-auto block" />
              <span className="absolute bottom-0.5 left-0.5 text-[9px] font-medium bg-background/90 px-1 rounded">{p.pageNumber}</span>
              {(pagesObjects[index]?.length ?? 0) > 0 && (
                <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="space-y-2 border rounded-lg p-3">
          <p className="text-sm font-medium">{selectedCount > 1 ? `${selectedCount} objects selected` : "Selection"}</p>
          <div className="grid grid-cols-2 gap-1">
            <Button variant="outline" size="sm" onClick={onCopySelected}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Copy
            </Button>
            <Button variant="outline" size="sm" onClick={onDuplicateSelected}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Duplicate
            </Button>
          </div>
          {selectedCount === 1 && (
            <div className="grid grid-cols-2 gap-1">
              <Button variant="outline" size="sm" onClick={() => onReorder("front")}>
                <BringToFront className="h-3.5 w-3.5 mr-1" /> Front
              </Button>
              <Button variant="outline" size="sm" onClick={() => onReorder("back")}>
                <SendToBack className="h-3.5 w-3.5 mr-1" /> Back
              </Button>
            </div>
          )}
          <Button variant="destructive" size="sm" className="w-full" onClick={onDeleteSelected}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
          </Button>
        </div>
      )}

      {selectedCount === 0 && canPaste && (
        <Button variant="outline" size="sm" className="w-full" onClick={onPasteClipboard}>
          <ClipboardPaste className="h-3.5 w-3.5 mr-1" /> Paste
        </Button>
      )}

      <PropertyPanel
        activeTool={activeTool}
        defaults={defaults}
        setDefaults={setDefaults}
        singleSelected={singleSelected}
        onPatchSelected={onPatchSelected}
      />
    </div>
  );
}

function ColorSwatchPicker({ value, onChange, allowNone }: { value: string | null; onChange: (v: string | null) => void; allowNone?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {allowNone && (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="No color"
          className={`h-6 w-6 rounded-full border-2 bg-[repeating-linear-gradient(45deg,#f87171_0,#f87171_2px,transparent_2px,transparent_6px)] ${value === null ? "border-primary" : "border-border"}`}
        />
      )}
      {COLOR_SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={c}
          style={{ backgroundColor: c }}
          className={`h-6 w-6 rounded-full border-2 ${value === c ? "border-primary" : "border-border"}`}
        />
      ))}
    </div>
  );
}

function PropertyPanel({
  activeTool,
  defaults,
  setDefaults,
  singleSelected,
  onPatchSelected,
}: {
  activeTool: ToolId;
  defaults: ReturnType<typeof defaultObjectDefaults>;
  setDefaults: React.Dispatch<React.SetStateAction<ReturnType<typeof defaultObjectDefaults>>>;
  singleSelected: EditorObject | undefined;
  onPatchSelected: (patch: Partial<EditorObject>) => void;
}) {
  if (singleSelected?.type === "text") {
    const obj = singleSelected as TextObject;
    return (
      <div className="space-y-3 border rounded-lg p-3">
        <p className="text-sm font-medium">Text style</p>
        <NumberField label="Font size" value={obj.fontSize} min={6} max={144} onChange={(v) => onPatchSelected({ fontSize: v })} />
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Color</p>
          <ColorSwatchPicker value={obj.color} onChange={(c) => onPatchSelected({ color: c ?? "#000000" })} />
        </div>
        <div className="flex gap-1">
          <Button variant={obj.fontWeight === "bold" ? "default" : "outline"} size="sm" onClick={() => onPatchSelected({ fontWeight: obj.fontWeight === "bold" ? "normal" : "bold" })}>
            Bold
          </Button>
          <Button variant={obj.fontStyle === "italic" ? "default" : "outline"} size="sm" onClick={() => onPatchSelected({ fontStyle: obj.fontStyle === "italic" ? "normal" : "italic" })}>
            Italic
          </Button>
        </div>
        <RotationField rotation={obj.rotation} onChange={(v) => onPatchSelected({ rotation: v })} />
      </div>
    );
  }

  if (singleSelected?.type === "rectangle" || singleSelected?.type === "ellipse") {
    const obj = singleSelected as ShapeObject;
    return (
      <div className="space-y-3 border rounded-lg p-3">
        <p className="text-sm font-medium">Shape style</p>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Fill</p>
          <ColorSwatchPicker value={obj.fillColor} onChange={(c) => onPatchSelected({ fillColor: c })} allowNone />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Border</p>
          <ColorSwatchPicker value={obj.strokeColor} onChange={(c) => onPatchSelected({ strokeColor: c })} allowNone />
        </div>
        <NumberField label="Border width" value={obj.strokeWidth} min={0} max={20} onChange={(v) => onPatchSelected({ strokeWidth: v })} />
        <NumberField label="Opacity %" value={Math.round(obj.opacity * 100)} min={5} max={100} onChange={(v) => onPatchSelected({ opacity: v / 100 })} />
        <RotationField rotation={obj.rotation} onChange={(v) => onPatchSelected({ rotation: v })} />
      </div>
    );
  }

  if (singleSelected?.type === "line") {
    const obj = singleSelected as LineObject;
    return (
      <div className="space-y-3 border rounded-lg p-3">
        <p className="text-sm font-medium">Line style</p>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Color</p>
          <ColorSwatchPicker value={obj.strokeColor} onChange={(c) => onPatchSelected({ strokeColor: c ?? "#000000" })} />
        </div>
        <NumberField label="Thickness" value={obj.strokeWidth} min={1} max={20} onChange={(v) => onPatchSelected({ strokeWidth: v })} />
        <RotationField rotation={obj.rotation} onChange={(v) => onPatchSelected({ rotation: v })} />
      </div>
    );
  }

  if (singleSelected?.type === "draw") {
    const obj = singleSelected as DrawObject;
    return (
      <div className="space-y-3 border rounded-lg p-3">
        <p className="text-sm font-medium">{obj.kind === "signature" ? "Signature style" : "Draw style"}</p>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Color</p>
          <ColorSwatchPicker value={obj.strokeColor} onChange={(c) => onPatchSelected({ strokeColor: c ?? "#000000" })} />
        </div>
        <NumberField label="Thickness" value={obj.strokeWidth} min={1} max={20} onChange={(v) => onPatchSelected({ strokeWidth: v })} />
      </div>
    );
  }

  if (singleSelected?.type === "note") {
    const obj = singleSelected as NoteObject;
    return (
      <div className="space-y-3 border rounded-lg p-3">
        <p className="text-sm font-medium">Note color</p>
        <div className="flex flex-wrap gap-1.5">
          {["#fef08a", "#fecaca", "#bbf7d0", "#bfdbfe", "#e9d5ff"].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onPatchSelected({ color: c })}
              aria-label={c}
              style={{ backgroundColor: c }}
              className={`h-6 w-6 rounded-full border-2 ${obj.color === c ? "border-primary" : "border-border"}`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (singleSelected?.type === "image") {
    const obj = singleSelected as ImageObject;
    return (
      <div className="space-y-3 border rounded-lg p-3">
        <p className="text-sm font-medium">Image</p>
        <RotationField rotation={obj.rotation} onChange={(v) => onPatchSelected({ rotation: v })} />
      </div>
    );
  }

  // Nothing selected: show defaults for the active creation tool.
  if (activeTool === "text") {
    return (
      <div className="space-y-3 border rounded-lg p-3">
        <p className="text-sm font-medium">Default text style</p>
        <NumberField label="Font size" value={defaults.text.fontSize} min={6} max={144} onChange={(v) => setDefaults((d) => ({ ...d, text: { ...d.text, fontSize: v } }))} />
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Color</p>
          <ColorSwatchPicker value={defaults.text.color} onChange={(c) => setDefaults((d) => ({ ...d, text: { ...d.text, color: c ?? "#000000" } }))} />
        </div>
      </div>
    );
  }

  if (activeTool === "rectangle" || activeTool === "ellipse") {
    const key = activeTool;
    return (
      <div className="space-y-3 border rounded-lg p-3">
        <p className="text-sm font-medium">Default shape style</p>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Fill</p>
          <ColorSwatchPicker value={defaults[key].fillColor} onChange={(c) => setDefaults((d) => ({ ...d, [key]: { ...d[key], fillColor: c } }))} allowNone />
        </div>
      </div>
    );
  }

  return (
    <div className="text-xs text-muted-foreground border rounded-lg p-3">
      Select an object to edit its style, or choose a tool above to place something new.
    </div>
  );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={Math.round(value * 10) / 10}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
        className="w-full px-2 py-1.5 border rounded-md bg-background text-sm"
      />
    </div>
  );
}

function RotationField({ rotation, onChange }: { rotation: number; onChange: (v: number) => void }) {
  const normalized = Math.round(((rotation % 360) + 360) % 360);
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">Rotation (degrees)</label>
      <input
        type="number"
        value={normalized}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full px-2 py-1.5 border rounded-md bg-background text-sm"
      />
    </div>
  );
}
