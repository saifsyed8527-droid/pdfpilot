"use client";
import { useId, useRef, useState } from "react";
const assets="/images/split-pdf/";
const dimensions: Record<string, number>={"split-1.webp":1167,"split-2.webp":847,"split-3.webp":847,"split-4.webp":1541,"split-5.svg":420,"split-6.webp":1449};
export function Screenshot({
  src, alt, caption, diagram = false,
}: { src: string; alt: string; caption: string; diagram?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const captionId = useId();
  const [opened, setOpened] = useState(false);

  function enlarge() {
    setOpened(true);
    dialog.current?.showModal();
  }

  return (
    <figure className={`figure${diagram ? " brief-diagram" : ""}`}>
      {!diagram && <div className="panelbar"><span><i className="livepoint" aria-hidden="true" />Inside PDFPilot</span><span>Click to enlarge ↗</span></div>}
      <button type="button" className="zoom" ref={trigger} onClick={enlarge} aria-label={`Enlarge: ${alt}`} aria-haspopup="dialog">
        {/* eslint-disable-next-line @next/next/no-img-element -- already optimized local reference assets; preserve the original screenshot. */}
        <img src={assets + src} alt={alt} width={diagram ? 1300 : 1440} height={dimensions[src] ?? 847} loading="lazy" decoding="async" />
      </button>
      <figcaption>{caption}{!diagram && <span>Click to enlarge ↗</span>}</figcaption>
      <dialog ref={dialog} className="modal" aria-labelledby={captionId}
        onClose={() => { setOpened(false); trigger.current?.focus({ preventScroll: true }); }}
        onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
        <div className="modalhead"><strong id={captionId}>{alt}</strong><button type="button" autoFocus onClick={() => dialog.current?.close()}>Close ×</button></div>
        {/* eslint-disable-next-line @next/next/no-img-element -- the same local reference asset, loaded only after opening. */}
        {opened && <img src={assets + src} alt={alt} />}
      </dialog>
    </figure>
  );
}


const steps=[{"text":"Select your PDF. Choose Select PDF file and wait for the page preview and page count. Use the preview to identify the boundaries between the sections you want.","alt":"How to split PDF pages: step 1","src":"split-1.webp","width":1440,"height":1167},{"text":"Enter your ranges. Under Split options, choose Range, then Custom. Fill in From page and To page for the first group. Use Add Range for each additional group.","alt":"How to split PDF pages: step 2","src":"split-2.webp","width":1440,"height":847},{"text":"Keep the outputs separate. Leave Merge all ranges in one PDF file unchecked when you want separate PDF files. Review the preview and the number of PDFs to create, then choose Split PDF.","alt":"How to split PDF pages: step 3","src":"split-2.webp","width":1440,"height":847},{"text":"Download the results. For multiple range outputs, use Download ZIP. Open the archive and check the PDFs inside before sending or saving them elsewhere.","alt":"How to split PDF pages: step 4","src":"split-6.webp","width":1440,"height":1449}];
export function Walkthrough() {
  const [active, setActive] = useState(0);
  const step = steps[active];
  return (
    <div className="gallery">
      <ol className="stepcol" aria-label="Four steps to split PDF pages">
        {steps.map((item, index) => <li key={item.text}>
          <button type="button" className={`step${active === index ? " active" : ""}`} aria-pressed={active === index} onClick={() => setActive(index)}>
            <span className="stepno" aria-hidden="true">{index + 1}</span><span>{item.text}</span>
          </button>
        </li>)}
      </ol>
      <div className="shotcol">
        <Screenshot src={step.src} alt={step.alt} caption={active === 0 ? "PDFPilot: select your PDF file" : `How to split PDF pages: step ${active + 1}`} />
        <div className="thumbstrip" role="group" aria-label="Walkthrough screenshots">
          {steps.map((item, index) => <button type="button" key={item.text} className={active === index ? "active" : ""} aria-label={`Show step ${index + 1}`} aria-pressed={active === index} onClick={() => setActive(index)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative thumbnail of the same cached screenshot. */}
            <img src={assets + item.src} alt="" width="1440" height="1000" loading="lazy" decoding="async" /><small>Step {index + 1}</small>
          </button>)}
        </div>
      </div>
    </div>
  );
}


export function ResultShowcase() {
 const [result,setResult]=useState(false);
 return <div className="result-showcase"><div className="screen-tabs"><button type="button" className="smallbutton" aria-pressed={!result} onClick={()=>setResult(false)}>Fixed interval 1</button><button type="button" className="smallbutton" aria-pressed={result} onClick={()=>setResult(true)}>6 PDFs created</button></div><Screenshot src={result ? "split-4.webp" : "split-3.webp"} alt={result ? "Six one-page PDFs created, with Download ZIP available" : "Fixed splitting set to one page per file."} caption={result ? "PDFPilot · Fixed interval 1 → 6 PDFs created" : "PDFPilot · Save individual pages as separate PDFs"} /></div>;
}
export function RangeExample() {
 const [count,setCount]=useState(3);
 return <div className="flow"><div className="flowhead"><strong>One six-page PDF → separate PDFs</strong></div><Screenshot diagram src="split-5.svg" alt="One six-page PDF becomes three PDFs: pages 1–2, 3–4 and 5–6." caption="Illustrative example · three separate page groups" /><div className="flowhead"><strong>Try a grouping</strong><div>{[2,3].map(n=><button type="button" key={n} className="smallbutton" aria-pressed={count===n} onClick={()=>setCount(n)}>{n} files</button>)}</div></div><div className="flowresult" aria-live="polite">{(count===2 ? ["Pages 1–3","Pages 4–6"] : ["Pages 1–2","Pages 3–4","Pages 5–6"]).map(text=><span className="group" key={text}>{text}</span>)}</div><small>Interactive grouping example. The illustration above shows three files.</small></div>;
}
export function ReturnToTool() {
  function returnToTool() {
    const tool = document.getElementById("split-pdf-tool");
    if (!tool) return;
    tool.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    // Focus the existing selection action without opening the file picker.
    const button = Array.from(tool.querySelectorAll<HTMLButtonElement>("button:not([disabled])"))
      .find((element) => /^(Select PDF file|Change file|Start over)$/i.test(element.textContent?.trim() ?? "") || element.getAttribute("aria-label") === "Add more PDFs");
    (button ?? tool).focus({ preventScroll: true });
  }
  return <button type="button" className="primary" onClick={returnToTool}>Select PDF file</button>;
}
