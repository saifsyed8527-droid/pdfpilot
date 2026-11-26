import Link from "next/link";
import styles from "./powerpoint-to-pdf-guide.module.css";
import { Gallery, Screenshot, RouteIllustration, ReturnToTool } from "./powerpoint-to-pdf-guide-interactions";
const galleries = [
  [
    {
      "title": "Select",
      "text": "Choose a supported PPTX presentation.",
      "src": "powerpoint-1.webp",
      "alt": "PDFPilot production · initial uploader · 25 Nov 2026 IST"
    },
    {
      "title": "Convert",
      "text": "Review the selected presentation, then convert.",
      "src": "powerpoint-2.webp",
      "alt": "PDFPilot production · selected synthetic PPTX · 25 Nov 2026 IST"
    },
    {
      "title": "Download",
      "text": "Inspect the real result screen.",
      "src": "powerpoint-3.webp",
      "alt": "PDFPilot production · completed synthetic conversion · 25 Nov 2026 IST"
    }
  ]
];
const figures = [
  {
    "src": "powerpoint-4.webp",
    "alt": "First page of the two-slide synthetic PDFPilot conversion",
    "caption": "Actual synthetic test · first PDF page · 25 Nov 2026 IST"
  },
  {
    "src": "powerpoint-5.webp",
    "alt": "PDFPilot production · separate PDFs in a batch · 25 Nov 2026 IST",
    "caption": "PDFPilot production · separate PDFs in a batch · 25 Nov 2026 IST"
  }
];
export function PowerpointToPdfGuide() {  
return <div className={styles.guide}>
    <nav className="toc" aria-label="On this page">
      <div className="wrap">
        <a href="#C02">{"How it works"}</a>
        <a href="#C03">{"Conversion routes"}</a>
        <a href="#C04">{"Check the PDF"}</a>
        <a href="#C05">{"Batch conversion"}</a>
        <a href="#C06">{"Limits & privacy"}</a>
        <a href="#C07">{"FAQs"}</a>
        <a href="#C08">{"Related tools"}</a>
        <a href="#C09">{"Get started"}</a>
      </div>
    </nav>
    {"\n"}
    <section className="section wrap editorial" id="C02" data-section="C02">
      <div className="sectionline">
        <span className="number">{"02"}</span>
        <h2>{"How to convert PowerPoint to PDF"}</h2>
      </div>
      <div className="copy">
        <p>{"Keep your original presentation. Work from a copy if you need to remove slides or change anything before conversion."}</p>
        <ol>
          <li>
            <strong>{"Select your presentation."}</strong>{" Choose Select PowerPoint files and pick a .pptx file from your device, or drag it into the drop area. Check the filename under Ready to convert."}</li>
          <li>
            <strong>{"Review and convert."}</strong>{" Read the format guidance beside the selected file. Use Add more files if needed, then choose Convert to PDF. Wait for the result; if a file contains unsupported content, follow the error message."}</li>
          <li>
            <strong>{"Find your PDF."}</strong>{" A successful conversion starts the download automatically. Use Download PDF again if you need another copy. Back to files returns you to the selected list."}</li>
          <li>
            <strong>{"Open and check."}</strong>{" View the downloaded PDF, compare it with your slides and check that it contains what the recipient needs. The checklist below shows what to look for."}</li>
        </ol>
      </div>
      <Gallery steps={galleries[0]} />
    </section>
    {"\n"}
    <section className="section wrap editorial" id="C03" data-section="C03">
      <div className="sectionline">
        <span className="number">{"03"}</span>
        <h2>{"Choose the right conversion route"}</h2>
      </div>
      <div className="copy">
        <p>{"The right route depends on what is inside your presentation. Use this guide before choosing a file that needs notes, complex artwork or an exact visual match."}</p>
        <div className="tablewrap">
          <table className="decisiontable">
            <thead>
              <tr>
                <th scope="col">{"Your presentation"}</th>
                <th scope="col">{"Recommended route"}</th>
                <th scope="col">{"What to check"}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td data-label="Your presentation">{"Supported .pptx slides"}</td>
                <td data-label="Recommended route">{"Convert here with PDFPilot."}</td>
                <td data-label="What to check">{"Text, drawings and images can convert. Fonts may be substituted and text may wrap differently."}</td>
              </tr>
              <tr>
                <td data-label="Your presentation">{"An older .ppt file"}</td>
                <td data-label="Recommended route">{"Open it in PowerPoint or another compatible presentation app. Export a PDF, or save a genuine .pptx copy first."}</td>
                <td data-label="What to check">{"Renaming the extension does not convert the file. Review a saved PPTX copy before using it here."}</td>
              </tr>
              <tr>
                <td data-label="Your presentation">{"Charts, SmartArt or unsupported artwork"}</td>
                <td data-label="Recommended route">{"Export the PDF from PowerPoint."}</td>
                <td data-label="What to check">{"Unsupported content can stop this tool’s conversion with an error."}</td>
              </tr>
              <tr>
                <td data-label="Your presentation">{"Exact appearance is essential"}</td>
                <td data-label="Recommended route">{"Export PowerPoint to PDF from the original presentation app."}</td>
                <td data-label="What to check">{"Check the exported result too, especially fonts, spacing and artwork."}</td>
              </tr>
              <tr>
                <td data-label="Your presentation">{"Speaker notes, handouts or clickable links"}</td>
                <td data-label="Recommended route">{"Use the presentation app’s PDF or print options, then test the output."}</td>
                <td data-label="What to check">{"This tool produces slide pages without speaker notes. Clickable links may not work in the converted PDF."}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>{"A PDF gives you static pages. Keep the original presentation for animations, transitions, video, audio or a live slideshow. When you save PowerPoint as PDF, choose the output that suits how the document will be used."}</p>
      </div>
      <RouteIllustration />
    </section>
    {"\n"}
    <section className="section wrap editorial" id="C04" data-section="C04">
      <div className="sectionline">
        <span className="number">{"04"}</span>
        <h2>{"Check your PDF before sharing"}</h2>
      </div>
      <div className="copy">
        <p>{"Open the downloaded PDF and compare it with the presentation."}</p>
        <ul className="checklist">
          <li>{"Pages and order: confirm that every intended slide is present and in the right place. Hidden slides may appear; remove unwanted slides from a copy before converting."}</li>
          <li>{"Text and layout: look for substituted fonts, changed line breaks, clipped headings or text that runs outside a shape."}</li>
          <li>{"Images and drawings: inspect fine detail, positioning and the edges of shapes."}</li>
          <li>{"Required features: check whether the recipient can use what they need. Visible link text does not mean a link is clickable."}</li>
        </ul>
        <p>{"If the result does not suit the task, return to the original presentation and use its PDF export. Keep that original so you can make changes later."}</p>
      </div>
      <div className="sample-card">
        <div>
          <Screenshot {...figures[0]} />
        </div>
        <div>
          <span className="eyebrow">{"VERIFIED SAMPLE"}</span>
          <strong className="sample-title">{"Two slides. Two PDF pages."}</strong>
          <p>{"This synthetic test kept text, pictures and basic drawings. Speaker notes were excluded, and the link label did not become a clickable PDF link."}</p>
          <a className="sample-download" href="/samples/powerpoint-to-pdf/PDFPilot-Synthetic-PowerPoint-Sample.pdf" download="PDFPilot-Synthetic-PowerPoint-Sample.pdf">{"Download the tested sample PDF "}<span aria-hidden="true">{"↓"}</span>
          </a>
          <p className="caption">{"This is a fixed QA sample, not a conversion of a file you selected."}</p>
        </div>
      </div>
    </section>
    {"\n"}
    <section className="section wrap editorial" id="C05" data-section="C05">
      <div className="sectionline">
        <span className="number">{"05"}</span>
        <h2>{"Convert more than one presentation"}</h2>
      </div>
      <div className="copy">
        <p>{"Choose Add more files to include another supported PPTX presentation. Each presentation becomes a separate PDF; the converter does not combine the slides into one document."}</p>
        <p>{"A successful batch downloads a ZIP containing the PDFs. Use Download ZIP again to retrieve another copy. Extract the ZIP, check that the expected files are there and open each PDF before sharing it."}</p>
        <p>{"If you need a single document, combine the downloaded PDFs afterwards using the related tool below."}</p>
      </div>
      <Screenshot {...figures[1]} />
    </section>
    {"\n"}
    <section className="section wrap editorial" id="C06" data-section="C06">
      <div className="sectionline">
        <span className="number">{"06"}</span>
        <h2>{"File limits and local processing"}</h2>
      </div>
      <div className="copy">
        <p>{"The tool displays these limits:"}</p>
        <ul className="checklist">
          <li>{"Up to 20 files in a batch."}</li>
          <li>{"Up to 100 MB per file."}</li>
          <li>{"A 200 MB combined budget for input files and completed PDFs."}</li>
        </ul>
        <p>{"Large or complex presentations can need more browser memory. Staying within the displayed file limits does not ensure that every presentation will convert."}</p>
        <p>{"Local files are processed in your browser. URL imports and external resources may use server requests."}</p>
      </div>
    </section>
    {"\n"}
    <section className="section wrap editorial" id="C07" data-section="C07">
      <div className="sectionline">
        <span className="number">{"07"}</span>
        <h2>{"PowerPoint to PDF questions"}</h2>
      </div>
      <details className="faq">
        <summary>
          <h3>{"Is PowerPoint to PDF free to use?"}</h3>
          <span aria-hidden="true">{"⌄"}</span>
        </summary>
        <div className="answer">
          <p>{"Yes. You can currently convert and download supported PPTX files without payment or account creation. The displayed file limits apply."}</p>
        </div>
      </details>
      <details className="faq">
        <summary>
          <h3>{"Can I include speaker notes or print handouts?"}</h3>
          <span aria-hidden="true">{"⌄"}</span>
        </summary>
        <div className="answer">
          <p>{"For speaker notes or several slides on one page, use your presentation app’s PDF or print options. PDFPilot’s current conversion produces slide pages and has no notes or handout layout setting."}</p>
        </div>
      </details>
    </section>
    {"\n"}
    <section className="section wrap editorial" id="C08" data-section="C08">
      <div className="sectionline">
        <span className="number">{"08"}</span>
        <h2>{"Continue with your PDF"}</h2>
      </div>
      <div className="copy">
        <div className="related-grid">
          <Link className="related-card" href="/merge-pdf" prefetch={false}>
            <strong>{"Merge PDF "}<span aria-hidden="true">{"→"}</span>
            </strong>
            <span>{"Combine your downloaded PDFs into one document."}</span>
            <span className="task-link">{"Open Merge PDF ↗"}</span>
          </Link>
          <Link className="related-card" href="/compress-pdf" prefetch={false}>
            <strong>{"Compress PDF "}<span aria-hidden="true">{"→"}</span>
            </strong>
            <span>{"Try reducing a PDF’s file size, then check its quality."}</span>
            <span className="task-link">{"Open Compress PDF ↗"}</span>
          </Link>
          <Link className="related-card" href="/pdf-to-powerpoint" prefetch={false}>
            <strong>{"PDF to PowerPoint "}<span aria-hidden="true">{"→"}</span>
            </strong>
            <span>{"Start the reverse conversion when your source is a PDF."}</span>
            <span className="task-link">{"Open PDF to PowerPoint ↗"}</span>
          </Link>
        </div>
      </div>
    </section>
    {"\n"}
    <section className="section wrap editorial" id="C09" data-section="C09">
      <div className="finalcta">
        <h2>{"Ready to convert your presentation?"}</h2>
        <p>{"Choose a supported PPTX file, convert it and check the PDF before you share it."}</p>
        <ReturnToTool />
      </div>
    </section>
  </div>;
}
