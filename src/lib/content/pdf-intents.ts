/** Editable page content. Layouts and PDF processing live outside this catalog. */
export type PdfIntent = {
  id: string;
  path: string;
  family: "tool" | "task" | "guide";
  tool: "compress-pdf" | "merge-pdf";
  status: "published" | "draft";
  title: string;
  description: string;
  eyebrow: string;
  heading: string;
  intro: string;
  cardTitle: string;
  decision: string;
  facts: [string, string][];
  stepsTitle: string;
  steps: { title: string; text: string }[];
  detailsTitle: string;
  detailsIntro: string;
  details: { title: string; text: string }[];
  example?: { caption: string; columns: string[]; rows: string[][]; note: string };
  checklistTitle: string;
  checklist: string[];
  faqs: { question: string; answer: string }[];
  related: string[];
  calculator?: boolean;
};

export const PDF_INTENTS: readonly PdfIntent[] = [
  {
    id: "compress-pdf", path: "/compress-pdf", family: "tool", tool: "compress-pdf", status: "published",
    title: "Compress PDF — Reduce File Size Online",
    description: "Compress PDFs in your browser with three quality settings. Compare the output size, check readability and download a smaller copy. Free, no sign-up.",
    eyebrow: "A smaller file. A clear next step.", heading: "Compress your PDF.\nCheck what matters.",
    intro: "Make a smaller copy for sharing or uploading. Choose a compression level, compare the result, and check the pages you need before sending.",
    cardTitle: "Your PDF, ready for its next step",
    decision: "A smaller file is useful only when the information you need is still readable. Keep your original and check the downloaded copy.",
    facts: [["Starting point", "One or more PDF files"], ["Intended result", "A smaller working copy"], ["First decision", "File size or image quality?"]],
    stepsTitle: "From a large file to a useful copy",
    steps: [
      { title: "Choose your original", text: "Select your PDFs and keep the originals. Note the starting size and any limit set by the recipient." },
      { title: "Choose a compression level", text: "Start with Recommended. Extreme uses lower image quality; Less compression keeps more detail. Process the files in your browser." },
      { title: "Check the downloaded result", text: "Compare the file size, then open the output. Zoom in on small text, stamps and images before you share it." },
    ],
    detailsTitle: "Choose the trade-off that fits your document",
    detailsIntro: "PDFPilot rebuilds compressed pages as images. That can reduce image-heavy PDFs, but it also changes how the document behaves.",
    details: [
      { title: "For an upload limit", text: "Use the recipient’s actual maximum as your target. A quality preset cannot promise an exact file size. Measure the exported file before submitting." },
      { title: "For searchable or interactive documents", text: "A rebuilt copy loses selectable text and interactive features. Keep the original if you need searchable text, fillable fields or existing digital signatures." },
    ],
    checklistTitle: "Check the smaller copy",
    checklist: ["The downloaded file opens correctly.", "Every required page is present.", "Small text and important images remain readable.", "The measured size meets my destination’s requirement."],
    faqs: [
      { question: "Can I compress a PDF to an exact size?", answer: "The tool offers quality levels, not a guaranteed byte target. The result depends on the original PDF. Use the upload-limit planner to choose a target, then check the output size." },
      { question: "Why might the size stay the same?", answer: "A PDF may already be compact. If the rebuilt PDF is not smaller, PDFPilot’s size guard returns the original file unchanged. Repeated compression does not guarantee a smaller result." },
      { question: "Are my PDF files uploaded?", answer: "Compression runs locally in your browser. Your PDFs are not sent to PDFPilot’s servers. The tool is free and does not require an account." },
    ],
    related: ["compress-pdf-for-upload", "why-pdf-still-too-large", "merge-pdf"],
  },
  {
    id: "merge-pdf", path: "/merge-pdf", family: "tool", tool: "merge-pdf", status: "published",
    title: "Merge PDF — Combine Documents in Order",
    description: "Merge PDF files into one document in your browser. Arrange and rotate your files, combine them, then check the final page count and order. Free, no sign-up.",
    eyebrow: "Organize your documents", heading: "Merge PDF files\ninto one document.",
    intro: "Bring separate documents together in the order you need. Check the sequence, combine the files, and review the finished PDF before sharing.",
    cardTitle: "Your document, in the right order",
    decision: "Start with a short source list. It gives you a concrete way to check that the finished PDF contains every section in the intended order.",
    facts: [["Starting point", "Separate PDF documents"], ["Intended result", "One combined PDF"], ["First decision", "The document order"]],
    stepsTitle: "Separate files. One clear sequence.",
    steps: [
      { title: "Select the right versions", text: "Add two or more PDFs. Use the latest intended copy of each document, and note their page counts before combining them." },
      { title: "Put your files in order", text: "Drag the file cards into sequence, or use their move controls. Rotate a file if needed. Review duplicate-file warnings before merging." },
      { title: "Merge and review", text: "Download the combined PDF. Check page count, section boundaries, orientation and repeated pages against your source list." },
    ],
    detailsTitle: "Give the reader a clear route through the file",
    detailsIntro: "Use this sequence as an example. The recipient’s instructions should determine the final order.",
    details: [],
    example: { caption: "An example document packet", columns: ["Order", "Section", "What to check"], rows: [["01", "Cover", "Identify the document before the main content."], ["02", "Main report", "Keep the primary content in its intended reading order."], ["03", "Appendix", "Place supporting material after the report unless instructed otherwise."]], note: "These are example sections, not files added to the tool." },
    checklistTitle: "Check the final document",
    checklist: ["The cover and opening page are correct.", "Each section appears in the intended order.", "No document or page has been included twice by mistake.", "The final file opens and all expected sections are present."],
    faqs: [
      { question: "What order should I use for the files?", answer: "Start with any order specified by the recipient. Otherwise, put introductory material first, the main content next, and supporting material last. PDFPilot lets you reorder files before merging." },
      { question: "Should I keep the original PDFs?", answer: "Yes. Keep the source files so you can check the output, correct a version mistake or produce a different document order later." },
      { question: "Can I use password-protected PDFs?", answer: "This merger does not unlock password-protected documents. Use an unprotected copy you are authorized to access. Each PDF must be within the displayed 100 MB file limit." },
      { question: "Are my files uploaded to merge them?", answer: "Merging runs locally in your browser. Your PDF files are not uploaded to PDFPilot’s servers, and no account is needed." },
    ],
    related: ["merge-pdf-for-application", "check-merged-pdf", "compress-pdf"],
  },
  {
    id: "compress-pdf-for-upload", path: "/use-cases/compress-pdf-for-upload", family: "task", tool: "compress-pdf", status: "published",
    title: "Compress PDF for an Upload Limit — Size Planner",
    description: "Calculate a PDF size target from your upload limit, compress a copy in your browser and check the result with an upload-readiness checklist.",
    eyebrow: "PDF workflows / Upload preparation", heading: "Compress a PDF\nfor an upload limit.",
    intro: "Start with the destination’s actual limit. Calculate a working target, compress a copy, and check the exported file before submitting.",
    cardTitle: "Prepare your upload copy",
    decision: "Does the file meet the destination’s size rule without losing information you need? Measure the result instead of relying on a preset name.",
    facts: [["Starting point", "A PDF above your upload limit"], ["Intended result", "A readable upload copy"], ["First decision", "The destination’s actual limit"]],
    stepsTitle: "A size-limit workflow",
    steps: [
      { title: "Read the destination’s rules", text: "Record the stated file-size limit and its unit. Check accepted formats and whether documents must be uploaded separately." },
      { title: "Calculate a working target", text: "Enter your current size and the maximum in the planner. Optional headroom sets a target below the limit. The example values are editable." },
      { title: "Create and verify the copy", text: "Select your PDF above and start with Recommended compression. Measure the downloaded result and inspect required content before attempting the upload." },
    ],
    calculator: true,
    detailsTitle: "When the first output is not enough",
    detailsIntro: "Use the measured result to decide what to do next. A calculated target is not a prediction of achievable compression.",
    details: [
      { title: "The PDF is already under the limit", text: "Further reduction may be unnecessary. Check completeness, readability and the destination’s other requirements, such as the filename and accepted format." },
      { title: "The PDF remains over the limit", text: "Check the troubleshooting guide before reducing quality again. If important details become unreadable, ask the recipient about an accepted alternative." },
    ],
    checklistTitle: "Upload readiness checklist",
    checklist: ["The size limit came from the actual destination.", "I used the correct size unit for each value.", "The exported file meets the stated limit.", "Required pages and details remain usable."],
    faqs: [
      { question: "Does entering a limit compress my PDF?", answer: "No. The planner only calculates a target. Select your PDF in the tool card to run the compressor, then compare the downloaded file with that target." },
      { question: "What does the headroom percentage do?", answer: "It puts the target below the maximum. For example, a 10 MB limit with 5% headroom gives a 9.5 MB target. This is an example, not a destination’s upload rule." },
      { question: "What is the difference between MB and MiB?", answer: "MB means 1,000,000 bytes; MiB means 1,048,576 bytes. The planner converts these units before comparing sizes. If a destination labels its limit ambiguously, check its instructions and verify the actual upload." },
    ],
    related: ["compress-pdf", "why-pdf-still-too-large", "merge-pdf-for-application"],
  },
  {
    id: "merge-pdf-for-application", path: "/use-cases/merge-pdf-for-application", family: "task", tool: "merge-pdf", status: "published",
    title: "Merge PDFs for an Application — Order & Checklist",
    description: "Prepare one PDF for an application that accepts a combined file. Map required documents, arrange PDFs, merge locally and check the final submission copy.",
    eyebrow: "PDF workflows / Application documents", heading: "Merge PDFs for\nyour application.",
    intro: "Turn a set of documents into an organized application packet. Confirm that one combined file is accepted, follow the required order, and review every section.",
    cardTitle: "Build your application packet",
    decision: "Check the application instructions first. Some destinations require separate uploads; a combined PDF is useful only when that format is accepted.",
    facts: [["Starting point", "Your required PDF documents"], ["Intended result", "One reviewed application packet"], ["First decision", "Separate uploads or one file?"]],
    stepsTitle: "From a document list to a complete packet",
    steps: [
      { title: "Map the submission", text: "Write down each requested document, its intended version and the required order. Note naming rules, size limits and whether a single PDF is accepted." },
      { title: "Arrange the correct sources", text: "Add your PDFs, then move their cards into the required sequence. Check the thumbnails and page counts. Remove accidental duplicate files before merging." },
      { title: "Audit the final packet", text: "Open the merged PDF and compare it with your list. Check the first and last page of every section, then verify the filename and measured size." },
    ],
    detailsTitle: "A submission map you can check",
    detailsIntro: "This is an illustrative packet, not a universal application requirement. Replace the sections and order with the recipient’s instructions.",
    details: [
      { title: "Protect against version mistakes", text: "Similar filenames can hide different revisions. Open the source files before combining them and check that each one belongs to this application." },
      { title: "Check what you are sharing", text: "Review the final file for unrelated pages or personal information the recipient did not request. Merging files does not decide what belongs in the application." },
    ],
    example: { caption: "Example application map", columns: ["Order", "Source", "Review"], rows: [["01", "Application form", "Correct version and completed fields"], ["02", "Statement", "All pages in reading order"], ["03", "Supporting document", "Requested evidence only"]], note: "Use the recipient’s sequence whenever it differs from this example." },
    checklistTitle: "Before you submit",
    checklist: ["The recipient accepts one combined PDF.", "The document order follows the actual instructions.", "Every requested document is present in its intended version.", "I reviewed the packet for unintended personal information.", "The filename and measured size meet the requirements."],
    faqs: [
      { question: "Should all application documents go into one PDF?", answer: "Only if the destination accepts a combined file. Keep separate documents when the form provides separate upload fields or the instructions require them." },
      { question: "Which document should go first?", answer: "Follow the recipient’s required sequence. If none is given, use a clear introductory document followed by the main material and supporting documents, and keep a source list for checking." },
      { question: "What if the merged PDF is too large?", answer: "Measure its size against the destination’s actual limit. Use the upload-limit workflow to plan a smaller copy. Check readability and retain the original merged file." },
    ],
    related: ["merge-pdf", "check-merged-pdf", "compress-pdf-for-upload"],
  },
  {
    id: "why-pdf-still-too-large", path: "/guides/why-pdf-still-too-large", family: "guide", tool: "compress-pdf", status: "published",
    title: "Why Is My PDF Still Too Large? — Practical Checks",
    description: "Check why a compressed PDF remains too large: verify the output, compare units, understand the size guard and choose a useful next step without losing readability.",
    eyebrow: "Troubleshooting / PDF compression", heading: "PDF still too large?\nStart with the result.",
    intro: "A compression attempt does not always produce the size you need. Check the actual exported file, the destination’s limit and the quality trade-off before trying again.",
    cardTitle: "Try a different compression level",
    decision: "Confirm that you measured the downloaded copy, not the original. Then compare its size with the destination’s requirement using the correct units.",
    facts: [["Start here", "The actual downloaded PDF"], ["Check against", "The destination’s size rule"], ["Keep an eye on", "Small text and image detail"]],
    stepsTitle: "Find out what is holding the size up",
    steps: [
      { title: "Verify the file you measured", text: "Open your downloads and confirm the newest output. If a previous download has a similar name, compare its date and size. Make sure you are not measuring the original." },
      { title: "Check the compression setting", text: "PDFPilot’s Extreme setting uses lower image resolution and quality than Recommended. Less compression preserves more detail. If the rebuilt PDF is not smaller, the size guard returns the original file unchanged." },
      { title: "Choose a usable next step", text: "Try a lower-quality setting on a fresh copy of the original, then inspect the output. Remove pages only if they are unnecessary and the recipient allows it. Ask for an accepted alternative when the target sacrifices required detail." },
    ],
    detailsTitle: "Match the symptom to the next check",
    detailsIntro: "Size, readability and upload acceptance are different checks. Use the one that matches the result in front of you.",
    details: [
      { title: "The file did not get smaller", text: "A compact text-based PDF may grow when converted to page images. The size guard can therefore return the original file unchanged. Repeating the same settings may make no useful difference." },
      { title: "It is smaller, but unreadable", text: "Return to the original and try Less compression. Inspect small text and scanned marks. A file below the limit still fails your task if the recipient cannot read it." },
      { title: "The size is acceptable, but upload fails", text: "Read the destination’s error. Check the required file format, password restrictions and filename rules, if specified. A size calculator cannot verify these conditions." },
    ],
    checklistTitle: "Before another attempt",
    checklist: ["I measured the newly downloaded output.", "I compared the size and limit using the correct units.", "I recorded which compression setting I tried.", "I checked the important content at a readable zoom level."],
    faqs: [
      { question: "Will compressing the PDF repeatedly keep reducing it?", answer: "No. Repeated image compression can lose detail without useful size savings. Start each comparison from the original and change one setting at a time." },
      { question: "Can I delete pages to meet the size limit?", answer: "Only remove pages that are genuinely unnecessary for your task and allowed to be omitted by the recipient. Do not remove required material just to pass the size check." },
      { question: "Will compressed text remain searchable?", answer: "Pages rebuilt as images lose selectable and searchable text. If compression would not reduce the file size, the size guard returns the original file unchanged. Keep your original when searchable text or interactive features are required." },
    ],
    related: ["compress-pdf-for-upload", "compress-pdf", "check-merged-pdf"],
  },
  {
    id: "check-merged-pdf", path: "/guides/check-merged-pdf", family: "guide", tool: "merge-pdf", status: "published",
    title: "Check a Merged PDF Before Sharing — Page Audit",
    description: "Audit a merged PDF against its source files. Reconcile page counts, check section boundaries, review duplicates and verify the file before sharing.",
    eyebrow: "How-to / Final document review", heading: "Check your merged PDF.\nThen share it.",
    intro: "A successful merge is the starting point for review. Compare the output with your source list so missing pages, repeated sections and order mistakes are easier to spot.",
    cardTitle: "Rebuild the packet in the right order",
    decision: "Keep a written source list beside the output. Check the beginning and end of every section; a matching page count alone does not prove the right content is present.",
    facts: [["Starting point", "The output and original PDFs"], ["Intended result", "A reviewed document packet"], ["First check", "Expected vs actual page count"]],
    stepsTitle: "Three passes through the finished file",
    steps: [
      { title: "Reconcile the page count", text: "Add the page counts of your sources, accounting for any intentional exclusions. Compare that total with the output. A difference is a reason to inspect the file, not proof of a specific error." },
      { title: "Follow the section boundaries", text: "Visit the first and last page of each source section in the merged PDF. Check them against the source list to find misplaced, missing or repeated sections." },
      { title: "Check the sharing copy", text: "Review orientation, small text and images. Verify the filename, measured size and any recipient requirements before attaching or submitting the document." },
    ],
    detailsTitle: "A small count check can reveal a big mistake",
    detailsIntro: "Suppose you combine the three sources below and intend to keep every page. The expected output is six pages.",
    details: [],
    example: { caption: "Example: expected page count", columns: ["Source", "Pages", "Running total"], rows: [["Application form", "2", "2"], ["Statement", "3", "5"], ["Supporting document", "1", "6"]], note: "Five or seven pages needs investigation. Six pages still needs a content and order check: a duplicate can replace a missing page without changing the total." },
    checklistTitle: "Check the final document",
    checklist: ["Every intended source document is present.", "The page count matches my intended inclusions.", "The first and last page of each section are correct.", "Repeated pages have been checked against the originals.", "Orientation, small text and important images are readable."],
    faqs: [
      { question: "Does a matching page count prove the merge is correct?", answer: "No. A duplicate and an omission can cancel each other out in the total. Check section boundaries and actual content as well as the number of pages." },
      { question: "What should I do about a repeated page?", answer: "Compare it with the originals and the recipient’s requirements. Some repeated pages may be intentional. If it is a mistake, rebuild the packet from the correct sources and review again." },
      { question: "Should I delete the originals after merging?", answer: "Keep the originals until you no longer need to verify or rebuild the packet. They are your reference for resolving a version, count or order mismatch." },
    ],
    related: ["merge-pdf", "merge-pdf-for-application", "compress-pdf-for-upload"],
  },
];

