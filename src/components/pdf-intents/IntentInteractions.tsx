"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { planPdfSize, SIZE_UNITS, type SizeUnit } from "@/lib/pdf-size-planner";
import { trackPdfIntent } from "@/lib/analytics/events";
import styles from "./intent.module.css";

const Compress = dynamic(() => import("@/app/compress-pdf/compress-pdf-client").then(module => module.CompressPdfClient));
const Merge = dynamic(() => import("@/app/merge-pdf/merge-pdf-client").then(module => module.MergePdfClient));
const SelectFilesContext = createContext<((files: File[]) => void) | null>(null);

/** Server-rendered page content is the landing slot of the existing processing workspace. */
export function IntentToolExperience({ tool, pageId, family, children }: { tool: "compress-pdf" | "merge-pdf"; pageId: string; family: "tool" | "task" | "guide"; children: ReactNode }) {
  const opened = useRef("");
  useEffect(() => {
    if (opened.current !== pageId) { opened.current = pageId; trackPdfIntent("pdf_workflow_opened", pageId, family, tool); }
  }, [pageId, family, tool]);
  const Client = tool === "compress-pdf" ? Compress : Merge;
  return <Client renderLanding={selectFiles => <SelectFilesContext.Provider value={files => {
    if (files.some(file => file.size <= 100 * 1024 * 1024)) trackPdfIntent("pdf_workflow_started", pageId, family, tool);
    selectFiles(files);
  }}>{children}</SelectFilesContext.Provider>} />;
}

export function ConnectedToolCard({ tool, title }: { tool: "compress-pdf" | "merge-pdf"; title: string }) {
  const selectFiles = useContext(SelectFilesContext);
  const input = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setReady(true), []);
  const merge = tool === "merge-pdf";
  function accept(files: File[]) {
    const pdfs = files.filter(file => file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf");
    if (pdfs.length !== files.length) {
      setError("Please select PDF files only.");
      return;
    }
    setError("");
    if (ready && pdfs.length) selectFiles?.(pdfs);
  }
  const rows = merge
    ? [["01-cover.pdf", "Start with the cover"], ["02-report.pdf", "Follow with the main document"], ["03-appendix.pdf", "Finish with supporting material"]]
    : [["Original PDF", "Keep a copy before you begin"], ["Compression level", "Choose the size and quality trade-off"], ["Smaller copy", "Check readability before sharing"]];
  return <section id="pdf-tool" aria-label={title} className={styles.toolCard}>
    <div className={styles.cardHeading}><h2>{title}</h2><span className={styles.badge}>IN YOUR BROWSER</span></div>
    <div className={`${styles.upload} ${dragging ? styles.dragging : ""}`}
      onDragOver={event => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={event => { event.preventDefault(); setDragging(false); accept(Array.from(event.dataTransfer.files)); }}>
      <span className={styles.plus} aria-hidden="true">+</span>
      <input ref={input} className={styles.fileInput} tabIndex={-1} type="file" accept="application/pdf,.pdf" multiple aria-label="Choose PDF files" disabled={!ready} onChange={event => { accept(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
      <button type="button" className={styles.button} disabled={!ready || !selectFiles} onClick={() => input.current?.click()}>Select PDF files <span aria-hidden="true">↗</span></button>
      <p>or drop PDFs here · 100 MB max per file</p>
      <p>{merge ? "Add two or more PDFs. Arrange them in the next step." : "Choose a compression level in the next step."}</p>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <p className={styles.eyebrow}>{merge ? "Example document order" : "Your file’s next steps"}</p>
    <ol className={styles.sampleList}>{rows.map(([name, detail], index) => <li key={name}>
      <span className={styles.fileIcon} aria-hidden="true">PDF</span><div><strong>{name}</strong><p>{detail}</p></div><span className={styles.fileOrder}>0{index + 1}</span>
    </li>)}</ol>
    <div className={styles.output}>Output <strong>{merge ? "merged.pdf" : "A compressed copy of your PDF"}</strong></div>
    <p className={styles.note}>{merge ? "Illustrative order above. Your own files appear after selection." : "Rebuilt pages become images and lose selectable text. Keep the original for searchable text or interactive fields."}</p>
    <p className={styles.note}>Free · No sign-up · PDF files stay on your device</p>
  </section>;
}

export function ReviewChecklist({ items }: { items: string[] }) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  return <div><ul className={styles.checklist}>{items.map((item, index) => <li key={item}><label>
    <input type="checkbox" checked={checked.has(index)} onChange={event => setChecked(previous => { const next = new Set(previous); if (event.target.checked) next.add(index); else next.delete(index); return next; })} /><span>{item}</span>
  </label></li>)}</ul><p className={styles.note} role="status" aria-live="polite">{checked.size} of {items.length} checks complete. Selections are not saved.</p></div>;
}

export function SizePlanner() {
  const [current, setCurrent] = useState("12");
  const [maximum, setMaximum] = useState("10");
  const [headroom, setHeadroom] = useState("5");
  const [currentUnit, setCurrentUnit] = useState<SizeUnit>("MB");
  const [maximumUnit, setMaximumUnit] = useState<SizeUnit>("MB");
  const result = planPdfSize(current, maximum, headroom, currentUnit, maximumUnit);
  const units = Object.keys(SIZE_UNITS) as SizeUnit[];
  const target = result ? result.target.toLocaleString("en", { maximumSignificantDigits: 6 }) : "";
  return <section className={styles.planner} id="size-planner" aria-labelledby="planner-heading">
    <p className={styles.eyebrow}>Interactive size planner</p><h2 id="planner-heading">Find your working file-size target.</h2>
    <p>Enter the actual limit from your destination. These sample values are editable.</p>
    <div className={styles.plannerFields}>
      <div><label htmlFor="current-size">Current PDF size</label><div className={styles.sizeField}><input id="current-size" type="number" min="0" step="any" value={current} onChange={event => setCurrent(event.target.value)} /><select aria-label="Current size unit" value={currentUnit} onChange={event => setCurrentUnit(event.target.value as SizeUnit)}>{units.map(unit => <option key={unit}>{unit}</option>)}</select></div></div>
      <div><label htmlFor="max-size">Destination maximum</label><div className={styles.sizeField}><input id="max-size" type="number" min="0" step="any" value={maximum} onChange={event => setMaximum(event.target.value)} /><select aria-label="Maximum size unit" value={maximumUnit} onChange={event => setMaximumUnit(event.target.value as SizeUnit)}>{units.map(unit => <option key={unit}>{unit}</option>)}</select></div></div>
      <div><label htmlFor="headroom">Optional headroom (%)</label><input id="headroom" type="number" min="0" max="99.99" step="any" value={headroom} onChange={event => setHeadroom(event.target.value)} /></div>
    </div>
    <div className={styles.plannerResult} role="status" aria-live="polite" aria-atomic="true">
      {result ? <><div><span>Working target</span><strong>{target} {result.unit}</strong></div><p>{result.reduction > 0 ? `${result.reduction.toFixed(1)}% reduction needed from your current file.` : "Your current size already meets this working target."}</p></> : <p>Enter positive file sizes and headroom from 0% to less than 100%.</p>}
    </div>
    <p className={styles.note}>Target = maximum × (1 − headroom ÷ 100). Units are converted before comparing sizes. This planner does not read or compress files, guarantee an achievable size, or predict upload acceptance. Values stay in this page.</p>
  </section>;
}
