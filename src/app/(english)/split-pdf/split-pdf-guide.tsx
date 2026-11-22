import Link from "next/link";
import { Walkthrough, Screenshot, ResultShowcase, RangeExample, ReturnToTool } from "./split-pdf-guide-interactions";
import styles from "./split-pdf-guide.module.css";
export function SplitPdfGuide() { return <div className={styles.guide} lang="en">
<nav className="toc" aria-label="Split PDF guide sections">
<div className="wrap">
<a href="#S02">How it works</a>
<a href="#S03">Choose your result</a>
<a href="#S05">Examples</a>
<a href="#S07">File handling</a>
<a href="#S08">FAQs</a>
<a href="#S09">Related tools</a>
</div>
</nav>
<section className="section wrap editorial " id="S02" data-section="S02" aria-labelledby="S02-heading">
<div className="sectionline">
<span className="eyebrow">The workflow</span>
<h2 id="S02-heading">How to split PDF pages</h2>
</div>
<p>Start with one PDF and decide which pages belong together. The Custom range workflow lets you create a separate document for each group.</p>
<Walkthrough />
<p>For a six-page document, ranges 1–2, 3–4 and 5–6 create three two-page PDFs. Check that those groups match the sections you actually need.</p>
</section>
<section className="section wrap editorial " id="S03" data-section="S03" aria-labelledby="S03-heading">
<div className="sectionline">
<span className="eyebrow">Choose your result</span>
<h2 id="S03-heading">Choose the output you need</h2>
</div>
<div className="copy">
<p>A PDF divider is useful when you know what each output should contain. Choose between whole page groups, individual pages or saving a selected subset.</p>
</div>
<div className="tablewrap">
<table className="decisiontable">
<thead>
<tr>
<th scope="col">Needed result</th>
<th scope="col">Control</th>
<th scope="col">Page example</th>
</tr>
</thead>
<tbody>
<tr>
<td>
<h3>Create a PDF for every page</h3>
</td>
<td>
<p>Choose Range → Fixed and set Split into page ranges of to 1. This creates a separate one-page PDF for each source page. A six-page document produces six files.</p>
</td>
<td>6 pages → 6 one-page PDFs</td>
</tr>
<tr>
<td>
<h3>Create files from page ranges</h3>
</td>
<td>
<p>Choose Range → Custom and enter a From/To pair for each group. Leave the merge-ranges checkbox unchecked to keep those groups in separate PDF files.</p>
</td>
<td>6 pages → ranges 1–2 / 3–4 / 5–6</td>
</tr>
<tr>
<td>
<h3>Keep only selected pages</h3>
</td>
<td>
<p>If you only need a few pages and do not want to divide the rest of the document, use <Link href="/extract-pages" prefetch={false}>Extract Pages</Link>. Saving a selected subset is a different task from splitting the whole PDF into outputs.</p>
</td>
<td>Only the pages you need</td>
</tr>
</tbody>
</table>
</div>
<Screenshot src="split-2.webp" alt="Custom range controls for separate PDF outputs." caption="PDFPilot · Choose the output you need" />
</section>
<section className="section wrap editorial " id="S04" data-section="S04" aria-labelledby="S04-heading">
<div className="sectionline">
<span className="eyebrow">One page, one PDF</span>
<h2 id="S04-heading">Save individual pages as separate PDFs</h2>
</div>
<div className="side-by-side">
<div className="copy">
<p>To split a PDF into individual pages, use Range → Fixed with the interval set to 1. Check the predicted output count before selecting Split PDF.</p>
<p>For a six-page input, the result shows 6 PDFs created. Choose Download ZIP, open the archive and you will find six one-page PDFs. Each output remains a PDF; this process does not convert pages into images.</p>
<p>Check the number of files against the expected page count. Open the first, a middle and the last output to confirm their contents and orientation. If you plan to share every file, check each one you will send.</p>
</div>
<ResultShowcase />
</div>
</section>
<section className="section wrap editorial " id="S05" data-section="S05" aria-labelledby="S05-heading">
<div className="sectionline">
<span className="eyebrow">Keep each group together</span>
<h2 id="S05-heading">Split a PDF into two or more files</h2>
</div>
<div className="copy">
<p>Ranges keep related pages together. Before entering them, identify where each chapter, report section or group of handouts begins and ends.</p>
<h3>Split into two files</h3>
<p>To split a six-page PDF into two files, use ranges 1–3 and 4–6. The first output contains the first three pages; the second contains the remaining three.</p>
<p>These are groups of document pages. Splitting into two files does not cut each physical page into two halves.</p>
<h3>Split into several page ranges</h3>
<p>For three two-page documents, choose Range → Custom and enter 1 to 2. Use Add Range for 3 to 4, then again for 5 to 6. Keep Merge all ranges in one PDF file unchecked.</p>
<p>Use the page positions shown in the preview. Printed page numbers may differ if the document includes a cover or an introduction numbered separately. Check for gaps or repeated pages before selecting Split PDF.</p>
</div>
<RangeExample />
</section>
<section className="section wrap editorial " id="S06" data-section="S06" aria-labelledby="S06-heading">
<div className="sectionline">
<span className="eyebrow">Before you share</span>
<h2 id="S06-heading">Check the files after splitting</h2>
</div>
<div className="side-by-side">
<div className="copy">
<p>For the Custom ranges and Fixed interval 1 workflows described here, Download ZIP saves the generated PDFs together. Open the archive to reach the individual documents.</p>
<p>After the PDF split, check:</p>
<ul className="checklist">
<li>Output count: confirm you have the number of documents you expected.</li>
<li>Page boundaries: inspect the first and last page of each range.</li>
<li>Content: check text, images, orientation and page order.</li>
<li>Important features: review forms, signatures, bookmarks and links that matter to your task. Keep the original document.</li>
</ul>
<p>If you want to unmerge PDF files, you still need to know their page boundaries. Splitting does not automatically recover original groupings or filenames. The outputs are new PDF files containing the pages you selected through the split settings.</p>
</div>
<Screenshot src="split-6.webp" alt="Three generated PDFs with Download ZIP available." caption="PDFPilot · Check the files after splitting" />
</div>
</section>
<section className="section wrap editorial " id="S07" data-section="S07" aria-labelledby="S07-heading">
<div className="sectionline">
<span className="eyebrow">Know how your files are handled</span>
<h2 id="S07-heading">File handling, privacy and size limits</h2>
</div>
<div className="privacybox">
<div className="copy">
<p className="handling">
<span>When you split PDFs online with PDFPilot, local files use browser processing.</span> <span>URL imports and external resources may use server requests.</span>
</p>
<p>Choose your input method with that distinction in mind.</p>
<p>The displayed limit is 100 MB per PDF. File complexity and your device’s resources can affect processing, so a size limit is not a guarantee that every document will complete in the same time.</p>
<p>Size-based splitting does not guarantee an exact file size for each result. For the workflows explained on this page, choose pages or ranges according to the content you need, then check the downloaded files before sharing them.</p>
</div>
</div>
</section>
<section className="section wrap editorial " id="S08" data-section="S08" aria-labelledby="S08-heading">
<div className="sectionline">
<span className="eyebrow">A few useful answers</span>
<h2 id="S08-heading">Questions about splitting a PDF</h2>
</div>
<div className="faqwrap">
<details className="faq">
<summary>
<h3>Does splitting cut each page in half?</h3>
<span aria-hidden="true">⌄</span>
</summary>
<div className="answer">
<p>No. This workflow separates a document into pages or page ranges. It does not cut the left and right halves of each sheet into new files. A range such as pages 1–3 keeps those three complete pages together.</p>
</div>
</details>
<details className="faq">
<summary>
<h3>Can I save only selected pages?</h3>
<span aria-hidden="true">⌄</span>
</summary>
<div className="answer">
<p>Yes—use the Extract Pages option described above when your main goal is keeping a selected subset. You do not need to divide the entire document just to save a few pages.</p>
</div>
</details>
<details className="faq">
<summary>
<h3>Can I remove pages and keep the rest?</h3>
<span aria-hidden="true">⌄</span>
</summary>
<div className="answer">
<p>Use <Link href="/delete-pages" prefetch={false}>Remove PDF Pages</Link> when you want to delete unwanted pages and keep the remaining document together. Splitting instead creates outputs from the page groups you specify.</p>
</div>
</details>
<details className="faq">
<summary>
<h3>Can I put the PDF files back together?</h3>
<span aria-hidden="true">⌄</span>
</summary>
<div className="answer">
<p>Use <Link href="/merge-pdf" prefetch={false}>Merge PDF</Link> to combine documents in the order you choose. Check the file order first. Merging the outputs does not automatically restore their original filenames or identify their earlier boundaries.</p>
</div>
</details>
<details className="faq">
<summary>
<h3>Will splitting make the PDF small enough to send?</h3>
<span aria-hidden="true">⌄</span>
</summary>
<div className="answer">
<p>A smaller page group can produce a smaller document, but its size depends on the content. There is no exact byte-size guarantee. If reducing file size is the main task, use <Link href="/compress-pdf" prefetch={false}>Compress PDF</Link> and check the result against your sending limit.</p>
</div>
</details>
<details className="faq">
<summary>
<h3>Can I split a password-protected PDF?</h3>
<span aria-hidden="true">⌄</span>
</summary>
<div className="answer">
<p>If the tool cannot open a protected PDF, use an accessible copy you are authorized to process. Follow the message shown for your file rather than assuming every protected document behaves the same way.</p>
</div>
</details>
</div>
</section>
<section className="section wrap editorial related" id="S09" data-section="S09" aria-labelledby="S09-heading">
<div className="sectionline">
<span className="eyebrow">Your next step</span>
<h2 id="S09-heading">Choose the right PDF task</h2>
</div>
<div className="copy">
<div className="tablewrap">
<table className="decisiontable">
<thead>
<tr>
<th scope="col">Tool</th>
<th scope="col">I need to…</th>
<th scope="col">Open tool</th>
</tr>
</thead>
<tbody>
<tr>
<td>Extract Pages:</td>
<td>save a selected subset.</td>
<td>
<Link className="task-link" href="/extract-pages" prefetch={false}>Open Extract Pages <span aria-hidden="true">↗</span>
</Link>
</td>
</tr>
<tr>
<td>Remove PDF Pages:</td>
<td>delete unwanted pages and keep the rest.</td>
<td>
<Link className="task-link" href="/delete-pages" prefetch={false}>Open Remove PDF Pages <span aria-hidden="true">↗</span>
</Link>
</td>
</tr>
<tr>
<td>Merge PDF:</td>
<td>combine documents in a chosen order.</td>
<td>
<Link className="task-link" href="/merge-pdf" prefetch={false}>Open Merge PDF <span aria-hidden="true">↗</span>
</Link>
</td>
</tr>
<tr>
<td>Compress PDF:</td>
<td>reduce file size.</td>
<td>
<Link className="task-link" href="/compress-pdf" prefetch={false}>Open Compress PDF <span aria-hidden="true">↗</span>
</Link>
</td>
</tr>
</tbody>
</table>
</div>
<p>Open the tool you need when your task changes. Keep the original PDF until you have checked the files you need.</p>
</div>
</section>
<section className="section wrap editorial " id="S10" data-section="S10" aria-labelledby="S10-heading">
<div className="finalcta">
<div className="sectionline">
<span className="eyebrow">Ready when you are</span>
<h2 id="S10-heading">Ready to separate your PDF?</h2>
</div>
<div className="copy">
<p>Select your PDF, choose the pages or ranges you need and check every output you plan to share.</p>
<ReturnToTool />
</div>
</div>
</section>
</div>; }
