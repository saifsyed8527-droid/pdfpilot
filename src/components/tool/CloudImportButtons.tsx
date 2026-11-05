"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { Accept } from "react-dropzone";
import { Cloud, HardDrive, Loader2 } from "lucide-react";
import copy from "@/lib/i18n/cloud-copy.json";
import { parseLocalizedPath } from "@/lib/i18n/url-strategy";
import { CLOUD_IMPORT_LIMIT, cloudDownload, cloudFileName, type CloudProvider } from "@/lib/cloud-import";

export function CloudImportButtons({ accept, multiple = false, maxSize = CLOUD_IMPORT_LIMIT, onFilesSelected }: {
  accept?: Accept; multiple?: boolean; maxSize?: number; onFilesSelected: (files: File[]) => void;
}) {
  const titleId = useId();
  const words = copy[parseLocalizedPath(usePathname()).locale];
  const [provider, setProvider] = useState<CloudProvider>("google-drive");
  const [links, setLinks] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const close = () => {
    active.current?.abort();
    active.current = null;
    setBusy(false);
    dialog.current?.close();
  };
  function open(value: CloudProvider) {
    setProvider(value);
    setLinks("");
    setError("");
    dialog.current?.showModal();
  }
  async function importFiles() {
    const controller = new AbortController();
    active.current?.abort();
    active.current = controller;
    setBusy(true);
    setError("");
    try {
      const urls = links.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
      if (!urls.length || urls.length > (multiple ? 20 : 1)) throw new Error(multiple ? words.many : words.link);
      const extensions = Object.values(accept ?? {}).flat();
      const format = extensions[0]?.replace(/^\./, "") ?? "pdf";
      const plans = urls.map(url => cloudDownload(url, provider, format));
      const files: File[] = [];
      for (let index = 0; index < urls.length; index++) {
        const response = await fetch("/api/cloud-import", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ url: urls[index], provider, format }) });
        if (!response.ok) {
          const detail = await response.json().catch(() => ({}));
          throw new Error(detail.error || words.failure);
        }
        const blob = await response.blob();
        const name = cloudFileName(response.headers.get("content-disposition") ?? undefined, plans[index].name);
        const file = new File([blob], name, { type: blob.type });
        if (file.size > Math.min(maxSize, CLOUD_IMPORT_LIMIT)) throw new Error(words.size);
        const matches = !accept || Object.entries(accept).some(([mime, exts]) =>
          file.type === mime || (mime.endsWith("/*") && file.type.startsWith(mime.slice(0, -1))) || exts.some(ext => file.name.toLowerCase().endsWith(ext.toLowerCase())));
        if (!matches) throw new Error(words.unsupported);
        files.push(file);
      }
      if (controller.signal.aborted) return;
      close();
      onFilesSelected(files);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : words.failure);
    } finally {
      if (active.current === controller) { active.current = null; setBusy(false); }
    }
  }
  return <>
    <div className="mt-4 flex flex-wrap justify-center gap-3">
      <button type="button" onClick={() => open("google-drive")} className="inline-flex items-center gap-2 rounded-xl border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"><HardDrive aria-hidden className="h-4 w-4" />Google Drive</button>
      <button type="button" onClick={() => open("dropbox")} className="inline-flex items-center gap-2 rounded-xl border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"><Cloud aria-hidden className="h-4 w-4" />Dropbox</button>
    </div>
    <dialog aria-labelledby={titleId} ref={dialog} onCancel={close} onClick={event => { if (event.target === event.currentTarget) close(); }} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border bg-background p-6 text-foreground shadow-xl backdrop:bg-black/50">
      <form onSubmit={event => { event.preventDefault(); void importFiles(); }} className="space-y-4 text-start">
        <h2 id={titleId} className="text-xl font-bold">{words.title.replace("{provider}", provider === "google-drive" ? "Google Drive" : "Dropbox")}</h2>
        <p className="text-sm text-muted-foreground">{words.hint}</p>
        <label className="block space-y-2 text-sm font-medium">{words.link}
          <textarea autoFocus required disabled={busy} value={links} onChange={event => setLinks(event.target.value)} dir="ltr" rows={multiple ? 3 : 2} className="block w-full rounded-lg border bg-background p-3" placeholder={provider === "google-drive" ? "https://drive.google.com/file/d/…/view" : "https://www.dropbox.com/scl/fi/…"} />
        </label>
        {multiple && <p className="text-xs text-muted-foreground">{words.many}</p>}
        <p className="text-sm text-muted-foreground">{words.privacy} {words.size}</p>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" className="rounded-lg border px-4 py-2" onClick={close}>{words.cancel}</button>
          <button disabled={busy || !links.trim()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">{busy && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}{busy ? words.loading : words.import}</button>
        </div>
      </form>
    </dialog>
  </>;
}
