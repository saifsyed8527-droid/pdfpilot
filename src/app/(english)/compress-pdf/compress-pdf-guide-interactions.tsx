"use client";
import { useId, useRef, useState } from "react";
const assets = "/images/compress-pdf/";
const heights: Record<string, number> = { "compress-1.webp": 712, "compress-2.webp": 947, "compress-3.webp": 997, "compress-4.webp": 936, "compress-5.webp": 997 };
type Shot = { src: string; alt: string; caption: string };
type Step = { title: string; text: string; src: string; alt: string };
export function Screenshot({ src, alt, caption }: Shot) {
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const captionId = useId();
  const [opened, setOpened] = useState(false);
  return <figure className="figure">
    <button type="button" className="zoom" ref={trigger} aria-label={`Enlarge: ${alt}`} aria-haspopup="dialog" onClick={() => { setOpened(true); dialog.current?.showModal(); }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- optimized original screenshot with intrinsic dimensions. */}
      <img loading="lazy" decoding="async" src={assets + src} alt={alt} width={1440} height={heights[src]} />
    </button>
    <figcaption>{caption} <span>Click to enlarge</span>
    </figcaption>
    <dialog ref={dialog} className="modal" aria-labelledby={captionId} onClose={() => { setOpened(false); trigger.current?.focus({ preventScroll: true }); }} onClick={e => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
      <div className="modalhead">
        <strong id={captionId}>{alt}</strong>
        <button type="button" autoFocus onClick={() => dialog.current?.close()}>Close ×</button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- full screenshot is loaded only when requested. */}
      {opened && <img src={assets + src} alt={alt} />}
    </dialog>
  </figure>;
}
export function Gallery({ steps, ordered = false }: { steps: Step[]; ordered?: boolean }) {
  const [active, setActive] = useState(0), step = steps[active];
  const List = ordered ? "ol" : "ul";
  return <div className="gallery">
    <List className="stepcol" aria-label={ordered ? "Four steps to compress a PDF" : "Compression setting screenshots"}>
      {steps.map((item, i) =>
        <li key={item.title}>
          <button type="button" className={`step${active === i ? " active" : ""}`} aria-pressed={active === i} onClick={() => setActive(i)}>
            <span className="stepno" aria-hidden="true">{i + 1}</span>
            <span>
              <strong>{item.title}</strong>
              <span className="step-description">{item.text}</span>
            </span>
          </button>
        </li>)}
    </List>
    <div className="shotcol">
      <Screenshot src={step.src} alt={step.alt} caption={step.alt} />
    </div>
  </div>;
}
export function MethodIllustration() {
  const [flat, setFlat] = useState(false);
  return <div className="concept" aria-label="Illustrated compression methods">
    <div className="concept-title">Method illustration</div>
    <div className="conceptcontrols" role="group" aria-label="Illustrated method">
      <button type="button" aria-pressed={!flat} onClick={() => setFlat(false)}>Keep text and forms</button>
      <button type="button" aria-pressed={flat} onClick={() => setFlat(true)}>Image-only pages</button>
    </div>
    <div className="diagramrow">
      <div className="paper">
        <strong>Original PDF</strong>
        <ul>
          <li>Searchable text</li>
          <li>Links and form fields</li>
          <li>Images and page layout</li>
        </ul>
      </div>
      <div className="diagramarrow" aria-hidden="true">→</div>
      <div className={`paper${flat ? " raster" : ""}`} aria-live="polite">
        <strong>{flat ? "Image-based PDF pages" : "Native PDF content"}</strong>
        <ul>{(flat ? ["Page appearance stored as images", "Text and links lose interactivity", "Keep the original for later editing"] : ["Text and interactive features remain native", "Image quality can still change", "Inspect the downloaded result"]).map(x =>
          <li key={x}>{x}</li>)}</ul>
        <span className="tinybadge">Output: PDF</span>
      </div>
    </div>
    <small>Conceptual illustration, not a screenshot or a guarantee for every PDF. The original can be returned when an unrotated file would not become smaller.</small>
  </div>;
}
export function ReturnToTool() {
  function go() { const tool = document.getElementById("compress-pdf-tool"); if (!tool) return; tool.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }); const button = Array.from(tool.querySelectorAll<HTMLButtonElement>("button:not([disabled])")).find(x => /^(Select PDF files|Start over)$/i.test(x.textContent?.trim() ?? "") || x.getAttribute("aria-label") === "Add more PDFs"); (button ?? tool).focus({ preventScroll: true }); }
  return <button type="button" className="primary" onClick={go}>Select PDF files</button>;
}
