"use client";

import { UiText } from "@/components/i18n/UiText";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowDown01,
  ArrowUp,
  FilePlus2,
  FileText,
  GripVertical,
  Loader2,
  Redo2,
  RotateCcw,
  RotateCw,
  Shuffle,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  PdfAddButton,
  PdfToolLanding,
  PdfToolResultLayout,
  PdfWorkspaceBar,
} from "@/components/tool/PdfToolChrome";
import { ResultState } from "@/components/tool/ResultState";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import {
  ORGANIZE_LIMITS,
  type OrganizePage,
  type OrganizeSource,
} from "@/lib/engines/pdf-organize-types";
import { cn, formatFileSize } from "@/lib/utils";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";

type SourceFile = OrganizeSource & { pageCount: number };
type PageItem = OrganizePage & { pageNumberLabel: string; thumbnail?: string };
type Workspace = { files: SourceFile[]; pages: PageItem[] };
type Result = {
  blob: Blob;
  filename: string;
  fieldCount: number;
  removedLinks: number;
};
const EMPTY: Workspace = { files: [], pages: [] };
const iconButton =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-40";

function SortablePageCard({
  item,
  index,
  disabled,
  selected,
  onSelect,
  onRotate,
  onRemove,
  onInsertBlankBefore,
}: {
  item: PageItem;
  index: number;
  disabled: boolean;
  selected: boolean;
  onSelect: (shift: boolean) => void;
  onRotate: () => void;
  onRemove: () => void;
  onInsertBlankBefore: () => void;
}) {
  const sortable = useSortable({ id: item.id, disabled });
  return (
    <div
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        opacity: sortable.isDragging ? 0.28 : 1,
      }}
      className={cn(
        "group/card relative w-[150px] rounded-xl border-2 bg-white p-3 text-center shadow-sm dark:bg-slate-900 sm:w-[188px]",
        selected
          ? "border-orange-500 ring-2 ring-orange-100 dark:ring-orange-950"
          : item.kind === "blank"
            ? "border-slate-300"
            : "border-rose-200",
      )}
    >
      <div className="mb-2 flex justify-between gap-1">
        <button
          type="button"
          {...sortable.attributes}
          {...sortable.listeners}
          disabled={disabled}
          className={cn(iconButton, "touch-none")}
          aria-label={`Drag page ${index + 1}`}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onRotate}
          disabled={disabled}
          className={iconButton}
          aria-label={`Rotate page ${index + 1}`}
        >
          <RotateCw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className={iconButton}
          aria-label={`Remove page ${index + 1}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={`Select page ${index + 1}`}
        onClick={(event) => onSelect(event.shiftKey)}
        disabled={disabled}
        className="block w-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
      >
        <div className="flex h-[170px] items-center justify-center overflow-hidden rounded-md bg-slate-50 dark:bg-slate-950 sm:h-[210px]">
          {item.kind === "blank" ? (
            <div
              className="flex max-h-[160px] max-w-[110px] items-center justify-center border border-dashed border-slate-300 bg-white text-xs text-slate-400 sm:max-h-[185px] sm:max-w-[130px]"
              style={{
                width: 130,
                aspectRatio: `${item.width ?? 595} / ${item.height ?? 842}`,
                transform: `rotate(${item.rotation}deg)`,
              }}
            >
              Blank
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnail}
              alt=""
              className="max-h-[160px] max-w-[110px] rounded bg-white shadow-sm sm:max-h-[185px] sm:max-w-[136px]"
              style={{ transform: `rotate(${item.rotation}deg)` }}
            />
          )}
        </div>
        <div className="mt-2 flex items-center justify-center gap-2 text-sm font-semibold">
          <span
            className={cn(
              "h-4 w-4 rounded border text-[10px]",
              selected && "border-orange-500 bg-orange-500 text-white",
            )}
          >
            {selected ? "✓" : ""}
          </span>
          {index + 1}
          {item.rotation > 0 && (
            <span className="text-xs font-normal text-orange-700">
              +{item.rotation}°
            </span>
          )}
        </div>
      </button>
      <p
        className="mt-1 truncate text-xs text-muted-foreground"
        title={item.pageNumberLabel}
      >
        {item.pageNumberLabel}
      </p>
      <button
        type="button"
        onClick={onInsertBlankBefore}
        disabled={disabled}
        className="mt-2 inline-flex min-h-9 items-center gap-1 text-xs text-orange-700 hover:underline disabled:opacity-40"
      >
        <FilePlus2 className="h-3.5 w-3.5" />
        Blank before
      </button>
    </div>
  );
}

export function OrganizePdfClient({
  faqs: _faqs,
  related: _related,
}: {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}) {
  const [workspace, setWorkspace] = useState<Workspace>(EMPTY),
    workspaceRef = useRef(workspace);
  const { files, pages } = workspace;
  const undoRef = useRef<Workspace[]>([]),
    redoRef = useRef<Workspace[]>([]);
  const [selected, setSelected] = useState(new Set<string>()),
    lastSelected = useRef<string | null>(null);
  const [loading, setLoading] = useState(false),
    [loadStatus, setLoadStatus] = useState("");
  const [messages, setMessages] = useState<string[]>([]),
    [exportError, setExportError] = useState("");
  const loadAbort = useRef<AbortController | null>(null),
    exportAbort = useRef<AbortController | null>(null);
  const [blankSize, setBlankSize] = useState("match");
  const [result, setResult] = useState<Result | null>(null),
    [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const inputRef = useRef<HTMLInputElement>(null),
    autoDownloadRef = useRef(false);
  const { processing, progress, run, cancel } = useProcessingTask();
  const busy = loading || processing;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const totalBytes = useMemo(
    () => files.reduce((sum, item) => sum + item.file.size, 0),
    [files],
  );
  const chosen = pages.filter((page) => selected.has(page.id));
  const blankPages = pages.filter((page) => page.kind === "blank").length;
  const activePage = pages.find((item) => item.id === activeId);

  const commit = useCallback((update: (previous: Workspace) => Workspace) => {
    const previous = workspaceRef.current,
      next = update(previous);
    if (next === previous) return;
    undoRef.current = [...undoRef.current.slice(-29), previous];
    redoRef.current = [];
    workspaceRef.current = next;
    setWorkspace(next);
    setExportError("");
  }, []);
  const undo = useCallback(() => {
    const previous = undoRef.current.pop();
    if (!previous) return;
    redoRef.current.push(workspaceRef.current);
    workspaceRef.current = previous;
    setWorkspace(previous);
    setExportError("");
  }, []);
  const redo = useCallback(() => {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current.push(workspaceRef.current);
    workspaceRef.current = next;
    setWorkspace(next);
    setExportError("");
  }, []);
  useEffect(
    () => () => {
      loadAbort.current?.abort();
      loadAbort.current = null;
      exportAbort.current?.abort();
      cancel();
    },
    [cancel],
  );
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        busy ||
        result ||
        !(event.ctrlKey || event.metaKey) ||
        event.key.toLowerCase() !== "z" ||
        (event.target as HTMLElement)?.closest(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [busy, result, undo, redo]);

  const addFiles = async (newFiles: File[]) => {
    if (loadAbort.current || processing) return;
    const controller = new AbortController();
    loadAbort.current = controller;
    setLoading(true);
    setMessages([]);
    setResult(null);
    setExportError("");
    autoDownloadRef.current = false;
    const errors: string[] = [];
    let completed = 0;
    try {
      const { loadOrganizePreview } = await import(
        "@/lib/engines/pdf-organize-preview"
      );
      for (const file of newFiles) {
        if (controller.signal.aborted) break;
        const current = workspaceRef.current;
        if (
          !file.name.toLowerCase().endsWith(".pdf") &&
          file.type !== "application/pdf"
        ) {
          errors.push(`${file.name}: choose a PDF file.`);
          continue;
        }
        if (current.files.length >= ORGANIZE_LIMITS.files) {
          errors.push("The workspace holds up to 20 PDFs.");
          break;
        }
        if (
          file.size > ORGANIZE_LIMITS.fileBytes ||
          current.files.reduce((sum, source) => sum + source.file.size, 0) +
            file.size >
            ORGANIZE_LIMITS.totalBytes
        ) {
          errors.push(`${file.name}: use up to 100MB per PDF and 200MB total.`);
          continue;
        }
        setLoadStatus(`Loading ${file.name}…`);
        try {
          const preview = await loadOrganizePreview(
            file,
            controller.signal,
            Math.min(
              ORGANIZE_LIMITS.pages - current.pages.length,
              ORGANIZE_LIMITS.pages -
                current.files.reduce(
                  (sum, source) => sum + source.pageCount,
                  0,
                ),
            ),
            (page, total) =>
              setLoadStatus(`${file.name}: page ${page} of ${total}`),
          );
          if (controller.signal.aborted) break;
          const id = crypto.randomUUID();
          const added: PageItem[] = preview.map((page) => ({
            id: `${id}-${page.pageIndex}`,
            kind: "pdf",
            fileId: id,
            originalPageIndex: page.pageIndex,
            pageNumberLabel: `${file.name} · page ${page.pageIndex + 1}`,
            thumbnail: page.thumbnail,
            width: page.width,
            height: page.height,
            rotation: 0,
          }));
          commit((previous) => ({
            files: [...previous.files, { id, file, pageCount: preview.length }],
            pages: [...previous.pages, ...added],
          }));
          completed++;
        } catch (error) {
          if (controller.signal.aborted) break;
          errors.push(
            `${file.name}: ${error instanceof Error ? error.message : "Could not read this PDF. Try an unlocked, readable copy."}`,
          );
        }
      }
    } finally {
      if (loadAbort.current === controller) {
        loadAbort.current = null;
        setLoading(false);
        setLoadStatus("");
        setMessages(errors);
        if (controller.signal.aborted)
          toast.info(
            `Loading cancelled. ${completed} completed file${completed === 1 ? "" : "s"} kept.`,
          );
      }
    }
  };
  const clearAll = () => {
    loadAbort.current?.abort();
    loadAbort.current = null;
    exportAbort.current?.abort();
    cancel();
    workspaceRef.current = EMPTY;
    setWorkspace(EMPTY);
    undoRef.current = [];
    redoRef.current = [];
    setResult(null);
    setSelected(new Set());
    lastSelected.current = null;
    setLoading(false);
    setMessages([]);
    setExportError("");
    autoDownloadRef.current = false;
  };
  const changePages = (update: (pages: PageItem[]) => PageItem[]) =>
    commit((previous) => ({ ...previous, pages: update(previous.pages) }));
  const removePage = (id: string) =>
    changePages((current) => current.filter((page) => page.id !== id));
  const rotate = (ids: Set<string>, delta: number) =>
    changePages((current) =>
      current.map((page) =>
        ids.has(page.id)
          ? { ...page, rotation: (page.rotation + delta + 360) % 360 }
          : page,
      ),
    );
  const toggle = (id: string, shift: boolean) => {
    const next = new Set(selected),
      index = pages.findIndex((page) => page.id === id),
      anchor = pages.findIndex((page) => page.id === lastSelected.current);
    const ids =
      shift && anchor >= 0
        ? pages
            .slice(Math.min(index, anchor), Math.max(index, anchor) + 1)
            .map((page) => page.id)
        : [id];
    const remove = next.has(id);
    ids.forEach((key) => (remove ? next.delete(key) : next.add(key)));
    setSelected(next);
    lastSelected.current = id;
  };
  const insertBlankBefore = (index: number) => {
    if (pages.length >= ORGANIZE_LIMITS.pages) {
      toast.error("The workspace supports up to 1,000 pages.");
      return;
    }
    const reference = pages[index] ?? pages[index - 1];
    let width = 595.28,
      height = 841.89;
    if (blankSize === "letter") {
      width = 612;
      height = 792;
    }
    if (blankSize === "match" && reference) {
      width = reference.width ?? width;
      height = reference.height ?? height;
      if (reference.rotation % 180) [width, height] = [height, width];
    }
    const blank: PageItem = {
      id: crypto.randomUUID(),
      kind: "blank",
      fileId: reference?.fileId,
      pageNumberLabel: "Blank page",
      rotation: 0,
      width,
      height,
    };
    changePages((current) => [
      ...current.slice(0, index),
      blank,
      ...current.slice(index),
    ]);
  };
  const reorderFiles = (nextFiles: SourceFile[]) =>
    commit((previous) => {
      const ranks = new Map(nextFiles.map((file, index) => [file.id, index]));
      return {
        files: nextFiles,
        pages: [...previous.pages].sort(
          (a, b) =>
            (ranks.get(a.fileId ?? "") ?? nextFiles.length) -
            (ranks.get(b.fileId ?? "") ?? nextFiles.length),
        ),
      };
    });
  const sortByOriginalPage = () =>
    changePages((current) =>
      [...current].sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "pdf" ? -1 : 1;
        return (
          files.findIndex((file) => file.id === a.fileId) -
            files.findIndex((file) => file.id === b.fileId) ||
          (a.originalPageIndex ?? 0) - (b.originalPageIndex ?? 0)
        );
      }),
    );
  const organizePdf = () => {
    if (!pages.length || busy) return;
    const controller = new AbortController();
    exportAbort.current?.abort();
    exportAbort.current = controller;
    void run(
      async (setProgress, isCancelled) => {
        setResult(null);
        setExportError("");
        autoDownloadRef.current = false;
        const { organizePdfPages } = await import(
          "@/lib/engines/pdf-organize-engine"
        );
        const output = await organizePdfPages(files, pages, {
          signal: controller.signal,
          onProgress: setProgress,
        });
        if (isCancelled() || controller.signal.aborted) return;
        setResult({ ...output, filename: "organized.pdf" });
      },
      {
        successMessage: "PDF organized successfully!",
        toolName: "organize-pdf",
        errorTitle: "Could not organize this PDF",
        onError: (error) => {
          const message =
            error instanceof Error
              ? error.message
              : "Please try an unlocked, readable PDF.";
          setExportError(message);
          return message;
        },
      },
    );
  };
  const downloadResult = useCallback(() => {
    if (result) downloadBlob(result.blob, result.filename);
  }, [result]);
  const loadMessages = messages.length ? (
    <div
      role="alert"
      className="mx-auto my-3 w-full max-w-5xl rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
    >
      <p className="mb-1 font-semibold">
        Some files were not added. Completed files are kept.
      </p>
      <ul className="list-inside list-disc break-words">
        {messages.map((message, index) => (
          <li key={index}>{message}</li>
        ))}
      </ul>
    </div>
  ) : null;

  if (result)
    return (
      <PdfToolResultLayout toolSlug="organize-pdf">
        <ResultState
          resultFilename={result.filename}
          fileSize={formatFileSize(result.blob.size)}
          onDownload={downloadResult}
          onStartOver={clearAll}
          autoDownloadedRef={autoDownloadRef}
          downloadLabel="Download PDF"
        />
        <div className="mx-auto max-w-xl rounded-xl bg-sky-50 p-4 text-sm text-sky-950 dark:bg-sky-950 dark:text-sky-100">
          {pages.length} {pages.length === 1 ? "page" : "pages"} organized. Original page text and images are
          preserved.
          {result.fieldCount > 0 &&
            ` ${result.fieldCount} form fields remain editable. In combined files, field names are grouped by source file.`}
          {result.removedLinks > 0 &&
            ` ${result.removedLinks} ${result.removedLinks === 1 ? "link" : "links"} to removed or unavailable pages ${result.removedLinks === 1 ? "was" : "were"} cleared.`}
        </div>
      </PdfToolResultLayout>
    );
  if (
    !files.length &&
    !pages.length &&
    !loading &&
    !undoRef.current.length &&
    !redoRef.current.length
  )
    return (
      <>
        <PdfToolLanding
          title="Organize PDF"
          description="Sort, add, rotate, and remove PDF pages in one visual workspace."
          buttonLabel="Select PDF file"
          dropLabel="or drop PDFs here"
          limitLabel="20 PDFs · 100MB each · 200MB total"
          accept={{ "application/pdf": [".pdf"] }}
          multiple
          icon={Shuffle}
          iconClass="text-orange-600"
          iconBackgroundClass="bg-orange-100 dark:bg-orange-950/40"
          accent="orange"
          onFilesSelected={addFiles}
        />
        {loadMessages}
      </>
    );

  return (
    <div className="flex flex-1 flex-col bg-slate-50/70 dark:bg-slate-950/40">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={(event) => {
          const selected = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (selected.length) void addFiles(selected);
        }}
      />
      <PdfWorkspaceBar
        title="Organize PDF"
        meta={
          <>
            {files.length} file{files.length === 1 ? "" : "s"} · {pages.length}{" "}
            {pages.length === 1 ? "page" : "pages"} · {formatFileSize(totalBytes)}
          </>
        }
        actions={
          <Button variant="ghost" size="sm" onClick={clearAll} disabled={busy}>
            <UiText text="Reset all" />
          </Button>
        }
      />
      <div className="container mx-auto grid w-full max-w-[1500px] flex-1 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="relative min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Page board</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Drag pages to reorder. Select pages for group actions; Shift
                selects a range.
              </p>
            </div>
            <PdfAddButton
              count={files.length}
              label="Add more files"
              accent="orange"
              disabled={busy || files.length >= ORGANIZE_LIMITS.files}
              onClick={() => inputRef.current?.click()}
            />
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border bg-background p-2">
            <button
              type="button"
              className={iconButton}
              onClick={undo}
              disabled={busy || !undoRef.current.length}
              aria-label="Undo"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={iconButton}
              onClick={redo}
              disabled={busy || !redoRef.current.length}
              aria-label="Redo"
            >
              <Redo2 className="h-4 w-4" />
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setSelected(
                  chosen.length === pages.length
                    ? new Set()
                    : new Set(pages.map((page) => page.id)),
                )
              }
              disabled={busy || !pages.length}
            >
              {chosen.length === pages.length && pages.length
                ? "Clear selection"
                : "Select all"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setSelected(
                  new Set(
                    pages
                      .filter((page) => !selected.has(page.id))
                      .map((page) => page.id),
                  ),
                )
              }
              disabled={busy || !pages.length}
            >
              Invert
            </Button>
            <span className="px-1 text-xs text-muted-foreground">
              {chosen.length} selected
            </span>
            <button
              type="button"
              className={iconButton}
              aria-label="Rotate selected pages left"
              disabled={busy || !chosen.length}
              onClick={() => rotate(selected, -90)}
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={iconButton}
              aria-label="Rotate selected pages right"
              disabled={busy || !chosen.length}
              onClick={() => rotate(selected, 90)}
            >
              <RotateCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={iconButton}
              aria-label="Remove selected pages"
              disabled={busy || !chosen.length}
              onClick={() =>
                changePages((current) =>
                  current.filter((page) => !selected.has(page.id)),
                )
              }
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={iconButton}
              aria-label="Move selected pages to start"
              disabled={busy || !chosen.length}
              onClick={() =>
                changePages((current) => [
                  ...current.filter((page) => selected.has(page.id)),
                  ...current.filter((page) => !selected.has(page.id)),
                ])
              }
            >
              <ArrowUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={iconButton}
              aria-label="Move selected pages to end"
              disabled={busy || !chosen.length}
              onClick={() =>
                changePages((current) => [
                  ...current.filter((page) => !selected.has(page.id)),
                  ...current.filter((page) => selected.has(page.id)),
                ])
              }
            >
              <ArrowDown className="h-4 w-4" />
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={sortByOriginalPage}
              disabled={busy || !pages.length}
            >
              <ArrowDown01 className="mr-1 h-4 w-4" />
              Original order
            </Button>
          </div>
          {loading && (
            <div
              role="status"
              className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-background p-3 text-sm"
            >
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-orange-600" />
              <span className="min-w-0 flex-1 break-words">{loadStatus}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadAbort.current?.abort()}
              >
                Cancel loading
              </Button>
            </div>
          )}
          {loadMessages}
          {!pages.length && !loading && (
            <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
              No pages left. Undo a removal, add a blank page, or add another
              PDF.
            </div>
          )}
          <DndContext
            accessibility={{
              announcements: {
                onDragStart: ({ active }) =>
                  `Picked up page ${pages.findIndex((page) => page.id === active.id) + 1}.`,
                onDragOver: ({ over }) =>
                  over
                    ? `Move to position ${pages.findIndex((page) => page.id === over.id) + 1}.`
                    : undefined,
                onDragEnd: ({ over }) =>
                  over
                    ? `Page placed at position ${pages.findIndex((page) => page.id === over.id) + 1}.`
                    : "Page order unchanged.",
                onDragCancel: () => "Move cancelled. Page order unchanged.",
              },
            }}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(event: DragStartEvent) =>
              setActiveId(event.active.id)
            }
            onDragEnd={(event: DragEndEvent) => {
              if (!busy && event.over && event.active.id !== event.over.id)
                changePages((current) => {
                  const from = current.findIndex(
                      (page) => page.id === event.active.id,
                    ),
                    to = current.findIndex(
                      (page) => page.id === event.over?.id,
                    );
                  return from < 0 || to < 0
                    ? current
                    : arrayMove(current, from, to);
                });
              setActiveId(null);
            }}
            onDragCancel={() => setActiveId(null)}
          >
            <SortableContext
              items={pages.map((page) => page.id)}
              strategy={rectSortingStrategy}
            >
              <div className="flex flex-wrap justify-center gap-4 py-3 sm:justify-start">
                {pages.map((item, index) => (
                  <SortablePageCard
                    key={item.id}
                    item={item}
                    index={index}
                    disabled={busy}
                    selected={selected.has(item.id)}
                    onSelect={(shift) => toggle(item.id, shift)}
                    onRotate={() => rotate(new Set([item.id]), 90)}
                    onRemove={() => removePage(item.id)}
                    onInsertBlankBefore={() => insertBlankBefore(index)}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activePage ? (
                <div className="h-[260px] w-[150px] rounded-xl border-2 border-orange-300 bg-white shadow-xl sm:w-[188px]" />
              ) : null}
            </DragOverlay>
          </DndContext>
        </section>
        <aside className="flex min-h-[440px] flex-col self-start rounded-xl border bg-background p-5 shadow-sm lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)]">
          <h2 className="border-b pb-4 text-2xl font-bold">Organize PDF</h2>
          <div className="min-h-0 flex-1 space-y-5 py-5 lg:overflow-y-auto">
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">Files</h3>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy || files.length < 2}
                    onClick={() =>
                      reorderFiles(
                        [...files].sort((a, b) =>
                          a.file.name.localeCompare(b.file.name, undefined, {
                            numeric: true,
                          }),
                        ),
                      )
                    }
                  >
                    A–Z
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy || files.length < 2}
                    onClick={() =>
                      reorderFiles(
                        [...files].sort((a, b) =>
                          b.file.name.localeCompare(a.file.name, undefined, {
                            numeric: true,
                          }),
                        ),
                      )
                    }
                  >
                    Z–A
                  </Button>
                </div>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Changing file order groups its pages together.
              </p>
              <div className="space-y-2">
                {files.map((item, index) => (
                  <div
                    key={item.id}
                    className="rounded-lg border bg-muted/30 p-2"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 shrink-0 text-orange-600" />
                      <span
                        className="min-w-0 flex-1 truncate"
                        title={item.file.name}
                      >
                        {item.file.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {
                          pages.filter(
                            (page) =>
                              page.fileId === item.id && page.kind === "pdf",
                          ).length
                        }
                        /{item.pageCount}
                      </span>
                    </div>
                    <div className="mt-2 flex justify-end gap-1">
                      <button
                        type="button"
                        className={iconButton}
                        aria-label={`Move file ${index + 1} up`}
                        disabled={busy || index === 0}
                        onClick={() =>
                          reorderFiles(arrayMove(files, index, index - 1))
                        }
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className={iconButton}
                        aria-label={`Move file ${index + 1} down`}
                        disabled={busy || index === files.length - 1}
                        onClick={() =>
                          reorderFiles(arrayMove(files, index, index + 1))
                        }
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className={iconButton}
                        aria-label={`Remove file ${index + 1}`}
                        disabled={busy}
                        onClick={() =>
                          commit((previous) => ({
                            files: previous.files.filter(
                              (file) => file.id !== item.id,
                            ),
                            pages: previous.pages.filter(
                              (page) => page.fileId !== item.id,
                            ),
                          }))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label
                className="block text-sm font-medium"
                htmlFor="organize-blank-size"
              >
                Blank page size
              </label>
              <select
                id="organize-blank-size"
                value={blankSize}
                onChange={(event) => setBlankSize(event.target.value)}
                disabled={busy}
                className="w-full rounded-lg border bg-background p-2 text-sm"
              >
                <option value="match">Match nearby page</option>
                <option value="a4">A4</option>
                <option value="letter">US Letter</option>
              </select>
              <Button
                variant="outline"
                className="w-full"
                disabled={busy || pages.length >= ORGANIZE_LIMITS.pages}
                onClick={() =>
                  insertBlankBefore(
                    chosen.length
                      ? pages.findIndex((page) => selected.has(page.id))
                      : pages.length,
                  )
                }
              >
                <FilePlus2 className="mr-2 h-4 w-4" />
                {chosen.length ? "Blank before selection" : "Add blank page"}
              </Button>
            </div>
            <div className="rounded-lg bg-sky-50 p-3 text-sm text-sky-950 dark:bg-sky-950 dark:text-sky-100">
              {pages.length} output {pages.length === 1 ? "page" : "pages"}
              {blankPages > 0 ? ` · ${blankPages} blank` : ""}. Original page
              content is preserved. Supported form fields remain editable; links
              to removed pages are cleared.
            </div>
            <p className="text-xs text-muted-foreground">
              Up to 1,000 pages. Undo/Redo keeps 30 changes. Bookmarks and
              attached files are not included in the new document.
            </p>
          </div>
          <div className="mt-auto shrink-0 space-y-3 border-t pt-4">
            {exportError && (
              <p
                role="alert"
                className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {exportError}
              </p>
            )}
            {processing ? (
              <>
                <Progress value={progress} aria-label="Organizing PDF" />
                <Button
                  variant="outline"
                  className="h-14 w-full"
                  onClick={() => {
                    exportAbort.current?.abort();
                    cancel();
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                onClick={organizePdf}
                disabled={loading || !pages.length}
                className="h-14 w-full bg-red-600 text-base font-bold hover:bg-red-700"
              >
                Organize PDF
              </Button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
