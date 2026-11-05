"use client";
import { IntentPresentation } from "@/components/pseo/IntentPresentation";
import { SITE_PRIVACY } from "@/lib/i18n/site-privacy";
import { useResourceI18n } from "@/components/i18n/ResourceLocaleProvider";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";

const SampleContext = createContext<readonly string[]>([]);
const mediaTypes: Record<string, string> = {
  pdf: "application/pdf", json: "application/json", csv: "text/csv", tsv: "text/tab-separated-values", xml: "application/xml",
  txt: "text/plain", md: "text/markdown", html: "text/html", yaml: "application/x-yaml", sql: "application/sql",
  png: "image/png", jpg: "image/jpeg", svg: "image/svg+xml", heic: "image/heic",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
async function readSample(path: string, signal: AbortSignal) {
  const response = await fetch(path, { signal });
  if (!response.ok) throw new Error("The example could not be opened. Try again or choose your own file.");
  const name = path.split("/").at(-1)!;
  return new File([await response.blob()], name, { type: mediaTypes[name.split(".").at(-1)!] ?? "application/octet-stream" });
}
/** Mounted only inside a task template. Selection uses the tool's ordinary file handler. */
export function TaskSampleButton({ onSelect, multiple }: { onSelect: (files: File[]) => void; multiple: boolean }) {
  const { t: tr } = useResourceI18n();

  const samples = useContext(SampleContext);
  const request = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => () => request.current?.abort(), []);
  if (!samples.length) return null;
  async function load() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError("");
    try {
      const files = await Promise.all((multiple ? samples : samples.slice(0, 1)).map(path => readSample(path, controller.signal)));
      if (!controller.signal.aborted) onSelect(files);
    } catch {
      if (!controller.signal.aborted) setError("Could not open the example. Retry or select a downloaded copy.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return <div className="mx-auto mb-6 px-4 text-center">
    <button type="button" disabled={busy} onClick={load} className="rounded-lg border bg-background px-4 py-2 font-semibold text-primary">
      {tr(busy ? "Opening example…" : samples.length > 1 && !multiple ? "Load the first example file" : "Load example files")}
    </button>
    {tr(error && <p role="alert" className="mt-2 text-sm">{tr(error)}</p>)}
  </div>;
}

export function TaskWorkspace({ name, toolPath, samples, children }: { name: string; toolPath: string; samples: string[]; children: ReactNode }) {
  const { t: tr, href: localHref, locale } = useResourceI18n();

  const [open, setOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (open) heading.current?.focus(); }, [open]);
  return <section id="workspace" className="scroll-mt-20 rounded-2xl border bg-card" aria-label={name}>
    <div className="space-y-3 p-5 sm:p-7">
      <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold">{open ? name : tr("Run this task")}</h2>
      <p className="text-sm text-muted-foreground">{tr("Use your own file or download the practice input below. The checks on this page describe the practice result.")}</p>
      <ul className="flex flex-wrap gap-x-5 gap-y-2">{tr(samples.map(path => <li key={path}><a download href={localHref(path)} className="break-all text-sm font-medium text-primary underline">{tr(path.split("/").at(-1))}</a></li>))}</ul>
      {tr(!open && <div className="flex flex-wrap items-center gap-4">
        <button type="button" className="rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground" onClick={() => setOpen(true)}>{tr("Use this template")}</button>
        <Link href={localHref(toolPath)} className="text-sm underline">{tr("Open ")}{tr(name)} {tr(" directly")}</Link>
      </div>)}
    </div>
    {open && <SampleContext.Provider value={samples}><IntentPresentation title={name} description={tr("Use your own file or download the practice input below. The checks on this page describe the practice result.")} privacy={SITE_PRIVACY[locale]}>{children}</IntentPresentation></SampleContext.Provider>}
  </section>;
}
