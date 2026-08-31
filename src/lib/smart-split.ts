/**
 * Split PDF's "Smart" mode — a deterministic, local document-boundary
 * detector. There is no AI/LLM/OCR backend in this codebase (verified: no
 * server, no third-party analysis API — see src/lib/engines/ai-engine.ts,
 * which is a local heuristic engine for a different tool, not a hosted
 * model), so Smart does NOT pretend to run AI analysis. It runs real text
 * extraction (pdfjs-dist, already a dependency) against each page and
 * applies one of a few honestly-described, deterministic detection
 * strategies. Every category/preset below maps to one of these strategies;
 * none of them claim capabilities (e.g. barcode reading, semantic
 * understanding) this engine doesn't actually have.
 */

import { loadPdfjs } from "./pdfjs";

export type DetectionMode =
  | "identifier-change"
  | "heading-pattern"
  | "repeated-first-line"
  | "every-n-pages";

export interface SmartPreset {
  id: string;
  label: string;
  mode: DetectionMode;
  /** Regex used by identifier-change / heading-pattern. Its first capture
   *  group (or, if none, the full match) is the "identifier" compared
   *  across pages. */
  pattern?: RegExp;
  n?: number;
  /** Shown in the UI so the detection strategy is never a mystery. */
  description: string;
}

export interface SmartCategory {
  id: string;
  label: string;
  presets: SmartPreset[];
}

