import Link from "next/link";
import { FileOrderExample, ReturnToTool, Screenshot, Walkthrough } from "./merge-pdf-guide-interactions";
import styles from "./merge-pdf-guide.module.css";

/** Service Content v1 in the supplied HTML layout; copy remains server rendered. */
export function MergePdfGuide() {
  return <div className={styles.guide} lang="en">
<nav className="toc" aria-label="Merge PDF guide sections">
<div className="wrap">
<a href="#M02">How it works</a>
<a href="#M03">Choose your result</a>
<a href="#M05">Check the result</a>
<a href="#M07">File handling</a>
<a href="#M08">FAQs</a>
<a href="#M09">Related tools</a>
</div>
</nav>
<section className="section wrap editorial " id="M02" data-section="M02" aria-labelledby="M02-heading">
<div className="sectionline">
<span className="eyebrow">The workflow</span>
<h2 id="M02-heading">How to merge PDF files</h2>
</div>
<p>To merge PDF files online, start with the documents you want in the final file. Keep the originals until you have checked the result.</p>
<Walkthrough />
<p>That is how to combine PDF files without leaving their order to chance: choose the documents, review the sequence, then inspect the download.</p>
</section>
<section className="section wrap editorial  example-section" id="M03" data-section="M03" aria-labelledby="M03-heading">
<div className="sectionline">
<span className="eyebrow">Choose your result</span>
<h2 id="M03-heading">Combine two PDFs or several documents</h2>
</div>
<div className="copy">
<p>A PDF combiner, merger or PDF joiner performs the same basic job: bringing existing PDF documents together. The result is one file containing their pages, not one sheet with every page squeezed onto it.</p>
<div className="features">
<article className="feature">
<div className="featureicon">
<svg aria-hidden="true" viewBox="0 0 24 24">
<rect x="7" y="6" width="14" height="16" rx="1">
</rect>
<path d="M16 3H3v15M11 11h6M11 15h6">
</path>
</svg>
</div>
<h3>Combine two PDF files</h3>
<p>Suppose File A has two pages and File B has two pages. Put A before B to create a four-page document in that order: A1, A2, B1, B2. Reverse the file order if B needs to come first.</p>
<p>This is useful when you want to merge two PDFs, such as a short application and its supporting document. Check which document should introduce the other before combining them.</p>
</article>
<article className="feature">
<div className="featureicon">
<svg aria-hidden="true" viewBox="0 0 24 24">
<rect x="7" y="6" width="14" height="16" rx="1">
</rect>
<path d="M16 3H3v15M11 11h6M11 15h6">
</path>
</svg>
</div>
<h3>Combine several documents</h3>
<p>You can also merge multiple PDFs into one document—for example, a report followed by its appendix and supporting attachments. Arrange the main document first, then add the supporting material in a sequence the reader can follow.</p>
<p>For study handouts, put the PDFs in lesson order so the reader can work through them in sequence.</p>
<p>The file order determines the sequence. It does not automatically organize documents by topic, insert a contents page or alternate pages from different files.</p>
</article>
</div>
</div>
<FileOrderExample />
</section>
<section className="section wrap editorial " id="M04" data-section="M04" aria-labelledby="M04-heading">
<div className="sectionline">
<span className="eyebrow">Before you continue</span>
<h2 id="M04-heading">Check the order before you merge</h2>
</div>
<div className="side-by-side">
<div className="copy">
<p>The file cards show your PDF merge order. Read them from first to last and check that the cover, main document and attachments are where you want them. A filename such as “Appendix” may sort before “Report,” even though it belongs afterward.</p>
<p>Use alphabetical sorting only when your filenames reflect the intended sequence. Otherwise, drag the cards into place before you merge PDFs.</p>
<p>File order and page order are different. If pages inside a source PDF need rearranging, use <Link href="/organize-pdf" prefetch={false}>Organize PDF</Link> before combining the documents. Changing the position of an entire file does not rearrange the individual pages within it.</p>
</div>
<Screenshot src="arrange-pdfs.webp" alt="B.pdf placed before A.pdf in the selected-file list before merging." caption="PDFPilot · B.pdf before A.pdf → B1, B2, A1, A2" />
</div>
</section>
<section className="section wrap editorial " id="M05" data-section="M05" aria-labelledby="M05-heading">
<div className="sectionline">
<span className="eyebrow">Before you share</span>
<h2 id="M05-heading">Check your merged PDF before sharing</h2>
</div>
<div className="side-by-side">
<div className="copy">
<p>A completed download is a good moment to check the document as your reader will see it. Open the merged PDF and review:</p>
<ul className="checklist">
<li>Page count and sequence: make sure the expected documents appear in the right order.</li>
<li>Document boundaries: check where one source file ends and the next begins.</li>
<li>Readability and orientation: inspect important text, images and any sideways pages.</li>
<li>Special features: check forms, signatures, bookmarks and links you rely on. Keep the originals rather than assuming every feature behaves identically after merging.</li>
</ul>
<p>Merging does not automatically compress the result. If the combined document is too large for your next step, <Link href="/compress-pdf" prefetch={false}>Compress PDF</Link> is the separate tool for reducing file size.</p>
</div>
<Screenshot src="download-pdf.webp" alt="PDFPilot result screen with the Download PDF action." caption="PDFPilot · Check your merged PDF before sharing" />
</div>
</section>
<section className="section wrap editorial " id="M06" data-section="M06" aria-labelledby="M06-heading">
<div className="fact-section">
<div className="sectionline">
<span className="eyebrow">The practical details</span>
<h2 id="M06-heading">Is PDF merging free?</h2>
</div>
<div className="copy">
<p>Yes. You can use the basic PDF merger and download the result without paying or creating an account. Check the file requirements shown in the tool before you begin.</p>
<p>The free PDF merger covers the basic combine-and-download workflow. “Free” does not mean that any file size or document complexity will work without limits.</p>
</div>
</div>
</section>
<section className="section wrap editorial " id="M07" data-section="M07" aria-labelledby="M07-heading">
<div className="sectionline">
<span className="eyebrow">Know how your files are handled</span>
<h2 id="M07-heading">File handling, privacy and practical limits</h2>
</div>
<div className="privacybox">
<div className="copy">
<p className="handling">
<span>When you combine PDFs online with PDFPilot, local files use browser processing.</span> <span>URL imports and external resources may use server requests.</span>
</p>
<p>Keep that distinction in mind when deciding which documents to use and how to bring them into the tool.</p>
<p>The displayed file limit is 100 MB per PDF. This is a per-file limit, not a promise of unlimited total processing. Document complexity and the resources available on your device can affect completion.</p>
<p>Use PDF files for this workflow. Keep copies of your originals, and allow the process to finish before checking the result. Avoid assuming that browser processing means every part of the website works offline.</p>
</div>
</div>
</section>
<section className="section wrap editorial " id="M08" data-section="M08" aria-labelledby="M08-heading">
<div className="sectionline">
<span className="eyebrow">A few useful answers</span>
<h2 id="M08-heading">Questions before you merge</h2>
</div>
<div className="faqwrap">
<details className="faq">
<summary>
<h3>Will merging put all pages on one sheet?</h3>
<span aria-hidden="true">⌄</span>
</summary>
<div className="answer">
<p>No. Merging creates one PDF document containing separate pages from the source files. It does not place every page on a single sheet. In the two-file example above, two two-page PDFs become a four-page PDF.</p>
</div>
</details>
<details className="faq">
<summary>
<h3>Can I merge images or other file types?</h3>
<span aria-hidden="true">⌄</span>
</summary>
<div className="answer">
<p>This workflow uses PDF inputs. If your starting files are JPG images, <Link href="/jpg-to-pdf" prefetch={false}>JPG to PDF</Link> provides the separate conversion task. Do not add other formats expecting the merger to convert them automatically.</p>
</div>
</details>
<details className="faq">
<summary>
<h3>Can I split the merged PDF again?</h3>
<span aria-hidden="true">⌄</span>
</summary>
<div className="answer">
<p>Yes, <Link href="/split-pdf" prefetch={false}>Split PDF</Link> can separate a document into known pages or ranges. You need to know where the sections should divide; splitting does not automatically identify the original files or restore their filenames.</p>
</div>
</details>
<details className="faq">
<summary>
<h3>Why is the merged PDF still too large?</h3>
<span aria-hidden="true">⌄</span>
</summary>
<div className="answer">
<p>Merging combines the documents; it does not guarantee a smaller file. The size also depends on the source content, including images. Use the compression option in the output checklist if reducing size is your next task.</p>
</div>
</details>
</div>
</section>
<section className="section wrap editorial related" id="M09" data-section="M09" aria-labelledby="M09-heading">
<div className="sectionline">
<span className="eyebrow">Your next step</span>
<h2 id="M09-heading">Choose the right next PDF task</h2>
</div>
<div className="copy">
<p>Use the task that matches the change you need:</p>
<div className="tablewrap">
<table className="decisiontable">
<thead>
<tr>
<th>Tool</th>
<th>I need to…</th>
</tr>
</thead>
<tbody>
<tr>
<td>Compress PDF:</td>
<td>reduce file size.</td>
</tr>
<tr>
<td>Split PDF:</td>
<td>separate a document into files.</td>
</tr>
<tr>
<td>JPG to PDF:</td>
<td>prepare JPG images as PDF documents.</td>
</tr>
<tr>
<td>Organize PDF:</td>
<td>rearrange pages inside a PDF.</td>
</tr>
</tbody>
</table>
</div>
<p>These are separate tasks. Follow the relevant link above when you need it, keeping a copy of the document you want to work on.</p>
</div>
</section>
<section className="section wrap editorial " id="M10" data-section="M10" aria-labelledby="M10-heading">
<div className="finalcta">
<div className="sectionline">
<span className="eyebrow">Ready when you are</span>
<h2 id="M10-heading">Ready to combine your files?</h2>
</div>
<div className="copy">
<p>Have your PDFs ready? Select the files, put them in the order you want and check the finished document before sharing.</p>
<ReturnToTool />
</div>
</div>
</section>
  </div>;
}
