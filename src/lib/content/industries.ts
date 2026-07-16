import type { BaseContentEntity, EntityRef } from "./types";

export interface IndustryEntity extends BaseContentEntity {
  type: "industry";
  /** Real tools recommended for this audience, each with a specific,
   *  verifiable reason tied to that tool's actual behavior — the same
   *  "no invented data" discipline COMPARISONS already follows. No tool
   *  is recommended here that doesn't already exist and do exactly what
   *  the reason describes. */
  recommendedTools: { tool: EntityRef; reason: string }[];
}

/**
 * Audience-based curation across multiple tools — a different axis from
 * CATEGORIES (which groups tools by function: merge, split, convert).
 * Every reason below is a real, specific claim about what a tool does,
 * not generic "great for professionals" filler — the same bar every other
 * content type in this project is held to.
 */
export const INDUSTRIES: readonly IndustryEntity[] = [
  {
    type: "industry",
    searchIntent: "commercial",
    id: "industry-legal",
    slug: "legal",
    path: "/industries/legal",
    title: "PDF Tools for Legal Professionals",
    description:
      "Contracts, filings, and discovery documents all move through PDF. Here's which PDFPilot tools handle the document work that comes up most in legal practice, and why. " +
      "One common legal need — redaction that provably removes content, not just visually covers it — isn't listed below because PDFPilot doesn't offer it yet; see the note under Compare PDFs.",
    recommendedTools: [
      {
        tool: { type: "tool", id: "tool-merge-pdf" },
        reason:
          "Assembling an exhibit packet or a multi-part filing from separate PDFs into one document, in a specific order, is a routine part of preparing filings.",
      },
      {
        tool: { type: "tool", id: "tool-pdf-metadata-editor" },
        reason:
          "Document metadata (author, creation tool, timestamps) can end up in a filed PDF without anyone intending it. Reviewing and clearing it before filing is a real, common precaution.",
      },
      {
        tool: { type: "tool", id: "tool-watermark-pdf" },
        reason:
          "Marking a document \"Draft\" or \"Privileged and Confidential\" before it's circulated for review is a standard practice this tool does directly, page by page.",
      },
      {
        tool: { type: "tool", id: "tool-compare-pdf" },
        reason:
          "Confirming exactly what changed between two versions of a contract or filing — not just that something changed — is what Compare PDFs does by diffing extracted text directly. " +
          "(Redaction is a related, frequently-requested need this tool does not cover — it isn't built, since guaranteeing removed content is actually gone from the file, not just visually hidden, is a correctness bar not yet met.)",
      },
    ],
    related: [
      { type: "tool", id: "tool-merge-pdf" },
      { type: "tool", id: "tool-pdf-metadata-editor" },
      { type: "tool", id: "tool-compare-pdf" },
    ],
  },
  {
    type: "industry",
    searchIntent: "commercial",
    id: "industry-education",
    slug: "education",
    path: "/industries/education",
    title: "PDF Tools for Students and Teachers",
    description:
      "From scanned lecture notes to assignment submissions, students and teachers deal with a specific, repetitive set of document problems. Here's what actually helps.",
    recommendedTools: [
      {
        tool: { type: "tool", id: "tool-ocr-image" },
        reason:
          "A photo of handwritten or printed notes isn't searchable or copyable text until it's run through OCR — this tool converts the image directly to text you can search, copy, and edit.",
      },
      {
        tool: { type: "tool", id: "tool-jpg-to-pdf" },
        reason:
          "Turning a set of photographed pages into a single PDF, in reading order, is exactly what this tool does — the standard way to submit a handwritten assignment digitally.",
      },
      {
        tool: { type: "tool", id: "tool-compress-pdf" },
        reason:
          "Most learning management systems and email attachments cap upload size — this tool shrinks an oversized scanned assignment PDF to fit under that limit.",
      },
      {
        tool: { type: "tool", id: "tool-merge-pdf" },
        reason:
          "Combining a semester's worth of separate lecture-note PDFs into one file for review before an exam is a direct fit for this tool.",
      },
      {
        tool: { type: "tool", id: "tool-extract-pages" },
        reason:
          "Pulling just the relevant chapter or section out of a long assigned reading, without carrying the rest of the document along, is what this tool does.",
      },
    ],
    related: [
      { type: "tool", id: "tool-ocr-image" },
      { type: "tool", id: "tool-jpg-to-pdf" },
      { type: "tool", id: "tool-compress-pdf" },
    ],
  },
  {
    type: "industry",
    searchIntent: "commercial",
    id: "industry-accounting-finance",
    slug: "accounting-finance",
    path: "/industries/accounting-finance",
    title: "PDF Tools for Accounting and Finance",
    description:
      "Statements, invoices, and spreadsheet exports are the daily material of accounting work. Here's which tools handle the conversions and organization that come up most.",
    recommendedTools: [
      {
        tool: { type: "tool", id: "tool-merge-pdf" },
        reason:
          "Combining twelve months of separate bank or credit card statement PDFs into one file, in chronological order, is a direct, common use of this tool.",
      },
      {
        tool: { type: "tool", id: "tool-excel-to-pdf" },
        reason:
          "Turning a spreadsheet of figures into a fixed, shareable PDF for a client or auditor — one that won't be accidentally edited — is exactly what this tool produces.",
      },
      {
        tool: { type: "tool", id: "tool-pdf-to-word" },
        reason:
          "Extracting the text of a received PDF invoice or statement into an editable document, for example to reuse language in a client letter, is what this tool converts to.",
      },
      {
        tool: { type: "tool", id: "tool-split-pdf" },
        reason:
          "Separating one combined statement PDF back into individual account or period files, when a client or system needs them separately, is what this tool does.",
      },
      {
        tool: { type: "tool", id: "tool-excel-to-xml" },
        reason:
          "Handing off a spreadsheet export of transactions or ledger entries to a system that ingests structured XML rather than a spreadsheet is what this tool converts to — a generic, honest XML structure, not a guess at any specific accounting system's proprietary schema.",
      },
      {
        tool: { type: "tool", id: "tool-xml-to-excel" },
        reason:
          "Turning a structured XML data export back into a real, openable spreadsheet for review is what this tool produces.",
      },
      {
        tool: { type: "tool", id: "tool-csv-cleaner" },
        reason:
          "A transaction export with stray whitespace or blank rows from a bank or payment processor is a routine annoyance before that data can be imported anywhere else — this tool trims it in one pass.",
      },
      {
        tool: { type: "tool", id: "tool-json-to-excel" },
        reason:
          "Many accounting and payment platforms expose transaction or invoice data as JSON through their API — turning that into a real spreadsheet for review or reconciliation is what this tool does.",
      },
    ],
    related: [
      { type: "tool", id: "tool-merge-pdf" },
      { type: "tool", id: "tool-excel-to-pdf" },
      { type: "tool", id: "tool-split-pdf" },
      { type: "tool", id: "tool-excel-to-xml" },
      { type: "tool", id: "tool-csv-cleaner" },
      { type: "tool", id: "tool-json-to-excel" },
    ],
  },
  {
    type: "industry",
    searchIntent: "commercial",
    id: "industry-hr",
    slug: "hr",
    path: "/industries/hr",
    title: "PDF Tools for HR and Recruiting",
    description:
      "Resumes, offer letters, and onboarding paperwork all pass through HR as PDFs. Here's what handles the volume and formatting problems that come with that.",
    recommendedTools: [
      {
        tool: { type: "tool", id: "tool-compress-pdf" },
        reason:
          "A resume with an embedded high-resolution headshot or portfolio images can be too large for an applicant tracking system's upload limit — this tool shrinks it without changing the content.",
      },
      {
        tool: { type: "tool", id: "tool-merge-pdf" },
        reason:
          "Assembling a resume, cover letter, and references into one file before forwarding a candidate to a hiring manager is a direct fit for this tool.",
      },
      {
        tool: { type: "tool", id: "tool-word-to-pdf" },
        reason:
          "Converting an offer letter or onboarding form drafted in Word into a fixed PDF, so formatting doesn't shift when the candidate opens it on a different device, is what this tool does.",
      },
      {
        tool: { type: "tool", id: "tool-pdf-metadata-editor" },
        reason:
          "Clearing the author/company metadata on a template document before it's sent externally — so it doesn't reveal internal file naming or authorship — is a real, checkable step this tool performs.",
      },
    ],
    related: [
      { type: "tool", id: "tool-compress-pdf" },
      { type: "tool", id: "tool-merge-pdf" },
      { type: "tool", id: "tool-word-to-pdf" },
    ],
  },
  {
    type: "industry",
    searchIntent: "commercial",
    id: "industry-real-estate",
    slug: "real-estate",
    path: "/industries/real-estate",
    title: "PDF Tools for Real Estate",
    description:
      "Listings, disclosures, and signed agreements move as PDFs throughout a real estate transaction. Here's what handles the document side of that.",
    recommendedTools: [
      {
        tool: { type: "tool", id: "tool-merge-pdf" },
        reason:
          "A closing packet is typically a stack of separate documents (disclosures, inspection reports, the agreement itself) that need to become one file — this tool does exactly that, in the order you set.",
      },
      {
        tool: { type: "tool", id: "tool-pdf-to-jpg" },
        reason:
          "Pulling a single page — a floor plan or a signature page — out of a long PDF as a standalone image, for example to include in a listing, is what this tool converts to.",
      },
      {
        tool: { type: "tool", id: "tool-compress-pdf" },
        reason:
          "A listing packet with embedded photos can exceed email attachment limits — this tool reduces the file size while keeping every page.",
      },
      {
        tool: { type: "tool", id: "tool-rotate-pdf" },
        reason:
          "A scanned inspection report or disclosure form that comes through sideways is a genuinely common problem — this tool fixes page orientation directly.",
      },
      {
        tool: { type: "tool", id: "tool-heic-to-jpg" },
        reason:
          "Listing photos shot on an agent's iPhone come out as HEIC files that many MLS platforms and listing sites reject — this tool converts them to universally-accepted JPG.",
      },
      {
        tool: { type: "tool", id: "tool-image-watermark" },
        reason:
          "Adding an agency name or \"Coming Soon\" text across listing photos before they're shared publicly, ahead of the official listing going live, is exactly what this tool draws directly onto the image.",
      },
    ],
    related: [
      { type: "tool", id: "tool-merge-pdf" },
      { type: "tool", id: "tool-compress-pdf" },
      { type: "tool", id: "tool-rotate-pdf" },
      { type: "tool", id: "tool-heic-to-jpg" },
      { type: "tool", id: "tool-image-watermark" },
    ],
  },
];

export function getIndustry(path: string): IndustryEntity | undefined {
  return INDUSTRIES.find((industry) => industry.path === path);
}
