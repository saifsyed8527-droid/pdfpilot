import Link from "next/link";
import styles from "./compress-pdf-guide.module.css";
import { Gallery, Screenshot, MethodIllustration, ReturnToTool } from "./compress-pdf-guide-interactions";
const galleries = [
  [
    {
      "title": "Select your files.",
      "text": "Choose Select PDF files and pick the PDFs from your device. Review the filenames under Your PDFs. Use Add more PDFs if another document belongs in the batch.",
      "src": "compress-1.webp",
      "alt": "PDFPilot production · Select your files. · 24 Nov 2026 IST"
    },
    {
      "title": "Choose your settings.",
      "text": "Select a Compression method, then a compression level. The method determines how document features are handled; the level affects the size and image-quality tradeoff.",
      "src": "compress-2.webp",
      "alt": "PDFPilot production · Choose your settings. · 24 Nov 2026 IST"
    },
    {
      "title": "Run the compression.",
      "text": "Choose Compress 1 PDF for one selected file. The button label changes with the number of files you have selected. Let processing finish.",
      "src": "compress-3.webp",
      "alt": "PDFPilot production · Run the compression. · 24 Nov 2026 IST"
    },
    {
      "title": "Review and download.",
      "text": "Your PDF is ready shows the original and result sizes, with Download PDF for a single file. A batch shows Your PDFs are ready, individual Download controls and Download ZIP. Downloads also start automatically. Open the saved file or ZIP contents and check the PDFs.",
      "src": "compress-4.webp",
      "alt": "PDFPilot production · Review and download. · 24 Nov 2026 IST"
    }
  ],
  [
    {
      "title": "Compression levels",
      "text": "Actual level choices in the current tool.",
      "src": "compress-2.webp",
      "alt": "PDFPilot production · levels · 24 Nov 2026 IST"
    },
    {
      "title": "Lossless images",
      "text": "The separate option belongs to Keep text and forms.",
      "src": "compress-5.webp",
      "alt": "PDFPilot production · lossless checkbox · 24 Nov 2026 IST"
    }
  ]
];
const figures = [
  {
    "src": "compress-4.webp",
    "alt": "PDFPilot result screen for a synthetic two-page PDF",
    "caption": "Actual synthetic test · 2,467,481 bytes → 2,190,669 bytes with Recommended Compression. This sample is not a predicted saving."
  }
];
export function CompressPdfGuide() {
  return <div className={styles.guide}>
    <nav className="toc" aria-label="On this page">
      <div className="wrap">
        <a href="#C02">{"How it works"}</a>
        <a href="#C03">{"Methods"}</a>
        <a href="#C04">{"Quality"}</a>
        <a href="#C05">{"Check the result"}</a>
        <a href="#C06">{"Upload limits"}</a>
        <a href="#C07">{"File handling"}</a>
        <a href="#C08">{"FAQs"}</a>
        <a href="#C09">{"Related tools"}</a>
        <a href="#C10">{"Get started"}</a>
      </div>
    </nav>
    <section className="section wrap editorial" id="C02" data-section="C02">
      <div className="sectionline">
        <span className="number">{"02"}</span>
        <h2>{"How to compress a PDF"}</h2>
      </div>
      <div className="copy">
        <p>{"Start with your original PDF and keep a copy. The same workflow applies whether you need a smaller email attachment or a document that fits an upload limit."}</p>
      </div>
      <Gallery steps={galleries[0]} ordered={true} />
    </section>
    <section className="section wrap editorial" id="C03" data-section="C03">
      <div className="sectionline">
        <span className="number">{"03"}</span>
        <h2>{"Choose the right compression method"}</h2>
      </div>
      <div className="copy">
        <h3 id="C03-H01">{"Keep text and forms"}</h3>
        <p>{"Choose this method when you need searchable text, links and editable form fields. It works with the document’s native PDF content. Image quality can still change, so check the details and interactive features you rely on after compression."}</p>
        <h3 id="C03-H02">{"Image-only pages (flatten)"}</h3>
        <p>{"A flattened output stores each page as an image inside a PDF. Searchable text, clickable links and editable fields no longer remain interactive. Keep the original if you will need those features later. The download remains a PDF, not a set of JPG files."}</p>
        <p>{"Check the result message: if an unrotated document would not become smaller, the tool can return the original instead of flattened output."}</p>
        <div className="tablewrap">
          <table className="decisiontable">
            <thead>
              <tr>
                <th scope="col">{"Method"}</th>
                <th scope="col">{"Main decision"}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{"Keep text and forms"}</td>
                <td>{"Use when native text and interactive features matter; inspect them in the result."}</td>
              </tr>
              <tr>
                <td>{"Image-only pages (flatten)"}</td>
                <td>{"Use only when image-based pages suit the task and losing interactivity is acceptable."}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <MethodIllustration />
    </section>
    <section className="section wrap editorial" id="C04" data-section="C04">
      <div className="sectionline">
        <span className="number">{"04"}</span>
        <h2>{"Balance file size and readability"}</h2>
      </div>
      <div className="copy">
        <p>{"To shrink PDF file size, choose the tradeoff that suits your document. A smaller file is useful only if the recipient can still read and use it."}</p>
        <h3 id="C04-H01">{"Recommended Compression"}</h3>
        <p>{"Start here for a balance between image quality and file size. Compare the output with the original before deciding whether you need a stronger setting."}</p>
        <h3 id="C04-H02">{"Extreme Compression"}</h3>
        <p>{"This prioritizes stronger image reduction. Fine text inside images, diagrams and photographs may lose detail. Check those areas rather than judging the result by file size alone."}</p>
        <h3 id="C04-H03">{"Less Compression and lossless images"}</h3>
        <p>{"Less Compression favors higher image quality, with potentially smaller savings. The separate Preserve image quality (lossless) option avoids reducing image quality, but the file may change very little. Neither option guarantees that every PDF feature stays unchanged or that the result reaches a particular size."}</p>
      </div>
      <Gallery steps={galleries[1]} ordered={false} />
    </section>
    <section className="section wrap editorial" id="C05" data-section="C05">
      <div className="sectionline">
        <span className="number">{"05"}</span>
        <h2>{"Check your compressed PDF before sharing"}</h2>
      </div>
      <div className="copy">
        <p>{"Use the result screen to compare the input and output sizes. Then open the downloaded PDF and check what the recipient needs:"}</p>
        <ul className="checklist">
          <li>{"Read small text and inspect important image details at a useful zoom level."}</li>
          <li>{"Confirm the page count and orientation."}</li>
          <li>{"Try text selection or search, links and form fields if the document depends on them."}</li>
          <li>{"Check the downloaded file size against the destination’s limit, using the same units."}</li>
        </ul>
        <p>{"Keep the original until you have finished these checks. A reduction in file size is not, by itself, proof that the document is ready to send."}</p>
      </div>
      <div className="comparison-shot">
        <Screenshot {...figures[0]} />
      </div>
    </section>
    <section className="section wrap editorial" id="C06" data-section="C06">
      <div className="sectionline">
        <span className="number">{"06"}</span>
        <h2>{"Need a PDF below a specific size?"}</h2>
      </div>
      <div className="copy">
        <p>{"An upload form might require a PDF below 100 KB, 200 KB or 500 KB; another may allow 1 MB or 2 MB. These are destination limits, not sizes this tool can guarantee."}</p>
        <p>{"Note the allowed size first. Compress the PDF, compare the downloaded file with that limit, and check its readability. There is no exact-size input that promises a chosen KB or MB result."}</p>
        <p>{"Different documents allow different reductions. An already compact PDF may change little. If a stronger setting makes important details difficult to read, keep a clearer version. When you cannot meet the limit at acceptable quality, check which other document or submission options the recipient allows."}</p>
      </div>
      <div className="concept">
        <div className="concept-title">{"Check the destination, then check the result"}</div>
        <div className="limitsflow">
          <div className="flowstep">
            <span className="stepno">{"1"}</span>
            <strong>{"Read the upload limit"}</strong>
            <p>{"Use the size and units required by the destination."}</p>
          </div>
          <div className="flowstep">
            <span className="stepno">{"2"}</span>
            <strong>{"Compress and inspect"}</strong>
            <p>{"Choose a method and level suited to the document."}</p>
          </div>
          <div className="flowstep">
            <span className="stepno">{"3"}</span>
            <strong>{"Check the downloaded file"}</strong>
            <p>{"Compare size and readability before sending it."}</p>
          </div>
        </div>
        <small>{"Original workflow illustration. A particular KB or MB output is not guaranteed."}</small>
      </div>
    </section>
    <section className="section wrap editorial" id="C07" data-section="C07">
      <div className="sectionline">
        <span className="number">{"07"}</span>
        <h2>{"File handling, limits and cost"}</h2>
      </div>
      <div className="copy">
        <h3 id="C07-H01">{"Processing and privacy"}</h3>
        <p>{"Local files are processed in your browser. URL imports and external resources may use server requests. Browser processing does not mean the entire website makes no network requests or works offline."}</p>
        <h3 id="C07-H02">{"File and page limits"}</h3>
        <p>{"The tool displays these limits:"}</p>
        <div className="tablewrap">
          <table className="decisiontable">
            <thead>
              <tr>
                <th scope="col">{"Limit"}</th>
                <th scope="col">{"Displayed maximum"}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{"PDFs in one batch"}</td>
                <td>{"20 PDFs"}</td>
              </tr>
              <tr>
                <td>{"Size of each file"}</td>
                <td>{"100 MB"}</td>
              </tr>
              <tr>
                <td>{"Combined file size"}</td>
                <td>{"200 MB"}</td>
              </tr>
              <tr>
                <td>{"Keep text and forms"}</td>
                <td>{"1,000 pages"}</td>
              </tr>
              <tr>
                <td>{"Image-only pages"}</td>
                <td>{"200 pages"}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>{"Encrypted, signed/certified and XFA PDFs are not supported. A file meeting a displayed limit still needs to be readable and compatible with the chosen method."}</p>
        <h3 id="C07-H03">{"Is PDF compression free?"}</h3>
        <p>{"Yes. Basic compression and downloading are available without payment or account creation. The file and page limits still apply; no-cost access is not a promise of unlimited processing."}</p>
      </div>
    </section>
    <section className="section wrap editorial" id="C08" data-section="C08">
      <div className="sectionline">
        <span className="number">{"08"}</span>
        <h2>{"Questions about PDF compression"}</h2>
      </div>
      <details className="faq">
        <summary>
          <h3 id="C08-H01">{"Why did the file size stay the same?"}</h3>
          <span aria-hidden="true">{"⌄"}</span>
        </summary>
        <div className="answer">
          <p>{"The selected setting may not make that PDF smaller. Without rotation, the tool can return the original when compression would not help. Read the result message before assuming something failed; repeatedly processing an already efficient file does not guarantee further savings."}</p>
        </div>
      </details>
      <details className="faq">
        <summary>
          <h3 id="C08-H02">{"Can I compress a scanned PDF?"}</h3>
          <span aria-hidden="true">{"⌄"}</span>
        </summary>
        <div className="answer">
          <p>{"Yes. Scanned PDFs contain images, and the result depends on their detail and your settings. Inspect small print and faint marks carefully. Compression does not add searchable text to a scan or restore detail that was missing from the original."}</p>
        </div>
      </details>
      <details className="faq">
        <summary>
          <h3 id="C08-H03">{"Does lossless mean every PDF feature stays unchanged?"}</h3>
          <span aria-hidden="true">{"⌄"}</span>
        </summary>
        <div className="answer">
          <p>{"No. Preserve image quality (lossless) concerns image treatment. It does not promise an identical whole file or preservation of every document feature. Choose the appropriate method and check any text, links or forms you need."}</p>
        </div>
      </details>
      <details className="faq">
        <summary>
          <h3 id="C08-H04">{"Can I compress encrypted or signed PDFs?"}</h3>
          <span aria-hidden="true">{"⌄"}</span>
        </summary>
        <div className="answer">
          <p>{"The tool does not support encrypted, signed/certified or XFA PDFs. Use a readable, supported document. Compression is not a way to unlock a file or guarantee that a digital signature remains valid."}</p>
        </div>
      </details>
    </section>
    <section className="section wrap editorial" id="C09" data-section="C09">
      <div className="sectionline">
        <span className="number">{"09"}</span>
        <h2>{"Choose the right PDF task"}</h2>
      </div>
      <div className="copy">
        <p>{"If you need a different change, choose the matching tool:"}</p>
        <div className="related-grid">
          <Link className="related-card" href="/merge-pdf" prefetch={false}>
            <strong>{"Merge PDF "}<span aria-hidden="true">{"→"}</span>
            </strong>
            <span>{"Combine separate documents into one PDF."}</span>
            <span className="task-link">{"Open Merge PDF ↗"}</span>
          </Link>
          <Link className="related-card" href="/split-pdf" prefetch={false}>
            <strong>{"Split PDF "}<span aria-hidden="true">{"→"}</span>
            </strong>
            <span>{"Divide a document into separate files by pages or ranges."}</span>
            <span className="task-link">{"Open Split PDF ↗"}</span>
          </Link>
          <Link className="related-card" href="/compress-image" prefetch={false}>
            <strong>{"Compress Image "}<span aria-hidden="true">{"→"}</span>
            </strong>
            <span>{"Reduce the size of an image file rather than a PDF."}</span>
            <span className="task-link">{"Open Compress Image ↗"}</span>
          </Link>
          <Link className="related-card" href="/pdf-to-jpg" prefetch={false}>
            <strong>{"PDF to JPG "}<span aria-hidden="true">{"→"}</span>
            </strong>
            <span>{"Export PDF pages as images. Image-only compression still produces a PDF."}</span>
            <span className="task-link">{"Open PDF to JPG ↗"}</span>
          </Link>
        </div>
      </div>
    </section>
    <section className="section wrap editorial" id="C10" data-section="C10">
      <div className="finalcta">
        <h2>{"Ready to reduce your PDF file size?"}</h2>
        <p>{"Select your documents, choose the settings, and check the compressed result before sharing."}</p>
        <ReturnToTool />
      </div>
    </section>
  </div>;
}
