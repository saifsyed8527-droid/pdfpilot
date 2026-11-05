"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { Accept } from "react-dropzone";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import copy from "@/lib/i18n/cloud-copy.json";
import pickerCopy from "@/lib/i18n/cloud-picker-copy.json";
import { parseLocalizedPath } from "@/lib/i18n/url-strategy";
import type { CloudProvider } from "@/lib/cloud-import";
import { CloudPickerError, PICKER_FILE_LIMIT, pickerConfigured, prepareCloudPicker, pickCloudFiles } from "@/lib/cloud-picker";

export type CloudSelectionProps = {
  accept?: Accept; multiple?: boolean; maxSize?: number; onFilesSelected: (files: File[]) => void;
};

export function ProviderIcon({ provider }: { provider: CloudProvider }) {
  return provider === "google-drive"
    ? <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true"><path d="M8.1 2 1 14.3l3.6 6.2 7.1-12.3L8.1 2Zm1.2 0 7.1 12.3h7.1L16.4 2H9.3ZM8.2 15.5l-3.6 6.2h14.2l3.6-6.2H8.2Z" /></svg>
    : <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true"><path d="M6 2 0 5.8l6 3.8 6-3.8L6 2Zm12 0-6 3.8 6 3.8 6-3.8L18 2ZM0 13.4l6 3.8 6-3.8L6 9.6 0 13.4Zm18-3.8-6 3.8 6 3.8 6-3.8-6-3.8ZM6 18.5l6 3.8 6-3.8-6-3.8-6 3.8Z" /></svg>;
}

/** The same controls are used beside the initial upload and in Add files. */
export function CloudImportButtons({ accept, multiple = false, maxSize = PICKER_FILE_LIMIT, onFilesSelected, children, disabled = false, onBusyChange }: CloudSelectionProps & { children?: ReactNode; disabled?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const locale = parseLocalizedPath(usePathname()).locale;
  const words = copy[locale];
  const labels = pickerCopy[locale];
  const [status, setStatus] = useState<"idle" | "selecting" | "downloading">("idle");
  const [ready, setReady] = useState<Partial<Record<CloudProvider, boolean>>>({});
  const active = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => { onBusyChange?.(status !== "idle"); return () => onBusyChange?.(false); }, [status, onBusyChange]);
  useEffect(() => {
    mounted.current = true;
    for (const provider of ["google-drive", "dropbox"] as const) {
      if (pickerConfigured(provider)) void prepareCloudPicker(provider).then(() => {
        if (mounted.current) setReady(current => ({ ...current, [provider]: true }));
      }).catch(() => { /* A click retries if the network or script blocker recovers. */ });
    }
    return () => { mounted.current = false; active.current?.abort(); };
  }, []);
  const cancel = () => { active.current?.abort(); active.current = null; setStatus("idle"); };
  function open(provider: CloudProvider) {
    if (disabled || active.current) return;
    if (!pickerConfigured(provider)) { toast.error(labels.configuration); return; }
    if (!ready[provider]) {
      toast.info(labels.loading);
      void prepareCloudPicker(provider).then(() => mounted.current && setReady(current => ({ ...current, [provider]: true }))).catch(() => toast.error(labels.loading));
      return;
    }
    const controller = new AbortController();
    active.current = controller;
    setStatus("selecting");
    // Invoke the SDK before any await to retain the original user click.
    void pickCloudFiles(provider, { accept, multiple, maxSize, locale, signal: controller.signal, onDownload: () => mounted.current && setStatus("downloading") })
      .then(files => { if (!controller.signal.aborted && files.length) onFilesSelected(files); })
      .catch(reason => {
        if (!controller.signal.aborted) {
          const code = reason instanceof CloudPickerError ? reason.code : "download";
          toast.error(code === "unsupported" ? words.unsupported : labels[code].replace("{size}", String(Math.round(Math.min(maxSize, PICKER_FILE_LIMIT) / 1024 / 1024))));
        }
      })
      .finally(() => { if (active.current === controller) { active.current = null; if (mounted.current) setStatus("idle"); } });
  }
  const fileType = [...new Set(Object.values(accept ?? {}).flat().map(ext => ext.replace(/^\./, "").toUpperCase()))].slice(0, 3).join(" / ");
  return <>
    <div className="inline-flex max-w-full items-stretch justify-center gap-3" data-cloud-upload onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
      {children && <div className="flex min-w-0 items-stretch [&>button]:min-h-24">{children}</div>}
      <div className="flex shrink-0 flex-col justify-center gap-2">
        {(["google-drive", "dropbox"] as const).map(provider => {
          const label = labels.select.replace("{type}", fileType || labels.files).replace("{provider}", provider === "google-drive" ? "Google Drive" : "Dropbox");
          return <div key={provider} className="group/cloud relative flex">
            <button type="button" aria-label={label} title={label} onClick={() => open(provider)} disabled={disabled || status !== "idle"}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white shadow-md transition-colors hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:opacity-50 dark:bg-slate-200 dark:text-slate-950 dark:hover:bg-orange-400">
              <ProviderIcon provider={provider} />
            </button>
            <span aria-hidden="true" className="pointer-events-none absolute end-14 top-1/2 z-40 hidden w-max max-w-64 -translate-y-1/2 rounded-lg bg-slate-950 px-3 py-2 text-start text-xs font-medium text-white shadow-md group-hover/cloud:block group-focus-within/cloud:block max-sm:hidden">{label}</span>
          </div>;
        })}
      </div>
    </div>
    {status !== "idle" && <div role="status" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()} className="fixed bottom-5 start-1/2 z-[1001] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-xl border bg-background p-4 text-sm shadow-xl rtl:translate-x-1/2">
      <Loader2 aria-hidden className="h-5 w-5 shrink-0 animate-spin" /><span className="flex-1">{status === "downloading" ? words.loading : labels.selecting}</span><button type="button" onClick={cancel} className="rounded-lg border px-3 py-2">{words.cancel}</button>
    </div>}
  </>;
}
