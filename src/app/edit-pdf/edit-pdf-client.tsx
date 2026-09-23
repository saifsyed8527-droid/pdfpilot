"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type React from "react";
import {
  AlertCircle,
  BringToFront,
  Bold,
  Bookmark as BookmarkIcon,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  Highlighter,
  ImagePlus,
  Italic,
  Layers as LayersIcon,
  Link2,
  ListChecks,
  Loader2,
  Minus,
  MousePointer2,
  Paperclip,
  Pencil,
  PenLine,
  Plus,
  Redo2,
  RotateCcw,
  SendToBack,
  Signature as SignatureIcon,
  Square,
  StickyNote,
  Strikethrough,
  TextCursorInput,
  Trash2,
  Type,
  Underline,
  Undo2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PdfToolLanding, PdfToolResultLayout, PdfWorkspaceBar } from "@/components/tool/PdfToolChrome";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { ResultState } from "@/components/tool/ResultState";
import { downloadBlob } from "@/lib/download-file";
import { classifyPdfRenderError, PDF_RENDER_ERROR_MESSAGE } from "@/lib/engines/pdf-render-engine";
import { useProcessingTask } from "@/lib/use-processing-task";
import { getCategoryStyle } from "@/lib/category-colors";
import { getTool } from "@/lib/tools";
import { cn, formatFileSize } from "@/lib/utils";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";
import type {
  Attachment,
  Bookmark,
  DrawObject,
  EditorObject,
  ExistingTextEditObject,
  FormFieldObject,
  FormFieldType,
  ImageObject,
  LineObject,
  LinkObject,
  NoteObject,
  PagesObjects,
  ShapeObject,
  TextObject,
} from "@/lib/editor/types";
import { nextObjectId } from "@/lib/editor/types";
import { exportEditedPdf } from "@/lib/editor/pdf-export";
import { extractPageTextRuns, type ExtractedTextRun } from "@/lib/editor/existing-text";
import { SignatureModal, type SignatureResult } from "@/components/editor/SignatureModal";

/** Scale the page is rendered at for editing (roughly 108 DPI) - every
 *  object's x/y/width/height is measured against these exact canvas
 *  pixels, and the page <img> is always shown at this exact pixel size
 *  (maxWidth: "none" overrides Tailwind preflight's img{max-width:100%}).
 *  Zoom is a separate, purely visual CSS transform layered on top - the
 *  object model's own coordinate system never changes with zoom. */
const EDIT_SCALE = 1.5;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const SNAP_THRESHOLD_PX = 6;
const MIN_OBJECT_SIZE = 12;

type ToolId =
  | "select"
  | "text"
  | "rectangle"
  | "ellipse"
  | "line"
  | "draw"
  | "highlight"
  | "note"
  | "link"
  | "form-text"
  | "form-checkbox"
  | "form-radio"
  | "form-dropdown";

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
// stack.
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

let formFieldCounter = 0;
function nextFieldName(prefix: string) {
  formFieldCounter += 1;
  return `${prefix}_${formFieldCounter}_${Date.now().toString(36)}`;
}

