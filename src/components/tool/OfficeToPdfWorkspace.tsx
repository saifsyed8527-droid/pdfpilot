"use client";
import { useWorkspaceText, UiText } from "@/components/i18n/WorkspaceText";

import { TemplateFilePicker } from "@/components/templates/TemplateFilePicker";
import type { TemplateSession } from "@/lib/content/conversion-templates";
import { useToolCopy } from "@/components/i18n/UiText";
import { conversionCopy, isConversionTool } from "@/lib/i18n/conversion-copy";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone, type Accept, type FileRejection } from "react-dropzone";
import { toast } from "sonner";
import {
  ArrowDownAZ,
  ArrowUpZA,
  FileOutput,
  GripVertical,
  Loader2,
  RotateCw,
  Sheet,
  X,
  type LucideIcon,
} from "lucide-react";
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
import {
  PdfAddButton,
  PdfToolLanding,
  PdfToolResultLayout,
  PdfWorkspaceBar,
} from "@/components/tool/PdfToolChrome";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { ResultState } from "@/components/tool/ResultState";
import { downloadBlob } from "@/lib/download-file";
import {
  OFFICE_BATCH_LIMITS,
  officeItemKey,
  type OfficeConvertedDocument,
} from "@/lib/engines/office-batch";
import { useOfficeBatch } from "@/lib/use-office-batch";
import { sortFilesByName } from "@/lib/file-sort";
import { cn, formatFileSize } from "@/lib/utils";

const MAX_FILE_SIZE = 100 * 1024 * 1024;
type Rotation = 0 | 90 | 180 | 270;
type SheetChoice = { name: string; hidden: boolean };
type Item = {
  id: string;
  file: File;
  rotation: Rotation;
  sheets?: SheetChoice[];
  selectedSheets?: string[];
  inspecting?: boolean;
  inspectionError?: string;
};

async function rotatePdf(bytes: Uint8Array, rotation: Rotation) {
  if (rotation === 0) return bytes;
  const { PDFDocument, degrees } = await import("pdf-lib");
  const pdf = await PDFDocument.load(bytes);
  pdf
    .getPages()
    .forEach((page) =>
      page.setRotation(degrees((page.getRotation().angle + rotation) % 360)),
    );
  return pdf.save();
}

function Card({
  item,
  index,
  processing,
  Icon,
  extension,
  accent,
  canRotate,
  onRemove,
  onRotate,
}: {
  item: Item;
  index: number;
  processing: boolean;
  Icon: LucideIcon;
  extension: string;
  accent: "orange" | "emerald" | "amber";
  canRotate: boolean;
  onRemove: () => void;
  onRotate: () => void;
}) {
  const __copy = useWorkspaceText();
  const sortable = useSortable({ id: item.id, disabled: processing });
  const color =
    accent === "amber"
      ? "text-blue-700 bg-blue-700 focus-visible:ring-amber-500"
      : accent === "orange"
        ? "text-orange-600 bg-orange-600 focus-visible:ring-orange-500"
        : "text-emerald-600 bg-emerald-600 focus-visible:ring-emerald-500";
  return (
    <article
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        opacity: sortable.isDragging ? 0.3 : 1,
      }}
      className="group/card relative flex h-[294px] w-[224px] flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_12px_32px_-24px_rgba(15,23,42,.5)] dark:border-slate-700 dark:bg-slate-900"
    >
      <span className="pointer-events-none absolute -top-9 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100">
        {formatFileSize(item.file.size)}
      </span>
      <span className="absolute left-2 top-2 z-20 flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-950 px-1.5 text-[11px] font-semibold text-white">
        {index + 1}
      </span>
      <div className="absolute right-2 top-2 z-20 flex gap-1.5 md:opacity-0 md:group-hover/card:opacity-100 md:group-focus-within/card:opacity-100">
        {canRotate && (
          <button
            type="button"
            aria-label={__copy("Rotate {0}", [item.file.name])}
            onClick={onRotate}
            disabled={processing}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 dark:text-slate-300 shadow transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 dark:border-slate-700 dark:bg-slate-900",
              color.split(" ").at(-1),
            )}
          >
            <RotateCw className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          aria-label={__copy("Remove {0}", [item.file.name])}
          onClick={onRemove}
          disabled={processing}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 dark:text-slate-300 shadow transition hover:bg-red-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-slate-700 dark:bg-slate-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center pt-3">
        <div className="flex h-[208px] w-[152px] items-center justify-center bg-white shadow-[0_5px_16px_rgba(15,23,42,.18)] ring-1 ring-slate-200">
          <div
            className={cn(
              "flex flex-col items-center transition-transform",
              color.split(" ")[0],
            )}
            style={{ transform: `rotate(${item.rotation}deg)` }}
          >
            <span
              className={cn(
                "mb-2 rounded px-2 py-.5 text-[10px] font-bold tracking-wide text-white",
                color.split(" ")[1],
              )}
            >
              {extension}
            </span>
            <Icon className="h-14 w-14" strokeWidth={1.7} />
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
        <button
          type="button"
          {...sortable.attributes}
          {...sortable.listeners}
          disabled={processing}
          aria-label={__copy("Drag to reorder {0}", [item.file.name])}
          className={cn(
            "flex h-8 w-8 shrink-0 touch-none items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 dark:hover:bg-slate-800",
            color.split(" ").at(-1),
          )}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <p
          className="min-w-0 flex-1 truncate text-center text-sm font-medium text-slate-700 dark:text-slate-200"
          title={item.file.name}
        >
          {item.file.name}
        </p>
        <span className="h-8 w-8" />
      </div>
    </article>
  );
}

