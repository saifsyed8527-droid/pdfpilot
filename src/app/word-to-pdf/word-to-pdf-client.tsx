"use client";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, FileType, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

type BlockType = "heading1" | "heading2" | "heading3" | "paragraph";

interface TextBlock {
  type: BlockType;
  text: string;
}

// pdf-lib's standard 14 fonts only support WinAnsi encoding, which can't
// represent common Word characters like bullets (U+25AA/U+2022), smart
// quotes, or em-dashes — drawing such text throws instead of degrading. Map
// the common cases to a visually equivalent ASCII form and fall back to "?"
// for anything else WinAnsi genuinely can't encode (verified against the
// same encoder pdf-lib uses internally, @pdf-lib/standard-fonts). Loaded
// dynamically, same as pdf-lib itself, to keep it out of the initial bundle.
const TYPOGRAPHIC_REPLACEMENTS: Record<string, string> = {
  "‘": "'", "’": "'", "“": '"', "”": '"',
  "–": "-", "—": "--", "…": "...",
  "•": "-", "▪": "-", "●": "-", "‣": "-",
  " ": " ",
};

async function loadWinAnsiEncoding() {
  const { Encodings } = await import("@pdf-lib/standard-fonts");
  return Encodings.WinAnsi;
}

function sanitizeForWinAnsi(text: string, winAnsi: Awaited<ReturnType<typeof loadWinAnsiEncoding>>): string {
  let result = "";
  for (const char of text) {
    const mapped = TYPOGRAPHIC_REPLACEMENTS[char];
    if (mapped !== undefined) {
      result += mapped;
      continue;
    }
    const codePoint = char.codePointAt(0) ?? 63;
    result += winAnsi.canEncodeUnicodeCodePoint(codePoint) ? char : "?";
  }
  return result;
}

/** Parses mammoth's HTML output into typed blocks — h1/h2/h3 become
 *  headings, p becomes a paragraph. Deliberately ignores everything else
 *  mammoth can produce (lists, tables, links, images) since this tool's
 *  honest scope is text + heading structure. Uses convertToHtml rather
 *  than the tempting convertToMarkdown: convertToMarkdown is undocumented
 *  and missing from mammoth's own published .d.ts, and was found to throw
 *  an internal xmldom parse error on real-world .docx files that contain
 *  footnotes/endnotes/comments parts, while convertToHtml — mammoth's
 *  primary, documented, fully-typed API — handles the same files fine. */
function parseHtmlBlocks(html: string): TextBlock[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks: TextBlock[] = [];
  for (const element of Array.from(doc.body.children)) {
    const text = element.textContent?.trim();
    if (!text) continue;
    const type: BlockType | null =
      element.tagName === "H1"
        ? "heading1"
        : element.tagName === "H2"
          ? "heading2"
          : element.tagName === "H3" || element.tagName === "H4" || element.tagName === "H5" || element.tagName === "H6"
            ? "heading3"
            : element.tagName === "P"
              ? "paragraph"
              : null;
    if (type) blocks.push({ type, text });
  }
  return blocks;
}