function defaultObjectDefaults() {
  return {
    text: {
      fontSize: 18,
      color: "#000000",
      fontWeight: "normal" as const,
      fontStyle: "normal" as const,
      underline: false,
      strikethrough: false,
      align: "left" as const,
    },
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

const tool = getTool("/edit-pdf")!;
const style = getCategoryStyle(tool);

const LANDING_COPY = {
  title: "Edit PDF",
  description: "A full PDF editor: add text, images, shapes, links, signatures, form fields and more — all free, right in your browser.",
  buttonLabel: "Select PDF file",
  dropLabel: "or drag and drop a PDF file here",
  limitLabel: "100MB max per PDF",
};

export function EditPdfClient({}: EditPdfClientProps) {
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
  const [result, setResult] = useState<{ blob: Blob; pageCount: number } | null>(null);
  const [snapGuide, setSnapGuide] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [railTab, setRailTab] = useState<"style" | "layers" | "bookmarks" | "files">("style");
  const [mode, setMode] = useState<"annotate" | "edit-text">("annotate");
  const [textRuns, setTextRuns] = useState<ExtractedTextRun[]>([]);
  const [textRunsLoading, setTextRunsLoading] = useState(false);
  const autoDownloadRef = useRef(false);
  const { processing, progress, run } = useProcessingTask();

  const pageViewRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const clipboardRef = useRef<EditorObject[]>([]);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const newTextIdRef = useRef<string | null>(null);
  const zIndexCounterRef = useRef(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pdfjs-dist's PDFDocumentProxy/module namespace aren't exported from the app's thin loadPdfjs() wrapper
  const pdfjsDocRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsLibRef = useRef<any>(null);
  const textRunsCacheRef = useRef<Map<number, ExtractedTextRun[]>>(new Map());

  const liveRef = useRef({ zoom, currentPageIndex, pages, pagesObjects, selectedIds, liveOverride });
  liveRef.current = { zoom, currentPageIndex, pages, pagesObjects, selectedIds, liveOverride };

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
    setResult(null);
    setBookmarks([]);
    setAttachments([]);
    setMode("annotate");
    setTextRuns([]);
    textRunsCacheRef.current = new Map();
    pdfjsDocRef.current = null;
    pdfjsLibRef.current = null;
    autoDownloadRef.current = false;
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
      // Kept around (not discarded after this render loop) so Advanced
      // Edit can call getTextContent() on demand per page without
      // re-parsing the whole document.
      pdfjsDocRef.current = pdfjsDoc;
      pdfjsLibRef.current = pdfjsLib;
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

  const commitObjects = (pageIndex: number, objects: EditorObject[]) => {
    dispatchHistory({ type: "commit", next: { ...liveRef.current.pagesObjects, [pageIndex]: objects } });
  };

  const addObject = (pageIndex: number, obj: EditorObject) => {
    zIndexCounterRef.current += 1;
    const withZ = { ...obj, zIndex: zIndexCounterRef.current };
    commitObjects(pageIndex, [...(liveRef.current.pagesObjects[pageIndex] ?? []), withZ]);
    setSelectedIds(new Set([withZ.id]));
    setRailTab("style");
  };

  const updateObject = (pageIndex: number, id: string, patch: Partial<EditorObject>) => {
    const objects = (liveRef.current.pagesObjects[pageIndex] ?? []).map((o) =>
      o.id === id ? ({ ...o, ...patch } as EditorObject) : o
    );
    commitObjects(pageIndex, objects);
  };

  // `field` is "text" for TextObject/NoteObject and "newText" for an
  // Advanced Edit ExistingTextEditObject - the same live-override-then-
  // commit-on-blur flow serves both, just writing a different property.
  const handleTextChange = (id: string, value: string, field: "text" | "newText" = "text") => {
    setLiveOverride((prev) => ({ ...prev, [id]: { [field]: value } }));
  };
  const handleTextBlur = (pageIndex: number, id: string, field: "text" | "newText" = "text") => {
    // Reads the pending value from liveRef (a plain mutable mirror, not a
    // setState updater's `prev` argument) and commits it as its own,
    // separate state update - calling dispatchHistory *from inside* a
    // setLiveOverride updater (the previous shape of this function) is
    // impure, and observably drops the commit under React's batching:
    // verified live by typing text, blurring, then immediately clicking a
    // style button, which reproduced an empty saved text object every
    // time. Two sequential, single-purpose state updates fixes it.
    const pending = liveRef.current.liveOverride?.[id];
    if (pending && field in pending) {
      updateObject(pageIndex, id, { [field]: pending[field as keyof typeof pending] } as Partial<EditorObject>);
    }
    setLiveOverride((prev) => {
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
      const base = { ...o, id: nextObjectId(), x: o.x + 16, y: o.y + 16, zIndex: zIndexCounterRef.current };
      // Field/radio names and link URLs must stay unique per object, or
      // pdf-lib's form builder will silently merge the duplicate into the
      // same AcroForm field as the original at export time.
      if (base.type === "form-field") {
        base.name = nextFieldName(base.fieldType);
        if (base.fieldType === "radio") base.optionLabel = nextObjectId();
      }
      return base;
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
      const base = { ...o, id: nextObjectId(), x: o.x + 20, y: o.y + 20, zIndex: zIndexCounterRef.current };
      if (base.type === "form-field") {
        base.name = nextFieldName(base.fieldType);
        if (base.fieldType === "radio") base.optionLabel = nextObjectId();
      }
      return base;
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
  // Drag lifecycle
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

  const buildBoxObject = (tool: ToolId, id: string): EditorObject => {
    if (tool === "rectangle" || tool === "highlight") {
      const d = tool === "highlight" ? defaults.highlight : defaults.rectangle;
      return {
        id,
        type: "rectangle",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        rotation: 0,
        zIndex: zIndexCounterRef.current,
        fillColor: "fillColor" in d ? d.fillColor : null,
        strokeColor: tool === "highlight" ? null : (defaults.rectangle.strokeColor ?? null),
        strokeWidth: defaults.rectangle.strokeWidth,
        opacity: d.opacity,
      } satisfies ShapeObject;
    }
    if (tool === "ellipse") {
      return {
        id,
        type: "ellipse",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        rotation: 0,
        zIndex: zIndexCounterRef.current,
        fillColor: defaults.ellipse.fillColor,
        strokeColor: defaults.ellipse.strokeColor,
        strokeWidth: defaults.ellipse.strokeWidth,
        opacity: defaults.ellipse.opacity,
      } satisfies ShapeObject;
    }
    if (tool === "line") {
      return {
        id,
        type: "line",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        rotation: 0,
        zIndex: zIndexCounterRef.current,
        strokeColor: defaults.line.strokeColor,
        strokeWidth: defaults.line.strokeWidth,
      } satisfies LineObject;
    }
    if (tool === "link") {
      return {
        id,
        type: "link",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        rotation: 0,
        zIndex: zIndexCounterRef.current,
        url: "",
      } satisfies LinkObject;
    }
    // form-* tools
    const fieldType: FormFieldType = tool === "form-text" ? "text" : tool === "form-checkbox" ? "checkbox" : tool === "form-radio" ? "radio" : "dropdown";
    return {
      id,
      type: "form-field",
      x: 0,
      y: 0,
      width: fieldType === "checkbox" ? 24 : 1,
      height: fieldType === "checkbox" ? 24 : 1,
      rotation: 0,
      zIndex: zIndexCounterRef.current,
      fieldType,
      name: nextFieldName(fieldType),
      groupName: fieldType === "radio" ? nextFieldName("group") : undefined,
      optionLabel: fieldType === "radio" ? nextObjectId() : undefined,
      options: fieldType === "dropdown" ? ["Option 1", "Option 2"] : undefined,
      required: false,
      fontSize: 12,
    } satisfies FormFieldObject;
  };

  const beginCreateShape = (e: { clientX: number; clientY: number }, toolId: ToolId, pageIndex: number) => {
    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    const id = nextObjectId();
    zIndexCounterRef.current += 1;
    const obj = { ...buildBoxObject(toolId, id), x, y };

    dragRef.current = {
      kind: "create-shape",
      startCanvasX: x,
      startCanvasY: y,
      pageIndex,
      startObjects: {},
      pendingId: id,
    };
    setLiveOverride({ [id]: obj });
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

    // All three branches below read the in-progress override from
    // `liveRef.current.liveOverride` (a plain mutable mirror kept in sync
    // every render) and call dispatchHistory/setSelectedIds as ordinary,
    // top-level statements - never from inside a setLiveOverride updater
    // callback. Committing history *from inside* that updater (the
    // previous shape of this function) is impure and observably drops the
    // commit under React's batching - verified live: dragging an object
    // then immediately clicking a style-panel button could silently
    // revert the move once. setLiveOverride itself is only ever called
    // here to reset it to null, a trivial, pure update.
    const handleUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      setSnapGuide({ x: null, y: null });
      const override = liveRef.current.liveOverride;

      if (drag.kind === "move" || drag.kind === "resize" || drag.kind === "rotate") {
        if (override) {
          const objects = (liveRef.current.pagesObjects[drag.pageIndex] ?? []).map((o) =>
            override[o.id] ? ({ ...o, ...override[o.id] } as EditorObject) : o
          );
          dispatchHistory({ type: "commit", next: { ...liveRef.current.pagesObjects, [drag.pageIndex]: objects } });
        }
        setLiveOverride(null);
      } else if (drag.kind === "create-shape") {
        const id = drag.pendingId!;
        const pending = override?.[id];
        if (pending) {
          zIndexCounterRef.current += 1;
          const finalObj = { ...pending, zIndex: zIndexCounterRef.current } as EditorObject;
          const objects = [...(liveRef.current.pagesObjects[drag.pageIndex] ?? []), finalObj];
          dispatchHistory({ type: "commit", next: { ...liveRef.current.pagesObjects, [drag.pageIndex]: objects } });
          setSelectedIds(new Set([id]));
          setRailTab("style");
        }
        setLiveOverride(null);
        setActiveTool("select");
      } else if (drag.kind === "create-draw") {
        const id = drag.pendingId!;
        const pending = override?.[id] as DrawObject | undefined;
        if (pending && pending.points.length >= 2) {
          zIndexCounterRef.current += 1;
          const finalObj = { ...pending, zIndex: zIndexCounterRef.current };
          const objects = [...(liveRef.current.pagesObjects[drag.pageIndex] ?? []), finalObj];
          dispatchHistory({ type: "commit", next: { ...liveRef.current.pagesObjects, [drag.pageIndex]: objects } });
          setSelectedIds(new Set([id]));
          setRailTab("style");
        }
        setLiveOverride(null);
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

  const BOX_TOOLS: ToolId[] = ["rectangle", "ellipse", "line", "highlight", "link", "form-text", "form-checkbox", "form-radio", "form-dropdown"];

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
        underline: defaults.text.underline,
        strikethrough: defaults.text.strikethrough,
        align: defaults.text.align,
        linkUrl: null,
      };
      addObject(currentPageIndex, obj);
      finishTextCreation(obj.id);
      setActiveTool("select");
      return;
    }
    if (activeTool === "note") {
      const obj_: NoteObject = {
        id: nextObjectId(),
        type: "note",
        ...screenToCanvas(e.clientX, e.clientY),
        width: 150,
        height: 110,
        rotation: 0,
        zIndex: 0,
        text: "",
        color: defaults.note.color,
      };
      addObject(currentPageIndex, obj_);
      setActiveTool("select");
      return;
    }
    if (BOX_TOOLS.includes(activeTool)) {
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
    setRailTab("style");
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
  // Advanced Edit: extract existing text runs for the current page on
  // entering edit-text mode (or navigating pages while already in it),
  // cached per page index so re-visiting a page doesn't re-render+re-parse
  // it. A run is only ever read here, never mutated - the click handler
  // below creates a normal, undoable ExistingTextEditObject instead.
  // -------------------------------------------------------------------
  useEffect(() => {
    if (mode !== "edit-text" || !currentPage || !canEditCurrentPage) {
      setTextRuns([]);
      return;
    }
    const cached = textRunsCacheRef.current.get(currentPageIndex);
    if (cached) {
      setTextRuns(cached);
      return;
    }
    let cancelled = false;
    setTextRunsLoading(true);
    (async () => {
      const pdfjsDoc = pdfjsDocRef.current;
      const pdfjsLib = pdfjsLibRef.current;
      if (!pdfjsDoc || !pdfjsLib) return;
      try {
        const page = await pdfjsDoc.getPage(currentPageIndex + 1);
        const viewport = page.getViewport({ scale: EDIT_SCALE });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas, viewport }).promise;
        const runs = await extractPageTextRuns(page, pdfjsLib, viewport, canvas);
        if (cancelled) return;
        textRunsCacheRef.current.set(currentPageIndex, runs);
        setTextRuns(runs);
      } catch (error) {
        console.error("Error extracting existing text:", error);
        if (!cancelled) setTextRuns([]);
      } finally {
        if (!cancelled) setTextRunsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, currentPageIndex, currentPage, canEditCurrentPage]);

  const handleRunClick = (run: ExtractedTextRun) => {
    const existing = currentObjects.find((o) => o.type === "existing-text-edit" && o.runId === run.id) as
      | ExistingTextEditObject
      | undefined;
    if (existing) {
      setSelectedIds(new Set([existing.id]));
      setRailTab("style");
      return;
    }
    const obj: ExistingTextEditObject = {
      id: nextObjectId(),
      type: "existing-text-edit",
      runId: run.id,
      x: run.xPx,
      y: run.yPx,
      width: run.widthPx,
      height: run.heightPx,
      rotation: 0,
      zIndex: 0,
      originalText: run.str,
      newText: run.str,
      originalXPt: run.xPt,
      originalYPt: run.yPt,
      originalWidthPt: run.widthPt,
      originalHeightPt: run.heightPt,
      fontSizePt: run.fontSizePt,
      color: "#000000",
      coverColor: run.coverColor,
    };
    addObject(currentPageIndex, obj);
  };

  const insertSignature = (result: SignatureResult) => {
    if (!currentPage) return;
    setShowSignatureModal(false);
    if (result.kind === "draw" && result.points) {
      const obj: DrawObject = {
        id: nextObjectId(),
        type: "draw",
        x: Math.max(0, currentPage.widthPx / 2 - result.width / 2),
        y: Math.max(0, currentPage.heightPx / 2 - result.height / 2),
        width: result.width,
        height: result.height,
        rotation: 0,
        zIndex: 0,
        points: result.points,
        strokeColor: result.color,
        strokeWidth: 2.5,
        kind: "signature",
      };
      addObject(currentPageIndex, obj);
    } else if (result.kind === "type" && result.text) {
      const obj: TextObject = {
        id: nextObjectId(),
        type: "text",
        x: Math.max(0, currentPage.widthPx / 2 - result.width / 2),
        y: Math.max(0, currentPage.heightPx / 2 - result.height / 2),
        width: result.width,
        height: result.height,
        rotation: 0,
        zIndex: 0,
        text: result.text,
        fontSize: 30,
        color: result.color,
        fontWeight: "normal",
        fontStyle: "italic",
        underline: false,
        strikethrough: false,
        align: "left",
        linkUrl: null,
      };
      addObject(currentPageIndex, obj);
    } else if (result.kind === "upload" && result.dataUrl) {
      const obj: ImageObject = {
        id: nextObjectId(),
        type: "image",
        x: Math.max(0, currentPage.widthPx / 2 - result.width / 2),
        y: Math.max(0, currentPage.heightPx / 2 - result.height / 2),
        width: result.width,
        height: result.height,
        rotation: 0,
        zIndex: 0,
        dataUrl: result.dataUrl,
        format: result.format ?? "png",
      };
      addObject(currentPageIndex, obj);
    }
    setActiveTool("select");
  };

  // -------------------------------------------------------------------
  // Bookmarks + Attachments (document-level, not canvas objects)
  // -------------------------------------------------------------------
  const addBookmark = () => {
    const bm: Bookmark = { id: nextObjectId(), title: `Page ${currentPageIndex + 1}`, pageIndex: currentPageIndex };
    setBookmarks((prev) => [...prev, bm]);
    setRailTab("bookmarks");
  };
  const renameBookmark = (id: string, title: string) => setBookmarks((prev) => prev.map((b) => (b.id === id ? { ...b, title } : b)));
  const deleteBookmark = (id: string) => setBookmarks((prev) => prev.filter((b) => b.id !== id));
  const goToBookmark = (b: Bookmark) => {
    setCurrentPageIndex(b.pageIndex);
    setSelectedIds(new Set());
    setActiveTool("select");
  };

  const addAttachment = (fileList: FileList | null) => {
    const f = fileList?.[0];
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) {
      toast.error("File too large", { description: "Attachments must be 20MB or smaller." });
      return;
    }
    setAttachments((prev) => [...prev, { id: nextObjectId(), name: f.name, file: f }]);
    setRailTab("files");
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
  };
  const removeAttachment = (id: string) => setAttachments((prev) => prev.filter((a) => a.id !== id));

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
  const canSave = totalObjectCount > 0 || bookmarks.length > 0 || attachments.length > 0;

  const savePdf = () => {
    if (!file) return;
    if (!canSave) {
      toast.error("Nothing to save", { description: "Add at least one element, bookmark, or attachment before saving." });
      return;
    }

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
        setResult(null);
        autoDownloadRef.current = false;
        setProgress(20);
        const blob = await exportEditedPdf(file, exportSnapshot, EDIT_SCALE, bookmarks, attachments);
        setProgress(100);
        setResult({ blob, pageCount: totalPageCount });
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
    if (result) downloadBlob(result.blob, "edited.pdf");
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

  const singleSelected = selectedIds.size === 1 ? renderList.find((o) => selectedIds.has(o.id)) : undefined;
  const singleSelectedDisplay = singleSelected ? getDisplay(singleSelected) : undefined;

  const setSingleSelectedPatch = (patch: Partial<EditorObject>) => {
    if (!singleSelected) return;
    updateObject(currentPageIndex, singleSelected.id, patch);
  };

  if (result) {
    return (
      <PdfToolResultLayout toolSlug="edit-pdf">
        <ResultState
          resultFilename="edited.pdf"
          fileSize={formatFileSize(result.blob.size)}
          onDownload={downloadResult}
          onStartOver={reset}
          autoDownloadedRef={autoDownloadRef}
        />
      </PdfToolResultLayout>
    );
  }

  if (!file) {
    return (
      <PdfToolLanding
        title={LANDING_COPY.title}
        description={LANDING_COPY.description}
        buttonLabel={LANDING_COPY.buttonLabel}
        dropLabel={LANDING_COPY.dropLabel}
        limitLabel={LANDING_COPY.limitLabel}
        accept={{ "application/pdf": [".pdf"] }}
        multiple={false}
        icon={tool.icon}
        iconClass={style.iconClass}
        iconBackgroundClass={style.bgClass}
        accent="orange"
        onFilesSelected={handleFilesSelected}
      />
    );
  }

  return (
    <div className="flex-1 bg-slate-100/75 dark:bg-slate-950/50">
      <PdfWorkspaceBar
        title="Edit PDF"
        meta={<>{file.name} · {formatFileSize(file.size)}{totalPageCount > 0 ? ` · ${totalPageCount} page${totalPageCount === 1 ? "" : "s"}` : ""}</>}
        actions={
          <Button variant="ghost" size="sm" onClick={reset} disabled={processing}>
            Change file
          </Button>
        }
      />

      <input ref={imageInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => handleImageFileChosen(e.target.files)} />
      <input ref={attachmentInputRef} type="file" className="hidden" onChange={(e) => addAttachment(e.target.files)} />
      {showSignatureModal && <SignatureModal onInsert={insertSignature} onClose={() => setShowSignatureModal(false)} />}

      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="relative flex min-h-[620px] flex-col border-b lg:border-b-0 lg:border-r lg:h-[calc(100vh-8.15rem)]">
          {loadingPages && pages.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground" role="status" aria-live="polite">Rendering pages…</p>
          ) : loadError ? (
            <div className="m-6 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm" role="alert">
              <AlertCircle className="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
              <div className="space-y-2">
                <p className="text-destructive">{PDF_RENDER_ERROR_MESSAGE[loadError]}</p>
                <Button variant="outline" size="sm" onClick={reset}>Choose a Different File</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex shrink-0 items-center gap-2 border-b bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex gap-1 rounded-lg bg-white p-1 shadow-sm dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("annotate");
                      setSelectedIds(new Set());
                      setActiveTool("select");
                    }}
                    className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition", mode === "annotate" ? "bg-slate-950 text-white dark:bg-orange-500" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800")}
                  >
                    <PenLine className="h-3.5 w-3.5" aria-hidden /> Annotate
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("edit-text");
                      setSelectedIds(new Set());
                      setActiveTool("select");
                    }}
                    disabled={!canEditCurrentPage}
                    className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40", mode === "edit-text" ? "bg-slate-950 text-white dark:bg-orange-500" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800")}
                  >
                    <TextCursorInput className="h-3.5 w-3.5" aria-hidden /> Edit Text
                  </button>
                </div>
                {mode === "edit-text" && (
                  <p className="hidden text-xs text-slate-500 sm:block">Click any existing text on the page to edit it.</p>
                )}
              </div>

              {mode === "annotate" ? (
                <div className="flex shrink-0 flex-wrap items-center gap-1 overflow-x-auto border-b bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                  <ToolButton icon={MousePointer2} label="Select" active={activeTool === "select"} onClick={() => setActiveTool("select")} />
                  <ToolButton icon={Type} label="Text" active={activeTool === "text"} onClick={() => setActiveTool("text")} disabled={!canEditCurrentPage} />
                  <ToolButton icon={ImagePlus} label="Image" active={false} onClick={() => imageInputRef.current?.click()} disabled={!canEditCurrentPage} />
                  <ToolButton icon={Pencil} label="Draw" active={activeTool === "draw"} onClick={() => setActiveTool("draw")} disabled={!canEditCurrentPage} />
                  <ToolButton icon={Highlighter} label="Highlight" active={activeTool === "highlight"} onClick={() => setActiveTool("highlight")} disabled={!canEditCurrentPage} />
                  <ToolButton icon={StickyNote} label="Note" active={activeTool === "note"} onClick={() => setActiveTool("note")} disabled={!canEditCurrentPage} />
                  <ToolButton icon={SignatureIcon} label="Signature" active={false} onClick={() => setShowSignatureModal(true)} disabled={!canEditCurrentPage} />
                  <div className="mx-1 h-6 w-px shrink-0 bg-border" aria-hidden="true" />
                  <ToolButton icon={Square} label="Rectangle" active={activeTool === "rectangle"} onClick={() => setActiveTool("rectangle")} disabled={!canEditCurrentPage} />
                  <ToolButton icon={Circle} label="Ellipse" active={activeTool === "ellipse"} onClick={() => setActiveTool("ellipse")} disabled={!canEditCurrentPage} />
                  <ToolButton icon={Minus} label="Line" active={activeTool === "line"} onClick={() => setActiveTool("line")} disabled={!canEditCurrentPage} />
                  <div className="mx-1 h-6 w-px shrink-0 bg-border" aria-hidden="true" />
                  <ToolButton icon={Link2} label="Link" active={activeTool === "link"} onClick={() => setActiveTool("link")} disabled={!canEditCurrentPage} />
                  <ToolButton icon={Type} label="Text field" active={activeTool === "form-text"} onClick={() => setActiveTool("form-text")} disabled={!canEditCurrentPage} />
                  <ToolButton icon={CheckSquare} label="Checkbox" active={activeTool === "form-checkbox"} onClick={() => setActiveTool("form-checkbox")} disabled={!canEditCurrentPage} />
                  <ToolButton icon={ListChecks} label="Radio button" active={activeTool === "form-radio"} onClick={() => setActiveTool("form-radio")} disabled={!canEditCurrentPage} />
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" aria-label="Undo" disabled={history.past.length === 0} onClick={() => dispatchHistory({ type: "undo" })}>
                      <Undo2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Redo" disabled={history.future.length === 0} onClick={() => dispatchHistory({ type: "redo" })}>
                      <Redo2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex shrink-0 flex-wrap items-center gap-1 overflow-x-auto border-b bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                  <ToolButton icon={MousePointer2} label="Select" active={activeTool === "select"} onClick={() => setActiveTool("select")} />
                  {textRunsLoading && (
                    <span className="flex items-center gap-1.5 px-2 text-xs text-slate-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Reading page text…
                    </span>
                  )}
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" aria-label="Undo" disabled={history.past.length === 0} onClick={() => dispatchHistory({ type: "undo" })}>
                      <Undo2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Redo" disabled={history.future.length === 0} onClick={() => dispatchHistory({ type: "redo" })}>
                      <Redo2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {!canEditCurrentPage && currentPage && (
                <div className="mx-4 mt-3 flex shrink-0 items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm" role="status">
                  <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
                  <p className="text-amber-700 dark:text-amber-500">
                    This page is rotated, so editing it isn&apos;t supported yet. Other pages in this file can still be edited.
                  </p>
                </div>
              )}

              <div className="relative min-h-0 flex-1 overflow-auto bg-slate-200/60 p-6 dark:bg-slate-900/40">
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
                      className="touch-none shadow-[0_18px_50px_-30px_rgba(15,23,42,0.6)]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- real client-rendered canvas snapshot at a deliberate native pixel size, not an optimizable remote asset */}
                      <img
                        src={currentPage.dataUrl}
                        alt={`Page ${currentPage.pageNumber}`}
                        draggable={false}
                        style={{ display: "block", width: currentPage.widthPx, height: currentPage.heightPx, maxWidth: "none" }}
                      />

                      {mode === "edit-text" &&
                        textRuns
                          .filter((run) => !currentObjects.some((o) => o.type === "existing-text-edit" && o.runId === run.id))
                          .map((run) => (
                            <button
                              key={run.id}
                              type="button"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={() => handleRunClick(run)}
                              title={run.str}
                              className="absolute cursor-text rounded-sm border border-transparent transition-colors hover:border-orange-400 hover:bg-orange-400/10"
                              style={{ left: run.xPx, top: run.yPx, width: run.widthPx, height: run.heightPx }}
                            />
                          ))}

                      {snapGuide.x !== null && (
                        <div style={{ position: "absolute", left: snapGuide.x, top: 0, bottom: 0, width: 1 }} className="bg-orange-500" aria-hidden="true" />
                      )}
                      {snapGuide.y !== null && (
                        <div style={{ position: "absolute", top: snapGuide.y, left: 0, right: 0, height: 1 }} className="bg-orange-500" aria-hidden="true" />
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
                            onChangeText={(text) => handleTextChange(obj.id, text, obj.type === "existing-text-edit" ? "newText" : "text")}
                            onBlurText={() => handleTextBlur(currentPageIndex, obj.id, obj.type === "existing-text-edit" ? "newText" : "text")}
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

                <div className="pointer-events-none sticky bottom-2 left-1/2 flex w-fit -translate-x-1/2 items-center gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-[0_18px_40px_-20px_rgba(15,23,42,0.5)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
                  <div className="pointer-events-auto flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Previous page"
                      disabled={currentPageIndex === 0}
                      onClick={() => {
                        setCurrentPageIndex((i) => Math.max(0, i - 1));
                        setSelectedIds(new Set());
                        setActiveTool("select");
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden />
                    </button>
                    <span className="whitespace-nowrap px-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                      {currentPageIndex + 1} / {totalPageCount || pages.length}
                    </span>
                    <button
                      type="button"
                      aria-label="Next page"
                      disabled={currentPageIndex >= pages.length - 1}
                      onClick={() => {
                        setCurrentPageIndex((i) => Math.min(pages.length - 1, i + 1));
                        setSelectedIds(new Set());
                        setActiveTool("select");
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <div className="pointer-events-auto mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
                  <div className="pointer-events-auto flex items-center gap-1">
                    <button type="button" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, Math.round((z - 0.1) * 100) / 100))} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                      <ZoomOut className="h-4 w-4" aria-hidden />
                    </button>
                    <span className="w-11 text-center text-xs font-medium text-slate-600 dark:text-slate-300">{Math.round(zoom * 100)}%</span>
                    <button type="button" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + 0.1) * 100) / 100))} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                      <ZoomIn className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        <aside className="bg-white dark:bg-slate-900 lg:h-[calc(100vh-8.15rem)] lg:min-h-[560px]">
          <div className="flex h-full min-h-0 flex-col p-5 lg:p-6">
            <div className="mb-4 flex shrink-0 items-center gap-3 border-b pb-4">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", style.bgClass)}>
                <tool.icon className={cn("h-5 w-5", style.iconClass)} aria-hidden />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight">Edit options</h2>
                <p className="text-xs text-slate-500">Pages, styling, and document structure</p>
              </div>
            </div>

            {!loadError && (
              <>
                <div className="mb-3 grid shrink-0 grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-950/50">
                  {([
                    { id: "style", label: "Style" },
                    { id: "layers", label: "Layers" },
                    { id: "bookmarks", label: "Marks" },
                    { id: "files", label: "Files" },
                  ] as const).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setRailTab(t.id)}
                      className={cn("rounded-lg py-1.5 text-xs font-semibold transition", railTab === t.id ? "bg-white text-slate-950 shadow dark:bg-slate-800 dark:text-white" : "text-slate-500")}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Pages</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {pages.map((p, index) => (
                        <button
                          key={p.pageNumber}
                          type="button"
                          onClick={() => {
                            setCurrentPageIndex(index);
                            setSelectedIds(new Set());
                            setActiveTool("select");
                          }}
                          aria-pressed={index === currentPageIndex}
                          aria-label={`Page ${p.pageNumber}`}
                          className={cn("relative w-14 shrink-0 overflow-hidden rounded-lg border-2", index === currentPageIndex ? "border-orange-500" : "border-slate-200 hover:border-orange-300 dark:border-slate-700")}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- small nav thumbnail from an already-rendered canvas */}
                          <img src={p.dataUrl} alt="" className="block h-auto w-full" />
                          <span className="absolute bottom-0.5 left-0.5 rounded bg-white/90 px-1 text-[9px] font-medium dark:bg-slate-900/90">{p.pageNumber}</span>
                          {(pagesObjects[index]?.length ?? 0) > 0 && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-orange-500" aria-hidden="true" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {railTab === "style" && (
                    <StylePanel
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
                  )}

                  {railTab === "layers" && (
                    <LayersPanel
                      objects={currentObjects}
                      selectedIds={selectedIds}
                      onSelect={(id) => setSelectedIds(new Set([id]))}
                      onReorder={reorderSelected}
                    />
                  )}

                  {railTab === "bookmarks" && (
                    <BookmarksPanel
                      bookmarks={bookmarks}
                      currentPageIndex={currentPageIndex}
                      onAdd={addBookmark}
                      onRename={renameBookmark}
                      onDelete={deleteBookmark}
                      onGoTo={goToBookmark}
                    />
                  )}

                  {railTab === "files" && (
                    <AttachmentsPanel attachments={attachments} onAdd={() => attachmentInputRef.current?.click()} onRemove={removeAttachment} />
                  )}
                </div>

                {processing ? (
                  <div className="mt-4 shrink-0">
                    <ProcessingState progress={progress} label="Saving PDF…" cancelable={false} />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={savePdf}
                    disabled={!canSave}
                    className="mt-4 flex min-h-14 w-full shrink-0 items-center justify-center rounded-xl bg-slate-950 px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:hover:translate-y-0"
                  >
                    Save changes
                  </button>
                )}
                <p className="mt-2 shrink-0 text-[11px] text-slate-400">
                  Ctrl/Cmd+Z undo · Ctrl/Cmd+Shift+Z redo · Delete to remove · arrows to nudge
                </p>
              </>
            )}
          </div>
        </aside>
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
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-40",
        active ? "bg-slate-950 text-white dark:bg-orange-500" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

// ===========================================================================
// Renders one object's visual content + (when selected) its handles.
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
      className={selected ? "outline outline-2 outline-orange-500 outline-offset-2" : ""}
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
            className="absolute h-3 w-3 cursor-grab touch-none rounded-full border-2 border-background bg-orange-500"
            style={{ left: "50%", top: -28, transform: "translateX(-50%)" }}
            aria-label="Rotate"
            role="button"
          />
          <div className="absolute bg-orange-500/60" style={{ left: "50%", top: -20, width: 1, height: 20, transform: "translateX(-50%)" }} aria-hidden="true" />
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
      className="absolute h-2.5 w-2.5 touch-none rounded-sm border-2 border-orange-500 bg-background"
      style={{ ...HANDLE_POSITIONS[handle], position: "absolute" }}
      aria-hidden="true"
    />
  );
}

const FIELD_TYPE_LABEL: Record<FormFieldType, string> = { text: "Text field", checkbox: "Checkbox", radio: "Radio", dropdown: "Dropdown" };

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
          textDecoration: [obj.underline && "underline", obj.strikethrough && "line-through"].filter(Boolean).join(" ") || "none",
          textAlign: obj.align,
          lineHeight: 1.25,
          resize: "none",
        }}
        className="border border-dashed border-muted-foreground/40 bg-transparent px-1 outline-none focus:border-orange-500"
      />
    );
  }

  if (obj.type === "rectangle") {
    return (
      <div style={{ width: "100%", height: "100%", backgroundColor: obj.fillColor ?? "transparent", opacity: obj.opacity, border: obj.strokeColor ? `${obj.strokeWidth}px solid ${obj.strokeColor}` : undefined, boxSizing: "border-box" }} />
    );
  }

  if (obj.type === "ellipse") {
    return (
      <div style={{ width: "100%", height: "100%", borderRadius: "50%", backgroundColor: obj.fillColor ?? "transparent", opacity: obj.opacity, border: obj.strokeColor ? `${obj.strokeWidth}px solid ${obj.strokeColor}` : undefined, boxSizing: "border-box" }} />
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
    // eslint-disable-next-line @next/next/no-img-element -- user-supplied image object being positioned on the canvas
    return <img src={obj.dataUrl} alt="" draggable={false} style={{ width: "100%", height: "100%", display: "block" }} />;
  }

  if (obj.type === "draw") {
    const path = obj.points.length > 1 ? "M " + obj.points.map((p) => `${p.x},${p.y}`).join(" L ") : "";
    return (
      <svg width={obj.width} height={obj.height} style={{ display: "block", overflow: "visible" }}>
        {path && <path d={path} fill="none" stroke={obj.strokeColor} strokeWidth={obj.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
    );
  }

  if (obj.type === "note") {
    return (
      <div style={{ width: "100%", height: "100%", backgroundColor: obj.color }} className="flex flex-col rounded-sm p-1.5 shadow-md">
        <textarea
          value={obj.text}
          placeholder="Note…"
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => onChangeText(e.target.value)}
          onBlur={onBlurText}
          className="flex-1 resize-none bg-transparent text-[13px] text-neutral-800 outline-none placeholder:text-neutral-500"
        />
      </div>
    );
  }

  if (obj.type === "link") {
    return (
      <div className="flex h-full w-full items-center justify-center rounded border-2 border-dashed border-blue-500 bg-blue-500/10 px-1 text-center text-[10px] font-medium text-blue-700 dark:text-blue-300">
        {obj.url || "Link — set a URL"}
      </div>
    );
  }

  if (obj.type === "form-field") {
    return (
      <div className="flex h-full w-full items-center justify-center rounded border-2 border-dashed border-emerald-500 bg-emerald-500/10 px-1 text-center text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
        {obj.fieldType === "checkbox" ? <CheckSquare className="h-4 w-4" aria-hidden /> : `${FIELD_TYPE_LABEL[obj.fieldType]}${obj.required ? " *" : ""}`}
      </div>
    );
  }

  if (obj.type === "existing-text-edit") {
    // The cover-color block previews exactly what export will paint over
    // the original run before drawing the replacement text - so what's
    // shown here is what actually ships, not just a UI-only stand-in.
    return (
      <div style={{ width: "100%", height: "100%", backgroundColor: obj.coverColor }} className="rounded-[1px]">
        <textarea
          value={obj.newText}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => onChangeText(e.target.value)}
          onBlur={onBlurText}
          style={{
            width: "100%",
            height: "100%",
            fontSize: obj.fontSizePt * EDIT_SCALE,
            color: obj.color,
            lineHeight: 1,
            resize: "none",
          }}
          className="border border-dashed border-emerald-500/60 bg-transparent px-0.5 outline-none focus:border-emerald-500"
        />
      </div>
    );
  }

  return null;
}

