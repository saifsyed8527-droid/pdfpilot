"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, LockKeyhole, UnlockKeyhole } from "lucide-react";
import { FileToolLayout } from "./FileToolLayout";
import { SourceFilePreview } from "./SourceFilePreview";
import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/lib/download-file";
import { formatFileSize } from "@/lib/utils";
import { useProcessingTask } from "@/lib/use-processing-task";
import {
  passwordFilename,
  passwordZip,
  processPdfPassword,
  type PdfPasswordOptions,
  type PdfPasswordResult,
} from "@/lib/engines/pdf-password-engine";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";

type Entry = {
  id: string;
  file: File;
  password: string;
  result?: PdfPasswordResult;
  error?: string;
};
type Result = {
  blob: Blob;
  name: string;
  entries: Entry[];
  unfinished: number;
};
const input =
  "mt-2 w-full min-w-0 rounded-xl border bg-background p-3 text-sm font-normal";
function PasswordField({
  label,
  value,
  onChange,
  creating = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  creating?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block text-sm font-medium">
      {label}
      <span className="relative block">
        <input
          aria-label={label}
          className={input + " pr-12"}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={creating ? 127 : 1024}
          autoComplete={creating ? "new-password" : "off"}
          spellCheck={false}
        />
        <button
          type="button"
          className="absolute bottom-0 right-0 flex h-11 w-11 items-center justify-center"
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}
function entryStatus(entry: Entry, lock: boolean) {
  if (entry.result)
    return entry.result.unchanged
      ? "Already unlocked · original returned unchanged"
      : `${entry.result.pageCount} pages · ${lock ? "AES-256 protected" : "Unlocked without flattening"}`;
  return entry.error ? "Needs attention" : "Ready";
}
export function PdfPasswordWorkspace({
  operation,
  faqs,
  related,
}: {
  operation: "lock" | "unlock";
  faqs: FaqInput[];
  related: ResolvedEntity[];
}) {
  const lock = operation === "lock",
    toolSlug = lock ? "lock-pdf" : "unlock-pdf";
  const [entries, setEntries] = useState<Entry[]>([]),
    [selected, setSelected] = useState(0),
    [result, setResult] = useState<Result | null>(null),
    [error, setError] = useState("");
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [currentPassword, setCurrentPassword] = useState(""),
    [ownerPassword, setOwnerPassword] = useState("");
  const [printing, setPrinting] = useState<"full" | "low" | "none">("full"),
    [modifying, setModifying] = useState<"all" | "form" | "none">("all"),
    [copying, setCopying] = useState(true),
    [previewPasswords, setPreviewPasswords] = useState<Record<string, string>>(
      {},
    );
  const [loading, setLoading] = useState(false),
    [pending, setPending] = useState<File | null>(null);
  const generation = useRef(0),
    controller = useRef<AbortController | null>(null),
    { processing, progress, run, cancel } = useProcessingTask();
  const stop = () => {
    generation.current++;
    controller.current?.abort();
    cancel();
    setLoading(false);
    setPending(null);
  };
  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
      cancel();
    },
    [cancel],
  );
  const reset = () => {
    stop();
    setEntries([]);
    setResult(null);
    setSelected(0);
    setPassword("");
    setConfirm("");
    setCurrentPassword("");
    setOwnerPassword("");
    setPreviewPasswords({});
    setError("");
  };
  const changeProtection = (change: () => void) => {
    change();
    setError("");
    setResult(null);
    setEntries((v) =>
      v.map((e) => ({ ...e, result: undefined, error: undefined })),
    );
  };
  const choose = async (files: File[]) => {
    if (!files.length) return;
    stop();
    const id = ++generation.current;
    setLoading(true);
    setPending(files[0]);
    setError("");
    try {
      if (
        files.some(
          (f) =>
            (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") ||
            !f.size ||
            f.size > 50 * 1024 * 1024,
        )
      )
        throw new Error("Choose non-empty PDF files up to 50MB each.");
      if (
        entries.length + files.length > 20 ||
        [...entries.map((e) => e.file), ...files].reduce(
          (n, f) => n + f.size,
          0,
        ) >
          200 * 1024 * 1024
      )
        throw new Error("Choose up to 20 PDFs and 200MB combined.");
      const added: Entry[] = [];
      for (const f of files) {
        const stable = new File([await f.arrayBuffer()], f.name, {
          type: "application/pdf",
        });
        if (id !== generation.current) return;
        added.push({ id: crypto.randomUUID(), file: stable, password: "" });
      }
      if (id === generation.current) {
        setEntries([...entries, ...added]);
        setSelected(entries.length);
        setResult(null);
      }
    } catch (e) {
      if (id === generation.current)
        setError(e instanceof Error ? e.message : "Choose readable PDFs.");
    } finally {
      if (id === generation.current) {
        setLoading(false);
        setPending(null);
      }
    }
  };
  const selectedEntry = entries[Math.min(selected, entries.length - 1)],
    ready = entries.filter((e) => e.result);
  const previewFile = useMemo(
    () =>
      selectedEntry?.result && !lock
        ? new File([selectedEntry.result.blob], selectedEntry.file.name, {
            type: "application/pdf",
          })
        : selectedEntry?.file,
    [selectedEntry?.file, selectedEntry?.result, lock],
  );
  const remove = (id: string) => {
    const index = entries.findIndex((e) => e.id === id),
      next = entries.filter((e) => e.id !== id);
    setEntries(next);
    setSelected(
      Math.max(
        0,
        Math.min(selected - (index < selected ? 1 : 0), next.length - 1),
      ),
    );
    setPreviewPasswords((v) => {
      const copy = { ...v };
      delete copy[id];
      return copy;
    });
    setError("");
  };
  const setEntryPassword = (value: string) => {
    if (!selectedEntry) return;
    setEntries((v) =>
      v.map((e) =>
        e.id === selectedEntry.id
          ? {
              ...e,
              password: value,
              error: undefined,
              ...(lock ? { result: undefined } : {}),
            }
          : e,
      ),
    );
    setError("");
  };
  const protectError = !password
    ? "Set an open password."
    : new TextEncoder().encode(password).length > 127
      ? "The password exceeds 127 UTF-8 bytes. Shorten it."
      : password !== confirm
        ? "Passwords do not match."
        : ownerPassword && ownerPassword === password
          ? "Use a different owner password or leave it empty."
          : "";
  const execute = (downloadOnly = false) => {
    if (
      processing ||
      loading ||
      !entries.length ||
      (!downloadOnly && lock && protectError)
    )
      return;
    const abort = new AbortController();
    controller.current = abort;
    setError("");
    void run(
      async (setProgress, cancelled) => {
        let current = entries;
        if (!downloadOnly) {
          const targets = current.filter((e) => !e.result);
          for (const [index, entry] of targets.entries()) {
            if (cancelled() || abort.signal.aborted) return;
            current = current.map((e) =>
              e.id === entry.id ? { ...e, error: undefined } : e,
            );
            setEntries(current);
            try {
              const output = await processPdfPassword(entry.file, {
                operation,
                currentPassword: entry.password || currentPassword,
                ...(lock
                  ? {
                      openPassword: password,
                      ownerPassword,
                      print: printing,
                      modify: modifying,
                      copy: copying,
                    }
                  : {}),
                signal: abort.signal,
                onProgress: (pct) =>
                  setProgress(((index + pct / 100) / targets.length) * 85),
              });
              if (cancelled() || abort.signal.aborted) return;
              current = current.map((e) =>
                e.id === entry.id ? { ...e, result: output } : e,
              );
            } catch (cause) {
              if (cancelled() || abort.signal.aborted) return;
              current = current.map((e) =>
                e.id === entry.id
                  ? {
                      ...e,
                      error:
                        cause instanceof Error
                          ? cause.message
                          : "This PDF could not be processed.",
                    }
                  : e,
              );
            }
            setEntries(current);
          }
          const failed = current.filter((e) => !e.result);
          if (failed.length)
            throw new Error(
              `${current.length - failed.length} ready · ${failed.length} unfinished. Review passwords or file messages, then retry. Completed files are kept.`,
            );
        }
        setProgress(90);
        const completed = current.filter((e) => e.result);
        if (!completed.length)
          throw new Error("There are no completed files to download.");
        const blob =
          completed.length === 1
            ? completed[0].result!.blob
            : await passwordZip(
                completed.map((e) => ({
                  name: passwordFilename(e.file.name, operation),
                  blob: e.result!.blob,
                })),
                abort.signal,
              );
        if (cancelled() || abort.signal.aborted) return;
        setResult({
          blob,
          name:
            completed.length === 1
              ? passwordFilename(completed[0].file.name, operation)
              : `${lock ? "protected" : "unlocked"}-pdfs.zip`,
          entries: completed,
          unfinished: current.length - completed.length,
        });
        setProgress(100);
      },
      {
        toolName: toolSlug,
        successMessage: "Your PDF download is ready",
        errorTitle: "Review the unfinished files",
        onError: (cause) => {
          const message =
            cause instanceof Error
              ? cause.message
              : "Check the files and retry.";
          setError(message);
          return message;
        },
      },
    );
  };
  const preview = (
    <div className="space-y-4">
      {previewFile && (
        <SourceFilePreview
          key={selectedEntry.id}
          file={previewFile}
          password={
            selectedEntry.result && !lock
              ? undefined
              : previewPasswords[selectedEntry.id]
          }
        />
      )}
      {selectedEntry && !selectedEntry.result && (
        <Button
          variant="outline"
          onClick={() =>
            setPreviewPasswords((v) => ({
              ...v,
              [selectedEntry.id]: selectedEntry.password || currentPassword,
            }))
          }
        >
          Preview with current password
        </Button>
      )}
      <div className="space-y-2">
        {entries.map((entry, i) => (
          <article
            key={entry.id}
            className={`rounded-xl border p-3 text-sm ${i === selected ? "border-orange-500" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <button
                className="min-w-0 break-all text-left font-semibold hover:underline"
                onClick={() => setSelected(i)}
              >
                {entry.file.name}
              </button>
              <button
                className="shrink-0 text-xs underline"
                aria-label={`Remove ${entry.file.name}`}
                onClick={() => remove(entry.id)}
              >
                Remove
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatFileSize(entry.file.size)} · {entryStatus(entry, lock)}
            </p>
            {entry.error && (
              <p className="mt-2 text-xs text-red-600" role="alert">
                {entry.error}
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
  return (
    <FileToolLayout
      toolSlug={toolSlug}
      files={loading ? [pending] : entries.map((e) => e.file)}
      accept={{ "application/pdf": [".pdf"] }}
      maxFileSize={50 * 1024 * 1024}
      multiple
      selectedFileIndex={selected}
      onSelectedFileChange={setSelected}
      onFilesSelected={choose}
      landingError={error}
      landingExtra={
        <p className="mx-auto mb-8 max-w-2xl px-4 text-center text-sm leading-6 text-muted-foreground">
          {lock
            ? "Protect PDFs with AES-256 encryption. Files and passwords stay on your device."
            : "Remove a known password while preserving text, links, forms and page quality. Files and passwords stay on your device."}{" "}
          Up to 20 files, 50MB each and 200MB combined.
        </p>
      }
      result={result}
      processing={processing || loading}
      progress={loading ? undefined : progress}
      onCancel={() => {
        stop();
        setError(
          "Processing stopped. Completed files are kept; you can retry the unfinished files.",
        );
      }}
      onReset={reset}
      onDownload={() => {
        if (result) downloadBlob(result.blob, result.name);
      }}
      preview={preview}
      faqs={faqs}
      related={related}
    >
      {result ? (
        <div className="space-y-5">
          <div className="text-center">
            {lock ? (
              <LockKeyhole className="mx-auto mb-3 h-12 w-12 text-green-600" />
            ) : (
              <UnlockKeyhole className="mx-auto mb-3 h-12 w-12 text-green-600" />
            )}
            <h2 className="text-2xl font-bold">
              Your {lock ? "protected" : "unlocked"} PDF
              {result.entries.length > 1 ? "s are" : " is"} ready
            </h2>
          </div>
          {result.unfinished > 0 && (
            <p
              role="alert"
              className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950"
            >
              {result.unfinished} unfinished file
              {result.unfinished === 1 ? " is" : "s are"} not included. Return
              to files to review them.
            </p>
          )}
          <ul className="space-y-3">
            {result.entries.map((e) => (
              <li key={e.id} className="rounded-xl border p-4">
                <p className="break-all font-medium">
                  {passwordFilename(e.file.name, operation)}
                </p>
                <p className="mt-1 text-sm">{entryStatus(e, lock)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {e.result!.fieldCount} form fields retained ·{" "}
                  {formatFileSize(e.result!.blob.size)}
                </p>
                {result.entries.length > 1 && (
                  <Button
                    className="mt-3"
                    variant="outline"
                    onClick={() =>
                      downloadBlob(
                        e.result!.blob,
                        passwordFilename(e.file.name, operation),
                      )
                    }
                  >
                    Download {e.file.name}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <p className="text-sm leading-6 text-muted-foreground">
            {lock
              ? "Keep the open password somewhere safe. PDFPilot cannot recover a forgotten password. Print/copy/edit restrictions depend on the PDF reader."
              : "Original text, images, links and form fields remain in the PDF. No page was converted into an image."}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => downloadBlob(result.blob, result.name)}>
              Download {result.entries.length > 1 ? "ZIP" : "PDF"}
            </Button>
            <Button variant="outline" onClick={() => setResult(null)}>
              Back to files
            </Button>
            <Button variant="outline" onClick={reset}>
              Start over
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm">
            {entries.length} selected · {ready.length} completed
          </p>
          {lock ? (
            <>
              <p className="text-sm text-muted-foreground">
                A password will be required to open every protected PDF.
                Original pages and editable form fields are kept.
              </p>
              <PasswordField
                label="Open password"
                value={password}
                creating
                onChange={(v) => changeProtection(() => setPassword(v))}
              />
              <PasswordField
                label="Confirm open password"
                value={confirm}
                creating
                onChange={setConfirm}
              />
              {password && (
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>
                    {password.length >= 12
                      ? "Longer password selected"
                      : "Use 12 or more characters or a memorable passphrase."}
                  </p>
                  <p>
                    {new TextEncoder().encode(password).length} / 127 UTF-8
                    bytes
                  </p>
                </div>
              )}
              {confirm && password !== confirm && (
                <p role="alert" className="text-xs text-red-600">
                  Passwords do not match.
                </p>
              )}
              <details className="rounded-xl border p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  Permissions and existing password
                </summary>
                <div className="mt-4 space-y-4">
                  <PasswordField
                    label="Current password for existing PDFs (optional)"
                    value={currentPassword}
                    onChange={setCurrentPassword}
                  />
                  <PasswordField
                    label="Owner password (optional)"
                    value={ownerPassword}
                    creating
                    onChange={(v) =>
                      changeProtection(() => setOwnerPassword(v))
                    }
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    The owner password must differ from the open password. Leave
                    it empty to generate a separate owner password locally. You
                    can still remove protection using the open password.
                  </p>
                  <label className="block text-sm">
                    Printing
                    <select
                      className={input}
                      value={printing}
                      onChange={(e) =>
                        changeProtection(() =>
                          setPrinting(
                            e.target.value as PdfPasswordOptions["print"] &
                              string,
                          ),
                        )
                      }
                    >
                      <option value="full">Full resolution</option>
                      <option value="low">Low resolution only</option>
                      <option value="none">Not allowed</option>
                    </select>
                  </label>
                  <label className="block text-sm">
                    Editing
                    <select
                      className={input}
                      value={modifying}
                      onChange={(e) =>
                        changeProtection(() =>
                          setModifying(
                            e.target.value as "all" | "form" | "none",
                          ),
                        )
                      }
                    >
                      <option value="all">Allow all edits</option>
                      <option value="form">Forms and page assembly</option>
                      <option value="none">Not allowed</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={copying}
                      onChange={(e) =>
                        changeProtection(() => setCopying(e.target.checked))
                      }
                    />
                    Allow copying text and graphics
                  </label>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Permission restrictions are requests to the reader. Some PDF
                    software ignores them; they do not replace the open
                    password.
                  </p>
                </div>
              </details>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Remove the password without flattening pages. Leave the password
                empty for files that already open freely.
              </p>
              <PasswordField
                label="Current password (optional)"
                value={currentPassword}
                onChange={(v) => {
                  setCurrentPassword(v);
                  setError("");
                }}
              />
            </>
          )}
          {selectedEntry && (
            <details className="rounded-xl border p-4">
              <summary className="cursor-pointer break-all text-sm font-medium">
                Password for {selectedEntry.file.name}
              </summary>
              <div className="mt-4 space-y-3">
                <PasswordField
                  label="Current password for this file"
                  value={selectedEntry.password}
                  onChange={setEntryPassword}
                />
                <p className="text-xs text-muted-foreground">
                  Overrides the shared current password for this file.
                </p>
              </div>
            </details>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-sm text-red-800"
            >
              {error}
            </p>
          )}
          {ready.length < entries.length && (
            <Button
              size="lg"
              className="w-full"
              disabled={lock && !!protectError}
              onClick={() => execute()}
            >
              {entries.some((e) => e.error)
                ? "Retry unfinished PDFs"
                : `${lock ? "Protect" : "Unlock"} ${entries.length - ready.length} PDF${entries.length - ready.length === 1 ? "" : "s"}`}
            </Button>
          )}
          {lock && protectError && password && password === confirm && (
            <p className="text-xs text-red-600">{protectError}</p>
          )}
          {ready.length > 0 && (
            <Button
              className="w-full"
              variant="outline"
              onClick={() => execute(true)}
            >
              Download {ready.length} completed file
              {ready.length === 1 ? "" : "s"}
            </Button>
          )}
          <p className="text-xs leading-5 text-muted-foreground">
            20 PDFs · 50MB each · 200MB combined · 1,000 pages per PDF. A wrong
            password affects only that file. Signed/certified PDFs and XFA forms
            are rejected.
          </p>
        </>
      )}
    </FileToolLayout>
  );
}
