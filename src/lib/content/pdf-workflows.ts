export type PdfWorkflowKind = "merge-compress" | "merge-number" | "merge-watermark" | "extract-compress" | "word-compress" | "word-merge";
export interface PdfWorkflow {
  slug: string; kind: PdfWorkflowKind; title: string; description: string; input: "pdf" | "docx";
  minFiles: number; samples: string[]; tools: string[]; steps: [string, string];
  purpose: string; checks: string[]; limitations: string; question: string; answer: string;
}
const compressLimit = "Compression can turn text and vector graphics into page images. Searchable text, links and editable fields may be lost if the smaller version is used. The workflow keeps the PDF from the first step if compression would make it larger. A specific file size is not guaranteed.";
const wordLimit = "The browser Word converter supports DOCX text, images and tables, but produces image-based pages. Fonts and layout can differ from Word. Unsupported charts, SmartArt and other complex content stop conversion. Use the original editor when exact layout is required.";
export const PDF_WORKFLOWS: readonly PdfWorkflow[] = [
  { slug: "merge-and-compress-pdf", kind: "merge-compress", title: "Merge and compress PDF", input: "pdf", minFiles: 2, samples: ["workflow-a.pdf", "workflow-b.pdf"], tools: ["merge-pdf", "compress-pdf"],
    description: "Combine PDFs in your chosen order, then reduce the merged file size in one browser workflow. Review the result and download one PDF for free.",
    steps: ["Merge your PDFs", "Compress the combined PDF"], purpose: "Prepare one smaller attachment from several documents. Arrange the files once; the merged result is passed directly into compression without a second upload.",
    checks: ["Check that the final pages follow your chosen file order.", "Compare the final size with the merged size shown in the result.", "Review small print before sending the document."],
    limitations: compressLimit + " Existing form fields are flattened before merging. Bookmarks and document-level settings are not preserved.",
    question: "Can I merge without reducing the quality?", answer: "The merge step copies PDF pages without rasterising them, and filled forms are flattened before copying. The optional compression step trades visual detail for size. Use the standard Merge PDF tool when keeping the original page content is your priority.",
  },
  { slug: "merge-pdf-and-add-page-numbers", kind: "merge-number", title: "Merge PDF and add page numbers", input: "pdf", minFiles: 2, samples: ["workflow-a.pdf", "workflow-b.pdf"], tools: ["merge-pdf", "add-page-numbers"],
    description: "Combine PDF files and add continuous page numbers across the merged document. Choose the file order and starting number, then download one PDF.",
    steps: ["Merge the files in order", "Number the combined pages"], purpose: "Create a numbered packet from separate documents. Numbering runs after merging so the sequence continues across file boundaries.",
    checks: ["Verify the first document appears first in the packet.", "Check that page numbers continue across the boundary between files.", "Make sure the bottom-centre label does not cover existing text."],
    limitations: "Numbers are added at the bottom centre of every page. Existing page numbers are not removed. Filled PDF forms are flattened during merging, and bookmarks or document-level settings are not retained. This preset needs pages without rotation; use the individual tools for a different numbering layout.",
    question: "Can I skip a cover page?", answer: "This workflow numbers every page. For a cover page, facing pages or a different number position, merge the PDFs with the standard tool and use the separate Add Page Numbers workspace for those controls.",
  },
  { slug: "merge-pdf-and-watermark", kind: "merge-watermark", title: "Merge PDF and add a watermark", input: "pdf", minFiles: 2, samples: ["workflow-a.pdf", "workflow-b.pdf"], tools: ["merge-pdf", "watermark-pdf"],
    description: "Merge PDFs and apply one text watermark across the combined document. Enter a label such as DRAFT, arrange the files and download the result.",
    steps: ["Combine the PDF pages", "Apply your text watermark"], purpose: "Prepare a consistently labelled draft or review packet. The same text watermark is applied to all pages after the files have been combined.",
    checks: ["Read the watermark on pages from each original file.", "Check the text still remains readable underneath the watermark.", "Confirm the file order before sharing the review packet."],
    limitations: "The preset adds a centred, translucent text label over every page. It does not secure the file or remove existing watermarks. Latin text only; forms are flattened before merging and document-level bookmarks are not retained.",
    question: "Does a watermark stop people from copying the PDF?", answer: "No. A watermark is a visible label, such as DRAFT or COPY. This workflow does not add encryption, permissions or copy protection.",
  },
  { slug: "extract-and-compress-pdf", kind: "extract-compress", title: "Extract and compress PDF pages", input: "pdf", minFiles: 1, samples: ["workflow-a.pdf"], tools: ["extract-pages", "compress-pdf"],
    description: "Select PDF pages and compress the extracted result in one step. Enter page numbers or ranges and download one PDF containing only your selection.",
    steps: ["Extract the selected pages", "Compress the selected PDF"], purpose: "Send only the relevant section of a larger file. Choose the pages first, then let the workflow attempt to reduce the size of that smaller document.",
    checks: ["Confirm that every requested page appears in the output.", "Check the selection order, especially if you entered separate ranges.", "Compare the size of the extracted PDF before and after compression."],
    limitations: compressLimit + " Select one PDF. Enter pages in the desired order; duplicate page selections are included once. Form fields are flattened before extracting pages.",
    question: "How do I select non-consecutive pages?", answer: "Enter a list such as 1, 3-5, 8. Page numbers start at 1. The result follows the order of your selections, and repeated page numbers are included once. Out-of-range pages produce an error so you can correct the selection.",
  },
  { slug: "word-to-pdf-and-compress", kind: "word-compress", title: "Convert Word to PDF and compress", input: "docx", minFiles: 1, samples: ["illustrated.docx"], tools: ["word-to-pdf", "compress-pdf"],
    description: "Convert a DOCX file to PDF and then try to reduce its size in one browser workflow. Review the conversion and download the final PDF for free.",
    steps: ["Convert the DOCX to PDF", "Compress the converted PDF"], purpose: "Prepare a PDF attachment from a Word file without moving the converted document between separate tools. The result shows the conversion size and the final size.",
    checks: ["Compare the output with your original Word document.", "Check images, table borders and page breaks.", "Inspect small text before sending the compressed result."],
    limitations: wordLimit + " " + compressLimit,
    question: "Can I upload an old .doc file?", answer: "This workflow accepts DOCX only. Save an older Word document as DOCX in its original editor, or use the editor's own PDF export. Password-protected documents are not supported.",
  },
  { slug: "combine-word-documents-to-pdf", kind: "word-merge", title: "Combine Word documents into one PDF", input: "docx", minFiles: 2, samples: ["table.docx", "illustrated.docx"], tools: ["word-to-pdf", "merge-pdf"],
    description: "Convert multiple DOCX documents and combine their pages into one PDF. Arrange the documents in order and download a single combined PDF file.",
    steps: ["Convert each DOCX document", "Merge the converted PDFs"], purpose: "Assemble separate Word documents into one reading or review packet. Each document is converted independently before its pages are added in the selected order.",
    checks: ["Check the start of each document in the combined PDF.", "Compare images and tables with the original DOCX files.", "Confirm all expected pages are present and in order."],
    limitations: wordLimit + " The output is a PDF, not an editable merged DOCX. Each document keeps its own page layout; headers and page numbers are not renumbered across documents.",
    question: "Does this make one editable Word document?", answer: "The result is one combined PDF. The workflow does not merge Word styles, sections or tracked changes into a new DOCX. Use Word's own document tools when you need an editable Word file.",
  },
];
export const workflowPath = (row: PdfWorkflow) => `/pdf-workflows/${row.slug}`;
export const getPdfWorkflow = (slug: string) => PDF_WORKFLOWS.find(row => row.slug === slug);
if (new Set(PDF_WORKFLOWS.map(row => row.slug)).size !== PDF_WORKFLOWS.length) throw new Error("Duplicate PDF workflow slug");
