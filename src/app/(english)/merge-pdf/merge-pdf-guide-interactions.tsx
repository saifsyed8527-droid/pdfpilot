"use client";

import { useId, useRef, useState } from "react";

const assets = "/images/merge-pdf/";

/** Original product captures from the supplied HTML; no uploaded user documents. */
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
        <img src={assets + src} alt={alt} width={diagram ? 1300 : 1440} height={diagram ? 400 : src === "select-pdfs.webp" ? 1167 : src === "arrange-pdfs.webp" ? 847 : 1325} loading="lazy" decoding="async" />
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

const steps = [
  { text: "Select your PDFs. Choose Select PDF files, or drag your PDFs into the upload area. If you missed a document, use Add more PDFs. Check the filenames before moving on.", image: "select-pdfs.webp", alt: "PDFPilot Merge PDF file selection area." },
  { text: "Arrange the files. Under Arrange your PDFs, review the file cards in order. Drag them into the sequence you need. Use A–Z or Z–A if alphabetical filename order matches your intended result.", image: "arrange-pdfs.webp", alt: "B.pdf placed before A.pdf in the selected-file list before merging." },
  { text: "Merge the documents. Select the merge button. With two files selected, it reads Merge 2 PDFs; the number changes with your selection. The files merge in the order shown.", image: "arrange-pdfs.webp", alt: "Merge 2 PDFs button below the selected PDF files." },
  { text: "Download and check. When Your file is ready appears, use Download PDF if the automatic download has not already saved it. Open the result and check its pages before sharing it.", image: "download-pdf.webp", alt: "PDFPilot result screen with the Download PDF action." },
];

export function Walkthrough() {
  const [active, setActive] = useState(0);
  const step = steps[active];
  return (
    <div className="gallery">
      <ol className="stepcol" aria-label="Four steps to merge PDF files">
        {steps.map((item, index) => <li key={item.text}>
          <button type="button" className={`step${active === index ? " active" : ""}`} aria-pressed={active === index} onClick={() => setActive(index)}>
            <span className="stepno" aria-hidden="true">{index + 1}</span><span>{item.text}</span>
          </button>
        </li>)}
      </ol>
      <div className="shotcol">
        <Screenshot src={step.image} alt={step.alt} caption={active === 0 ? "PDFPilot: select your PDF files" : `How to merge PDF files: step ${active + 1}`} />
        <div className="thumbstrip" role="group" aria-label="Walkthrough screenshots">
          {steps.map((item, index) => <button type="button" key={item.text} className={active === index ? "active" : ""} aria-label={`Show step ${index + 1}`} aria-pressed={active === index} onClick={() => setActive(index)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative thumbnail of the same cached screenshot. */}
            <img src={assets + item.image} alt="" width="1440" height="1000" loading="lazy" decoding="async" /><small>Step {index + 1}</small>
          </button>)}
        </div>
      </div>
    </div>
  );
}

export function FileOrderExample() {
  const [reversed, setReversed] = useState(false);
  return (
    <div className="flow">
      <div className="flowhead"><strong>Two documents → one PDF</strong><button type="button" className="smallbutton" aria-pressed={reversed} onClick={() => setReversed(!reversed)}>Swap file order</button></div>
      <Screenshot diagram src={reversed ? "file-order-b-a.svg" : "file-order-a-b.svg"}
        alt={reversed ? "File B before File A: two two-page PDFs become one PDF with pages B1, B2, A1, A2." : "File A before File B: two two-page PDFs become one PDF with pages A1, A2, B1, B2."}
        caption="Illustrative example · two documents combined in the chosen file order" />
      <p className="resultlabel" aria-live="polite">One PDF · 4 pages · {reversed ? "B before A" : "A before B"}</p>
      <small>Illustration of document order, not a screenshot.</small>
    </div>
  );
}

export function ReturnToTool() {
  function returnToTool() {
    const tool = document.getElementById("merge-pdf-tool");
    if (!tool) return;
    tool.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    // Focus the existing selection action without opening the file picker.
    const button = Array.from(tool.querySelectorAll<HTMLButtonElement>("button:not([disabled])"))
      .find((element) => /^(Select PDF files|Add more PDFs|Start over)$/.test(element.textContent?.trim() ?? "") || element.getAttribute("aria-label") === "Add more PDFs");
    (button ?? tool).focus({ preventScroll: true });
  }
  return <button type="button" className="primary" onClick={returnToTool}>Select PDF files</button>;
}
