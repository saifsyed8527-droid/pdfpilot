"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Copy, Download, Loader2, RotateCcw, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextToolPanel, TextToolWorkspace } from "@/components/tool/TextToolWorkspace";
import { formatJson, minifyJson, validateJson, type JsonIndentation, type ValidationResult } from "@/lib/engines/format-engine";
import { readEncodingTextFile, utf8Bytes } from "@/lib/engines/encoding-engine";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";

export interface JsonToolContent { faqs: FaqInput[]; related: ResolvedEntity[] }
type JsonTool = "json-formatter" | "json-minifier" | "json-validator";
const CONFIG = {
  "json-formatter": { title: "JSON Formatter", action: "Format JSON", filename: "formatted.json", description: "Format JSON with readable indentation while preserving exact numbers, escaped strings and the original member order." },
  "json-minifier": { title: "JSON Minifier", action: "Minify JSON", filename: "minified.json", description: "Remove unnecessary whitespace from JSON without rounding numbers or changing strings, members or array order." },
  "json-validator": { title: "JSON Validator", action: "Validate JSON", filename: "validation-report.txt", description: "Check JSON syntax and locate errors. This checks the JSON grammar; it does not validate a schema or your application's data rules." },
} as const;
const INPUT_LIMIT = 1_048_576;
const PREVIEW_LIMIT = 100_000;
const EDITOR = "min-h-72 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm leading-6 text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const PRIMARY = "rounded-xl bg-slate-950 text-white hover:bg-slate-800 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400";

