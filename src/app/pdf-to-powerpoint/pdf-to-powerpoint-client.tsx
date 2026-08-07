"use client";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { getPdfBasicInfo } from "@/lib/engines/pdf-engine";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";
import type { PDFPageProxy } from "pdfjs-dist";

/** Structural subset of pdfjs's real TextItem shape (verified against
 *  node_modules/pdfjs-dist/types/src/display/api.d.ts) - defined locally
 *  since pdfjs-dist doesn't re-export TextItem from its public entry
 *  point, only from an internal display/api module path. */
interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  hasEOL: boolean;
}

interface PdfToPowerpointClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

interface TextLine {
  text: string;
  /** Baseline start, PDF points, Y-up (raw pdfjs text-content space). */
  xPt: number;
  yPt: number;
  fontSizePt: number;
  widthPt: number;
}

/** Groups pdfjs's per-run text items into per-line runs using pdfjs's own
 *  `hasEOL` flag (a real line-break signal from the content stream) rather
 *  than guessing line boundaries from Y-coordinate deltas. One line becomes
 *  one invisible PowerPoint text box - matching how a real line of text
 *  reads and selects, instead of one text box per word. */
function groupTextIntoLines(items: PdfTextItem[]): TextLine[] {
  const lines: TextLine[] = [];
  let buffer = "";
  let startX = 0;
  let startY = 0;
  let fontSize = 12;
  let endX = 0;
  let open = false;

  const flush = () => {
    if (open && buffer.trim()) {
      lines.push({ text: buffer, xPt: startX, yPt: startY, fontSizePt: fontSize, widthPt: Math.max(endX - startX, fontSize) });
    }
    buffer = "";
    open = false;
  };

  for (const item of items) {
    if (item.str) {
      if (!open) {
        startX = item.transform[4];
        startY = item.transform[5];
        // transform[0] is the font size for unrotated, unskewed text (the
        // overwhelming common case); transform[3] covers the rare vertical-
        // text fallback. Verified against pdfjs's real TextItem shape
        // (node_modules/pdfjs-dist/types/src/display/api.d.ts) - the same
        // matrix convention pdfjs's own text layer uses for its invisible,
        // selectable overlay in the browser PDF viewer, which this mirrors
        // for PowerPoint.
        fontSize = Math.abs(item.transform[0]) || Math.abs(item.transform[3]) || 12;
        open = true;
      }
      buffer += item.str;
      endX = item.transform[4] + item.width;
    }
    if (item.hasEOL) flush();
  }
  flush();

  return lines;
}

/** Renders a page (already guaranteed rotation-free at the pdfjs level -
 *  see `stripPageRotations` below) and, if the page's ORIGINAL /Rotate
 *  value was non-zero, draws that canvas onto a second, correctly-sized
 *  canvas rotated to match with the 2D context - producing a correctly
 *  upright slide image without pdfjs ever seeing a rotated page. */
async function renderPageUpright(
  page: PDFPageProxy,
  scale: number,
  rotationDeg: number
): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const rawCanvas = document.createElement("canvas");
  rawCanvas.width = viewport.width;
  rawCanvas.height = viewport.height;
  await page.render({ canvas: rawCanvas, viewport }).promise;

  if (rotationDeg === 0) return rawCanvas;

  const swapped = rotationDeg === 90 || rotationDeg === 270;
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = swapped ? rawCanvas.height : rawCanvas.width;
  finalCanvas.height = swapped ? rawCanvas.width : rawCanvas.height;
  const ctx = finalCanvas.getContext("2d");
  if (!ctx) return rawCanvas;

  ctx.translate(finalCanvas.width / 2, finalCanvas.height / 2);
  // Canvas rotate() is clockwise-positive, matching the PDF spec's own
  // definition of /Rotate ("degrees by which the page shall be rotated
  // clockwise when displayed") - no sign adjustment needed.
  ctx.rotate((rotationDeg * Math.PI) / 180);
  ctx.drawImage(rawCanvas, -rawCanvas.width / 2, -rawCanvas.height / 2);
  return finalCanvas;
}

