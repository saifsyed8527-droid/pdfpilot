import type { BaseContentEntity, EntityRef } from "./types";

export interface UseCaseEntity extends BaseContentEntity {
  type: "use-case";
  steps: { tool: EntityRef; instruction: string }[];
}

export const USE_CASES: readonly UseCaseEntity[] = [
  {
    type: "use-case",
    id: "use-case-extract-and-shrink-pages-from-a-large-pdf",
    slug: "extract-and-shrink-pages-from-a-large-pdf",
    path: "/use-cases/extract-and-shrink-pages-from-a-large-pdf",
    title: "Extract and Shrink Pages From a Large PDF",
    description:
      "Only need a few pages from a large PDF, and need to keep the result small enough to email? Here's the two-step way to do it.",
    steps: [
      {
        tool: { type: "tool", id: "tool-split-pdf" },
        instruction: "Use Split PDF to pull out just the page range you need from the original document.",
      },
      {
        tool: { type: "tool", id: "tool-compress-pdf" },
        instruction: "If the extracted pages are still too large to send, run the result through Compress PDF to shrink the file size further.",
      },
    ],
    related: [
      { type: "tool", id: "tool-split-pdf" },
      { type: "tool", id: "tool-compress-pdf" },
    ],
  },
  {
    type: "use-case",
    id: "use-case-combine-bank-statements-into-one-pdf",
    slug: "combine-bank-statements-into-one-pdf",
    path: "/use-cases/combine-bank-statements-into-one-pdf",
    title: "Combine Bank Statements Into One PDF",
    description:
      "Have separate monthly bank statement PDFs you need as a single document? Here's how to combine them in the right order.",
    steps: [
      {
        tool: { type: "tool", id: "tool-merge-pdf" },
        instruction:
          "Upload each monthly statement PDF, then drag them into chronological order — the merged file will follow the exact order you arrange them in.",
      },
      {
        tool: { type: "tool", id: "tool-merge-pdf" },
        instruction:
          "Merge the files into a single PDF and download it. Every page from each statement is preserved exactly as it was, so all your original numbers and formatting stay intact.",
      },
    ],
    related: [
      { type: "tool", id: "tool-merge-pdf" },
      { type: "guide", id: "guide-how-pdf-merging-works" },
    ],
  },
  {
    type: "use-case",
    id: "use-case-split-a-scanned-pdf-into-separate-documents",
    slug: "split-a-scanned-pdf-into-separate-documents",
    path: "/use-cases/split-a-scanned-pdf-into-separate-documents",
    title: "Split a Scanned PDF Into Separate Documents",
    description:
      "Scanned multiple documents into one PDF by mistake? Here's how to split it back into individual files.",
    steps: [
      {
        tool: { type: "tool", id: "tool-split-pdf" },
        instruction:
          "Upload the scanned PDF and note which page ranges belong to which document — the page count and a preview of your file appear right after upload.",
      },
      {
        tool: { type: "tool", id: "tool-split-pdf" },
        instruction:
          "Enter each document's page range separated by commas (for example, 1-2,3-4,5-6) — Split PDF creates one separate file for each range you enter, ready to download individually or all at once.",
      },
    ],
    related: [
      { type: "tool", id: "tool-split-pdf" },
      { type: "guide", id: "guide-how-pdf-splitting-works" },
    ],
  },
  {
    type: "use-case",
    id: "use-case-create-preview-images-from-a-pdf-for-a-website",
    slug: "create-preview-images-from-a-pdf-for-a-website",
    path: "/use-cases/create-preview-images-from-a-pdf-for-a-website",
    title: "Create Preview Images From a PDF for a Website or Presentation",
    description:
      "Need an image version of a PDF page to embed in a website, slide deck, or document? Here's how.",
    steps: [
      {
        tool: { type: "tool", id: "tool-pdf-to-jpg" },
        instruction:
          "Upload the PDF. PDF to JPG converts every page into its own JPG image — there's no option to convert only specific pages, so the whole document is processed.",
      },
      {
        tool: { type: "tool", id: "tool-pdf-to-jpg" },
        instruction:
          "Download the image for the specific page you need, or use \"Download All\" if you need more than one.",
      },
    ],
    related: [
      { type: "tool", id: "tool-pdf-to-jpg" },
      { type: "guide", id: "guide-how-pdf-to-jpg-conversion-works" },
    ],
  },
  {
    type: "use-case",
    id: "use-case-combine-scanned-photos-into-a-single-pdf",
    slug: "combine-scanned-photos-into-a-single-pdf",
    path: "/use-cases/combine-scanned-photos-into-a-single-pdf",
    title: "Combine Scanned Photos Into a Single PDF",
    description:
      "Took photos of a multi-page paper document with your phone? Here's how to turn them into one PDF, in the right order.",
    steps: [
      {
        tool: { type: "tool", id: "tool-jpg-to-pdf" },
        instruction:
          "Upload each photo in the order the pages should appear. JPG to PDF doesn't support reordering afterward, so add them in sequence from the start — or upload them in batches and remove any that are out of place before continuing.",
      },
      {
        tool: { type: "tool", id: "tool-jpg-to-pdf" },
        instruction:
          "Convert the images to a single PDF and download it. Each photo becomes its own page, sized to match that photo's original dimensions.",
      },
    ],
    related: [
      { type: "tool", id: "tool-jpg-to-pdf" },
      { type: "guide", id: "guide-how-jpg-to-pdf-conversion-works" },
      { type: "help", id: "help-can-i-reorder-my-images-before-converting-to-pdf" },
    ],
  },
  {
    type: "use-case",
    id: "use-case-prepare-documents-for-printing",
    slug: "prepare-documents-for-printing",
    path: "/use-cases/prepare-documents-for-printing",
    title: "Prepare Documents for Printing",
    searchIntent: "transactional",
    difficulty: "beginner",
    description:
      "Getting a PDF ready to print correctly — right orientation, right page order, one clean file — usually takes a couple of quick fixes first. Here's the checklist.",
    steps: [
      {
        tool: { type: "tool", id: "tool-rotate-pdf" },
        instruction:
          "Fix any pages that are sideways or upside-down first — a scanned document commonly has a few pages in the wrong orientation, and this is easiest to catch before printing, not after.",
      },
      {
        tool: { type: "tool", id: "tool-rearrange-pages" },
        instruction:
          "If pages are out of order — common after combining scans — reorder them into the sequence you want printed.",
      },
      {
        tool: { type: "tool", id: "tool-merge-pdf" },
        instruction:
          "If you're printing from more than one source file, merge them into a single PDF first so the print job comes out as one document, not several separate ones.",
      },
    ],
    related: [
      { type: "tool", id: "tool-rotate-pdf" },
      { type: "tool", id: "tool-rearrange-pages" },
      { type: "tool", id: "tool-merge-pdf" },
    ],
  },
  {
    type: "use-case",
    id: "use-case-merge-invoices-into-one-pdf",
    slug: "merge-invoices-into-one-pdf",
    path: "/use-cases/merge-invoices-into-one-pdf",
    title: "Merge Invoices Into One PDF",
    searchIntent: "transactional",
    difficulty: "beginner",
    description:
      "Sending or filing a batch of individual invoice PDFs as one combined document? Here's how to merge them without losing any pages.",
    steps: [
      {
        tool: { type: "tool", id: "tool-merge-pdf" },
        instruction:
          "Upload each invoice PDF and arrange them in the order you want them to appear — by date or invoice number is the usual choice for an accounting record.",
      },
      {
        tool: { type: "tool", id: "tool-merge-pdf" },
        instruction:
          "Merge and download the combined file. Every page from every invoice is preserved exactly as it was — merging doesn't alter page content, only combines the files.",
      },
    ],
    related: [
      { type: "tool", id: "tool-merge-pdf" },
      { type: "guide", id: "guide-how-pdf-merging-works" },
    ],
  },
  {
    type: "use-case",
    id: "use-case-turn-handwritten-notes-into-searchable-text",
    slug: "turn-handwritten-notes-into-searchable-text",
    path: "/use-cases/turn-handwritten-notes-into-searchable-text",
    title: "Turn Handwritten Notes Into Searchable Text",
    searchIntent: "transactional",
    difficulty: "intermediate",
    description:
      "Have a photo of handwritten or printed notes and need the actual text out of it — to search, copy, or edit? Here's how OCR gets you there.",
    steps: [
      {
        tool: { type: "tool", id: "tool-ocr-image" },
        instruction:
          "Upload a photo of the notes. OCR Image reads the text directly out of the image — accuracy depends heavily on handwriting legibility and photo clarity, so a clear, well-lit, non-blurry photo of neat handwriting works best.",
      },
      {
        tool: { type: "tool", id: "tool-ocr-image" },
        instruction:
          "Review the extracted text against the original — OCR on handwriting is meaningfully less reliable than OCR on printed text, so a quick proofread is worth doing before you rely on the result.",
      },
    ],
    related: [
      { type: "tool", id: "tool-ocr-image" },
      { type: "tool", id: "tool-ocr-pdf" },
      { type: "learning-resource", id: "learning-resource-what-is-ocr" },
    ],
  },
  {
    type: "use-case",
    id: "use-case-compress-a-resume-for-email",
    slug: "compress-a-resume-for-email",
    path: "/use-cases/compress-a-resume-for-email",
    title: "Compress a Resume for Email",
    searchIntent: "transactional",
    difficulty: "beginner",
    description:
      "A resume with an embedded photo or portfolio images can be too large for some email systems or application forms. Here's how to shrink it without losing any pages.",
    steps: [
      {
        tool: { type: "tool", id: "tool-compress-pdf" },
        instruction:
          "Upload your resume PDF — Compress PDF reduces file size while keeping every page and all the text intact.",
      },
      {
        tool: { type: "tool", id: "tool-compress-pdf" },
        instruction:
          "Download the compressed version and check it opens correctly before sending — compression is lossy for embedded images specifically, so a resume with a lot of photos may show a small, usually unnoticeable, quality reduction in those images.",
      },
    ],
    related: [
      { type: "tool", id: "tool-compress-pdf" },
      { type: "guide", id: "guide-how-pdf-compression-works" },
    ],
  },
  {
    type: "use-case",
    id: "use-case-prepare-a-spreadsheet-export-for-a-data-import",
    slug: "prepare-a-spreadsheet-export-for-a-data-import",
    path: "/use-cases/prepare-a-spreadsheet-export-for-a-data-import",
    title: "Prepare a Spreadsheet Export for a Data Import",
    description:
      "Need to hand off data from an Excel export or CSV report to a system that expects XML? Here's how to convert it without hand-editing the file.",
    searchIntent: "transactional",
    difficulty: "intermediate",
    steps: [
      {
        tool: { type: "tool", id: "tool-excel-to-xml" },
        instruction:
          "If your data is in an Excel workbook, upload it here — the first sheet with data converts into <row> elements, one per spreadsheet row. If you already have a CSV export instead, use CSV to XML the same way.",
      },
      {
        tool: { type: "tool", id: "tool-csv-to-xml" },
        instruction:
          "For a CSV export specifically: upload it and convert directly — no need to open it in Excel first.",
      },
      {
        tool: { type: "tool", id: "tool-xml-to-csv" },
        instruction:
          "If the receiving system needs CSV instead, and you already have XML in the <rows><row> structure PDFPilot produces, convert it back with XML to CSV.",
      },
    ],
    related: [
      { type: "tool", id: "tool-excel-to-xml" },
      { type: "tool", id: "tool-csv-to-xml" },
      { type: "tool", id: "tool-xml-to-csv" },
      { type: "guide", id: "guide-how-csv-excel-xml-conversion-works" },
    ],
  },
  {
    type: "use-case",
    id: "use-case-prepare-iphone-photos-for-a-website",
    slug: "prepare-iphone-photos-for-a-website",
    path: "/use-cases/prepare-iphone-photos-for-a-website",
    title: "Prepare iPhone Photos for a Website",
    description:
      "Photos straight from an iPhone are usually HEIC files that many websites and content management systems reject on upload. Here's how to fix that.",
    searchIntent: "transactional",
    difficulty: "beginner",
    steps: [
      {
        tool: { type: "tool", id: "tool-heic-to-jpg" },
        instruction:
          "Upload the HEIC photo and convert it to JPG — the format virtually every website, CMS, and image host accepts without issue.",
      },
      {
        tool: { type: "tool", id: "tool-resize-image" },
        instruction:
          "If the site has a maximum upload dimension or file size, resize the converted JPG down before uploading it.",
      },
    ],
    related: [
      { type: "tool", id: "tool-heic-to-jpg" },
      { type: "tool", id: "tool-resize-image" },
      { type: "guide", id: "guide-how-heic-photo-conversion-works" },
    ],
  },
  {
    type: "use-case",
    id: "use-case-watermark-photos-before-sharing-proofs",
    slug: "watermark-photos-before-sharing-proofs",
    path: "/use-cases/watermark-photos-before-sharing-proofs",
    title: "Watermark Photos Before Sharing Proofs",
    description:
      "Sending unwatermarked proof photos to a client before payment risks someone using them anyway. Here's how to mark them without a full editing app.",
    searchIntent: "transactional",
    difficulty: "beginner",
    steps: [
      {
        tool: { type: "tool", id: "tool-image-watermark" },
        instruction:
          "Upload each proof photo and add your text watermark. Choose Tiled for proofs you want harder to crop around, or a single corner position for a lighter-touch mark.",
      },
      {
        tool: { type: "tool", id: "tool-image-watermark" },
        instruction:
          "Adjust opacity to balance visibility against how much of the underlying photo you want a client to be able to judge before paying for the unmarked version.",
      },
    ],
    related: [
      { type: "tool", id: "tool-image-watermark" },
      { type: "guide", id: "guide-how-image-watermarking-works" },
    ],
  },
  {
    type: "use-case",
    id: "use-case-migrate-a-legacy-sql-export-to-a-spreadsheet",
    slug: "migrate-a-legacy-sql-export-to-a-spreadsheet",
    path: "/use-cases/migrate-a-legacy-sql-export-to-a-spreadsheet",
    title: "Migrate a Legacy SQL Export to a Spreadsheet",
    description:
      "Inherited a database dump's INSERT statements and need the data in a real spreadsheet for review or a non-technical teammate? Here's how, without setting up a database.",
    searchIntent: "transactional",
    difficulty: "intermediate",
    steps: [
      {
        tool: { type: "tool", id: "tool-sql-to-csv" },
        instruction:
          "Upload the .sql file containing INSERT INTO statements and convert it to CSV — no database needs to be running, since the tool reads the literal values directly from the SQL text.",
      },
      {
        tool: { type: "tool", id: "tool-csv-to-json" },
        instruction:
          "If the receiving system or teammate needs JSON instead of CSV, convert the CSV one more step to get a JSON array of the same records.",
      },
    ],
    related: [
      { type: "tool", id: "tool-sql-to-csv" },
      { type: "tool", id: "tool-sql-to-json" },
      { type: "guide", id: "guide-how-pdfpilots-data-format-tools-fit-together" },
    ],
  },
  {
    type: "use-case",
    id: "use-case-prepare-api-json-data-for-a-non-technical-teammate",
    slug: "prepare-api-json-data-for-a-non-technical-teammate",
    path: "/use-cases/prepare-api-json-data-for-a-non-technical-teammate",
    title: "Prepare API JSON Data for a Non-Technical Teammate",
    description:
      "Pulled a JSON response from an API and need to hand the data to someone who lives in Excel, not code? Here's the fastest honest path.",
    searchIntent: "transactional",
    difficulty: "beginner",
    steps: [
      {
        tool: { type: "tool", id: "tool-json-formatter" },
        instruction:
          "If the raw API response is a single unreadable line, format it first so you can sanity-check its structure before converting.",
      },
      {
        tool: { type: "tool", id: "tool-json-to-excel" },
        instruction:
          "Convert the JSON array into a real, openable Excel spreadsheet your teammate can filter, sort, and use directly — no code required on their end.",
      },
    ],
    related: [
      { type: "tool", id: "tool-json-formatter" },
      { type: "tool", id: "tool-json-to-excel" },
      { type: "tool", id: "tool-json-to-csv" },
    ],
  },
];

export function getUseCase(path: string): UseCaseEntity | undefined {
  return USE_CASES.find((useCase) => useCase.path === path);
}
