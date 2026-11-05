"use client";

import { useEffect, useRef, useState } from "react";
import { getConnection } from "@/lib/connections/registry";
import { DEFAULT_CONNECTION_OPTIONS, CONNECTION_FILE_LIMIT, type ConnectionOptions } from "@/lib/connections/options";
import copy from "@/lib/connections/copy.json";
import type { LocaleCode } from "@/lib/i18n/locales";
import { downloadBlob } from "@/lib/download-file";
import { CloudImportButtons } from "@/components/tool/CloudImportButtons";

export function ConnectionRunner({ source, target, locale }: { source: string; target: string; locale: LocaleCode }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const words = copy[locale];
  const connection = getConnection(source, target);
  const [files, setFiles] = useState<File[]>([]);
  const [options, setOptions] = useState<ConnectionOptions>(DEFAULT_CONNECTION_OPTIONS);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);
  const [preview, setPreview] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  if (!connection || connection.cloud) return null;
  const { first, next } = connection;
  const settings = [...new Set([...first.settings, ...next.settings])] as (keyof ConnectionOptions)[];
  const reset = () => { setResult(null); setPreview(""); setError(""); };
  const choose = (value: File[]) => { reset(); setFiles(value); };
  function cancel() {
    active.current?.abort();
    active.current = null;
    setStep(0);
  }
  async function run(example: boolean) {
    cancel();
    const controller = new AbortController();
    active.current = controller;
    reset();
    setStep(1);
    try {
      let input = files;
      if (example) {
        input = [];
        for (const name of first.samples) {
          const response = await fetch("/task-examples/" + name, { signal: controller.signal });
          if (!response.ok) throw new Error("The example file could not be loaded.");
          input.push(new File([await response.blob()], name));
        }
        if (!controller.signal.aborted) setFiles(input);
      }
      const { runConnection } = await import("@/lib/connections/engine");
      const output = await runConnection(source, target, input, options, controller.signal, setStep);
      const text = ["pdf", "xlsx"].includes(next.output) ? "" : await output.blob.slice(0, 2000).text();
      if (!controller.signal.aborted) { setResult(output); setPreview(text); }
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : words.unsupported);
    } finally {
      if (active.current === controller) { active.current = null; setStep(0); }
    }
  }
  return <section className="space-y-5 rounded-2xl border bg-card p-5 md:p-8" aria-label={words.run}>
    <h2 className="text-2xl font-semibold">{words.run}</h2>
    <fieldset disabled={step > 0} className="space-y-5">
      <legend className="sr-only">{words.settings}</legend>
      <CloudImportButtons accept={{ "application/octet-stream": ["." + first.input] }} multiple={first.kind === "merge"} maxSize={CONNECTION_FILE_LIMIT} onFilesSelected={choose} disabled={step > 0}>
        <button type="button" onClick={() => fileInput.current?.click()} className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">{words.choose}</button>
      </CloudImportButtons>
      <input ref={fileInput} className="sr-only" aria-label={words.choose} type="file" accept={"." + first.input} multiple={first.kind === "merge"} onChange={event => { choose(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
      {files.length > 0 && <ol className="list-inside list-decimal break-all text-sm">{files.map((file, index) => <li key={index}>{file.name}</li>)}</ol>}
      <div className="grid gap-4 sm:grid-cols-2">{settings.map(setting => <label key={setting} className="text-sm font-medium">{words[setting]}
        {setting === "rotation" ? <select value={options.rotation} onChange={event => { reset(); setOptions({ ...options, rotation: Number(event.target.value) }); }} className="mt-2 block w-full rounded-lg border bg-background p-3">{[90, 180, 270].map(value => <option key={value} value={value}>{value}°</option>)}</select>
          : <input type={setting === "firstNumber" ? "number" : "text"} min={1} max={9999} value={options[setting]} onChange={event => { reset(); setOptions({ ...options, [setting]: setting === "firstNumber" ? Number(event.target.value) : event.target.value }); }} className="mt-2 block w-full rounded-lg border bg-background p-3" />}
      </label>)}</div>
      <div className="flex flex-wrap gap-3">
        <button disabled={!files.length} onClick={() => void run(false)} className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50">{words.run}</button>
        <button onClick={() => void run(true)} className="rounded-xl border px-5 py-3 font-semibold">{words.sample}</button>
      </div>
    </fieldset>
    {step > 0 && <div className="flex items-center gap-4"><p role="status">{words.working.replace("{step}", String(step))}</p><button onClick={cancel} className="rounded border px-3 py-2">{words.cancel}</button></div>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {result && <div className="space-y-4" aria-live="polite"><p className="font-semibold">{words.ready}</p>
      {preview && <pre dir="ltr" className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted p-4 text-xs">{preview}</pre>}
      <button onClick={() => downloadBlob(result.blob, result.filename)} className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">{words.download}</button>
    </div>}
  </section>;
}
