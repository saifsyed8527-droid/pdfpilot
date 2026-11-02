"use client";

import { useEffect, useRef, useState } from "react";
import { Code2, Copy, FileSpreadsheet, Link2, X } from "lucide-react";
import { toast } from "sonner";
import { ToolFaqAccordion } from "./ToolFaqAccordion";
import { RelatedTools } from "./RelatedTools";
import { getCrossSellTools } from "@/lib/cross-sell";
import type { FaqInput } from "@/lib/seo";
import {
  PdfAddButton,
  PdfToolLanding,
  PdfToolResultLayout,
  PdfWorkspaceBar,
} from "./PdfToolChrome";
import { ProcessingState } from "./ProcessingState";
import { ResultState } from "./ResultState";
import { downloadBlob } from "@/lib/download-file";
import { formatFileSize } from "@/lib/utils";
import { useProcessingTask } from "@/lib/use-processing-task";
import {
  inspectXml,
  readTableFile,
  xmlTable,
  parseDelimited,
  tableXml,
  type XmlInspection,
  type TableData,
  type XmlLayout,
} from "@/lib/engines/xml-table-engine";
import { exportTableWorker } from "@/lib/engines/xml-table-worker-client";
import { tableBaseName } from "@/lib/engines/xml-table-engine";

type Mode = "xml-to-excel" | "xml-to-csv" | "csv-to-xml";
type Source = {
  name: string;
  text: string;
  size: number;
  inspection?: XmlInspection;
};
type Result = {
  blob: Blob;
  filename: string;
  rows: number;
  columns: number;
  warnings: string[];
  text?: string;
};
const field =
  "mt-2 w-full min-w-0 rounded-xl border border-slate-300 bg-white p-3 text-sm font-normal dark:border-slate-700 dark:bg-slate-950";
const note =
  "rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100";
const secondary =
  "rounded-xl border bg-background px-4 py-2 text-sm font-medium disabled:opacity-50";