/** Returns a copy of the PDF's bytes with every page's /Rotate reset to 0,
 *  plus the ORIGINAL rotation each page had before the reset.
 *
 *  Verified directly (temporary debug logging, since reverted): forcing
 *  pdfjs's viewport rotation to 0 does NOT avoid the render hang this
 *  session already found on rotated pages elsewhere (Edit PDF) - the hang
 *  is tied to the page's own /Rotate value, not the viewport parameter
 *  pdfjs is asked to render with. Stripping the rotation at the PDF-lib
 *  level, before pdfjs ever opens the file, means pdfjs never sees a
 *  rotated page at all, sidestepping the hang entirely - the actual
 *  rotation is then reapplied to the finished canvas with a plain 2D
 *  context rotation in `renderPageUpright`. */
async function stripPageRotations(file: File): Promise<{ bytes: Uint8Array; rotations: number[] }> {
  const { PDFDocument, degrees } = await import("pdf-lib");
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const pages = pdf.getPages();
  const rotations = pages.map((p) => p.getRotation().angle);
  pages.forEach((p) => p.setRotation(degrees(0)));
  const bytes = await pdf.save();
  return { bytes, rotations };
}

export function PdfToPowerpointClient({ faqs, related }: PdfToPowerpointClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [resultPptx, setResultPptx] = useState<Blob | null>(null);
  const { processing, progress, run, cancel } = useProcessingTask();

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setResultPptx(null);
    }
  };

  const convertToPowerpoint = () => {
    if (!file) return;

    run(
      async (setProgress, isCancelled) => {
        setResultPptx(null);

        // Real page-1 dimensions (in PDF points) set the presentation's
        // slide size, so every slide's image fills the frame exactly
        // instead of floating inside a generic 4:3/16:9 layout with
        // mismatched margins on every side.
        const { firstPageSize } = await getPdfBasicInfo(file);
        const layoutWidthIn = firstPageSize.width / 72;
        const layoutHeightIn = firstPageSize.height / 72;

        const PptxGenJS = (await import("pptxgenjs")).default;
        const pptx = new PptxGenJS();
        pptx.defineLayout({ name: "PDF_PAGE", width: layoutWidthIn, height: layoutHeightIn });
        pptx.layout = "PDF_PAGE";

        const { loadPdfjs } = await import("@/lib/pdfjs");
        const pdfjsLib = await loadPdfjs();
        const { bytes: unrotatedBytes, rotations } = await stripPageRotations(file);
        const pdfDoc = await pdfjsLib.getDocument({ data: unrotatedBytes }).promise;
        const totalPages = pdfDoc.numPages;

        for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
          if (isCancelled()) return;
          const page = await pdfDoc.getPage(pageNumber);
          const rotationDeg = rotations[pageNumber - 1] ?? 0;

          // Each page is rendered as a real image and placed full-bleed on
          // its own slide - this is what actually makes the output look
          // like "PDF to PowerPoint" rather than "PDF text to PowerPoint":
          // the deck looks like the source document (layout, images,
          // colors, fonts, tables, diagrams exactly as they appear), which
          // plain text extraction can never do. Scale 2 matches PDF to
          // JPG's existing quality-output default (roughly 144 DPI from a
          // 72-DPI page).
          const canvas = await renderPageUpright(page, 2, rotationDeg);
          const slide = pptx.addSlide();
          slide.addImage({
            data: canvas.toDataURL("image/jpeg", 0.85),
            x: 0,
            y: 0,
            w: layoutWidthIn,
            h: layoutHeightIn,
          });

          // A real, invisible, selectable text layer on top of the image -
          // the same technique pdfjs's own in-browser viewer uses for its
          // text layer, applied here to PowerPoint's text-run model
          // instead. This is what makes the output genuinely useful and
          // not just a picture of a document: the words are selectable,
          // searchable, and copyable, while the image underneath still
          // carries the exact visual layout, fonts, colors, tables, and
          // diagrams a rebuilt/reconstructed text layout could never
          // guarantee. Skipped for rotated pages - the text content API
          // reports raw, un-rotated page coordinates, and correctly
          // remapping those onto a rotated visual needs its own rotation
          // transform; rather than guess at that under time pressure, a
          // rotated page still gets its (correctly upright) image slide,
          // just without the overlay.
          if (rotationDeg === 0) {
            const textContent = await page.getTextContent();
            const items = textContent.items
              .filter((item) => "str" in item)
              .map((item) => item as unknown as PdfTextItem);
            const lines = groupTextIntoLines(items);
            for (const line of lines) {
              const xIn = line.xPt / 72;
              const yIn = (firstPageSize.height - line.yPt - line.fontSizePt) / 72;
              const wIn = Math.max(line.widthPt / 72, 0.1);
              const hIn = Math.max((line.fontSizePt * 1.3) / 72, 0.05);
              slide.addText(line.text, {
                x: xIn,
                y: yIn,
                w: wIn,
                h: hIn,
                fontSize: Math.min(400, Math.max(1, line.fontSizePt)),
                color: "000000",
                transparency: 100,
                margin: 0,
                valign: "top",
              });
            }
          }

          setProgress((pageNumber / totalPages) * 90);
        }

        if (isCancelled()) return;

        const blob = (await pptx.write({ outputType: "blob" })) as Blob;
        setProgress(100);
        setResultPptx(blob);
      },
      {
        successMessage: "Converted to PowerPoint successfully!",
        toolName: "pdf-to-powerpoint",
        errorTitle: "Failed to convert to PowerPoint",
        onError: (error) => {
          console.error("Error converting PDF to PowerPoint:", error);
          // Matches Merge PDF's established pattern: never surface pdf-lib's
          // raw error.message (e.g. "Cannot read properties of undefined
          // (reading 'Pages')" for malformed PDFs) - it's an internal
          // implementation detail, not something a user can act on.
          const message = error instanceof Error ? error.message : "";
          return message.includes("is encrypted")
            ? "This PDF is password-protected. Please remove the password and try again."
            : "Please try again with a valid PDF file";
        },
      }
    );
  };

  const downloadResult = () => {
    if (!resultPptx) return;
    downloadBlob(resultPptx, "converted.pptx");
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
              <h1>PDF to PowerPoint</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!file && !resultPptx && (
              <FileUpload
                accept={{ "application/pdf": [".pdf"] }}
                multiple={false}
                onFilesSelected={handleFilesSelected}
              />
            )}

            {file && !resultPptx && (
              <>
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  Each page becomes one slide showing an exact image of that page — the layout,
                  images, tables, and design all carry over exactly. The real text is also placed
                  on top (invisibly), so it stays selectable, searchable, and copyable, even though
                  it isn&apos;t a fully independent, re-editable text box the way a typed slide would be.
                </p>

                {processing && (
                  <Progress value={progress} className="h-2" aria-label="Converting to PowerPoint" />
                )}

                <div className="flex gap-4 flex-wrap">
                  {processing ? (
                    <Button variant="outline" size="lg" onClick={cancel}>
                      Cancel
                    </Button>
                  ) : (
                    <>
                      <Button size="lg" onClick={convertToPowerpoint}>
                        Convert to PowerPoint
                      </Button>
                      <Button variant="outline" onClick={() => { setFile(null); setResultPptx(null); }}>
                        Clear
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}

            {resultPptx && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">Converted to PowerPoint successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download PowerPoint
                  </Button>
                  <Button variant="outline" onClick={() => { setFile(null); setResultPptx(null); }}>
                    Convert Another PDF
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