interface WordToPdfClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function WordToPdfClient({ faqs, related }: WordToPdfClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [resultPdf, setResultPdf] = useState<Blob | null>(null);
  const { processing, progress, run } = useProcessingTask();

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setResultPdf(null);
    }
  };

  const convertToPdf = () => {
    if (!file) return;

    run(
      async (setProgress) => {
        setResultPdf(null);

        const mammoth = await import("mammoth");
        const arrayBuffer = await file.arrayBuffer();
        let conversion;
        try {
          conversion = await mammoth.convertToHtml({ arrayBuffer });
        } catch {
          // mammoth's browser-bundled XML parser can fail on a narrow class
          // of otherwise-valid .docx files (observed with documents whose
          // comments/footnotes parts are empty-but-present, a pattern some
          // non-Word tools produce) even though the same file parses fine
          // in Node. There's no in-app fix for a third-party parser defect,
          // so surface it as a clear, actionable error rather than the raw
          // internal exception.
          throw new Error(
            "This document couldn't be read. It may use a feature (such as comments or footnotes) that this converter doesn't support — try removing them and saving again."
          );
        }
        const blocks = parseHtmlBlocks(conversion.value);

        if (blocks.length === 0) {
          throw new Error(
            "No text content could be extracted from this document. It may be empty, or contain only images."
          );
        }

        const [{ PDFDocument, StandardFonts, rgb }, winAnsi] = await Promise.all([
          import("pdf-lib"),
          loadWinAnsiEncoding(),
        ]);
        const pdf = await PDFDocument.create();
        const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

        const pageWidth = 612; // US Letter, in points
        const pageHeight = 792;
        const margin = 56;
        const maxLineWidth = pageWidth - margin * 2;

        let page = pdf.addPage([pageWidth, pageHeight]);
        let y = pageHeight - margin;

        const wrapText = (text: string, font: typeof regularFont, fontSize: number): string[] => {
          const words = text.split(/\s+/);
          const lines: string[] = [];
          let currentLine = "";
          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (font.widthOfTextAtSize(testLine, fontSize) > maxLineWidth && currentLine) {
              lines.push(currentLine);
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          }
          if (currentLine) lines.push(currentLine);
          return lines;
        };

        const ensureSpace = (needed: number) => {
          if (y - needed < margin) {
            page = pdf.addPage([pageWidth, pageHeight]);
            y = pageHeight - margin;
          }
        };

        blocks.forEach((block, index) => {
          const isHeading = block.type !== "paragraph";
          const font = isHeading ? boldFont : regularFont;
          const fontSize =
            block.type === "heading1" ? 20 : block.type === "heading2" ? 16 : block.type === "heading3" ? 14 : 11;
          const lineHeight = fontSize * 1.4;

          const lines = wrapText(sanitizeForWinAnsi(block.text, winAnsi), font, fontSize);

          if (isHeading) ensureSpace(lineHeight + 8);
          lines.forEach((line) => {
            ensureSpace(lineHeight);
            page.drawText(line, { x: margin, y: y - fontSize, size: fontSize, font, color: rgb(0.1, 0.1, 0.1) });
            y -= lineHeight;
          });
          y -= isHeading ? 10 : 8;

          setProgress(((index + 1) / blocks.length) * 100);
        });

        const pdfBytes = await pdf.save();
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
        setResultPdf(blob);
      },
      {
        successMessage: "Converted to PDF successfully!",
        toolName: "word-to-pdf",
        errorTitle: "Failed to convert to PDF",
        onError: (error) => {
          console.error("Error converting Word to PDF:", error);
          return error instanceof Error ? error.message : "Please try again with a valid .docx file";
        },
      }
    );
  };

  const downloadResult = () => {
    if (!resultPdf) return;
    downloadBlob(resultPdf, "converted.pdf");
  };

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <Link href="/" className="flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <Card>
          <CardHeader>
            <CardTitle asChild className="text-2xl md:text-3xl">
              <h1>Word to PDF</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!file && !resultPdf && (
              <FileUpload
                accept={{
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
                }}
                multiple={false}
                onFilesSelected={handleFilesSelected}
              />
            )}

            {file && !resultPdf && (
              <>
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <FileType className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  This converts your document&apos;s text and headings into a clean PDF — formatting like
                  bold text, images, and tables aren&apos;t preserved.
                </p>

                {processing && (
                  <Progress value={progress} className="h-2" aria-label="Converting to PDF" />
                )}

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={convertToPdf} disabled={processing}>
                    Convert to PDF
                  </Button>
                  <Button variant="outline" onClick={() => { setFile(null); setResultPdf(null); }} disabled={processing}>
                    Clear
                  </Button>
                </div>
              </>
            )}

            {resultPdf && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">Converted to PDF successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download PDF
                  </Button>
                  <Button variant="outline" onClick={() => { setFile(null); setResultPdf(null); }}>
                    Convert Another Document
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle asChild className="text-xl md:text-2xl"><h2>Frequently Asked Questions</h2></CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.question}>
                <h3 className="font-semibold mb-1">{faq.question}</h3>
                <p className="text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <ToolRelatedContent items={related} />
      </div>
    </div>
  );
}