function Delimiter({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <select
        className={field}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value=",">Comma (,)</option>
        <option value=";">Semicolon (;)</option>
        <option value={"\t"}>Tab</option>
        <option value="|">Pipe (|)</option>
      </select>
    </label>
  );
}
function DataPreview({ data }: { data: TableData }) {
  const [columnStart, setColumnStart] = useState(0);
  useEffect(() => setColumnStart(0), [data]);
  return (
    <>
      <div className="max-h-[520px] overflow-auto rounded-xl border">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900">
            <tr>
              {data.rows[0]
                .slice(columnStart, columnStart + 12)
                .map((value, i) => (
                  <th
                    key={i}
                    className="min-w-32 max-w-64 break-words border-b p-3"
                    dir="auto"
                  >
                    {value}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.slice(1, 21).map((row, i) => (
              <tr key={i}>
                {row.slice(columnStart, columnStart + 12).map((value, j) => (
                  <td
                    key={j}
                    className="max-w-64 whitespace-pre-wrap break-words border-b p-3 align-top"
                    dir="auto"
                  >
                    {value.length > 500 ? value.slice(0, 500) + "…" : value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {data.rows.length - 1} rows · {data.rows[0].length} columns. Preview
        shows the first 20 rows; long cells are shortened here only.
      </p>
      {data.rows[0].length > 12 && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <button
            className={secondary}
            disabled={!columnStart}
            onClick={() => setColumnStart((v) => Math.max(0, v - 12))}
          >
            Previous columns
          </button>
          <span>
            Columns {columnStart + 1}–
            {Math.min(columnStart + 12, data.rows[0].length)} of{" "}
            {data.rows[0].length}
          </span>
          <button
            className={secondary}
            disabled={columnStart + 12 >= data.rows[0].length}
            onClick={() => setColumnStart((v) => v + 12)}
          >
            Next columns
          </button>
        </div>
      )}
    </>
  );
}

export function StructuredDataWorkspace({
  mode,
  faqs,
}: {
  mode: Mode;
  faqs: FaqInput[];
}) {
  const csvInput = mode === "csv-to-xml",
    excel = mode === "xml-to-excel",
    inputType = csvInput ? "CSV" : "XML",
    outputType = csvInput ? "XML" : excel ? "Excel" : "CSV",
    title = `${inputType} to ${outputType}`;
  const [source, setSource] = useState<Source | null>(null),
    [reading, setReading] = useState(false),
    [error, setError] = useState<string | null>(null),
    [result, setResult] = useState<Result | null>(null),
    [preview, setPreview] = useState<TableData | null>(null),
    [xmlPreview, setXmlPreview] = useState("");
  const [layout, setLayout] = useState<XmlLayout>("table"),
    [recordPath, setRecordPath] = useState(""),
    [parents, setParents] = useState(false),
    [repeated, setRepeated] = useState<"columns" | "json">("columns"),
    [alphabetical, setAlphabetical] = useState(false),
    [epochDates, setEpochDates] = useState(false);
  const [format, setFormat] = useState<"xlsx" | "xls">("xlsx"),
    [delimiter, setDelimiter] = useState(","),
    [bom, setBom] = useState(true),
    [protectFormulas, setProtectFormulas] = useState(true),
    [header, setHeader] = useState(true),
    [root, setRoot] = useState("rows"),
    [rowName, setRowName] = useState("row");
  const [pasteOpen, setPasteOpen] = useState(false),
    [paste, setPaste] = useState(""),
    [urlOpen, setUrlOpen] = useState(false),
    [url, setUrl] = useState(""),
    [urlError, setUrlError] = useState(""),
    [importing, setImporting] = useState(false),
    [label, setLabel] = useState("Reading document…");
  const inputRef = useRef<HTMLInputElement | null>(null),
    dialogRef = useRef<HTMLDialogElement | null>(null),
    job = useRef<AbortController | null>(null),
    generation = useRef(0),
    downloaded = useRef(false);
  const { processing, progress, run, cancel } = useProcessingTask(),
    busy = reading || processing || importing;
  const stop = () => {
    generation.current++;
    job.current?.abort();
    job.current = null;
    cancel();
    setReading(false);
    setImporting(false);
  };
  useEffect(
    () => () => {
      generation.current++;
      job.current?.abort();
      cancel();
    },
    [cancel],
  );
  useEffect(() => {
    if (urlOpen) dialogRef.current?.showModal();
  }, [urlOpen]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [source, result]);
  useEffect(() => {
    setPreview(null);
    setXmlPreview("");
    setError(null);
  }, [
    layout,
    recordPath,
    parents,
    repeated,
    alphabetical,
    epochDates,
    format,
    delimiter,
    bom,
    protectFormulas,
    header,
    root,
    rowName,
  ]);
  const clear = () => {
    stop();
    setSource(null);
    setResult(null);
    setPreview(null);
    setXmlPreview("");
    setError(null);
    downloaded.current = false;
  };
  async function choose(files: File[]) {
    const file = files[0];
    if (!file) return;
    stop();
    const id = ++generation.current,
      controller = new AbortController();
    job.current = controller;
    setReading(true);
    setError(null);
    setResult(null);
    setPreview(null);
    setXmlPreview("");
    try {
      const text = await readTableFile(file, controller.signal);
      if (id !== generation.current) return;
      const next: Source = { name: file.name, text, size: file.size };
      setSource(next);
      if (!csvInput) {
        const inspection = await inspectXml(text, controller.signal);
        if (id !== generation.current) return;
        next.inspection = inspection;
        setSource({ ...next });
        setRecordPath(inspection.suggestedPath);
      }
      setPasteOpen(false);
      setPaste("");
      downloaded.current = false;
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not read this document.",
        );
    } finally {
      if (id === generation.current) {
        setReading(false);
        if (job.current === controller) job.current = null;
      }
    }
  }
  function convert(previewOnly = false) {
    if (!source || busy) return;
    const controller = new AbortController();
    job.current = controller;
    setError(null);
    downloaded.current = false;
    run(
      async (setProgress, isCancelled) => {
        try {
          setLabel("Building output preview…");
          setProgress(5);
          if (csvInput) {
            const rows = await parseDelimited(
              source.text,
              delimiter,
              controller.signal,
            );
            setProgress(40);
            const converted = await tableXml(rows, {
              header,
              root,
              row: rowName,
              signal: controller.signal,
            });
            if (isCancelled() || controller.signal.aborted) return;
            const previewRows = [
              converted.mapping.map((m) => m.name),
              ...(header ? rows.slice(1) : rows),
            ];
            setPreview({ rows: previewRows, warnings: [], convertedDates: 0 });
            setXmlPreview(converted.text.slice(0, 100_000));
            if (!previewOnly) {
              const changed = converted.mapping.filter(
                (m) => m.source !== m.name,
              );
              setResult({
                blob: new Blob([converted.text], {
                  type: "application/xml;charset=utf-8",
                }),
                filename: tableBaseName(source.name) + ".xml",
                rows: converted.rows,
                columns: converted.mapping.length,
                ...(converted.text.length <= 1_000_000
                  ? { text: converted.text }
                  : {}),
                warnings: [
                  "Generic row/field XML. This does not target an accounting or ERP schema.",
                  ...(changed.length
                    ? [
                        `${changed.length} column names were made unique or XML-safe. Their original names are kept in each field’s column attribute.`,
                      ]
                    : []),
                ],
              });
            }
          } else {
            const inspection =
              source.inspection ??
              (await inspectXml(source.text, controller.signal));
            const table = await xmlTable(inspection, {
              layout,
              recordPath,
              parents,
              repeated,
              alphabetical,
              epochDates,
              signal: controller.signal,
            });
            setProgress(60);
            if (isCancelled() || controller.signal.aborted) return;
            setPreview(table);
            if (!previewOnly) {
              setLabel("Preparing download…");
              const output = await exportTableWorker(table, {
                format: excel ? format : "csv",
                delimiter,
                bom,
                protectFormulas,
                name: source.name,
                signal: controller.signal,
              });
              if (isCancelled() || controller.signal.aborted) return;
              setResult({
                ...output,
                rows: table.rows.length - 1,
                columns: table.rows[0].length,
                warnings: [
                  ...table.warnings,
                  ...(output.protectedCells
                    ? [
                        `${output.protectedCells} formula-like CSV cells start with an apostrophe for spreadsheet safety.`,
                      ]
                    : []),
                  ...(!excel
                    ? [
                        "CSV readers may infer numbers and dates. Use XML to Excel to preserve cell values as text.",
                      ]
                    : []),
                ],
                ...(!excel && output.blob.size <= 2 * 1024 * 1024
                  ? { text: await output.blob.text() }
                  : {}),
              });
            }
          }
          setProgress(100);
        } finally {
          if (job.current === controller) job.current = null;
        }
      },
      {
        toolName: mode,
        successMessage: previewOnly
          ? "Preview ready"
          : "Your converted file is ready",
        errorTitle: "Could not convert this document",
        onError: (cause) => {
          const message =
            cause instanceof Error
              ? cause.message
              : "Check the input and try again.";
          setError(message);
          return message;
        },
      },
    );
  }
  async function importUrl(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const controller = new AbortController();
    job.current = controller;
    setImporting(true);
    setUrlError("");
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch("/api/data-table/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, format: inputType.toLowerCase() }),
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(
          (await response.json()).error || "Could not import this URL.",
        );
      const name =
        /filename="([^"]+)"/.exec(
          response.headers.get("content-disposition") ?? "",
        )?.[1] || `imported.${inputType.toLowerCase()}`;
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      setUrlOpen(false);
      setUrl("");
      await choose([new File([blob], name)]);
    } catch (cause) {
      if (!controller.signal.aborted)
        setUrlError(
          cause instanceof Error ? cause.message : "Could not import this URL.",
        );
      else setUrlError("Import cancelled or timed out. You can try again.");
    } finally {
      clearTimeout(timeout);
      setImporting(false);
      if (job.current === controller) job.current = null;
    }
  }
  const dialogs = urlOpen && (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        if (importing) stop();
        setUrlOpen(false);
      }}
      className="m-auto w-[min(520px,calc(100%-2rem))] rounded-3xl border bg-background p-6 text-foreground shadow-xl backdrop:bg-black/50"
      aria-label={`Import ${inputType} from URL`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Import {inputType} from URL</h2>
        <button
          className={secondary}
          aria-label="Close import dialog"
          onClick={() => {
            if (importing) stop();
            setUrlOpen(false);
          }}
        >
          <X size={18} />
        </button>
      </div>
      <form onSubmit={importUrl} className="space-y-4">
        <label className="block text-sm font-medium">
          Public download URL
          <input
            type="url"
            required
            maxLength={2048}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={importing}
            className={field}
            placeholder={`https://example.com/data.${inputType.toLowerCase()}`}
          />
        </label>
        <p className="text-xs leading-5 text-muted-foreground">
          Direct public files up to 4MB. PDFPilot’s server fetches this URL;
          conversion happens on your device. For private cloud files, download
          them and use Select file.
        </p>
        {urlError && (
          <p role="alert" className="text-sm text-red-600">
            {urlError}
          </p>
        )}
        <button type="submit" className={secondary} disabled={importing}>
          {importing ? "Importing…" : "Import file"}
        </button>
      </form>
    </dialog>
  );
  const showPaste = (
    <div className="mx-auto my-6 w-full max-w-2xl px-4">
      <div className="flex flex-wrap justify-center gap-3">
        <button
          className={secondary}
          disabled={busy}
          onClick={() => setPasteOpen((v) => !v)}
        >
          Paste {inputType}
        </button>
        <button
          className={secondary + " inline-flex items-center gap-2"}
          disabled={busy}
          onClick={() => {
            setUrlError("");
            setUrlOpen(true);
          }}
        >
          <Link2 size={16} />
          Import from URL
        </button>
      </div>
      {pasteOpen && (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void choose([
              new File([paste], `pasted.${inputType.toLowerCase()}`),
            ]);
          }}
        >
          <label className="block text-sm font-medium">
            {inputType} text
            <textarea
              className={field + " min-h-48 font-mono"}
              value={paste}
              maxLength={8 * 1024 * 1024}
              onChange={(e) => setPaste(e.target.value)}
              disabled={busy}
              spellCheck={false}
            />
          </label>
          <button
            type="submit"
            className={secondary}
            disabled={busy || !paste.trim()}
          >
            Use pasted text
          </button>
        </form>
      )}
    </div>
  );
  const errorBox = error && (
    <p
      role="alert"
      className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm leading-6 text-red-800 dark:bg-red-950 dark:text-red-100"
    >
      {error}
    </p>
  );
  if (result)
    return (
      <>
        {dialogs}
        <PdfToolResultLayout
          toolSlug={mode}
          showRelated={false}
          showTrust={false}
        >
          <ResultState
            resultFilename={result.filename}
            fileSize={formatFileSize(result.blob.size)}
            onDownload={() => downloadBlob(result.blob, result.filename)}
            downloadLabel={`Download ${csvInput ? "XML" : excel ? format.toUpperCase() : "CSV"}`}
            onStartOver={clear}
            autoDownloadedRef={downloaded}
          />
          <div className="mx-auto max-w-3xl space-y-4 px-4">
            <p className={note}>
              {result.rows} data rows · {result.columns} columns. Your file was
              converted on this device.
            </p>
            <details className="rounded-xl border p-4">
              <summary className="cursor-pointer text-sm font-medium">
                Conversion details
              </summary>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                {result.warnings.map((message, i) => (
                  <li key={i}>{message}</li>
                ))}
              </ul>
            </details>
            {preview && (
              <details className="rounded-xl border p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  Preview converted data
                </summary>
                <div className="mt-4">
                  <DataPreview data={preview} />
                </div>
              </details>
            )}
            {csvInput && (
              <details className="rounded-xl border p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  Preview XML
                </summary>
                <pre className="mt-4 max-h-80 overflow-auto whitespace-pre text-xs">
                  {xmlPreview}
                </pre>
                <p className="mt-2 text-xs text-muted-foreground">
                  Preview up to 100,000 characters. Download includes the full
                  output.
                </p>
              </details>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                className={secondary}
                onClick={() => {
                  setResult(null);
                  downloaded.current = false;
                }}
              >
                Back to options
              </button>
              {result.text && (
                <button
                  className={secondary + " inline-flex items-center gap-2"}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(result.text!);
                      toast.success("Converted text copied");
                    } catch {
                      toast.error(
                        "Copy was unavailable. Download the file instead.",
                      );
                    }
                  }}
                >
                  <Copy size={16} />
                  Copy {outputType}
                </button>
              )}
            </div>
          </div>
        </PdfToolResultLayout>
        <div className="mx-auto max-w-4xl px-4 pb-8">
          <RelatedTools
            title="Continue with your file"
            tools={getCrossSellTools(mode)}
          />
        </div>
      </>
    );
  if (!source)
    return (
      <>
        {dialogs}
        <PdfToolLanding
          title={title}
          description={
            csvInput
              ? "Turn CSV rows into XML with unique column names, a preview and a free download."
              : "Turn nested XML, attributes and repeated records into a readable table. Choose your layout and preview before downloading."
          }
          buttonLabel={`Select ${inputType} file`}
          dropLabel={`or drop ${inputType} here`}
          limitLabel="Up to 8MB"
          accept={
            csvInput
              ? { "text/csv": [".csv", ".tsv", ".txt"] }
              : { "application/xml": [".xml"], "text/xml": [".xml"] }
          }
          multiple={false}
          icon={csvInput ? Code2 : FileSpreadsheet}
          iconClass="text-emerald-600"
          iconBackgroundClass="bg-emerald-100 dark:bg-emerald-950/30"
          accent="emerald"
          onFilesSelected={choose}
        />
        {showPaste}
        <div className="mx-auto max-w-2xl px-4">
          <ToolFaqAccordion faqs={faqs} />
        </div>
        <div className="mx-auto max-w-2xl space-y-4 px-4">
          {reading && (
            <ProcessingState
              progress={0}
              label="Reading document…"
              onCancel={stop}
            />
          )}
          {errorBox}
          <p className="py-6 text-sm leading-6 text-muted-foreground">
            Local files and pasted text stay on your device.{" "}
            {csvInput
              ? "Quoted commas, escaped quotes, multiline values and Unicode are supported. XML names are made unique and original headers are retained when changed."
              : "XML is checked before conversion. Nested elements, attributes, namespaces and fields introduced in later records are retained in the selected layout. Malformed XML is rejected; DTDs and custom entities are not loaded."}
          </p>
        </div>
      </>
    );
  return (
    <>
      {dialogs}
      <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950">
        <PdfWorkspaceBar
          title={title}
          meta={`${source.name} · ${formatFileSize(source.size)}`}
          actions={
            <>
              <PdfAddButton
                onClick={() => inputRef.current?.click()}
                accent="emerald"
                label={`Replace ${inputType} file`}
                disabled={busy}
              />
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept={csvInput ? ".csv,.tsv,.txt" : ".xml"}
                disabled={busy}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  void choose(files);
                }}
              />
            </>
          }
        />
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_390px]">
          <section className="min-w-0 space-y-4 rounded-3xl border bg-background p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                {preview ? "Output preview" : `Original ${inputType}`}
              </h2>
              <button
                className={secondary}
                disabled={busy}
                onClick={clear}
                aria-label={`Remove ${inputType}`}
              >
                <X size={18} />
              </button>
            </div>
            {preview ? (
              <DataPreview data={preview} />
            ) : (
              <pre
                className="max-h-[520px] overflow-auto whitespace-pre rounded-xl bg-muted/50 p-4 font-mono text-xs leading-6"
                dir="auto"
              >
                {source.text.slice(0, 8000)}
              </pre>
            )}
            {!preview && (
              <p className="text-xs text-muted-foreground">
                Source preview shows the first 8,000 characters. Conversion uses
                the complete file.
              </p>
            )}
            {csvInput && xmlPreview && (
              <details className="rounded-xl border p-4" open>
                <summary className="cursor-pointer text-sm font-medium">
                  XML preview
                </summary>
                <pre className="mt-3 max-h-80 overflow-auto text-xs">
                  {xmlPreview}
                </pre>
              </details>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                className={secondary}
                disabled={busy}
                onClick={() => convert(true)}
              >
                Preview output
              </button>
              {preview && (
                <button
                  className={secondary}
                  disabled={busy}
                  onClick={() => {
                    setPreview(null);
                    setXmlPreview("");
                  }}
                >
                  Show source
                </button>
              )}
            </div>
            {preview &&
              preview.warnings.map((message, i) => (
                <p className="text-xs leading-5 text-muted-foreground" key={i}>
                  {message}
                </p>
              ))}
          </section>
          <aside className="min-w-0 self-start rounded-3xl border bg-background p-5 shadow-sm lg:sticky lg:top-20">
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mb-6 mt-2 text-sm text-muted-foreground">
              Choose how your data appears
            </p>
            <fieldset disabled={busy} className="space-y-5 disabled:opacity-60">
              {csvInput ? (
                <>
                  <Delimiter
                    value={delimiter}
                    onChange={setDelimiter}
                    label="Input delimiter"
                  />
                  <label className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={header}
                      onChange={(e) => setHeader(e.target.checked)}
                    />
                    First row contains column names
                  </label>
                  <label className="block text-sm font-medium">
                    Root element
                    <input
                      className={field}
                      value={root}
                      onChange={(e) => setRoot(e.target.value)}
                      maxLength={80}
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Row element
                    <input
                      className={field}
                      value={rowName}
                      onChange={(e) => setRowName(e.target.value)}
                      maxLength={80}
                    />
                  </label>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Empty lines are skipped. Short rows get empty cells; extra
                    columns receive generated names. Duplicate headers keep
                    separate columns.
                  </p>
                </>
              ) : (
                <>
                  <label className="block text-sm font-medium">
                    Output layout
                    <select
                      className={field}
                      value={layout}
                      onChange={(e) => setLayout(e.target.value as XmlLayout)}
                    >
                      <option value="table">
                        Table · one column per field
                      </option>
                      <option value="key-value">
                        Key / Value · paths and values
                      </option>
                      <option value="elements">One row per element</option>
                      <option value="levels">
                        Nested levels · separate path columns
                      </option>
                    </select>
                  </label>
                  {layout === "table" && (
                    <>
                      <label className="block text-sm font-medium">
                        Record path
                        <select
                          className={field}
                          value={recordPath}
                          onChange={(e) => setRecordPath(e.target.value)}
                        >
                          {source.inspection?.paths.map((p) => (
                            <option key={p.path} value={p.path}>
                              {p.path} · {p.count} records
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm font-medium">
                        Repeated child items
                        <select
                          className={field}
                          value={repeated}
                          onChange={(e) =>
                            setRepeated(e.target.value as typeof repeated)
                          }
                        >
                          <option value="columns">
                            Separate indexed columns
                          </option>
                          <option value="json">
                            Keep together as JSON in one cell
                          </option>
                        </select>
                      </label>
                      <label className="flex items-start gap-3 text-sm">
                        <input
                          className="mt-1"
                          type="checkbox"
                          checked={parents}
                          onChange={(e) => setParents(e.target.checked)}
                        />
                        <span>
                          Copy parent values
                          <span className="mt-1 block text-xs text-muted-foreground">
                            Ancestor attributes and direct leaf fields
                          </span>
                        </span>
                      </label>
                      <label className="flex items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={alphabetical}
                          onChange={(e) => setAlphabetical(e.target.checked)}
                        />
                        Sort columns A to Z
                      </label>
                    </>
                  )}
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      className="mt-1"
                      type="checkbox"
                      checked={epochDates}
                      onChange={(e) => setEpochDates(e.target.checked)}
                    />
                    <span>
                      Convert epoch timestamps to dates
                      <span className="mt-1 block text-xs text-muted-foreground">
                        10/13-digit values → UTC yyyy-mm-dd. This can also
                        change numeric IDs.
                      </span>
                    </span>
                  </label>
                  {excel ? (
                    <label className="block text-sm font-medium">
                      Excel format
                      <select
                        className={field}
                        value={format}
                        onChange={(e) =>
                          setFormat(e.target.value as typeof format)
                        }
                      >
                        <option value="xlsx">
                          XLSX · Excel 2007 and later
                        </option>
                        <option value="xls">XLS · Excel 97–2003</option>
                      </select>
                    </label>
                  ) : (
                    <>
                      <Delimiter
                        value={delimiter}
                        onChange={setDelimiter}
                        label="Output delimiter"
                      />
                      <label className="flex items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={bom}
                          onChange={(e) => setBom(e.target.checked)}
                        />
                        UTF-8 marker for Excel
                      </label>
                      <label className="flex items-start gap-3 text-sm">
                        <input
                          className="mt-1"
                          type="checkbox"
                          checked={protectFormulas}
                          onChange={(e) => setProtectFormulas(e.target.checked)}
                        />
                        <span>
                          Protect formula-like CSV values
                          <span className="mt-1 block text-xs text-muted-foreground">
                            Adds an apostrophe to cells that spreadsheets might
                            execute.
                          </span>
                        </span>
                      </label>
                    </>
                  )}
                </>
              )}
            </fieldset>
            <div className="mt-6 space-y-4 border-t pt-5">
              {errorBox}
              {busy ? (
                <ProcessingState
                  progress={reading ? 0 : progress}
                  label={reading ? "Reading document…" : label}
                  onCancel={stop}
                />
              ) : (
                <button
                  onClick={() => convert()}
                  className="w-full rounded-2xl bg-emerald-600 px-5 py-4 text-lg font-semibold text-white hover:bg-emerald-700"
                >
                  Convert to {outputType}
                </button>
              )}
              <p className="text-xs leading-5 text-muted-foreground">
                Up to 50,000 data rows, 512 columns and one million cells.{" "}
                {excel
                  ? "Excel values are stored as text, preserving identifiers and literal formulas."
                  : "Review the preview before using the downloaded data."}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
