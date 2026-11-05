"use client";
import { useResourceI18n } from "@/components/i18n/ResourceLocaleProvider";
import { useEffect, useRef, useState } from "react";
import type { DataWorkflow } from "@/lib/content/data-workflows";
import { downloadBlob } from "@/lib/download-file";

export function DataWorkflowRunner({ workflow }: { workflow: DataWorkflow }) {
  const { t: tr } = useResourceI18n();

  const [file, setFile] = useState<File | null>(null), [tableName, setTableName] = useState("stock");
  const [result, setResult] = useState<Blob | null>(null), [preview, setPreview] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function run(example: boolean) {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setBusy(true); setError(""); setResult(null); setPreview("");
    try {
      const { runDataWorkflow, WORKFLOW_INPUT_LIMIT } = await import("@/lib/engines/data-workflow-engine");
      let text: string;
      if (example) {
        const response = await fetch("/task-examples/" + workflow.sample, { signal: controller.signal });
        if (!response.ok) throw new Error("Could not load the example. Try again.");
        text = await response.text();
      } else {
        if (!file || file.size > WORKFLOW_INPUT_LIMIT) throw new Error("Select a file of 1 MiB or less.");
        text = await file.text();
      }
      const blob = await runDataWorkflow(workflow, text, tableName);
      const excerpt = workflow.output === "xlsx" ? "" : await blob.slice(0, 1600).text();
      if (!controller.signal.aborted) { setResult(blob); setPreview(excerpt); }
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Check the input and try again.");
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }
  const clear = () => { setResult(null); setPreview(""); setError(""); };
  return <section aria-label={tr("Run both steps")} className="max-w-3xl space-y-4 rounded-xl border p-5 md:p-7">
    <h2 className="text-xl font-bold">{tr("Run both steps")}</h2>
    <label className="block text-sm font-medium">{tr("Choose a ")}{tr(workflow.input.toUpperCase())} {tr(" file (up to 1 MiB) ")}<input disabled={busy} className="mt-2 block w-full rounded-lg border p-3" type="file" accept={workflow.input === "yaml" ? ".yaml,.yml" : "." + workflow.input}
        onChange={event => { clear(); setFile(event.target.files?.[0] ?? null); }} />
    </label>
    {tr(workflow.output === "sql" && <label className="block text-sm">{tr("Destination table")}<input disabled={busy} className="ms-3 rounded border p-2" value={tableName} onChange={event => { clear(); setTableName(event.target.value); }} /></label>)}
    <div className="flex flex-wrap gap-3">
      <button disabled={busy || !file} onClick={() => run(false)} className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50">{tr("Run workflow")}</button>
      <button disabled={busy} onClick={() => run(true)} className="rounded-lg border px-4 py-2 font-semibold">{tr("Try with example data")}</button>
    </div>
    {tr(busy && <p role="status">{tr("Processing both steps…")}</p>)}
    {tr(error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-900">{tr(error)}</p>)}
    {tr(result && <div className="space-y-3" aria-live="polite"><p className="font-semibold">{tr("Your ")}{tr(workflow.output.toUpperCase())} {tr(" is ready.")}</p>
      {tr(preview && <pre dir="ltr" className="max-h-52 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3 text-xs">{tr(preview)}</pre>)}
      <button className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground" onClick={() => downloadBlob(result, workflow.slug + "." + workflow.output)}>{tr("Download ")}{tr(workflow.output.toUpperCase())}</button>
    </div>)}
  </section>;
}
