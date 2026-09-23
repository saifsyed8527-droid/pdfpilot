"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type React from "react";
import {
  AlertCircle,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Circle,
  Italic,
  List,
  ListChecks,
  MousePointer2,
  PenLine,
  Plus,
  Redo2,
  RotateCcw,
  Signature as SignatureIcon,
  Trash2,
  Type,
  Underline as UnderlineIcon,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdfToolLanding, PdfToolResultLayout, PdfWorkspaceBar } from "@/components/tool/PdfToolChrome";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { ResultState } from "@/components/tool/ResultState";
import { downloadBlob } from "@/lib/download-file";
import { classifyPdfRenderError, PDF_RENDER_ERROR_MESSAGE } from "@/lib/engines/pdf-render-engine";
import { useProcessingTask } from "@/lib/use-processing-task";
import {
  applyTextEdits,
  buildNewFields,
  extractExistingFields,
  fillExistingFields,
  nextFieldId,
  type FieldKind,
  type FormField,
  type TextEdit,
} from "@/lib/engines/pdf-forms-engine";
import { extractPageTextRuns, type ExtractedTextRun } from "@/lib/editor/existing-text";
import { getCategoryStyle } from "@/lib/category-colors";
import { getTool } from "@/lib/tools";
import { cn, formatFileSize } from "@/lib/utils";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";

const EDIT_SCALE = 1.5;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const MIN_FIELD_SIZE = 12;

interface FillPdfClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

const tool = getTool("/fill-pdf")!;
const style = getCategoryStyle(tool);

const LANDING_COPY = {
  title: "PDF Forms",
  description: "Fill existing PDF forms, or build new ones — text fields, checkboxes, radio buttons, lists, dropdowns, and signatures.",
  buttonLabel: "Select PDF file",
  dropLabel: "or drag and drop a PDF file here",
  limitLabel: "100MB max per PDF",
};

interface EditedPage {
  pageNumber: number;
  dataUrl: string;
  widthPx: number;
  heightPx: number;
  rotation: number;
}

type ToolId = "select" | "text" | "checkbox" | "radio" | "listbox" | "dropdown" | "signature" | "edittext";
type FieldToolId = Exclude<ToolId, "select" | "edittext">;

const FIELD_DEFAULT_SIZE: Record<FieldToolId, { width: number; height: number }> = {
  text: { width: 200, height: 40 },
  checkbox: { width: 20, height: 20 },
  radio: { width: 20, height: 20 },
  listbox: { width: 150, height: 150 },
  dropdown: { width: 200, height: 40 },
  signature: { width: 180, height: 40 },
};

const FIELD_KIND_LABEL: Record<FieldKind, string> = {
  text: "Text field",
  checkbox: "Checkbox",
  radio: "Radio button",
  listbox: "List box",
  dropdown: "Dropdown",
  signature: "Signature field",
};

// ---------------------------------------------------------------------------
// Undo/redo history over a combined document snapshot (built fields + native
// text edits together) so a single undo stack covers every mutable editor
// action, not just field placement - existing (imported) fields are never
// part of history since they're filled/flag-checked in place, never created
// or destroyed by this editor.
// ---------------------------------------------------------------------------
interface Doc {
  fields: FormField[];
  textEdits: TextEdit[];
}
const EMPTY_DOC: Doc = { fields: [], textEdits: [] };

interface HistoryState {
  past: Doc[];
  present: Doc;
  future: Doc[];
}
type HistoryAction = { type: "commit"; next: Doc } | { type: "undo" } | { type: "redo" } | { type: "reset"; state: Doc };

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
  kind: "move" | "resize" | "create";
  startX: number;
  startY: number;
  pageIndex: number;
  startField?: FormField;
  handle?: HandleId;
  pendingId?: string;
  pendingName?: string;
  toolKind?: FieldKind;
}

/**
 * Meaningful, stable default field names ("text_1", "radio_group_1", ...)
 * per the task's naming convention - not the internal `nextFieldId()`
 * scheme (which is a debug-style id meant for React keys/history, not a
 * user-facing AcroForm field name). Counts existing + already-built fields
 * of the same kind so re-adding fields after deletes still picks the next
 * free number rather than colliding.
 */
function nextDefaultFieldName(kind: FieldKind, allFields: FormField[]): string {
  const prefix = kind === "radio" ? "radio_group" : kind;
  const used = new Set(allFields.map((f) => (f.kind === "radio" ? f.groupName : f.name)).filter((n): n is string => Boolean(n)));
  let n = 1;
  while (used.has(`${prefix}_${n}`)) n += 1;
  return `${prefix}_${n}`;
}

