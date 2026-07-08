"use client";

import { useEffect, useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Download, ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { loadPdfjs } from "@/lib/pdfjs";
import { useProcessingTask } from "@/lib/use-processing-task";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

type WatermarkType = "text" | "image";
type Position = "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

const POSITION_STYLE: Record<Position, React.CSSProperties> = {
  center: { top: "50%", left: "50%", transform: "translate(-50%, -50%)" },
  "top-left": { top: "15%", left: "15%", transform: "translate(-50%, -50%)" },
  "top-right": { top: "15%", left: "85%", transform: "translate(-50%, -50%)" },
  "bottom-left": { top: "85%", left: "15%", transform: "translate(-50%, -50%)" },
  "bottom-right": { top: "85%", left: "85%", transform: "translate(-50%, -50%)" },
};

interface WatermarkPdfClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function WatermarkPdfClient({ faqs, related }: WatermarkPdfClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [watermarkType, setWatermarkType] = useState<WatermarkType>("text");
  const [text, setText] = useState("CONFIDENTIAL");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(0.3);
  const [rotation, setRotation] = useState(-45);
  const [position, setPosition] = useState<Position>("center");
  const [scale, setScale] = useState(1);

  const [resultPdf, setResultPdf] = useState<Blob | null>(null);
  const { processing, progress, run } = useProcessingTask();

  const handleFilesSelected = async (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    const pdfFile = newFiles[0];
    setFile(pdfFile);
    setResultPdf(null);
    setLoadingPreview(true);

    try {
      const pdfjsLib = await loadPdfjs();
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.2 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas not available");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, viewport }).promise;
      setPreviewUrl(canvas.toDataURL("image/jpeg", 0.85));
    } catch (error) {
      console.error("Error loading PDF preview:", error);
      toast.error("Failed to load PDF", {
        description: "Please try again with a valid PDF file",
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      });
      setFile(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleWatermarkImageSelected = (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    setImageFile(newFiles[0]);
  };

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const applyWatermark = () => {
    if (!file) return;
    if (watermarkType === "text" && !text.trim()) return;
    if (watermarkType === "image" && !imageFile) return;

    run(
      async (setProgress) => {
        setResultPdf(null);
        const { PDFDocument, StandardFonts, rgb, degrees } = await import("pdf-lib");
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const pages = pdf.getPages();

        let font: import("pdf-lib").PDFFont | null = null;
        let embeddedImage: import("pdf-lib").PDFImage | null = null;

        if (watermarkType === "text") {
          font = await pdf.embedFont(StandardFonts.HelveticaBold);
        } else if (imageFile) {
          const imgBytes = await imageFile.arrayBuffer();
          embeddedImage =
            imageFile.type === "image/png"
              ? await pdf.embedPng(imgBytes)
              : await pdf.embedJpg(imgBytes);
        }

        const anchor = (width: number, height: number) => {
          switch (position) {
            case "top-left":
              return { x: width * 0.15, y: height * 0.85 };
            case "top-right":
              return { x: width * 0.85, y: height * 0.85 };
            case "bottom-left":
              return { x: width * 0.15, y: height * 0.15 };
            case "bottom-right":
              return { x: width * 0.85, y: height * 0.15 };
            default:
              return { x: width * 0.5, y: height * 0.5 };
          }
        };

        pages.forEach((page, index) => {
          const { width, height } = page.getSize();
          const { x, y } = anchor(width, height);

          if (watermarkType === "text" && font) {
            const fontSize = 36 * scale;
            const textWidth = font.widthOfTextAtSize(text, fontSize);
            page.drawText(text, {
              x: x - textWidth / 2,
              y: y - fontSize / 2,
              size: fontSize,
              font,
              color: rgb(0.5, 0.5, 0.5),
              opacity,
              rotate: degrees(rotation),
            });
          } else if (embeddedImage) {
            const imgWidth = embeddedImage.width * 0.3 * scale;
            const imgHeight = embeddedImage.height * 0.3 * scale;
            page.drawImage(embeddedImage, {
              x: x - imgWidth / 2,
              y: y - imgHeight / 2,
              width: imgWidth,
              height: imgHeight,
              opacity,
              rotate: degrees(rotation),
            });
          }

          setProgress(((index + 1) / pages.length) * 100);
        });

        const pdfBytes = await pdf.save();
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
        setResultPdf(blob);
      },
      {
        successMessage: "Watermark added successfully!",
        toolName: "watermark-pdf",
        errorTitle: "Failed to add watermark",
        onError: (error) => {
          console.error("Error adding watermark:", error);
          return "Please try again with a valid PDF file";
        },
      }
    );
  };

  const downloadResult = () => {
    if (!resultPdf) return;
    downloadBlob(resultPdf, "watermarked.pdf");
  };

  const overlayStyle: React.CSSProperties = {
    ...POSITION_STYLE[position],
    position: "absolute",
    opacity,
    transform: `${POSITION_STYLE[position].transform} rotate(${-rotation}deg) scale(${scale})`,
    pointerEvents: "none",
    whiteSpace: "nowrap",
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12">
      <div className="container mx-auto px-4 max-w-5xl">
        <Link href="/" className="flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <Card>
          <CardHeader>
            <CardTitle asChild className="text-2xl md:text-3xl">
              <h1>Watermark PDF</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!file && !resultPdf && (
              <FileUpload
                accept={{ "application/pdf": [".pdf"] }}
                multiple={false}
                onFilesSelected={handleFilesSelected}
              />
            )}

            {loadingPreview && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
                <p role="status">Loading preview…</p>
              </div>
            )}

            {file && !loadingPreview && previewUrl && !resultPdf && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium mb-2">Preview</p>
                  <div className="relative border rounded-lg overflow-hidden bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="First page preview" className="w-full block" />
                    {watermarkType === "text" && text && (
                      <span style={overlayStyle} className="text-2xl font-bold text-gray-500">
                        {text}
                      </span>
                    )}
                    {watermarkType === "image" && imagePreviewUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imagePreviewUrl} alt="" style={{ ...overlayStyle, width: "30%" }} />
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Watermark type</label>
                    <Select value={watermarkType} onValueChange={(v) => setWatermarkType(v as WatermarkType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="image">Image</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {watermarkType === "text" ? (
                    <div className="space-y-2">
                      <label htmlFor="watermark-text" className="text-sm font-medium">
                        Watermark text
                      </label>
                      <input
                        id="watermark-text"
                        type="text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md bg-background"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Watermark image</label>
                      <FileUpload
                        accept={{ "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"] }}
                        multiple={false}
                        onFilesSelected={handleWatermarkImageSelected}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label htmlFor="watermark-position" className="text-sm font-medium">
                      Position
                    </label>
                    <Select value={position} onValueChange={(v) => setPosition(v as Position)}>
                      <SelectTrigger id="watermark-position">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="top-left">Top Left</SelectItem>
                        <SelectItem value="top-right">Top Right</SelectItem>
                        <SelectItem value="bottom-left">Bottom Left</SelectItem>
                        <SelectItem value="bottom-right">Bottom Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="watermark-opacity" className="text-sm font-medium">
                      Opacity: {Math.round(opacity * 100)}%
                    </label>
                    <input
                      id="watermark-opacity"
                      type="range"
                      min={0.05}
                      max={1}
                      step={0.05}
                      value={opacity}
                      onChange={(e) => setOpacity(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="watermark-rotation" className="text-sm font-medium">
                      Rotation: {rotation}°
                    </label>
                    <input
                      id="watermark-rotation"
                      type="range"
                      min={-90}
                      max={90}
                      step={5}
                      value={rotation}
                      onChange={(e) => setRotation(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="watermark-scale" className="text-sm font-medium">
                      Scale: {scale.toFixed(1)}x
                    </label>
                    <input
                      id="watermark-scale"
                      type="range"
                      min={0.3}
                      max={3}
                      step={0.1}
                      value={scale}
                      onChange={(e) => setScale(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  {processing && (
                    <Progress value={progress} className="h-2" aria-label="Adding watermark" />
                  )}

                  <div className="flex gap-4 flex-wrap">
                    <Button
                      size="lg"
                      onClick={applyWatermark}
                      disabled={
                        processing ||
                        (watermarkType === "text" && !text.trim()) ||
                        (watermarkType === "image" && !imageFile)
                      }
                    >
                      Add Watermark
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setFile(null);
                        setPreviewUrl(null);
                        setResultPdf(null);
                      }}
                      disabled={processing}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {resultPdf && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">Watermark added successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download PDF
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setPreviewUrl(null);
                      setResultPdf(null);
                    }}
                  >
                    Watermark Another PDF
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl">Frequently Asked Questions</CardTitle>
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
    </main>
  );
}