// ===========================================================================
// Style panel: contextual property controls for the current selection/tool.
// ===========================================================================
interface StylePanelProps {
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

function StylePanel({
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
}: StylePanelProps) {
  return (
    <div className="space-y-4">
      {selectedCount > 0 && (
        <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{selectedCount > 1 ? `${selectedCount} objects selected` : "Selection"}</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Button variant="outline" size="sm" onClick={onCopySelected}><Copy className="mr-1 h-3.5 w-3.5" /> Copy</Button>
            <Button variant="outline" size="sm" onClick={onDuplicateSelected}><Copy className="mr-1 h-3.5 w-3.5" /> Duplicate</Button>
          </div>
          {selectedCount === 1 && (
            <div className="grid grid-cols-2 gap-1.5">
              <Button variant="outline" size="sm" onClick={() => onReorder("front")}><BringToFront className="mr-1 h-3.5 w-3.5" /> To front</Button>
              <Button variant="outline" size="sm" onClick={() => onReorder("back")}><SendToBack className="mr-1 h-3.5 w-3.5" /> To back</Button>
            </div>
          )}
          <Button variant="destructive" size="sm" className="w-full" onClick={onDeleteSelected}><Trash2 className="mr-1 h-3.5 w-3.5" /> Delete</Button>
        </div>
      )}

      {selectedCount === 0 && canPaste && (
        <Button variant="outline" size="sm" className="w-full" onClick={onPasteClipboard}>Paste</Button>
      )}

      <PropertyPanel activeTool={activeTool} defaults={defaults} setDefaults={setDefaults} singleSelected={singleSelected} onPatchSelected={onPatchSelected} />
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
          className={cn("h-6 w-6 rounded-full border-2 bg-[repeating-linear-gradient(45deg,#f87171_0,#f87171_2px,transparent_2px,transparent_6px)]", value === null ? "border-orange-500" : "border-slate-200 dark:border-slate-700")}
        />
      )}
      {COLOR_SWATCHES.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)} aria-label={c} style={{ backgroundColor: c }} className={cn("h-6 w-6 rounded-full border-2", value === c ? "border-orange-500" : "border-white dark:border-slate-900", "shadow-[0_0_0_1px_rgba(15,23,42,0.15)]")} />
      ))}
      <input type="color" value={value ?? "#000000"} onChange={(e) => onChange(e.target.value)} aria-label="Custom color" className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0" />
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
      <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Text style</p>
        <NumberField label="Font size" value={obj.fontSize} min={6} max={144} onChange={(v) => onPatchSelected({ fontSize: v })} />
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Color</p>
          <ColorSwatchPicker value={obj.color} onChange={(c) => onPatchSelected({ color: c ?? "#000000" })} />
        </div>
        <div className="flex flex-wrap gap-1">
          <button type="button" aria-pressed={obj.fontWeight === "bold"} onClick={() => onPatchSelected({ fontWeight: obj.fontWeight === "bold" ? "normal" : "bold" })} className={cn("flex h-8 w-8 items-center justify-center rounded-lg border", obj.fontWeight === "bold" ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/30" : "border-slate-200 dark:border-slate-700")}>
            <Bold className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" aria-pressed={obj.fontStyle === "italic"} onClick={() => onPatchSelected({ fontStyle: obj.fontStyle === "italic" ? "normal" : "italic" })} className={cn("flex h-8 w-8 items-center justify-center rounded-lg border", obj.fontStyle === "italic" ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/30" : "border-slate-200 dark:border-slate-700")}>
            <Italic className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" aria-pressed={obj.underline} onClick={() => onPatchSelected({ underline: !obj.underline })} className={cn("flex h-8 w-8 items-center justify-center rounded-lg border", obj.underline ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/30" : "border-slate-200 dark:border-slate-700")}>
            <Underline className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" aria-pressed={obj.strikethrough} onClick={() => onPatchSelected({ strikethrough: !obj.strikethrough })} className={cn("flex h-8 w-8 items-center justify-center rounded-lg border", obj.strikethrough ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/30" : "border-slate-200 dark:border-slate-700")}>
            <Strikethrough className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Alignment</p>
          <div className="grid grid-cols-3 gap-1">
            {(["left", "center", "right"] as const).map((a) => (
              <button key={a} type="button" aria-pressed={obj.align === a} onClick={() => onPatchSelected({ align: a })} className={cn("rounded-lg border py-1.5 text-xs capitalize", obj.align === a ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/30" : "border-slate-200 dark:border-slate-700")}>
                {a}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Link URL (optional)</label>
          <input
            type="text"
            value={obj.linkUrl ?? ""}
            onChange={(e) => onPatchSelected({ linkUrl: e.target.value || null })}
            placeholder="https://example.com"
            className="w-full rounded-md border border-slate-300 bg-background px-2 py-1.5 text-sm dark:border-slate-700"
          />
        </div>
        <RotationField rotation={obj.rotation} onChange={(v) => onPatchSelected({ rotation: v })} />
      </div>
    );
  }

  if (singleSelected?.type === "rectangle" || singleSelected?.type === "ellipse") {
    const obj = singleSelected as ShapeObject;
    return (
      <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Shape style</p>
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
      <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Line style</p>
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
      <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{obj.kind === "signature" ? "Signature style" : "Draw style"}</p>
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
      <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Note color</p>
        <div className="flex flex-wrap gap-1.5">
          {["#fef08a", "#fecaca", "#bbf7d0", "#bfdbfe", "#e9d5ff"].map((c) => (
            <button key={c} type="button" onClick={() => onPatchSelected({ color: c })} aria-label={c} style={{ backgroundColor: c }} className={cn("h-6 w-6 rounded-full border-2", obj.color === c ? "border-orange-500" : "border-slate-200 dark:border-slate-700")} />
          ))}
        </div>
      </div>
    );
  }

  if (singleSelected?.type === "image") {
    const obj = singleSelected as ImageObject;
    return (
      <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Image</p>
        <RotationField rotation={obj.rotation} onChange={(v) => onPatchSelected({ rotation: v })} />
      </div>
    );
  }

  if (singleSelected?.type === "existing-text-edit") {
    const obj = singleSelected as ExistingTextEditObject;
    const changed = obj.newText !== obj.originalText;
    return (
      <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Existing text</p>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Original (read-only)</p>
          <p className="rounded-md bg-slate-100 px-2 py-1.5 text-sm text-slate-500 dark:bg-slate-950/50">{obj.originalText}</p>
        </div>
        <NumberField label="Font size" value={obj.fontSizePt} min={4} max={144} onChange={(v) => onPatchSelected({ fontSizePt: v })} />
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Color</p>
          <ColorSwatchPicker value={obj.color} onChange={(c) => onPatchSelected({ color: c ?? "#000000" })} />
        </div>
        <button
          type="button"
          onClick={() => onPatchSelected({ newText: obj.originalText })}
          disabled={!changed}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-600 transition hover:border-orange-300 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-orange-950/20"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Revert to original
        </button>
        {!changed && <p className="text-[11px] text-slate-400">Unchanged - the original PDF content stream for this run won&apos;t be touched unless you edit it.</p>}
      </div>
    );
  }

  if (singleSelected?.type === "link") {
    const obj = singleSelected as LinkObject;
    return (
      <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Link</p>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Destination URL</label>
          <input type="text" value={obj.url} onChange={(e) => onPatchSelected({ url: e.target.value })} placeholder="https://example.com" className="w-full rounded-md border border-slate-300 bg-background px-2 py-1.5 text-sm dark:border-slate-700" />
        </div>
      </div>
    );
  }

  if (singleSelected?.type === "form-field") {
    const obj = singleSelected as FormFieldObject;
    return (
      <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{FIELD_TYPE_LABEL[obj.fieldType]} field</p>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Field name</label>
          <input type="text" value={obj.name} onChange={(e) => onPatchSelected({ name: e.target.value })} className="w-full rounded-md border border-slate-300 bg-background px-2 py-1.5 text-sm dark:border-slate-700" />
        </div>
        {obj.fieldType === "radio" && (
          <>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Group name (shared by all options)</label>
              <input type="text" value={obj.groupName ?? ""} onChange={(e) => onPatchSelected({ groupName: e.target.value })} className="w-full rounded-md border border-slate-300 bg-background px-2 py-1.5 text-sm dark:border-slate-700" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Option value</label>
              <input type="text" value={obj.optionLabel ?? ""} onChange={(e) => onPatchSelected({ optionLabel: e.target.value })} className="w-full rounded-md border border-slate-300 bg-background px-2 py-1.5 text-sm dark:border-slate-700" />
            </div>
          </>
        )}
        {obj.fieldType === "dropdown" && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Options (one per line)</label>
            <textarea
              value={(obj.options ?? []).join("\n")}
              onChange={(e) => onPatchSelected({ options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
              rows={3}
              className="w-full rounded-md border border-slate-300 bg-background px-2 py-1.5 text-sm dark:border-slate-700"
            />
          </div>
        )}
        {obj.fieldType === "text" && <NumberField label="Font size" value={obj.fontSize} min={6} max={48} onChange={(v) => onPatchSelected({ fontSize: v })} />}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={obj.required} onChange={(e) => onPatchSelected({ required: e.target.checked })} className="h-4 w-4 accent-orange-500" />
          Required field
        </label>
      </div>
    );
  }

  if (activeTool === "text") {
    return (
      <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Default text style</p>
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
      <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Default shape style</p>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Fill</p>
          <ColorSwatchPicker value={defaults[key].fillColor} onChange={(c) => setDefaults((d) => ({ ...d, [key]: { ...d[key], fillColor: c } }))} allowNone />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 p-3 text-xs text-muted-foreground dark:border-slate-800">
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
        className="w-full rounded-md border border-slate-300 bg-background px-2 py-1.5 text-sm dark:border-slate-700"
      />
    </div>
  );
}

function RotationField({ rotation, onChange }: { rotation: number; onChange: (v: number) => void }) {
  const normalized = Math.round(((rotation % 360) + 360) % 360);
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">Rotation (degrees)</label>
      <input type="number" value={normalized} onChange={(e) => onChange(Number(e.target.value) || 0)} className="w-full rounded-md border border-slate-300 bg-background px-2 py-1.5 text-sm dark:border-slate-700" />
    </div>
  );
}

// ===========================================================================
// Layers panel
// ===========================================================================
const OBJECT_TYPE_LABEL: Record<EditorObject["type"], string> = {
  text: "Text",
  rectangle: "Rectangle",
  ellipse: "Ellipse",
  line: "Line",
  image: "Image",
  draw: "Drawing",
  note: "Note",
  link: "Link",
  "form-field": "Form field",
  "existing-text-edit": "Edited text",
};

function LayersPanel({
  objects,
  selectedIds,
  onSelect,
  onReorder,
}: {
  objects: EditorObject[];
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onReorder: (direction: "front" | "back" | "forward" | "backward") => void;
}) {
  const sorted = [...objects].sort((a, b) => b.zIndex - a.zIndex);
  if (sorted.length === 0) {
    return <p className="rounded-xl border border-slate-200 p-3 text-xs text-muted-foreground dark:border-slate-800">No objects on this page yet.</p>;
  }
  return (
    <div className="space-y-1.5">
      {sorted.map((obj) => {
        const selected = selectedIds.has(obj.id);
        return (
          <div key={obj.id} className={cn("flex items-center gap-2 rounded-lg border px-2 py-1.5", selected ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20" : "border-slate-200 dark:border-slate-800")}>
            <button type="button" onClick={() => onSelect(obj.id)} className="flex flex-1 items-center gap-2 truncate text-left text-xs">
              <LayersIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
              <span className="truncate">{OBJECT_TYPE_LABEL[obj.type]}</span>
            </button>
            {selected && (
              <div className="flex shrink-0 items-center gap-0.5">
                <button type="button" aria-label="Move forward" onClick={() => onReorder("forward")} className="flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <ChevronRight className="h-3.5 w-3.5 -rotate-90" aria-hidden />
                </button>
                <button type="button" aria-label="Move backward" onClick={() => onReorder("backward")} className="flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <ChevronRight className="h-3.5 w-3.5 rotate-90" aria-hidden />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ===========================================================================
// Bookmarks panel
// ===========================================================================
function BookmarksPanel({
  bookmarks,
  currentPageIndex,
  onAdd,
  onRename,
  onDelete,
  onGoTo,
}: {
  bookmarks: Bookmark[];
  currentPageIndex: number;
  onAdd: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onGoTo: (b: Bookmark) => void;
}) {
  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" className="w-full" onClick={onAdd}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Add bookmark for page {currentPageIndex + 1}
      </Button>
      {bookmarks.length === 0 ? (
        <p className="rounded-xl border border-slate-200 p-3 text-xs text-muted-foreground dark:border-slate-800">No bookmarks yet.</p>
      ) : (
        <div className="space-y-1.5">
          {bookmarks.map((b) => (
            <div key={b.id} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 dark:border-slate-800">
              <BookmarkIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
              <input
                type="text"
                value={b.title}
                onChange={(e) => onRename(b.id, e.target.value)}
                onFocus={() => onGoTo(b)}
                className="min-w-0 flex-1 truncate bg-transparent text-xs outline-none"
              />
              <span className="shrink-0 text-[10px] text-slate-400">p.{b.pageIndex + 1}</span>
              <button type="button" aria-label="Delete bookmark" onClick={() => onDelete(b.id)} className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-destructive dark:hover:bg-slate-800">
                <X className="h-3 w-3" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Attachments panel
// ===========================================================================
function AttachmentsPanel({ attachments, onAdd, onRemove }: { attachments: Attachment[]; onAdd: () => void; onRemove: (id: string) => void }) {
  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" className="w-full" onClick={onAdd}>
        <Upload className="mr-1 h-3.5 w-3.5" /> Attach a file
      </Button>
      {attachments.length === 0 ? (
        <p className="rounded-xl border border-slate-200 p-3 text-xs text-muted-foreground dark:border-slate-800">No attachments yet.</p>
      ) : (
        <div className="space-y-1.5">
          {attachments.map((a) => (
            <div key={a.id} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 dark:border-slate-800">
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{a.name}</p>
                <p className="text-[10px] text-slate-400">{formatFileSize(a.file.size)}</p>
              </div>
              <button type="button" aria-label="Remove attachment" onClick={() => onRemove(a.id)} className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-destructive dark:hover:bg-slate-800">
                <X className="h-3 w-3" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