export function JsonToolClient({ tool, faqs, related }: JsonToolContent & { tool: JsonTool }) {
  const config = CONFIG[tool];
  const [input, setInput] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [indentation, setIndentation] = useState<JsonIndentation>(2);
  const [result, setResult] = useState<{ text: string; validation: ValidationResult; blob: Blob } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { processing, run } = useProcessingTask();
  const fileInput = useRef<HTMLInputElement>(null);
  const inputEditor = useRef<HTMLTextAreaElement>(null);
  const busy = loading || processing;
  const largeInput = input.length > INPUT_LIMIT;

  function invalidate() { setResult(null); setError(null); setNotice(null); }
  function reset() { invalidate(); setInput(""); setFileName(""); setIndentation(2); if (fileInput.current) fileInput.current.value = ""; }
  async function importFile(file: File | undefined) {
    if (!file) return;
    invalidate(); setLoading(true); setInput(""); setFileName("");
    try {
      const text = await readEncodingTextFile(file);
      setInput(text.startsWith("\ufeff") ? text.slice(1) : text); setFileName(file.name);
      if (text.startsWith("\ufeff")) setNotice("The UTF-8 byte order mark was removed from the imported text.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to read this file. Choose another UTF-8 file."); }
    finally { setLoading(false); }
  }
  function convert() {
    if (busy || !input.length) return;
    invalidate();
    void run(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      // Reject literal lone surrogates that a UTF-8 download would replace.
      // JSON escape sequences such as "\\ud800" are retained verbatim.
      utf8Bytes(input);
      const validation = validateJson(input);
      if (tool !== "json-validator" && !validation.valid) {
        setResult({ text: "", validation, blob: new Blob() });
        throw new Error(validation.error ?? "Invalid JSON.");
      }
      const text = tool === "json-formatter" ? formatJson(input, indentation) : tool === "json-minifier" ? minifyJson(input) : validation.valid
        ? "Valid JSON syntax.\n\nThis does not validate a schema or application rules. Exact numbers and duplicate members may be interpreted differently by consuming applications.\n"
        : `Invalid JSON syntax.\n${validation.line ? `Line ${validation.line}, column ${validation.column}.\n` : ""}${validation.error}\n`;
      setResult({ text, validation, blob: new Blob([text], { type: tool === "json-validator" ? "text/plain;charset=utf-8" : "application/json;charset=utf-8" }) });
      if (!validation.valid) throw new Error(validation.error ?? "Invalid JSON.");
    }, { toolName: tool, successMessage: tool === "json-validator" ? "Validation finished" : "Your JSON output is ready", errorTitle: "Unable to process JSON", onError: (cause) => { const message = cause instanceof Error ? cause.message : "Check your input and try again."; setError(message); return "JSON syntax or input could not be processed. Check the input and try again."; } });
  }
  async function copy() {
    if (!result) return;
    try { await navigator.clipboard.writeText(result.text); setNotice("Result copied to clipboard."); }
    catch { setNotice("Clipboard access is unavailable. Select the result to copy it, or download it."); }
  }
  const diagnostic = result?.validation;
  const downloadable = result && (tool === "json-validator" || diagnostic?.valid);
  return <TextToolWorkspace title={config.title} description={config.description} meta="Private processing in your browser" faqs={faqs} related={related} actions={<>
    <Button variant="outline" disabled={busy} onClick={reset} aria-label="Reset all input and output"><RotateCcw aria-hidden />Reset</Button>
    <Button className={PRIMARY} disabled={busy || !input.length} onClick={convert}>{busy && <Loader2 className="animate-spin" aria-hidden />}{processing ? "Processing…" : config.action}</Button>
  </>}>
    <div className="grid min-w-0 gap-5 lg:grid-cols-2">
      <TextToolPanel title="Input" description="Paste JSON or import a UTF-8 file up to 100 MB. Text up to 1,048,576 characters can be edited here.">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input ref={fileInput} type="file" accept=".json,.txt,application/json,text/plain" aria-label="Choose a JSON file" className="sr-only" disabled={busy} onChange={(event) => { void importFile(event.target.files?.[0]); event.target.value = ""; }} />
          <Button variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}><Upload aria-hidden />{fileName ? "Replace JSON file" : "Choose JSON file"}</Button>
          {fileName && <p className="min-w-0 break-all text-xs text-slate-500 dark:text-slate-400">{fileName}</p>}
        </div>
        <label htmlFor={`${tool}-input`} className="mb-2 block text-sm font-medium">JSON input</label>
        <textarea ref={inputEditor} id={`${tool}-input`} className={EDITOR} value={largeInput ? input.slice(0, PREVIEW_LIMIT) : input} readOnly={largeInput} disabled={busy} spellCheck={false} placeholder={'{"message": "Hello, world", "count": 42}'} onChange={(event) => { invalidate(); if (event.target.value.length > INPUT_LIMIT) { setError("Pasted text is too long. Import a JSON file for larger documents; your previous input has been kept."); return; } setInput(event.target.value); }} />
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{input.length.toLocaleString()} characters{largeInput ? " · Read-only preview of the first 100,000 characters. The complete document is processed." : " · Input is editable."}</p>
        {tool === "json-formatter" && <label className="mt-4 block text-sm font-medium">Indentation<select aria-label="Indentation" className="ml-3 rounded-lg border bg-background px-3 py-2" value={indentation} disabled={busy} onChange={(event) => { setIndentation(event.target.value === "tab" ? "tab" : Number(event.target.value) as 2 | 4); invalidate(); }}><option value="2">2 spaces</option><option value="4">4 spaces</option><option value="tab">Tab</option></select></label>}
        <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">{tool === "json-validator" ? "Valid syntax can still contain duplicate object names or numbers outside your application's supported range." : "Only whitespace outside strings changes. Large integers, exponent notation, negative zero, escapes and duplicate object members are preserved. Consuming applications may interpret them differently."}</p>
      </TextToolPanel>
      <TextToolPanel title={tool === "json-validator" ? "Validation result" : "Output"} description={downloadable ? `${result.blob.size.toLocaleString()} bytes` : "Your result will appear here after processing."}>
        {busy && <p role="status" className="mb-4 flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{loading ? "Reading JSON file…" : "Checking your JSON…"}</p>}
        {diagnostic && <div role={diagnostic.valid ? "status" : "alert"} className={`mb-4 rounded-xl border p-4 text-sm ${diagnostic.valid ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200" : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"}`}>
          <p className="flex items-center gap-2 font-medium">{diagnostic.valid ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}{diagnostic.valid ? "Valid JSON syntax" : "Invalid JSON syntax"}</p>
          {!diagnostic.valid && <><p className="mt-2 break-words">{diagnostic.error}</p>{diagnostic.line && <p className="mt-2">Line {diagnostic.line}, column {diagnostic.column}</p>}{diagnostic.offset !== undefined && !largeInput && <Button variant="outline" size="sm" className="mt-3" onClick={() => { inputEditor.current?.focus(); inputEditor.current?.setSelectionRange(diagnostic.offset!, diagnostic.offset! + 1); }}>Go to error</Button>}<p className="mt-2">Correct the input or replace the file, then try again.</p></>}
        </div>}
        {error && !diagnostic && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{error}</p>}
        <label htmlFor={`${tool}-output`} className="mb-2 block text-sm font-medium">{tool === "json-validator" ? "Validation report" : "JSON output"}</label>
        <textarea id={`${tool}-output`} className={EDITOR} value={result?.text.slice(0, PREVIEW_LIMIT) ?? ""} readOnly spellCheck={false} placeholder="Result preview" />
        {result && result.text.length > PREVIEW_LIMIT && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Preview shows the first 100,000 characters. Copy and download include the complete output.</p>}
        {downloadable && <div className="mt-4 flex flex-wrap gap-2"><Button className={PRIMARY} onClick={() => downloadBlob(result.blob, config.filename)}><Download aria-hidden />{tool === "json-validator" ? "Download report" : "Download JSON"}</Button><Button variant="outline" onClick={() => void copy()}><Copy aria-hidden />Copy result</Button></div>}
        {notice && <p role="status" className="mt-4 text-sm text-slate-600 dark:text-slate-300">{notice}</p>}
      </TextToolPanel>
    </div>
    <p className="text-xs text-slate-500 dark:text-slate-400">Your JSON stays in this browser. No account required.</p>
  </TextToolWorkspace>;
}