const MONTH_YEAR = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\.?\s+\d{4}\b/i;
const DATE_RANGE = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\s*(?:-|to|–)\s*\d{1,2}\/\d{1,2}\/\d{2,4}\b/i;
const ACCOUNT_NUMBER = /account\s*(?:#|no\.?|number)?\s*[:#]?\s*([A-Z0-9*\-]{4,})/i;
const INVOICE_NUMBER = /invoice\s*(?:#|no\.?|number)?\s*[:#]?\s*([A-Z0-9\-]{3,})/i;

export const SMART_CATEGORIES: SmartCategory[] = [
  {
    id: "invoices",
    label: "Invoices and billing documents",
    presets: [
      { id: "by-invoice", label: "Split by invoice", mode: "heading-pattern", pattern: /\binvoice\b/i, description: "Starts a new file wherever a page's top text contains \"Invoice\"." },
      { id: "by-invoice-number", label: "Split by invoice number", mode: "identifier-change", pattern: INVOICE_NUMBER, description: "Starts a new file wherever the detected invoice number changes." },
      { id: "by-customer", label: "Split by customer", mode: "identifier-change", pattern: /(?:bill\s*to|customer)\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9 .,&'-]{2,40})/i, description: "Starts a new file wherever the detected \"Bill To\" / customer name changes." },
      { id: "by-billing-period", label: "Split by billing period", mode: "identifier-change", pattern: MONTH_YEAR, description: "Starts a new file wherever the detected billing month changes." },
    ],
  },
  {
    id: "contracts",
    label: "Contracts and legal documents",
    presets: [
      { id: "by-contract", label: "Split by contract", mode: "heading-pattern", pattern: /\b(agreement|contract)\b/i, description: "Starts a new file wherever a page's top text contains \"Agreement\" or \"Contract\"." },
      { id: "by-agreement", label: "Split by agreement", mode: "repeated-first-line", description: "Starts a new file wherever a page's first line matches the document's recurring letterhead/title line." },
      { id: "by-section", label: "Split by major document section", mode: "heading-pattern", pattern: /^\s*(article|section)\s+[ivxlcdm\d]+/im, description: "Starts a new file wherever a page begins with \"Article\" or \"Section\" followed by a number." },
    ],
  },
  {
    id: "bank-statements",
    label: "Bank statements and financial reports",
    presets: [
      { id: "by-month", label: "Split statements by month", mode: "identifier-change", pattern: MONTH_YEAR, description: "Starts a new file wherever the detected statement month changes." },
      { id: "by-account-number", label: "Split statements by account number", mode: "identifier-change", pattern: ACCOUNT_NUMBER, description: "Starts a new file wherever the detected account number changes." },
      { id: "multi-account", label: "Split multi-account statements", mode: "identifier-change", pattern: ACCOUNT_NUMBER, description: "Same account-number detection as above, for statements covering multiple accounts." },
      { id: "by-reporting-period", label: "Split statements by reporting period", mode: "identifier-change", pattern: DATE_RANGE, description: "Starts a new file wherever the detected statement date range changes." },
      { id: "summary-vs-transactions", label: "Split summary pages from transactions", mode: "heading-pattern", pattern: /\bsummary\b/i, description: "Starts a new file at each page whose top text contains \"Summary\"." },
      { id: "card-vs-bank", label: "Split credit card and bank account statements", mode: "identifier-change", pattern: /\b(visa|mastercard|credit card|checking|savings)\b/i, description: "Starts a new file wherever the detected account type (credit card vs. checking/savings) changes." },
      { id: "by-header", label: "Split statements by bank or header", mode: "repeated-first-line", description: "Starts a new file wherever a page's first line matches the recurring header line seen elsewhere in the document." },
    ],
  },
  {
    id: "academic",
    label: "Academic and educational documents",
    presets: [
      { id: "by-chapter", label: "Split by chapter", mode: "heading-pattern", pattern: /^\s*chapter\s+\d+/im, description: "Starts a new file wherever a page begins with \"Chapter\" followed by a number." },
      { id: "by-assignment", label: "Split by assignment", mode: "heading-pattern", pattern: /^\s*assignment\s*\d*/im, description: "Starts a new file wherever a page begins with \"Assignment\"." },
      { id: "by-paper", label: "Split by paper/article", mode: "repeated-first-line", description: "Starts a new file wherever a page's first line matches the document's recurring title/header line." },
      { id: "by-section", label: "Split by section", mode: "heading-pattern", pattern: /^\s*section\s+[ivxlcdm\d]+/im, description: "Starts a new file wherever a page begins with \"Section\" followed by a number." },
    ],
  },
  {
    id: "medical",
    label: "Medical and healthcare records",
    presets: [
      { id: "by-patient", label: "Split by patient", mode: "identifier-change", pattern: /patient\s*(?:name)?\s*[:#]?\s*([A-Za-z][A-Za-z .,'-]{2,40})/i, description: "Starts a new file wherever the detected patient name changes." },
      { id: "by-visit-date", label: "Split by visit date", mode: "identifier-change", pattern: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/, description: "Starts a new file wherever the detected date changes." },
      { id: "by-record-type", label: "Split by record type", mode: "heading-pattern", pattern: /\b(lab results?|prescription|visit summary|discharge summary)\b/i, description: "Starts a new file wherever a page's top text contains a recognized record-type heading." },
    ],
  },
  {
    id: "hr",
    label: "HR and employee documents",
    presets: [
      { id: "by-employee", label: "Split by employee", mode: "identifier-change", pattern: /employee\s*(?:name)?\s*[:#]?\s*([A-Za-z][A-Za-z .,'-]{2,40})/i, description: "Starts a new file wherever the detected employee name changes." },
      { id: "by-document-type", label: "Split by document type", mode: "heading-pattern", pattern: /\b(offer letter|employment contract|performance review|termination)\b/i, description: "Starts a new file wherever a page's top text contains a recognized HR document heading." },
    ],
  },
  {
    id: "insurance",
    label: "Insurance documents",
    presets: [
      { id: "by-policy-number", label: "Split by policy number", mode: "identifier-change", pattern: /policy\s*(?:#|no\.?|number)?\s*[:#]?\s*([A-Z0-9\-]{4,})/i, description: "Starts a new file wherever the detected policy number changes." },
      { id: "by-claim", label: "Split by claim", mode: "identifier-change", pattern: /claim\s*(?:#|no\.?|number)?\s*[:#]?\s*([A-Z0-9\-]{4,})/i, description: "Starts a new file wherever the detected claim number changes." },
    ],
  },
  {
    id: "shipping",
    label: "Shipping, logistics, and customs documents",
    presets: [
      { id: "by-tracking-number", label: "Split by tracking number", mode: "identifier-change", pattern: /tracking\s*(?:#|no\.?|number)?\s*[:#]?\s*([A-Z0-9\-]{6,})/i, description: "Starts a new file wherever the detected tracking number changes." },
      { id: "by-shipment", label: "Split by shipment", mode: "repeated-first-line", description: "Starts a new file wherever a page's first line matches the recurring shipment-header line." },
    ],
  },
  {
    id: "government",
    label: "Government and administrative forms",
    presets: [
      { id: "by-form-number", label: "Split by form number", mode: "identifier-change", pattern: /form\s*(?:#|no\.?|number)?\s*[:#]?\s*([A-Z0-9\-]{2,})/i, description: "Starts a new file wherever the detected form number changes." },
      { id: "by-applicant", label: "Split by applicant", mode: "identifier-change", pattern: /applicant\s*(?:name)?\s*[:#]?\s*([A-Za-z][A-Za-z .,'-]{2,40})/i, description: "Starts a new file wherever the detected applicant name changes." },
    ],
  },
  {
    id: "scanned",
    label: "Scanned document batches",
    presets: [
      { id: "repeated-header", label: "Split by repeated first-page pattern", mode: "repeated-first-line", description: "Starts a new file wherever a page's first line matches the document's recurring first-page pattern." },
    ],
  },
  {
    id: "marketing",
    label: "Marketing and creative documents",
    presets: [
      { id: "by-campaign", label: "Split by campaign", mode: "repeated-first-line", description: "Starts a new file wherever a page's first line matches the document's recurring title line." },
    ],
  },
  {
    id: "books",
    label: "Books and general reading documents",
    presets: [
      { id: "by-chapter", label: "Split by chapter", mode: "heading-pattern", pattern: /^\s*chapter\s+\d+/im, description: "Starts a new file wherever a page begins with \"Chapter\" followed by a number." },
      { id: "every-n-pages", label: "Split every N pages", mode: "every-n-pages", n: 10, description: "Splits every 10 pages — content-blind, not based on detected structure." },
    ],
  },
];

export interface SmartSplitResult {
  groups: number[][]; // 1-indexed page numbers, contiguous ranges
  detected: boolean;
  message?: string;
}

/** Extracts the top ~300 characters of visible text for each page — enough
 *  for heading/identifier detection without paying for full-page OCR-grade
 *  extraction, and cheap enough to run once per loaded document rather than
 *  per keystroke. */
export async function extractPageTexts(pdfBytes: ArrayBuffer): Promise<string[]> {
  const pdfjsLib = await loadPdfjs();
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
  const pdf = await loadingTask.promise;
  try {
    const texts: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
      texts.push(text.slice(0, 2000));
    }
    return texts;
  } finally {
    // Releases this document's worker-side resources immediately rather
    // than leaving it to GC — Smart mode's own text-extraction pass is one
    // more `getDocument()` call on top of the page-thumbnail one every
    // loaded file already pays for, so it's worth not letting it linger.
    // Cleanup lives on the loading task, not the resolved PDFDocumentProxy.
    loadingTask.destroy();
  }
}

function firstLine(text: string): string {
  return text.trim().slice(0, 60).toLowerCase().replace(/\s+/g, " ");
}

function similarFirstLine(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  return longer.includes(shorter) && shorter.length >= 8;
}

function groupsFromBoundaries(totalPages: number, boundaries: Set<number>): number[][] {
  const starts = [...boundaries].filter((p) => p > 1 && p <= totalPages).sort((a, b) => a - b);
  const allStarts = [1, ...starts];
  const groups: number[][] = [];
  for (let i = 0; i < allStarts.length; i++) {
    const start = allStarts[i];
    const end = i + 1 < allStarts.length ? allStarts[i + 1] - 1 : totalPages;
    const group: number[] = [];
    for (let p = start; p <= end; p++) group.push(p);
    groups.push(group);
  }
  return groups;
}

/** Runs one preset's detection strategy against pre-extracted page texts.
 *  Returns `detected: false` (never a fabricated single-group "success")
 *  when the pattern never actually matched anywhere in the document — the
 *  UI shows this as "no split points found" rather than silently producing
 *  one arbitrary output. */
export function detectSmartBoundaries(pageTexts: string[], preset: SmartPreset): SmartSplitResult {
  const totalPages = pageTexts.length;
  if (totalPages === 0) return { groups: [], detected: false, message: "This document has no pages to analyze." };

  if (preset.mode === "every-n-pages") {
    const n = Math.max(1, preset.n ?? 10);
    const boundaries = new Set<number>();
    for (let p = 1 + n; p <= totalPages; p += n) boundaries.add(p);
    return { groups: groupsFromBoundaries(totalPages, boundaries), detected: true };
  }

  if (preset.mode === "repeated-first-line") {
    const lines = pageTexts.map(firstLine);
    const anchor = lines[0];
    const boundaries = new Set<number>();
    for (let i = 1; i < lines.length; i++) {
      if (similarFirstLine(lines[i], anchor)) boundaries.add(i + 1);
    }
    if (boundaries.size === 0) {
      return { groups: [], detected: false, message: "No repeating header/title pattern could be detected across pages. Try another preset or use Custom ranges." };
    }
    return { groups: groupsFromBoundaries(totalPages, boundaries), detected: true };
  }

  // identifier-change / heading-pattern both need a pattern.
  if (!preset.pattern) {
    return { groups: [], detected: false, message: "This preset isn't supported yet. Try another preset or use Custom ranges." };
  }

  if (preset.mode === "heading-pattern") {
    const boundaries = new Set<number>();
    let anyMatch = false;
    for (let i = 0; i < totalPages; i++) {
      const head = pageTexts[i].slice(0, 300);
      if (preset.pattern.test(head)) {
        anyMatch = true;
        if (i > 0) boundaries.add(i + 1);
      }
    }
    if (!anyMatch) {
      return { groups: [], detected: false, message: "No split points could be detected for this preset. Try another preset or use Custom ranges." };
    }
    return { groups: groupsFromBoundaries(totalPages, boundaries), detected: true };
  }

  // identifier-change
  const identifiers: (string | null)[] = pageTexts.map((text) => {
    const match = preset.pattern!.exec(text);
    if (!match) return null;
    return (match[1] ?? match[0]).trim().toLowerCase();
  });

  if (identifiers.every((id) => id === null)) {
    return { groups: [], detected: false, message: "No split points could be detected for this preset. Try another preset or use Custom ranges." };
  }

  const boundaries = new Set<number>();
  let running: string | null = null;
  for (let i = 0; i < totalPages; i++) {
    const id = identifiers[i];
    if (id !== null && id !== running) {
      if (i > 0 && running !== null) boundaries.add(i + 1);
      running = id;
    }
  }
  return { groups: groupsFromBoundaries(totalPages, boundaries), detected: true };
}

// ---------------------------------------------------------------------------
// Custom prompt — structured, deterministic instructions only. No natural-
// language interpretation is attempted or implied (see section 22 of the
// spec this engine was built against): an instruction that doesn't match
// one of the supported forms below returns an explicit error naming the
// forms that ARE supported, rather than guessing.
// ---------------------------------------------------------------------------

export interface CustomPromptParseResult {
  preset?: SmartPreset;
  error?: string;
}

const SUPPORTED_FORMS =
  'Supported forms: "every N pages", \'when a page contains "keyword"\', \'when heading "text" appears\', \'when identifier "regex" changes\'.';

export function parseCustomSmartPrompt(input: string): CustomPromptParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { error: `Enter an instruction. ${SUPPORTED_FORMS}` };
  }

  let match = trimmed.match(/^every\s+(\d+)\s+pages?$/i);
  if (match) {
    const n = Number(match[1]);
    if (n < 1) return { error: "N must be at least 1." };
    return { preset: { id: "custom-every-n", label: `Every ${n} pages`, mode: "every-n-pages", n, description: `Splits every ${n} pages.` } };
  }

  match = trimmed.match(/^when\s+(?:a\s+)?page\s+contains\s+"([^"]+)"$/i);
  if (match) {
    const keyword = match[1];
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return {
      preset: {
        id: "custom-keyword",
        label: `Contains "${keyword}"`,
        mode: "heading-pattern",
        pattern: new RegExp(escaped, "i"),
        description: `Starts a new file wherever a page contains "${keyword}".`,
      },
    };
  }

  match = trimmed.match(/^when\s+heading\s+"([^"]+)"\s+appears$/i);
  if (match) {
    const heading = match[1];
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return {
      preset: {
        id: "custom-heading",
        label: `Heading "${heading}"`,
        mode: "heading-pattern",
        pattern: new RegExp(escaped, "i"),
        description: `Starts a new file wherever a page's top text contains "${heading}".`,
      },
    };
  }

  match = trimmed.match(/^when\s+(?:the\s+)?identifier\s+"([^"]+)"\s+changes$/i);
  if (match) {
    const source = match[1];
    let regex: RegExp;
    try {
      regex = new RegExp(source, "i");
    } catch {
      return { error: `"${source}" isn't a valid pattern. ${SUPPORTED_FORMS}` };
    }
    return {
      preset: {
        id: "custom-identifier",
        label: `Identifier "${source}"`,
        mode: "identifier-change",
        pattern: regex,
        description: `Starts a new file wherever the detected value of "${source}" changes.`,
      },
    };
  }

  return { error: `That instruction isn't recognized. ${SUPPORTED_FORMS}` };
}