export const PUBLISHED_PDF_INTENTS = PDF_INTENTS.filter(page => page.status === "published");
export const getPdfIntent = (path: string) => PDF_INTENTS.find(page => page.path === path);
export const INTENT_FAMILY_LABEL = { tool: "Tool", task: "Workflow", guide: "Guide" } as const;

/** Fail a build on broken relationships, duplicate URLs or incomplete launch content. */
export function validatePdfIntents(pages: readonly PdfIntent[]) {
  const ids = new Set<string>();
  const paths = new Set<string>();
  const titles = new Set<string>();
  for (const page of pages) {
    if (ids.has(page.id) || paths.has(page.path) || titles.has(page.title)) throw new Error(`Duplicate PDF intent: ${page.id}`);
    if (!/^\/(?:use-cases\/|guides\/)?[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.path)) throw new Error(`Invalid intent path: ${page.path}`);
    if (page.family === "tool" ? page.path !== `/${page.tool}` : !page.path.startsWith(page.family === "guide" ? "/guides/" : "/use-cases/")) throw new Error(`Wrong route family: ${page.id}`);
    if (page.steps.length < 3 || page.checklist.length < 3 || page.faqs.length < 2 || page.related.length < 2 || !page.description || !page.heading) throw new Error(`Incomplete PDF intent: ${page.id}`);
    ids.add(page.id); paths.add(page.path); titles.add(page.title);
  }
  for (const page of pages) for (const id of page.related) {
    const target = pages.find(row => row.id === id);
    if (!target || id === page.id || (page.status === "published" && target.status !== "published")) throw new Error(`Invalid related intent: ${page.id} -> ${id}`);
  }
}
validatePdfIntents(PDF_INTENTS);
