"use client";
import { useState } from "react";
import { templateExampleValues, type DocumentTemplate } from "@/lib/content/document-templates";
import { createDocumentTemplate, type TemplatePaper } from "@/lib/engines/document-template-engine";
import { downloadBlob } from "@/lib/download-file";
import { trackPseoAction } from "@/lib/analytics/events";

export function DocumentTemplateEditor({ template }: { template: DocumentTemplate }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [paper, setPaper] = useState<TemplatePaper>("a4");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const set = (key: string, value: string) => { setValues(current => ({ ...current, [key]: value })); setMessage(""); setError(""); };
  const download = async (blank: boolean) => {
    setBusy(true); setError(""); setMessage("");
    trackPseoAction("template_started", template.slug, "document", blank ? "blank" : "filled");
    try {
      const blob = await createDocumentTemplate(template, blank ? {} : values, paper);
      downloadBlob(blob, `${template.slug}-${paper}.pdf`);
      trackPseoAction("template_downloaded", template.slug, "document", blank ? "blank" : "filled");
      setMessage("Your fillable PDF is ready. Open it in a PDF reader to check the result and continue editing.");
    } catch (e) { setError(e instanceof Error ? e.message : "The PDF could not be created. Please try again."); trackPseoAction("template_failed", template.slug, "document", "generation"); }
    finally { setBusy(false); }
  };
  const style = "w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return <section id="editor" className="scroll-mt-24 rounded-2xl border bg-card p-5 text-card-foreground md:p-8" data-clarity-mask="True">
    <h2 className="text-2xl font-semibold">Customise your {template.name.toLowerCase()}</h2>
    <p className="mt-2 text-sm text-muted-foreground">Optional: fill the fields here, or download a blank PDF. Entries stay in this tab and are cleared when you leave. Latin characters are supported.</p>
    <div className="my-6 flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-sm font-medium">Paper size<select aria-label="Paper size" value={paper} onChange={e => setPaper(e.target.value as TemplatePaper)} className="rounded-lg border bg-background p-2"><option value="a4">A4</option><option value="letter">US Letter</option></select></label>
      <button type="button" disabled={busy} onClick={() => { setValues(templateExampleValues(template)); setError(""); setMessage(""); trackPseoAction("template_sample_loaded", template.slug, "document", "example"); }} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">Load example</button>
      <button type="button" disabled={busy} onClick={() => { setValues({}); setError(""); setMessage(""); }} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">Clear fields</button></div>
    <fieldset disabled={busy} className="min-w-0 space-y-5"><legend className="sr-only">Template contents</legend><div className="grid gap-4 sm:grid-cols-2">{template.fields.map(f => <label key={f.key} className="block text-sm font-medium">{f.label}<input className={`${style} mt-2`} value={values[f.key] ?? ""} onChange={e => set(f.key, e.target.value)} maxLength={80} autoComplete="off" /></label>)}</div>
      <div className="max-w-full overflow-x-auto rounded-lg border" tabIndex={0} role="region" aria-label="Editable template rows"><table className="w-full min-w-[580px] border-collapse text-left"><caption className="sr-only">{template.name} entries</caption><thead><tr>{template.columns.map((c, i) => <th key={i} scope="col" className="bg-muted px-3 py-3 text-sm" style={{ width: `${100 * c.weight / template.columns.reduce((s, col) => s + col.weight, 0)}%` }}>{c.label}</th>)}</tr></thead><tbody>{Array.from({ length: template.rows }, (_, row) => <tr key={row}>{template.columns.map((col, column) => { const key = `row-${row}-${column}`; return <td key={key} className="border-t p-1.5"><input aria-label={`Row ${row + 1} ${col.label}`} className={style} value={values[key] ?? ""} onChange={e => set(key, e.target.value)} maxLength={80} autoComplete="off" /></td>; })}</tr>)}</tbody></table></div>
      <label className="block text-sm font-medium">{template.notesLabel}<textarea className={`${style} mt-2`} rows={4} value={values.notes ?? ""} maxLength={400} onChange={e => set("notes", e.target.value)} /></label></fieldset>
    <div className="mt-6 flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => void download(false)} className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Creating PDF…" : "Download my PDF"}</button><button type="button" disabled={busy} onClick={() => void download(true)} className="rounded-xl border px-5 py-3 font-semibold hover:bg-muted disabled:opacity-50">Download blank PDF</button></div>
    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}{message && <p role="status" className="mt-4 text-sm">{message}</p>}
  </section>;
}