export function FillPdfClient({}: FillPdfClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<EditedPage[]>([]);
  const [totalPageCount, setTotalPageCount] = useState(0);
  const [loadingPages, setLoadingPages] = useState(false);
  const [loadError, setLoadError] = useState<ReturnType<typeof classifyPdfRenderError> | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);

  const [existingFields, setExistingFields] = useState<FormField[]>([]);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [history, dispatchHistory] = useReducer(historyReducer, { past: [], present: EMPTY_DOC, future: [] });
  const builtFields = history.present.fields;
  const textEdits = history.present.textEdits;

  const [mode, setMode] = useState<"fill" | "edit">("fill");
  const [activeTool, setActiveTool] = useState<ToolId>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [liveOverride, setLiveOverride] = useState<Partial<FormField> | null>(null);
  const [railTab, setRailTab] = useState<"style" | "fields">("style");
  const [result, setResult] = useState<{ blob: Blob } | null>(null);
  const autoDownloadRef = useRef(false);
  const { processing, progress, run } = useProcessingTask();

  const [textRuns, setTextRuns] = useState<ExtractedTextRun[]>([]);
  const [textRunsLoading, setTextRunsLoading] = useState(false);
  const textRunsCacheRef = useRef<Map<number, ExtractedTextRun[]>>(new Map());

  const pageViewRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pdf-lib's PDFDocument type is fine here, but kept loose to avoid importing pdf-lib types at module scope
  const pdfLibDocRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pdfjs-dist's document/module types aren't exported from the app's thin loadPdfjs() wrapper
  const pdfjsDocRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- same as above, this is the pdfjs module itself (needed for Util.transform in extractPageTextRuns)
  const pdfjsLibRef = useRef<any>(null);

  const liveRef = useRef({ zoom, currentPageIndex, builtFields, selectedId, liveOverride });
  liveRef.current = { zoom, currentPageIndex, builtFields, selectedId, liveOverride };

  const reset = () => {
    setFile(null);
    setPages([]);
    setTotalPageCount(0);
    setLoadError(null);
    setCurrentPageIndex(0);
    setZoom(1);
    setExistingFields([]);
    setValues({});
    dispatchHistory({ type: "reset", state: EMPTY_DOC });
    setMode("fill");
    setActiveTool("select");
    setSelectedId(null);
    setResult(null);
    setTextRuns([]);
    setTextRunsLoading(false);
    textRunsCacheRef.current = new Map();
    pdfLibDocRef.current = null;
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
      const pdfLibDoc = await PDFDocument.load(arrayBuffer);
      pdfLibDocRef.current = pdfLibDoc;

      const { loadPdfjs } = await import("@/lib/pdfjs");
      const pdfjsLib = await loadPdfjs();
      pdfjsLibRef.current = pdfjsLib;
      const pdfjsDoc = await pdfjsLib.getDocument({ data: await pdfFile.arrayBuffer() }).promise;
      pdfjsDocRef.current = pdfjsDoc;
      setTotalPageCount(pdfjsDoc.numPages);

      for (let pageNumber = 1; pageNumber <= pdfjsDoc.numPages; pageNumber++) {
        const page = await pdfjsDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: EDIT_SCALE });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        // AnnotationMode.DISABLE - our own field overlays render every
        // field's current value, so pdfjs must not also bake existing
        // AcroForm field appearances (e.g. a pre-filled default value)
        // into the page raster underneath them, which would show the
        // value twice.
        await page.render({ canvas, viewport, annotationMode: pdfjsLib.AnnotationMode.DISABLE }).promise;
        setPages((prev) => [
          ...prev,
          { pageNumber, dataUrl: canvas.toDataURL("image/png"), widthPx: canvas.width, heightPx: canvas.height, rotation: 0 },
        ]);
      }

      // Silently inspect for existing AcroForm fields - no blocking modal,
      // no "detect automatically" step of any kind. If real fields exist
      // they're loaded straight into Fill mode; otherwise the user lands
      // directly in Edit Form mode, ready to place fields (or edit native
      // text) manually.
      const extracted = await extractExistingFields(pdfLibDoc, EDIT_SCALE);
      setExistingFields(extracted);
      const initialValues: Record<string, string | boolean> = {};
      for (const f of extracted) {
        if (f.kind === "checkbox") initialValues[f.name] = f.defaultValue === "true";
        else if (f.kind === "radio") { if (f.defaultValue) initialValues[f.groupName!] = f.defaultValue; }
        else initialValues[f.name] = f.defaultValue ?? "";
      }
      setValues(initialValues);
      setMode(extracted.length > 0 ? "fill" : "edit");
    } catch (error) {
      console.error("Error loading PDF for forms:", error);
      const message = error instanceof Error ? error.message : "";
      setLoadError(message.includes("is encrypted") ? "password" : classifyPdfRenderError(error));
    } finally {
      setLoadingPages(false);
    }
  };

  const currentPage = pages[currentPageIndex];

  const getDisplay = useCallback(
    (f: FormField): FormField => (liveOverride && liveRef.current.selectedId === f.id ? ({ ...f, ...liveOverride } as FormField) : f),
    [liveOverride]
  );

  const commitDoc = (next: Doc) => dispatchHistory({ type: "commit", next });
  // Mirrors the latest committed textEdits for use inside the field
  // add/update/delete helpers below, which only need to preserve whichever
  // textEdits are already committed while they change fields.
  const textEditsRef = useRef<TextEdit[]>(textEdits);
  textEditsRef.current = textEdits;

  const addField = (field: FormField) => {
    commitDoc({ fields: [...liveRef.current.builtFields, field], textEdits: textEditsRef.current });
    setSelectedId(field.id);
    setRailTab("style");
  };

  const updateField = (id: string, patch: Partial<FormField>) => {
    commitDoc({ fields: liveRef.current.builtFields.map((f) => (f.id === id ? ({ ...f, ...patch } as FormField) : f)), textEdits: textEditsRef.current });
  };

  const deleteField = (id: string) => {
    commitDoc({ fields: liveRef.current.builtFields.filter((f) => f.id !== id), textEdits: textEditsRef.current });
    if (liveRef.current.selectedId === id) setSelectedId(null);
  };

  const addOrSelectTextEdit = (run: ExtractedTextRun) => {
    const existing = textEditsRef.current.find((t) => t.runId === run.id);
    if (existing) {
      setSelectedId(existing.id);
      setRailTab("style");
      return;
    }
    const edit: TextEdit = {
      id: nextFieldId("textedit"),
      runId: run.id,
      pageIndex: currentPageIndex,
      x: run.xPx,
      y: run.yPx,
      width: run.widthPx,
      height: run.heightPx,
      originalText: run.str,
      newText: run.str,
      originalXPt: run.xPt,
      originalYPt: run.yPt,
      originalWidthPt: run.widthPt,
      originalHeightPt: run.heightPt,
      fontSizePt: run.fontSizePt,
      color: "#000000",
      coverColor: run.coverColor,
      bold: false,
      italic: false,
      underline: false,
      align: "left",
    };
    commitDoc({ fields: liveRef.current.builtFields, textEdits: [...textEditsRef.current, edit] });
    setSelectedId(edit.id);
    setRailTab("style");
  };

  const updateTextEdit = (id: string, patch: Partial<TextEdit>) => {
    commitDoc({ fields: liveRef.current.builtFields, textEdits: textEditsRef.current.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  };

  const revertTextEdit = (id: string) => {
    commitDoc({ fields: liveRef.current.builtFields, textEdits: textEditsRef.current.filter((t) => t.id !== id) });
    if (liveRef.current.selectedId === id) setSelectedId(null);
  };

  // -------------------------------------------------------------------
  // Edit Text: extract the current page's native text runs (cached per
  // page index) whenever that tool is active - the run itself is only
  // ever read here, never mutated; clicking one creates/selects a normal,
  // undoable TextEdit instead (addOrSelectTextEdit above).
  // -------------------------------------------------------------------
  useEffect(() => {
    if (activeTool !== "edittext" || mode !== "edit" || !currentPage) {
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
  }, [activeTool, mode, currentPageIndex, currentPage]);

  // -------------------------------------------------------------------
  // Coordinate + drag lifecycle (no rotation - form-field rects are
  // always axis-aligned, matching every real-world AcroForm widget).
  // -------------------------------------------------------------------
  const screenToCanvas = (clientX: number, clientY: number) => {
    const rect = pageViewRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const z = liveRef.current.zoom;
    return { x: (clientX - rect.left) / z, y: (clientY - rect.top) / z };
  };

  const beginCreate = (e: { clientX: number; clientY: number }, toolKind: FieldKind, pageIndex: number) => {
    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    const id = nextFieldId(toolKind);
    const name = nextDefaultFieldName(toolKind, [...existingFields, ...liveRef.current.builtFields]);
    const size = FIELD_DEFAULT_SIZE[activeTool as FieldToolId];
    const field = buildDefaultField(toolKind, id, pageIndex, x, y, size.width, size.height, name);
    dragRef.current = { kind: "create", startX: x, startY: y, pageIndex, pendingId: id, pendingName: name, toolKind };
    setLiveOverride(field);
    setSelectedId(id);
  };

  const beginMove = (e: { clientX: number; clientY: number }, field: FormField) => {
    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    dragRef.current = { kind: "move", startX: x, startY: y, pageIndex: field.pageIndex, startField: field };
    setSelectedId(field.id);
    setRailTab("style");
  };

  const beginResize = (e: { clientX: number; clientY: number }, field: FormField, handle: HandleId) => {
    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    dragRef.current = { kind: "resize", startX: x, startY: y, pageIndex: field.pageIndex, startField: field, handle };
    setSelectedId(field.id);
  };

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const { x, y } = screenToCanvas(e.clientX, e.clientY);

      if (drag.kind === "move" && drag.startField) {
        const dx = x - drag.startX;
        const dy = y - drag.startY;
        setLiveOverride({ x: drag.startField.x + dx, y: drag.startField.y + dy });
      } else if (drag.kind === "resize" && drag.startField && drag.handle) {
        const start = drag.startField;
        let { x: nx, y: ny, width: nw, height: nh } = start;
        const right = start.x + start.width;
        const bottom = start.y + start.height;
        if (drag.handle.includes("w")) { nx = Math.min(x, right - MIN_FIELD_SIZE); nw = right - nx; }
        if (drag.handle.includes("e")) nw = Math.max(MIN_FIELD_SIZE, x - start.x);
        if (drag.handle.includes("n")) { ny = Math.min(y, bottom - MIN_FIELD_SIZE); nh = bottom - ny; }
        if (drag.handle.includes("s")) nh = Math.max(MIN_FIELD_SIZE, y - start.y);
        setLiveOverride({ x: nx, y: ny, width: nw, height: nh });
      } else if (drag.kind === "create") {
        const nx = Math.min(drag.startX, x);
        const ny = Math.min(drag.startY, y);
        const nw = Math.max(MIN_FIELD_SIZE, Math.abs(x - drag.startX));
        const nh = Math.max(MIN_FIELD_SIZE, Math.abs(y - drag.startY));
        setLiveOverride((prev) => ({ ...prev, x: nx, y: ny, width: nw, height: nh }));
      }
    };

    const handleUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      const override = liveRef.current.liveOverride;

      if (drag.kind === "move" || drag.kind === "resize") {
        if (override && drag.startField) updateField(drag.startField.id, override);
        setLiveOverride(null);
      } else if (drag.kind === "create") {
        const id = drag.pendingId!;
        if (override && override.width && override.width >= MIN_FIELD_SIZE) {
          const size = FIELD_DEFAULT_SIZE[activeTool as FieldToolId];
          const field = buildDefaultField(drag.toolKind!, id, drag.pageIndex, override.x ?? 0, override.y ?? 0, override.width ?? size.width, override.height ?? size.height, drag.pendingName!);
          addField(field);
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
  }, [activeTool]);

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!currentPage || mode !== "edit") return;
    if (activeTool === "select" || activeTool === "edittext") {
      setSelectedId(null);
      return;
    }
    beginCreate(e, activeTool, currentPageIndex);
  };

  // -------------------------------------------------------------------
  // Save
  // -------------------------------------------------------------------
  const canSave = existingFields.length > 0 || builtFields.length > 0 || textEdits.some((t) => t.newText !== t.originalText);

  const savePdf = () => {
    if (!file) return;
    if (!canSave) return;

    const exportFields = liveOverride && selectedId
      ? builtFields.map((f) => (f.id === selectedId ? ({ ...f, ...liveOverride } as FormField) : f))
      : builtFields;

    run(
      async (setProgress) => {
        setResult(null);
        autoDownloadRef.current = false;
        setProgress(10);
        const { PDFDocument } = await import("pdf-lib");
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        setProgress(30);
        await fillExistingFields(pdfDoc, values);
        setProgress(50);
        await buildNewFields(pdfDoc, exportFields, EDIT_SCALE);
        setProgress(70);
        await applyTextEdits(pdfDoc, textEdits);
        setProgress(90);
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
        setProgress(100);
        setResult({ blob });
      },
      {
        successMessage: "PDF saved successfully!",
        toolName: "fill-pdf",
        errorTitle: "Failed to save PDF",
        onError: (error) => {
          console.error("Error saving PDF form:", error);
          const message = error instanceof Error ? error.message : "";
          return message.includes("is encrypted") ? "This PDF is password-protected. Please remove the password and try again." : "Please try again with a valid PDF file";
        },
      }
    );
  };

  const downloadResult = () => {
    if (result) downloadBlob(result.blob, "forms.pdf");
  };

  const allFieldsForCurrentPage = [...existingFields, ...builtFields].filter((f) => f.pageIndex === currentPageIndex);
  const allFieldsFlat = [...existingFields, ...builtFields];
  const selectedField = selectedId ? allFieldsFlat.find((f) => f.id === selectedId) : undefined;
  const selectedFieldDisplay = selectedField ? getDisplay(selectedField) : undefined;
  const selectedTextEdit = !selectedField && selectedId ? textEdits.find((t) => t.id === selectedId) : undefined;
  const textEditsForCurrentPage = textEdits.filter((t) => t.pageIndex === currentPageIndex);
  const radioGroupNames = Array.from(new Set(builtFields.filter((f) => f.kind === "radio").map((f) => f.groupName!).filter(Boolean)));

  if (result) {
    return (
      <PdfToolResultLayout toolSlug="fill-pdf">
        <ResultState resultFilename="forms.pdf" fileSize={formatFileSize(result.blob.size)} onDownload={downloadResult} onStartOver={reset} autoDownloadedRef={autoDownloadRef} />
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
        title="PDF Forms"
        meta={<>{file.name} · {formatFileSize(file.size)}{totalPageCount > 0 ? ` · ${totalPageCount} page${totalPageCount === 1 ? "" : "s"}` : ""}</>}
        actions={<Button variant="ghost" size="sm" onClick={reset} disabled={processing}>Change file</Button>}
      />

      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="relative flex min-h-[620px] min-w-0 flex-col border-b lg:border-b-0 lg:border-r lg:h-[calc(100vh-8.15rem)]">
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
                  <button type="button" onClick={() => { setMode("fill"); setSelectedId(null); setActiveTool("select"); }} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold transition", mode === "fill" ? "bg-slate-950 text-white dark:bg-orange-500" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800")}>
                    Fill Form
                  </button>
                  <button type="button" onClick={() => { setMode("edit"); setActiveTool("select"); }} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold transition", mode === "edit" ? "bg-slate-950 text-white dark:bg-orange-500" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800")}>
                    Edit Form
                  </button>
                </div>
                {textRunsLoading && (
                  <span className="px-2 text-xs text-slate-500">Reading page text…</span>
                )}
              </div>

              {mode === "edit" && (
                <div className="flex shrink-0 flex-wrap items-center gap-1 overflow-x-auto border-b bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                  <ToolButton icon={MousePointer2} label="Select" active={activeTool === "select"} onClick={() => setActiveTool("select")} />
                  <ToolButton icon={SignatureIcon} label="Signature Field" active={activeTool === "signature"} onClick={() => setActiveTool("signature")} />
                  <ToolButton icon={Type} label="Text Field" active={activeTool === "text"} onClick={() => setActiveTool("text")} />
                  <ToolButton icon={CheckSquare} label="Checkbox Field" active={activeTool === "checkbox"} onClick={() => setActiveTool("checkbox")} />
                  <ToolButton icon={Circle} label="Radio Button Field" active={activeTool === "radio"} onClick={() => setActiveTool("radio")} />
                  <ToolButton icon={List} label="List Box Field" active={activeTool === "listbox"} onClick={() => setActiveTool("listbox")} />
                  <ToolButton icon={ListChecks} label="Combo Box Field" active={activeTool === "dropdown"} onClick={() => setActiveTool("dropdown")} />
                  <div className="mx-1 h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />
                  <ToolButton icon={PenLine} label="Edit Text" active={activeTool === "edittext"} onClick={() => { setActiveTool("edittext"); setSelectedId(null); }} />
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" aria-label="Undo" disabled={history.past.length === 0} onClick={() => dispatchHistory({ type: "undo" })}><Undo2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label="Redo" disabled={history.future.length === 0} onClick={() => dispatchHistory({ type: "redo" })}><Redo2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}

              <div className="relative min-h-0 flex-1 overflow-auto bg-slate-200/60 p-6 dark:bg-slate-900/40">
                {currentPage && (
                  <div style={{ width: currentPage.widthPx * zoom, height: currentPage.heightPx * zoom, position: "relative" }}>
                    <div
                      ref={pageViewRef}
                      onPointerDown={handleCanvasPointerDown}
                      style={{ position: "relative", width: currentPage.widthPx, height: currentPage.heightPx, transform: `scale(${zoom})`, transformOrigin: "0 0", cursor: mode === "edit" && activeTool !== "select" && activeTool !== "edittext" ? "crosshair" : "default" }}
                      className="touch-none shadow-[0_18px_50px_-30px_rgba(15,23,42,0.6)]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- real client-rendered canvas snapshot at a deliberate native pixel size */}
                      <img src={currentPage.dataUrl} alt={`Page ${currentPage.pageNumber}`} draggable={false} style={{ display: "block", width: currentPage.widthPx, height: currentPage.heightPx, maxWidth: "none" }} />

                      {allFieldsForCurrentPage.map((f) => {
                        const display = getDisplay(f);
                        const isSelected = selectedId === f.id;
                        return (
                          <FieldOverlay
                            key={f.id}
                            field={display}
                            mode={mode}
                            selected={isSelected}
                            value={f.kind === "radio" ? values[f.groupName!] : values[f.name]}
                            onPointerDownBody={(e) => {
                              if (mode !== "edit" || f.isExisting || activeTool === "edittext") return;
                              e.stopPropagation();
                              beginMove(e, f);
                            }}
                            onResizeHandleDown={(handle, e) => {
                              e.stopPropagation();
                              if (f.isExisting) return;
                              beginResize(e, f, handle);
                            }}
                            onFillChange={(v) => setValues((prev) => ({ ...prev, [f.kind === "radio" ? f.groupName! : f.name]: v }))}
                          />
                        );
                      })}

                      {mode === "edit" && activeTool === "edittext" &&
                        textRuns
                          .filter((run) => !textEditsForCurrentPage.some((t) => t.runId === run.id))
                          .map((run) => (
                            <div
                              key={run.id}
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                addOrSelectTextEdit(run);
                              }}
                              className="absolute cursor-text rounded-[2px] outline-dashed outline-1 outline-transparent hover:bg-orange-500/10 hover:outline-orange-400"
                              style={{ left: run.xPx, top: run.yPx, width: run.widthPx, height: run.heightPx }}
                              aria-label={`Edit text: ${run.str}`}
                            />
                          ))}

                      {textEditsForCurrentPage.map((edit) => (
                        <TextEditOverlay
                          key={edit.id}
                          edit={edit}
                          selected={selectedId === edit.id}
                          interactive={mode === "edit"}
                          onClick={() => {
                            if (mode !== "edit") return;
                            setSelectedId(edit.id);
                            setRailTab("style");
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="pointer-events-none sticky bottom-2 left-1/2 flex w-fit -translate-x-1/2 items-center gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-[0_18px_40px_-20px_rgba(15,23,42,0.5)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
                  <div className="pointer-events-auto flex items-center gap-1">
                    <button type="button" aria-label="Previous page" disabled={currentPageIndex === 0} onClick={() => { setCurrentPageIndex((i) => Math.max(0, i - 1)); setSelectedId(null); }} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800">
                      <ChevronLeft className="h-4 w-4" aria-hidden />
                    </button>
                    <span className="whitespace-nowrap px-1 text-xs font-medium text-slate-600 dark:text-slate-300">{currentPageIndex + 1} / {totalPageCount || pages.length}</span>
                    <button type="button" aria-label="Next page" disabled={currentPageIndex >= pages.length - 1} onClick={() => { setCurrentPageIndex((i) => Math.min(pages.length - 1, i + 1)); setSelectedId(null); }} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800">
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <div className="pointer-events-auto mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
                  <div className="pointer-events-auto flex items-center gap-1">
                    <button type="button" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, Math.round((z - 0.1) * 100) / 100))} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><ZoomOut className="h-4 w-4" aria-hidden /></button>
                    <span className="w-11 text-center text-xs font-medium text-slate-600 dark:text-slate-300">{Math.round(zoom * 100)}%</span>
                    <button type="button" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + 0.1) * 100) / 100))} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><ZoomIn className="h-4 w-4" aria-hidden /></button>
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
                <h2 className="text-xl font-bold tracking-tight">Form options</h2>
                <p className="text-xs text-slate-500">{mode === "fill" ? "Fill in the fields, then download" : "Build and style your form fields"}</p>
              </div>
            </div>

            {!loadError && (
              <>
                {mode === "edit" && (
                  <div className="mb-3 grid shrink-0 grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-950/50">
                    {([{ id: "style", label: "Style" }, { id: "fields", label: "Form Field List" }] as const).map((t) => (
                      <button key={t.id} type="button" onClick={() => setRailTab(t.id)} className={cn("rounded-lg py-1.5 text-xs font-semibold transition", railTab === t.id ? "bg-white text-slate-950 shadow dark:bg-slate-800 dark:text-white" : "text-slate-500")}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                  {mode === "fill" && (
                    <p className="rounded-xl border border-slate-200 p-3 text-xs text-muted-foreground dark:border-slate-800">
                      {allFieldsFlat.length === 0 ? "No fields to fill yet." : "Fill in the fields on the page, then use Download PDF below."}
                    </p>
                  )}

                  {mode === "edit" && railTab === "style" && (
                    selectedFieldDisplay ? (
                      <FieldStylePanel field={selectedFieldDisplay} radioGroupNames={radioGroupNames} onPatch={(patch) => updateField(selectedFieldDisplay.id, patch)} onDelete={() => deleteField(selectedFieldDisplay.id)} />
                    ) : selectedTextEdit ? (
                      <TextEditStylePanel edit={selectedTextEdit} onPatch={(patch) => updateTextEdit(selectedTextEdit.id, patch)} onRevert={() => revertTextEdit(selectedTextEdit.id)} />
                    ) : (
                      <p className="rounded-xl border border-slate-200 p-3 text-xs text-muted-foreground dark:border-slate-800">
                        {activeTool === "edittext" ? "Click any text on the page to edit it." : "Select a field to edit its style, or choose a tool above to place a new one."}
                      </p>
                    )
                  )}

                  {mode === "edit" && railTab === "fields" && (
                    <FormFieldListPanel
                      fields={[...existingFields, ...builtFields]}
                      selectedId={selectedId}
                      onSelect={(f) => { setCurrentPageIndex(f.pageIndex); setSelectedId(f.id); setRailTab("style"); }}
                      onDelete={(f) => !f.isExisting && deleteField(f.id)}
                    />
                  )}
                </div>

                {processing ? (
                  <div className="mt-4 shrink-0"><ProcessingState progress={progress} label="Saving PDF…" cancelable={false} /></div>
                ) : (
                  <button type="button" onClick={savePdf} disabled={!canSave} className="mt-4 flex min-h-14 w-full shrink-0 items-center justify-center rounded-xl bg-slate-950 px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:hover:translate-y-0">
                    {mode === "fill" ? "Download PDF" : "Save changes"}
                  </button>
                )}
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function buildDefaultField(kind: FieldKind, id: string, pageIndex: number, x: number, y: number, width: number, height: number, name: string): FormField {
  const base = { id, pageIndex, x, y, width, height, required: false, readOnly: false, fontSize: 12, textColor: "#000000", borderColor: "#0f172a", borderWidth: 1, fillColor: null, isExisting: false };
  if (kind === "radio") return { ...base, kind, name: `${name}`, groupName: name, optionLabel: id } as FormField;
  if (kind === "listbox" || kind === "dropdown") return { ...base, kind, name, options: ["Option 1", "Option 2", "Option 3"], multiSelect: kind === "listbox" ? false : undefined } as FormField;
  return { ...base, kind, name } as FormField;
}

function ToolButton({ icon: Icon, label, active, onClick }: { icon: typeof Type; label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" title={label} aria-label={label} aria-pressed={active} onClick={onClick} className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition", active ? "bg-slate-950 text-white dark:bg-orange-500" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800")}>
      <Icon className="h-4 w-4" aria-hidden />
    </button>
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

function FieldOverlay({
  field,
  mode,
  selected,
  value,
  onPointerDownBody,
  onResizeHandleDown,
  onFillChange,
}: {
  field: FormField;
  mode: "fill" | "edit";
  selected: boolean;
  value: string | boolean | undefined;
  onPointerDownBody: (e: React.PointerEvent) => void;
  onResizeHandleDown: (handle: HandleId, e: React.PointerEvent) => void;
  onFillChange: (v: string | boolean) => void;
}) {
  const style: React.CSSProperties = {
    position: "absolute",
    left: field.x,
    top: field.y,
    width: field.width,
    height: field.height,
    border: field.borderColor ? `${field.borderWidth}px solid ${field.borderColor}` : "1px dashed #94a3b8",
    backgroundColor: field.fillColor ?? (mode === "edit" ? "rgba(37,99,235,0.06)" : "transparent"),
    boxSizing: "border-box",
  };

  const content = (() => {
    if (mode === "edit") {
      return (
        <div className="pointer-events-none flex h-full w-full items-center justify-center overflow-hidden px-1 text-center text-[9px] font-medium text-slate-600 dark:text-slate-300">
          {field.kind === "checkbox" ? <CheckSquare className="h-3 w-3" aria-hidden /> : `${FIELD_KIND_LABEL[field.kind]}${field.required ? " *" : ""}`}
        </div>
      );
    }
    if (field.readOnly) {
      return <div className="flex h-full w-full items-center px-1 text-xs text-slate-500">{typeof value === "string" ? value : ""}</div>;
    }
    if (field.kind === "text") {
      return (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onFillChange(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          style={{ fontSize: field.fontSize, color: field.textColor }}
          className="h-full w-full bg-transparent px-1 outline-none"
        />
      );
    }
    if (field.kind === "checkbox") {
      return (
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onFillChange(e.target.checked)} onPointerDown={(e) => e.stopPropagation()} className="h-full w-full cursor-pointer accent-orange-500" />
      );
    }
    if (field.kind === "radio") {
      return (
        <input type="radio" name={field.groupName} checked={value === field.optionLabel} onChange={() => onFillChange(field.optionLabel ?? "")} onPointerDown={(e) => e.stopPropagation()} className="h-full w-full cursor-pointer accent-orange-500" />
      );
    }
    if (field.kind === "dropdown") {
      return (
        <select value={typeof value === "string" ? value : ""} onChange={(e) => onFillChange(e.target.value)} onPointerDown={(e) => e.stopPropagation()} style={{ fontSize: field.fontSize }} className="h-full w-full bg-transparent px-1 outline-none">
          <option value="">Choose…</option>
          {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    if (field.kind === "listbox") {
      return (
        <select multiple={field.multiSelect} value={typeof value === "string" ? [value] : []} onChange={(e) => onFillChange([...e.target.selectedOptions].map((o) => o.value).join(","))} onPointerDown={(e) => e.stopPropagation()} style={{ fontSize: field.fontSize }} className="h-full w-full bg-transparent px-1 outline-none">
          {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    if (field.kind === "signature") {
      return <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400"><SignatureIcon className="mr-1 h-3 w-3" aria-hidden />Sign here</div>;
    }
    return null;
  })();

  return (
    <div data-field-id={field.id} style={style} onPointerDown={onPointerDownBody} className={cn(mode === "edit" && !field.isExisting && "cursor-move", selected && "outline outline-2 outline-orange-500 outline-offset-1")}>
      {content}
      {mode === "edit" && selected && !field.isExisting && (
        <>
          {(["nw", "n", "ne", "e", "se", "s", "sw", "w"] as HandleId[]).map((handle) => (
            <div key={handle} onPointerDown={(e) => { e.stopPropagation(); onResizeHandleDown(handle, e); }} className="absolute h-2.5 w-2.5 touch-none rounded-sm border-2 border-orange-500 bg-background" style={{ ...HANDLE_POSITIONS[handle], position: "absolute" }} aria-hidden="true" />
          ))}
        </>
      )}
    </div>
  );
}

/** Live on-canvas preview of a native-text edit: only rendered once the
 *  user has actually typed a replacement (untouched runs show through the
 *  original page raster unmodified), styled with the same cover-color
 *  background + font weight/style/underline/alignment the export will use,
 *  so what's on screen matches the saved PDF. */
function TextEditOverlay({ edit, selected, interactive, onClick }: { edit: TextEdit; selected: boolean; interactive: boolean; onClick: () => void }) {
  if (edit.newText === edit.originalText) {
    return interactive ? (
      <div
        onPointerDown={(e) => { e.stopPropagation(); onClick(); }}
        className={cn("absolute cursor-text rounded-[2px]", selected && "outline outline-2 outline-orange-500 outline-offset-1")}
        style={{ left: edit.x, top: edit.y, width: edit.width, height: edit.height }}
      />
    ) : null;
  }
  return (
    <div
      onPointerDown={interactive ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      className={cn("absolute flex items-center overflow-hidden whitespace-nowrap", interactive && "cursor-text", selected && "outline outline-2 outline-orange-500 outline-offset-1")}
      style={{
        left: edit.x,
        top: edit.y,
        width: Math.max(edit.width, 4),
        height: edit.height,
        backgroundColor: edit.coverColor,
        color: edit.color,
        fontWeight: edit.bold ? 700 : 400,
        fontStyle: edit.italic ? "italic" : "normal",
        textDecoration: edit.underline ? "underline" : "none",
        justifyContent: edit.align === "center" ? "center" : edit.align === "right" ? "flex-end" : "flex-start",
        fontSize: Math.max(6, edit.fontSizePt * EDIT_SCALE * 0.92),
      }}
    >
      {edit.newText}
    </div>
  );
}

function ColorSwatchPicker({ value, onChange, allowNone }: { value: string | null; onChange: (v: string | null) => void; allowNone?: boolean }) {
  const swatches = ["#0f172a", "#dc2626", "#2563eb", "#16a34a", "#ca8a04", "#ffffff"];
  return (
    <div className="flex flex-wrap gap-1.5">
      {allowNone && (
        <button type="button" onClick={() => onChange(null)} aria-label="No color" className={cn("h-6 w-6 rounded-full border-2 bg-[repeating-linear-gradient(45deg,#f87171_0,#f87171_2px,transparent_2px,transparent_6px)]", value === null ? "border-orange-500" : "border-slate-200 dark:border-slate-700")} />
      )}
      {swatches.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)} aria-label={c} style={{ backgroundColor: c }} className={cn("h-6 w-6 rounded-full border-2 shadow-[0_0_0_1px_rgba(15,23,42,0.15)]", value === c ? "border-orange-500" : "border-white dark:border-slate-900")} />
      ))}
      <input type="color" value={value ?? "#000000"} onChange={(e) => onChange(e.target.value)} aria-label="Custom color" className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0" />
    </div>
  );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <input type="number" min={min} max={max} value={Math.round(value)} onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))} className="w-full rounded-md border border-slate-300 bg-background px-2 py-1.5 text-sm dark:border-slate-700" />
    </div>
  );
}

function FieldStylePanel({ field, radioGroupNames, onPatch, onDelete }: { field: FormField; radioGroupNames: string[]; onPatch: (patch: Partial<FormField>) => void; onDelete: () => void }) {
  const isNew = !field.isExisting;
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{FIELD_KIND_LABEL[field.kind]}</p>
        {isNew && (
          <button type="button" onClick={onDelete} aria-label="Delete field" className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-destructive dark:hover:bg-slate-800">
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>

      {isNew && field.kind !== "radio" && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Field name</label>
          <input type="text" value={field.name} onChange={(e) => onPatch({ name: e.target.value })} className="w-full rounded-md border border-slate-300 bg-background px-2 py-1.5 text-sm dark:border-slate-700" />
        </div>
      )}

      {isNew && field.kind === "radio" && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Group name (matching names share one group)</label>
          <input
            type="text"
            list="radio-group-name-options"
            value={field.groupName ?? ""}
            onChange={(e) => onPatch({ groupName: e.target.value })}
            className="w-full rounded-md border border-slate-300 bg-background px-2 py-1.5 text-sm dark:border-slate-700"
          />
          <datalist id="radio-group-name-options">
            {radioGroupNames.map((n) => <option key={n} value={n} />)}
          </datalist>
        </div>
      )}

      {field.kind === "text" && isNew && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Default Value</label>
          <input type="text" value={field.defaultValue ?? ""} onChange={(e) => onPatch({ defaultValue: e.target.value })} className="w-full rounded-md border border-slate-300 bg-background px-2 py-1.5 text-sm dark:border-slate-700" />
        </div>
      )}

      {field.kind === "radio" && isNew && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Option value</label>
          <input type="text" value={field.optionLabel ?? ""} onChange={(e) => onPatch({ optionLabel: e.target.value })} className="w-full rounded-md border border-slate-300 bg-background px-2 py-1.5 text-sm dark:border-slate-700" />
        </div>
      )}

      {(field.kind === "listbox" || field.kind === "dropdown") && isNew && (
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Options</label>
          {(field.options ?? []).map((opt, i) => (
            <div key={i} className="flex items-center gap-1">
              <input
                type="text"
                value={opt}
                onChange={(e) => {
                  const next = [...(field.options ?? [])];
                  next[i] = e.target.value;
                  onPatch({ options: next });
                }}
                className="w-full rounded-md border border-slate-300 bg-background px-2 py-1 text-sm dark:border-slate-700"
              />
              <button type="button" aria-label={`Remove option ${i + 1}`} onClick={() => onPatch({ options: (field.options ?? []).filter((_, idx) => idx !== i) })} className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-destructive dark:hover:bg-slate-800">
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => onPatch({ options: [...(field.options ?? []), `Option ${(field.options?.length ?? 0) + 1}`] })} className="flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700">
            <Plus className="h-3.5 w-3.5" aria-hidden /> Add Option
          </button>
        </div>
      )}

      <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Properties</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={field.readOnly} onChange={(e) => onPatch({ readOnly: e.target.checked })} disabled={!isNew} className="h-4 w-4 accent-orange-500" /> Read Only</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={field.required} onChange={(e) => onPatch({ required: e.target.checked })} disabled={!isNew} className="h-4 w-4 accent-orange-500" /> Required</label>
        {field.kind === "text" && isNew && (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={field.multiline ?? false} onChange={(e) => onPatch({ multiline: e.target.checked })} className="h-4 w-4 accent-orange-500" /> Multiline</label>
        )}
        {field.kind === "listbox" && isNew && (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={field.multiSelect ?? false} onChange={(e) => onPatch({ multiSelect: e.target.checked })} className="h-4 w-4 accent-orange-500" /> Multi Select</label>
        )}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={field.includeIndicator ?? false} onChange={(e) => onPatch({ includeIndicator: e.target.checked })} className="h-4 w-4 accent-orange-500" /> Include Field Indicator</label>
      </div>

      {(field.kind === "text" || field.kind === "dropdown") && isNew && (
        <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Text Style</p>
          <NumberField label="Font size" value={field.fontSize} min={6} max={48} onChange={(v) => onPatch({ fontSize: v })} />
          <ColorSwatchPicker value={field.textColor} onChange={(c) => onPatch({ textColor: c ?? "#000000" })} />
        </div>
      )}

      {isNew && (
        <>
          <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Stroke</p>
            <ColorSwatchPicker value={field.borderColor} onChange={(c) => onPatch({ borderColor: c })} allowNone />
            <NumberField label="Border width (pt)" value={field.borderWidth} min={0} max={10} onChange={(v) => onPatch({ borderWidth: v })} />
          </div>
          <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Fill</p>
            <ColorSwatchPicker value={field.fillColor} onChange={(c) => onPatch({ fillColor: c })} allowNone />
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <NumberField label="Width" value={field.width} min={MIN_FIELD_SIZE} max={800} onChange={(v) => onPatch({ width: v })} />
        <NumberField label="Height" value={field.height} min={MIN_FIELD_SIZE} max={800} onChange={(v) => onPatch({ height: v })} />
      </div>
    </div>
  );
}

function TextEditStylePanel({ edit, onPatch, onRevert }: { edit: TextEdit; onPatch: (patch: Partial<TextEdit>) => void; onRevert: () => void }) {
  const changed = edit.newText !== edit.originalText;
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Edit Text</p>
        {changed && (
          <button type="button" onClick={onRevert} aria-label="Revert to original text" title="Revert to original text" className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-destructive dark:hover:bg-slate-800">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Original text</label>
        <p className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40">{edit.originalText}</p>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">New text</label>
        <textarea
          value={edit.newText}
          onChange={(e) => onPatch({ newText: e.target.value })}
          rows={3}
          className="w-full resize-none rounded-md border border-slate-300 bg-background px-2 py-1.5 text-sm dark:border-slate-700"
        />
      </div>

      <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Text Style</p>
        <NumberField label="Font size (pt)" value={edit.fontSizePt} min={4} max={96} onChange={(v) => onPatch({ fontSizePt: v })} />
        <ColorSwatchPicker value={edit.color} onChange={(c) => onPatch({ color: c ?? "#000000" })} />
        <div className="flex items-center gap-1">
          <button type="button" aria-pressed={edit.bold} onClick={() => onPatch({ bold: !edit.bold })} className={cn("flex h-8 w-8 items-center justify-center rounded-md border", edit.bold ? "border-orange-500 bg-orange-50 text-orange-600 dark:bg-orange-950/30" : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300")}>
            <Bold className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button type="button" aria-pressed={edit.italic} onClick={() => onPatch({ italic: !edit.italic })} className={cn("flex h-8 w-8 items-center justify-center rounded-md border", edit.italic ? "border-orange-500 bg-orange-50 text-orange-600 dark:bg-orange-950/30" : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300")}>
            <Italic className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button type="button" aria-pressed={edit.underline} onClick={() => onPatch({ underline: !edit.underline })} className={cn("flex h-8 w-8 items-center justify-center rounded-md border", edit.underline ? "border-orange-500 bg-orange-50 text-orange-600 dark:bg-orange-950/30" : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300")}>
            <UnderlineIcon className="h-3.5 w-3.5" aria-hidden />
          </button>
          <div className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" />
          {([{ v: "left", Icon: AlignLeft }, { v: "center", Icon: AlignCenter }, { v: "right", Icon: AlignRight }] as const).map(({ v, Icon }) => (
            <button key={v} type="button" aria-pressed={edit.align === v} onClick={() => onPatch({ align: v })} className={cn("flex h-8 w-8 items-center justify-center rounded-md border", edit.align === v ? "border-orange-500 bg-orange-50 text-orange-600 dark:bg-orange-950/30" : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300")}>
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function FormFieldListPanel({ fields, selectedId, onSelect, onDelete }: { fields: FormField[]; selectedId: string | null; onSelect: (f: FormField) => void; onDelete: (f: FormField) => void }) {
  if (fields.length === 0) {
    return <p className="rounded-xl border border-slate-200 p-4 text-center text-xs text-muted-foreground dark:border-slate-800">This document has no form fields</p>;
  }
  return (
    <div className="space-y-1.5">
      {fields.map((f) => (
        <div key={f.id} className={cn("flex items-center gap-2 rounded-lg border px-2 py-1.5", selectedId === f.id ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20" : "border-slate-200 dark:border-slate-800")}>
          <button type="button" onClick={() => onSelect(f)} className="min-w-0 flex-1 text-left">
            <p className="truncate text-xs font-medium">{f.kind === "radio" ? f.groupName : f.name}</p>
            <p className="text-[10px] text-slate-400">{FIELD_KIND_LABEL[f.kind]} · page {f.pageIndex + 1}{f.isExisting ? " · existing" : ""}{f.required ? " · required" : ""}</p>
          </button>
          {!f.isExisting && (
            <button type="button" aria-label={`Delete ${f.name}`} onClick={() => onDelete(f)} className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-destructive dark:hover:bg-slate-800">
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