function SheetPicker({
  items,
  processing,
  onToggle,
  onToggleAll,
}: {
  items: Item[];
  processing: boolean;
  onToggle: (itemId: string, sheetName: string) => void;
  onToggleAll: (itemId: string, selected: boolean) => void;
}) {
  return (
    <div className="mt-5 min-h-0 space-y-4 overflow-y-auto rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
        <Sheet className="h-4 w-4 text-emerald-600" aria-hidden /> {""}<UiText text={"Sheets to include"} />{" "}</div>
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900"
        >
          <p
            className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200"
            title={item.file.name}
          >
            {item.file.name}
          </p>
          {item.inspecting ? (
            <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {""}<UiText text={"Reading workbook…"} />{" "}</p>
          ) : item.inspectionError ? (
            <p className="mt-3 text-xs leading-5 text-red-600">
              {item.inspectionError}
            </p>
          ) : (
            <>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => onToggleAll(item.id, true)}
                  className="text-[11px] font-semibold text-emerald-700 hover:underline disabled:opacity-50"
                >
                  {""}<UiText text={"Select all"} />{" "}</button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => onToggleAll(item.id, false)}
                  className="text-[11px] font-semibold text-slate-500 hover:underline disabled:opacity-50"
                >
                  {""}<UiText text={"Clear"} />{" "}</button>
              </div>
              <div className="mt-3 space-y-2">
                {item.sheets?.map(({ name: sheetName, hidden }) => (
                  <label
                    key={sheetName}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-700 transition hover:bg-emerald-50 dark:text-slate-200 dark:hover:bg-emerald-950/40"
                  >
                    <input
                      type="checkbox"
                      disabled={processing}
                      checked={
                        item.selectedSheets?.includes(sheetName) ?? false
                      }
                      onChange={() => onToggle(item.id, sheetName)}
                      className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
                    />
                    <span className="min-w-0 truncate" title={sheetName}>
                      {sheetName}{hidden && " (hidden)"}
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export function OfficeToPdfWorkspace({
  title,
  description,
  buttonLabel,
  dropLabel,
  accepted,
  extension,
  icon: Icon,
  accent,
  canRotate = false,
  convertsRotation = false,
  convert,
  inspectSheets,
  toolName,
  fidelityNote,
  templateSession,
  addButtonPosition = "bottom",
}: {
  title: string;
  description: string;
  buttonLabel: string;
  dropLabel: string;
  accepted: Accept;
  extension: string;
  icon: LucideIcon;
  accent: "orange" | "emerald" | "amber";
  canRotate?: boolean;
  convertsRotation?: boolean;
  convert: (
    file: File,
    onProgress: (value: number, label?: string) => void,
    cancelled: () => boolean,
    selectedSheets?: string[],
    rotation?: Rotation,
    preview?: boolean,
  ) => Promise<Blob | OfficeConvertedDocument>;
  inspectSheets?: (file: File) => Promise<SheetChoice[]>;
  toolName: string;
  fidelityNote: string;
  templateSession?: TemplateSession;
  addButtonPosition?: "top" | "bottom";
}) {
  const __copy = useWorkspaceText();
  const [items, setItems] = useState<Item[]>([]);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const { locale, t } = useToolCopy();
  const localizedFidelity = isConversionTool(toolName)
    ? conversionCopy(locale, toolName).limitations
    : fidelityNote;
  const itemsRef = useRef(items),
    inspectionGeneration = useRef(0),
    inspectionQueue = useRef(Promise.resolve());
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(
    () => () => {
      inspectionGeneration.current++;
    },
    [],
  );
  const batch = useOfficeBatch(
    items,
    toolName,
    async (item, progress, cancelled) => {
      if (item.inspecting)
        throw new Error("Please wait while this workbook's sheets are read.");
      if (item.inspectionError) throw new Error(item.inspectionError);
      if (inspectSheets && !item.selectedSheets?.length)
        throw new Error("Select at least one sheet from this workbook.");
      const rendered = await convert(
        item.file,
        (value, label) => progress(value, label),
        cancelled,
        item.selectedSheets,
        item.rotation,
        items.length === 1,
      );
      if (cancelled()) throw new Error("Conversion cancelled.");
      const document = rendered instanceof Blob ? { blob: rendered } : rendered;
      if (!convertsRotation && canRotate && item.rotation) {
        const bytes = await rotatePdf(
          new Uint8Array(await document.blob.arrayBuffer()),
          item.rotation,
        );
        if (cancelled()) throw new Error("Conversion cancelled.");
        return {
          ...document,
          blob: new Blob([bytes as BlobPart], { type: "application/pdf" }),
        };
      }
      return document;
    },
  );
  const { result, processing, progress, label, autoDownloadedRef } = batch;
  const backToFiles = batch.back;
  const clearAll = () => {
    inspectionGeneration.current++;
    itemsRef.current = [];
    setItems([]);
    setActiveId(null);
    batch.reset();
  };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const addFiles = useCallback(
    (files: File[]) => {
      let total = itemsRef.current.reduce(
          (sum, item) => sum + item.file.size,
          0,
        ),
        count = itemsRef.current.length;
      const extensions = Object.values(accepted)
          .flat()
          .map((x) => x.toLowerCase()),
        additions: Item[] = [];
      const notices: string[] = [];
      for (const file of files) {
        if (
          !file.size ||
          file.size > MAX_FILE_SIZE ||
          !extensions.some((ext) => file.name.toLowerCase().endsWith(ext))
        ) {
          notices.push(`Choose nonempty ${extension} files up to 100MB each.`);
          continue;
        }
        if (
          count >= OFFICE_BATCH_LIMITS.files ||
          total + file.size > OFFICE_BATCH_LIMITS.totalBytes
        ) {
          notices.push("Choose up to 20 documents and 200MB combined.");
          continue;
        }
        additions.push({
          id: crypto.randomUUID(),
          file,
          rotation: 0,
          inspecting: Boolean(inspectSheets),
        });
        total += file.size;
        count++;
      }
      if (notices.length) toast.error([...new Set(notices)].join(" "));
      if (!additions.length) return;
      itemsRef.current = [...itemsRef.current, ...additions];
      setItems(itemsRef.current);
      backToFiles();
      if (inspectSheets) {
        const generation = inspectionGeneration.current;
        inspectionQueue.current = inspectionQueue.current.then(async () => {
          for (const item of additions) {
            if (generation !== inspectionGeneration.current) break;
            if (!itemsRef.current.some((i) => i.id === item.id)) continue;
            try {
              const sheets = await inspectSheets(item.file);
              if (generation !== inspectionGeneration.current) break;
              setItems((current) =>
                current.map((entry) =>
                  entry.id === item.id
                    ? {
                        ...entry,
                        inspecting: false,
                        sheets,
                        selectedSheets: sheets.filter(sheet => !sheet.hidden).map(sheet => sheet.name),
                      }
                    : entry,
                ),
              );
            } catch (error) {
              if (generation !== inspectionGeneration.current) break;
              const message =
                error instanceof Error
                  ? error.message
                  : "Could not read this workbook.";
              setItems((current) =>
                current.map((entry) =>
                  entry.id === item.id
                    ? { ...entry, inspecting: false, inspectionError: message }
                    : entry,
                ),
              );
            }
          }
        });
      }
    },
    [accepted, extension, inspectSheets, backToFiles],
  );
  const rejected = useCallback(
    (entries: FileRejection[]) =>
      toast.error(
        entries.some((entry) =>
          entry.errors.some((error) => error.code === "file-too-large"),
        )
          ? "Each file must be 100MB or smaller."
          : `Please choose ${extension} files.`,
      ),
    [extension],
  );
  const dropzone = useDropzone({
    accept: accepted,
    multiple: true,
    maxSize: MAX_FILE_SIZE,
    noClick: true,
    disabled: processing,
    onDropAccepted: addFiles,
    onDropRejected: rejected,
  });
  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.file.size, 0),
    [items],
  );
  const toggleSheet = (itemId: string, sheetName: string) =>
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) return item;
        const selected = new Set(item.selectedSheets ?? []);
        if (selected.has(sheetName)) selected.delete(sheetName);
        else selected.add(sheetName);
        return {
          ...item,
          selectedSheets:
            item.sheets?.filter(sheet => selected.has(sheet.name)).map(sheet => sheet.name) ?? [],
        };
      }),
    );
  const toggleAllSheets = (itemId: string, selected: boolean) =>
    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              selectedSheets: selected ? (item.sheets ?? []).map(sheet => sheet.name) : [],
            }
          : item,
      ),
    );
  const sort = (direction: "asc" | "desc") =>
    setItems((current) => {
      const ordered = sortFilesByName(
        current.map((item) => item.file),
        direction,
      );
      const positions = new Map(ordered.map((file, index) => [file, index]));
      return [...current].sort(
        (a, b) => (positions.get(a.file) ?? 0) - (positions.get(b.file) ?? 0),
      );
    });
  const download = useCallback(() => {
    if (result) downloadBlob(result.blob, result.filename);
  }, [result]);
  const convertAll = () => {
    if (items.some((item) => item.inspecting)) {
      toast.error(__copy("Please wait while workbook sheets are read."));
      return;
    }
    void batch.run();
  };
  if (!items.length && !result && templateSession)
    return (
      <TemplateFilePicker
        session={templateSession}
        accept={accepted}
        label={__copy("Choose {0} files", [extension])}
        onFiles={addFiles}
      />
    );
  if (!items.length && !result)
    return (
      <PdfToolLanding
        title={title}
        description={description}
        buttonLabel={buttonLabel}
        dropLabel={dropLabel}
        limitLabel={__copy("20 files · 100MB each · 200MB combined")}
        accept={accepted}
        multiple
        icon={Icon}
        iconClass={
          accent === "amber"
            ? "text-blue-700"
            : accent === "orange"
              ? "text-orange-600"
              : "text-emerald-600"
        }
        iconBackgroundClass={
          accent === "amber"
            ? "bg-amber-100"
            : accent === "orange"
              ? "bg-orange-100"
              : "bg-emerald-100"
        }
        accent={accent}
        onFilesSelected={addFiles}
      />
    );
  if (result)
    return (
      <PdfToolResultLayout toolSlug={toolName}>
        <div data-clarity-mask="True">
          {result.omitted > 0 && (
            <p
              role="alert"
              className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
            >
              {""}<UiText text={"Partial download:"} />{" "}{result.count} {""}<UiText text={"of"} />{" "}{items.length} {""}<UiText text={"PDFs included."} />{""}{" "}
              {result.omitted} {""}<UiText text={"unfinished"} />{""}{" "}
              {result.omitted === 1 ? <UiText text={"file is"} /> : <UiText text={"files are"} />} {""}<UiText text={"omitted. Return to files to review errors or retry."} />{" "}</p>
          )}
          <ResultState
            resultFilename={result.filename}
            fileSize={formatFileSize(result.blob.size)}
            onDownload={download}
            onStartOver={clearAll}
            autoDownloadedRef={autoDownloadedRef}
            downloadLabel={
              result.count > 1 ? "Download ZIP again" : "Download PDF again"
            }
          />
          <div className="my-5 text-center">
            <Button variant="outline" onClick={batch.back}>
              {""}<UiText text={"Back to files"} />{" "}</Button>
          </div>
          {result.pagePreviews && (
            <details className="my-6 rounded-xl border p-4">
              <summary className="cursor-pointer font-medium">
                {""}<UiText text={"Preview all"} />{" "}{result.pagePreviews.length} {""}<UiText text={"pages before sharing"} />{" "}</summary>
              <p className="my-3 text-sm text-muted-foreground">
                {""}<UiText text={"These are the pages included in your PDF. Text is image-based, not searchable. Review fonts and page breaks before sharing."} />{" "}</p>
              <div className="grid gap-6">
                {result.pagePreviews.map((src, index) => (
                  <figure key={index}>
                    <figcaption className="mb-2 text-sm text-muted-foreground">
                      {""}<UiText text={"Page"} />{" "}{index + 1}
                    </figcaption>
                    {/* eslint-disable-next-line @next/next/no-img-element -- private local conversion preview */}
                    <img
                      src={src}
                      alt={__copy("Converted document page {0}", [index + 1])}
                      className="mx-auto h-auto max-w-full bg-white shadow"
                    />
                  </figure>
                ))}
              </div>
            </details>
          )}
        </div>
        <p className="mx-auto max-w-xl border-t pt-5 text-center text-sm leading-6 text-muted-foreground">
          {result.count > 1 ? <UiText text={"{0} PDFs are bundled in one download."} values={[result.count]} /> : <UiText text={"Your download started automatically."} />}{" "}
          {localizedFidelity}
        </p>
      </PdfToolResultLayout>
    );
  const active = items.find((item) => item.id === activeId);
  return (
    <div
      className="flex flex-1 flex-col bg-slate-50/70 dark:bg-slate-950/40"
      data-clarity-mask="True"
    >
      <PdfWorkspaceBar
        title={title}
        embedded={Boolean(templateSession)}
        meta={`${items.length} file${items.length === 1 ? "" : "s"} · ${formatFileSize(total)} · ${batch.ready.length} ready`}
        actions={
          <>
            <button
              type="button"
              onClick={() => sort("asc")}
              disabled={processing}
              className="rounded-lg p-2 text-slate-500 dark:text-slate-300 hover:bg-muted hover:text-foreground disabled:opacity-50"
              aria-label={__copy("Sort files A to Z")}
            >
              <ArrowDownAZ className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => sort("desc")}
              disabled={processing}
              className="rounded-lg p-2 text-slate-500 dark:text-slate-300 hover:bg-muted hover:text-foreground disabled:opacity-50"
              aria-label={__copy("Sort files Z to A")}
            >
              <ArrowUpZA className="h-5 w-5" />
            </button>
            <Button
              variant="ghost"
              size="sm"
              disabled={processing}
              onClick={clearAll}
            >
              {""}<UiText text={"Clear"} />{" "}</Button>
          </>
        }
      />
      <div
        {...dropzone.getRootProps()}
        className="container mx-auto flex w-full max-w-[1500px] flex-1 flex-col px-4 py-6"
      >
        <input {...dropzone.getInputProps()} />
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0">
            {addButtonPosition === "top" && (
              <div
                className="flex justify-end px-3 pt-2"
                data-testid="office-add-files-toolbar"
              >
                <PdfAddButton cloud={{ accept: accepted, multiple: true, onFilesSelected: addFiles }}
                  count={items.length}
                  label={__copy("Add more files")}
                  accent={accent}
                  disabled={processing}
                  onClick={dropzone.open}
                />
              </div>
            )}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={(event: DragStartEvent) =>
                setActiveId(event.active.id)
              }
              onDragEnd={(event: DragEndEvent) => {
                if (event.over && event.active.id !== event.over.id)
                  setItems((current) =>
                    arrayMove(
                      current,
                      current.findIndex((item) => item.id === event.active.id),
                      current.findIndex((item) => item.id === event.over?.id),
                    ),
                  );
                setActiveId(null);
              }}
              onDragCancel={() => setActiveId(null)}
            >
              <SortableContext
                items={items.map((item) => item.id)}
                strategy={rectSortingStrategy}
              >
                <div className="flex flex-wrap justify-center gap-4 py-7 sm:justify-start">
                  {items.map((item, index) => (
                    <Card
                      key={item.id}
                      item={item}
                      index={index}
                      processing={processing}
                      Icon={Icon}
                      extension={item.file.name.split(".").at(-1)?.toUpperCase() || extension}
                      accent={accent}
                      canRotate={canRotate}
                      onRotate={() =>
                        setItems((current) =>
                          current.map((entry) =>
                            entry.id === item.id
                              ? {
                                  ...entry,
                                  rotation: ((entry.rotation + 90) %
                                    360) as Rotation,
                                }
                              : entry,
                          ),
                        )
                      }
                      onRemove={() =>
                        setItems((current) =>
                          current.filter((entry) => entry.id !== item.id),
                        )
                      }
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {active ? (
                  <div className="h-[294px] w-[224px] rounded-2xl border bg-card shadow-2xl" />
                ) : null}
              </DragOverlay>
            </DndContext>
            {addButtonPosition === "bottom" && (
              <div className="mt-3 flex justify-center px-8 pb-12 lg:justify-start">
                <PdfAddButton cloud={{ accept: accepted, multiple: true, onFilesSelected: addFiles }}
                  count={items.length}
                  label={__copy("Add more files")}
                  accent={accent}
                  disabled={processing}
                  onClick={dropzone.open}
                />
              </div>
            )}
          </section>
          <aside className="flex min-h-[310px] min-w-0 flex-col rounded-3xl border bg-white p-6 shadow-sm dark:bg-slate-900 lg:sticky lg:top-24 lg:self-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-400">
                {t("Ready to convert")}
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight">
                {t(title)}
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {localizedFidelity}
              </p>
            </div>
            {inspectSheets && (
              <SheetPicker
                items={items}
                processing={processing}
                onToggle={toggleSheet}
                onToggleAll={toggleAllSheets}
              />
            )}
            <div
              className="mt-5 max-h-[45vh] space-y-2 overflow-y-auto"
              aria-label={__copy("File conversion status")}
            >
              {items.map((item) => {
                const ready =
                  batch.completed[item.id]?.key === officeItemKey(item)
                    ? batch.completed[item.id]
                    : undefined;
                const error =
                  batch.errors[item.id]?.key === officeItemKey(item)
                    ? batch.errors[item.id].message
                    : undefined;
                return (
                  <div key={item.id} className="rounded-xl border p-3 text-xs">
                    <p className="break-words font-semibold">
                      {item.file.name}
                    </p>
                    {ready ? (
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-emerald-700">
                          {""}<UiText text={"Ready ·"} />{" "}{formatFileSize(ready.blob.size)}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={processing}
                          onClick={() => downloadBlob(ready.blob, ready.name)}
                          aria-label={__copy("Download {0}", [ready.name])}
                        >
                          {""}<UiText text={"Download PDF"} />{" "}</Button>
                      </div>
                    ) : error ? (
                      <p
                        role="alert"
                        className="mt-2 whitespace-pre-wrap break-words text-red-700 dark:text-red-300"
                      >
                        {<UiText text={error} />}
                      </p>
                    ) : (
                      <p className="mt-2 text-muted-foreground">
                        {item.inspecting ? <UiText text={"Reading sheets…"} /> : item.inspectionError ? <UiText text={"Review workbook error below."} /> : <UiText text={"Not converted yet"} />}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-6 flex-1">
              {processing && (
                <ProcessingState
                  progress={progress}
                  label={label}
                  onCancel={batch.cancel}
                />
              )}
              {batch.message && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm leading-6 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
                >
                  {batch.message}
                </p>
              )}
            </div>
            <Button
              size="lg"
              disabled={processing || items.some((item) => item.inspecting)}
              onClick={convertAll}
              className={cn(
                "mt-6 min-h-14 w-full shrink-0 text-base font-bold text-white",
                accent === "amber"
                  ? "bg-slate-950 hover:bg-amber-500 hover:text-slate-950 dark:bg-amber-500 dark:text-slate-950"
                  : accent === "orange"
                    ? "bg-orange-600 hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-700"
                    : "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700",
              )}
            >
              <FileOutput className="mr-2 h-5 w-5" />
              {batch.pending === 0 ? <UiText text={"Download ready PDFs"} /> : batch.ready.length ? <UiText text={"Retry {0} unfinished {1}"} values={[batch.pending, batch.pending === 1 ? "file" : "files"]} /> : t("Convert to PDF")}
            </Button>
            {batch.ready.length > 0 && batch.pending > 0 && (
              <Button
                variant="outline"
                className="mt-3 min-h-12 w-full"
                disabled={processing}
                onClick={() => void batch.downloadReady()}
              >
                {""}<UiText text={"Download"} />{" "}{batch.ready.length} {""}<UiText text={"ready"} />{""}{" "}
                {batch.ready.length === 1 ? "PDF" : <UiText text={"PDFs"} />}
              </Button>
            )}
            <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
              {""}<UiText text={"20 files · 100MB each · 200MB combined input and completed PDFs. Files stay on your device."} />{" "}</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
