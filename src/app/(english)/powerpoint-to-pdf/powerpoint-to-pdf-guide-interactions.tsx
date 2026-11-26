"use client";
import { useId, useRef, useState } from "react";
const assets = "/images/powerpoint-to-pdf/";
const heights: Record<string, number> = { "powerpoint-1.webp": 1000, "powerpoint-2.webp": 1000, "powerpoint-3.webp": 1052, "powerpoint-4.webp": 405, "powerpoint-5.webp": 1052 };
type Shot = { src: string; alt: string; caption: string };
type Step = { title: string; text: string; src: string; alt: string };
export function Screenshot({ src, alt, caption }: Shot) {
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const captionId = useId();
  const [opened, setOpened] = useState(false);
  return <figure className="figure">
    <button type="button" className="zoom" ref={trigger} aria-label={`Enlarge: ${alt}`} aria-haspopup="dialog" onClick={() => { setOpened(true); dialog.current?.showModal(); }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- optimized original screenshot with intrinsic dimensions. */}
      <img loading="lazy" decoding="async" src={assets + src} alt={alt} width={src === "powerpoint-4.webp" ? 720 : 1440} height={heights[src]} />
    </button>
    <figcaption>{caption} <span>Click to enlarge</span>
    </figcaption>
    <dialog ref={dialog} className="modal" aria-labelledby={captionId} onClose={() => { setOpened(false); trigger.current?.focus({ preventScroll: true }); }} onClick={e => { if(e.target === e.currentTarget) dialog.current?.close(); }}>
      <div className="modalhead">
        <strong id={captionId}>{alt}</strong>
        <button type="button" autoFocus onClick={() => dialog.current?.close()}>Close ×</button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- full screenshot is loaded only when requested. */}
      {opened && <img src={assets + src} alt={alt} />}
    </dialog>
  </figure>;
}
export function Gallery({ steps }: { steps: Step[] }) {
  const [active, setActive] = useState(0), step = steps[active];
  return <div className="gallery">
    <div className="stepcol" role="group" aria-label="PowerPoint conversion screenshots">
      {steps.map((item, i) =>
        <button key={item.title} type="button" className={`step${active === i ? " active" : ""}`} aria-pressed={active === i} onClick={() => setActive(i)}>
          <span className="stepno" aria-hidden="true">{i + 1}</span>
          <span>
            <strong>{item.title}</strong>
            <span className="step-description">{item.text}</span>
          </span>
        </button>)}
    </div>
    <div className="shotcol">
      <Screenshot src={step.src} alt={step.alt} caption={step.alt} />
    </div>
  </div>;
}
const routes = {
  pptx: ["PPTX", "Standard slide content", "A presentation containing supported text, pictures and drawings.", "Convert, then inspect", "Check each PDF page before sharing. Font substitution or layout differences can occur."],
  legacy: ["PPT", "Older PowerPoint format", "The current PDFPilot converter does not accept legacy PPT files.", "Use a supported export route", "Open the presentation in PowerPoint and export a PDF, or save a supported PPTX copy first."],
  special: ["SLIDES", "Notes, handouts or complex content", "A specialist layout or an unsupported slide feature needs the original application.", "Export from PowerPoint", "Use native export settings and verify the PDF. Do not treat unsupported content as preserved."],
};
export function RouteIllustration() {
  const [route, setRoute] = useState<keyof typeof routes>("pptx");
  const values = routes[route];
  return <div className="concept" aria-label="Conversion route illustration">
    <div className="concept-title">Choose a route for the file you have</div>
    <div className="conceptcontrols" role="group" aria-label="Presentation scenario">
      {([['pptx', 'Supported PPTX'], ['legacy', 'Legacy PPT'], ['special', 'Notes or complex slides']] as const).map(([key, label]) => <button type="button" key={key} aria-pressed={route === key} onClick={() => setRoute(key)}>{label}</button>)}
    </div>
    <div className="diagramrow" aria-live="polite">
      <div className="paper">
        <span className="file-chip">{values[0]}</span>
        <strong>{values[1]}</strong>
        <p>{values[2]}</p>
      </div>
      <div className="diagramarrow" aria-hidden="true">→</div>
      <div className="paper output">
        <span className="file-chip">PDF</span>
        <strong>{values[3]}</strong>
        <p>{values[4]}</p>
      </div>
    </div>
    <small>Original route illustration. A PDF is static; it does not preserve a live slideshow experience.</small>
  </div>;
}
export function ReturnToTool() {
  function go() {
    const tool = document.getElementById("powerpoint-to-pdf-tool");
    if(!tool) return;
    tool.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    const button = Array.from(tool.querySelectorAll<HTMLButtonElement>("button:not([disabled])")).find(x => /^(Select PowerPoint files|Start over|Add more files)$/i.test(x.textContent?.trim() ?? "") || x.getAttribute("aria-label") === "Add more files");
    (button ?? tool).focus({ preventScroll: true });
  }
  return <button type="button" className="primary" onClick={go}>Select PowerPoint files</button>;
}
