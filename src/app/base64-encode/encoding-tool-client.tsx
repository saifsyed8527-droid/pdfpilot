"use client";

import { useRef, useState } from "react";
import { Copy, Download, FileText, Loader2, RotateCcw, ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextToolPanel, TextToolWorkspace } from "@/components/tool/TextToolWorkspace";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { assertEncodingFileSize, base64DecodeToBlob, base64EncodeFile, base64EncodeText, decodedTextPreview, ENCODING_TEXT_LIMIT, readEncodingTextFile, urlDecode, urlEncode } from "@/lib/engines/encoding-engine";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";

type EncodingTool = "base64-encode" | "base64-decode" | "url-encode" | "url-decode";
export interface EncodingToolContent { faqs: FaqInput[]; related: ResolvedEntity[]; }

const DETAILS = {
  "base64-encode": { title: "Base64 Encode", action: "Encode to Base64", input: "Text to encode", output: "Base64 output", description: "Encode Unicode text or any file as Base64. File mode preserves the original bytes.", filename: "encoded-base64.txt" },
  "base64-decode": { title: "Base64 Decode", action: "Decode Base64", input: "Base64 input", output: "Decoded output", description: "Decode standard Base64 into its original bytes. Preview readable UTF-8 text or download the original binary data.", filename: "decoded.bin" },
  "url-encode": { title: "URL Encode", action: "URL Encode", input: "Text to encode", output: "URL-encoded output", description: "Encode text for a URL component, such as a query value or path segment. Spaces and URL separators are percent-escaped.", filename: "url-encoded.txt" },
  "url-decode": { title: "URL Decode", action: "URL Decode", input: "URL-encoded input", output: "Decoded output", description: "Decode percent-escaped UTF-8 text. Choose whether plus signs represent spaces in form or query values.", filename: "url-decoded.txt" },
} as const;

const PREVIEW_LIMIT = 100_000;
const editorClass = "min-h-64 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm leading-6 text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

