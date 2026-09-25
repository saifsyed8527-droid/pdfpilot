"use client";

import { useState } from "react";
import { useDropzone, type Accept } from "react-dropzone";
import { Upload, FlaskConical } from "lucide-react";
import type { TemplateSession } from "@/lib/content/conversion-templates";

/** Same local-file intake as the main workspaces. Samples are first-party fixtures. */
export function TemplateFilePicker({ session, accept, label, onFiles }: { session: TemplateSession; accept: Accept; label: string; onFiles: (files: File[]) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const select = (files: File[]) => { setError(""); onFiles(files); };
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ accept, multiple: true, maxSize: 100 * 1024 * 1024, disabled: loading, onDropAccepted: select, onDropRejected: () => setError("Choose supported files up to 100 MB each.") });
  const trySample = async () => {
    setLoading(true); setError("");
    try {
      const files = await Promise.all(session.samples.map(async name => {
        if (!/^[a-z0-9-]+\.(jpg|png|docx|pptx)$/.test(name)) throw new Error("Invalid sample");
        const response = await fetch(`/template-samples/${name}`);
        if (!response.ok) throw new Error("Sample unavailable");
        const blob = await response.blob();
        return new File([blob], name, { type: blob.type });
      }));
      select(files);
    } catch { setError("The sample could not be loaded. You can still choose your own files."); }
    finally { setLoading(false); }
  };
  return <div className="mx-auto max-w-3xl p-5 md:p-8">
    <div {...getRootProps()} className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center outline-none focus-visible:ring-2 focus-visible:ring-primary ${isDragActive ? "border-primary bg-muted" : "border-border bg-card text-card-foreground"}`}>
      <input {...getInputProps()} aria-label={label} />
      <Upload className="mx-auto mb-4 h-7 w-7 text-primary" aria-hidden />
      <span className="inline-flex rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground">{label}</span>
      <p className="mt-4 text-sm text-muted-foreground">Or drop files here · 100 MB per file · no uploads</p>
    </div>
    <div className="mt-5 text-center"><button type="button" onClick={trySample} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"><FlaskConical className="h-4 w-4" aria-hidden />{loading ? "Loading sample files…" : "Try with sample files"}</button><p className="mt-2 text-xs text-muted-foreground">Original PDFPilot examples. Your own documents are never used as public samples.</p></div>
    {error && <p role="alert" className="mt-4 text-center text-sm text-red-700 dark:text-red-300">{error}</p>}
  </div>;
}