export function EncodingToolClient({ tool, faqs, related }: EncodingToolContent & { tool: EncodingTool }) {
  const details = DETAILS[tool];
  const [mode, setMode] = useState<"text" | "file">("text");
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; text: string | null } | null>(null);
  const [filename, setFilename] = useState<string>(details.filename);
  const [plusAsSpace, setPlusAsSpace] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const { processing, run } = useProcessingTask();
  const busy = processing || loading;
  const rawFile = tool === "base64-encode" && mode === "file";
  const largeInput = input.length > ENCODING_TEXT_LIMIT;
  const canConvert = !busy && (mode === "file" ? file !== null : input.length > 0);

  function invalidate() { setResult(null); setError(null); setNotice(null); }

  function reset() {
    setMode("text"); setInput(""); setFile(null); setResult(null);
    setError(null); setNotice(null); setPlusAsSpace(false); setFilename(details.filename);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function chooseFile(selected: File | undefined) {
    if (!selected) return;
    invalidate(); setFile(null); setInput(""); setLoading(true);
    try {
      assertEncodingFileSize(selected.size);
      const text = tool === "base64-encode" ? "" : await readEncodingTextFile(selected);
      setFile(selected); setInput(text);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to read this file. Choose another file and try again.");
    } finally { setLoading(false); }
  }

  function convert() {
    if (!canConvert) return;
    invalidate();
    void run(async () => {
      // Yield once so the disabled controls and real processing status can paint.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      let blob: Blob;
      let text: string | null;
      if (tool === "base64-encode") {
        text = rawFile && file ? await base64EncodeFile(file) : base64EncodeText(input);
        blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      } else if (tool === "base64-decode") {
        blob = base64DecodeToBlob(input);
        text = await decodedTextPreview(blob);
      } else {
        text = tool === "url-encode" ? urlEncode(input) : urlDecode(input, plusAsSpace);
        blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      }
      setResult({ blob, text });
    }, {
      toolName: tool, successMessage: "Your output is ready", errorTitle: "Unable to convert this input",
      onError: (cause) => {
        const message = cause instanceof Error ? cause.message : "Please check your input and try again.";
        setError(message); return message;
      },
    });
  }

  async function copyOutput() {
    if (result?.text == null) return;
    try { await navigator.clipboard.writeText(result.text); setNotice("Output copied to clipboard."); }
    catch { setNotice("Clipboard access is unavailable. Select the output to copy it, or download the file."); }
  }

  return (
    <TextToolWorkspace title={details.title} description={details.description} meta="Private processing in your browser" faqs={faqs} related={related} actions={
      <>
        <Button variant="outline" onClick={reset} disabled={busy} aria-label="Reset all input and output"><RotateCcw aria-hidden />Reset</Button>
        <Button onClick={convert} disabled={!canConvert} className="rounded-xl bg-slate-950 text-white hover:bg-slate-800 focus-visible:ring-amber-500 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400">
          {busy && <Loader2 className="animate-spin" aria-hidden />}{processing ? "Processing…" : details.action}
        </Button>
      </>
    }>
      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <TextToolPanel title="Input" description={rawFile ? "Any file type · up to 100 MB. The file's bytes are encoded without converting them to text." : "Paste text (up to 1,048,576 characters) or choose a UTF-8 text file (up to 100 MB)."}>
          <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Input source">
            {(["text", "file"] as const).map((value) => <Button key={value} variant={mode === value ? "secondary" : "outline"} aria-pressed={mode === value} disabled={busy} onClick={() => { setMode(value); setInput(""); setFile(null); invalidate(); if (fileInput.current) fileInput.current.value = ""; }}>{value === "text" ? "Text" : "File"}</Button>)}
          </div>
          {mode === "file" && <div className="mb-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/60">
            <input ref={fileInput} type="file" aria-label={tool === "base64-encode" ? "Choose a file to encode" : "Choose a UTF-8 text file"} className="sr-only" accept={tool === "base64-encode" ? undefined : ".txt,.b64,.base64,text/plain"} disabled={busy} onChange={(event) => { void chooseFile(event.target.files?.[0]); event.target.value = ""; }} />
            <Button variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}><Upload aria-hidden />{file ? "Replace file" : "Choose file"}</Button>
            {file && <p className="mt-3 break-all text-sm text-slate-600 dark:text-slate-300"><FileText className="mr-1 inline h-4 w-4" aria-hidden />{file.name} · {file.size.toLocaleString()} bytes</p>}
            {loading && <p className="mt-3 text-sm" role="status">Reading file…</p>}
          </div>}
          {!rawFile && <>
            <label htmlFor={`${tool}-input`} className="mb-2 block text-sm font-medium">{details.input}</label>
            <textarea id={`${tool}-input`} value={largeInput ? input.slice(0, PREVIEW_LIMIT) : input} readOnly={largeInput} disabled={busy || (mode === "file" && !file)} spellCheck={false} className={editorClass} placeholder={tool === "base64-decode" ? "SGVsbG8sIHdvcmxkIQ==" : tool === "url-decode" ? "Hello%2C%20world%21" : "Type or paste your text here…"} onChange={(event) => {
              const next = event.target.value;
              invalidate();
              if (next.length > ENCODING_TEXT_LIMIT) { setError("Pasted text is too long. Use a UTF-8 text file for more than 1,048,576 characters; your previous input has been kept."); return; }
              setInput(next);
            }} />
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{input.length.toLocaleString()} characters{largeInput ? " · Read-only preview of the first 100,000 characters. The complete file is processed." : " · Input is editable; whitespace is preserved."}</p>
          </>}
          {tool === "base64-decode" && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Standard Base64 only. Line breaks and whitespace are accepted. Remove any data: URI prefix first.</p>}
          {tool === "url-decode" && <label className="mt-4 flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 accent-amber-500" checked={plusAsSpace} disabled={busy} onChange={(event) => { setPlusAsSpace(event.target.checked); invalidate(); }} /><span>Treat + as a space (form/query values)<span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Leave off to preserve literal plus signs. %2B always becomes +.</span></span></label>}
        </TextToolPanel>
        <TextToolPanel title="Output" description={result ? `${result.blob.size.toLocaleString()} bytes · conversion complete` : "Your result will appear here after conversion."}>
          {processing && <p className="mb-4 flex items-center gap-2 text-sm" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Converting your input in this browser…</p>}
          {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}<p className="mt-2">Correct the input or replace the file, then try again.</p></div>}
          {result?.text === null ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">This output contains binary data rather than readable UTF-8 text. Download it to preserve the original bytes, and choose the original file extension if you know it.</div> : <>
            <label htmlFor={`${tool}-output`} className="mb-2 block text-sm font-medium">{details.output}</label>
            <textarea id={`${tool}-output`} value={result?.text?.slice(0, PREVIEW_LIMIT) ?? ""} readOnly spellCheck={false} className={editorClass} placeholder="Output preview" />
            {result?.text && result.text.length > PREVIEW_LIMIT && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Preview shows the first 100,000 characters. Copy and download include the complete output.</p>}
          </>}
          {result && <div className="mt-4 space-y-4">
            <div><label htmlFor={`${tool}-filename`} className="mb-2 block text-sm font-medium">Download filename</label><input id={`${tool}-filename`} value={filename} onChange={(event) => setFilename(event.target.value)} className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-slate-700 dark:bg-slate-950" /></div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => downloadBlob(result.blob, filename.trim().replace(/[\\/]/g, "_") || details.filename)} className="rounded-xl bg-slate-950 text-white hover:bg-slate-800 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400"><Download aria-hidden />Download output</Button>
              {result.text !== null && <Button variant="outline" onClick={() => void copyOutput()}><Copy aria-hidden />Copy output</Button>}
            </div>
          </div>}
          {notice && <p role="status" className="mt-4 text-sm text-slate-600 dark:text-slate-300">{notice}</p>}
        </TextToolPanel>
      </div>
      <p className="mt-5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />Your text and files stay in your browser. No account required.</p>
    </TextToolWorkspace>
  );
}
