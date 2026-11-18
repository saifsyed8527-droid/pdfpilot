"use client";
import { useWorkspaceText, UiText } from "@/components/i18n/WorkspaceText";


import { FileToolLayout } from "@/components/tool/FileToolLayout";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, ImageIcon } from "lucide-react";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { convertImageFormat, preferredOutputFormat } from "@/lib/engines/image-engine";
import type { ResolvedEntity } from "@/lib/content/registry";

interface CompressImageClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function CompressImageClient({ faqs, related }: CompressImageClientProps) {
  const __copy = useWorkspaceText();
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState(0.8);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const { processing, progress, failed, run, cancel } = useProcessingTask();

  const isLosslessFormat = file?.type === "image/png";

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setResultBlob(null);
    }
  };

  const compress = () => {
    if (!file) return;

    run(
      async (setProgress, isCancelled) => {
        setResultBlob(null);
        // PNG is always lossless in canvas — re-encoding it can't shrink it via
        // a quality knob, so PNGs are converted to JPEG instead, the same
        // honest tradeoff every browser-based image compressor makes.
        const format = isLosslessFormat ? "image/jpeg" : preferredOutputFormat(file);
        const blob = await convertImageFormat(file, format, quality);
        if (isCancelled()) return;
        setProgress(100);
        setResultBlob(blob);
      },
      {
        successMessage: "Image compressed successfully!",
        toolName: "compress-image",
        errorTitle: "Failed to compress image",
        onError: (error) =>
          error instanceof Error ? error.message : "Please try again with a valid image file",
      }
    );
  };

  const downloadResult = () => {
    if (!resultBlob) return;
    const extension = isLosslessFormat ? "jpg" : file?.type === "image/webp" ? "webp" : "jpg";
    downloadBlob(resultBlob, `compressed-image.${extension}`);
  };

  const clear = () => {
    setFile(null);
    setQuality(0.8);
    setResultBlob(null);
  };

  const savings =
    resultBlob && file ? Math.round((1 - resultBlob.size / file.size) * 100) : null;

  return (
    <FileToolLayout toolSlug="compress-image" files={[file]}
      accept={{ "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"] }} multiple={false} onFilesSelected={handleFilesSelected}
      result={resultBlob} processing={processing}
      progress={progress}
      onDownload={downloadResult} onReset={clear} onCancel={cancel} faqs={faqs} related={related}>

            {file && !resultBlob && (
              <>
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <ImageIcon className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>

                {isLosslessFormat && (
                  <p className="text-sm text-muted-foreground">
                    {""}<UiText text={"PNG is a lossless format and can't be shrunk with a quality setting — this will convert your image to JPG to actually reduce file size."} />{" "}</p>
                )}

                <div className="space-y-2">
                  <label htmlFor="quality" className="text-sm font-medium">
                    {""}<UiText text={"Quality:"} />{" "}{Math.round(quality * 100)}%
                  </label>
                  <input
                    id="quality"
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    {""}<UiText text={"Lower quality means a smaller file but more visible compression artifacts."} />{" "}</p>
                </div>

                {processing && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground/80">
                      {progress >= 100 ? <UiText text={"Almost done…"} /> : <UiText text={"Processing…"} />}
                    </p>
                    <Progress value={progress} className="h-2" aria-label={__copy("Compressing image")} />
                  </div>
                )}

                <div className="flex gap-4 flex-wrap">
                  {processing ? (
                    <Button variant="outline" size="lg" onClick={cancel}>
                      {""}<UiText text={"Cancel"} />{" "}</Button>
                  ) : (
                    <>
                      <Button size="lg" onClick={compress}>
                        {failed ? <UiText text={"Try Again"} /> : <UiText text={"Compress Image"} />}
                      </Button>
                      <Button variant="outline" size="lg" onClick={clear}>
                        {""}<UiText text={"Clear"} />{" "}</Button>
                    </>
                  )}
                </div>
              </>
            )}

            {resultBlob && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">{""}<UiText text={"Your file is ready"} />{""}</h3>
                {savings !== null && (
                  <p className="text-muted-foreground">
                    {savings > 0 ? <UiText text={"{0}% smaller ({1} MB)"} values={[savings, (resultBlob.size / 1024 / 1024).toFixed(2)]} /> : <UiText text={"New size: {0} MB"} values={[(resultBlob.size / 1024 / 1024).toFixed(2)]} />}
                  </p>
                )}
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    {""}<UiText text={"Download Image"} />{" "}</Button>
                  <Button variant="outline" size="lg" onClick={clear}>
                    {""}<UiText text={"Process another file"} />{" "}</Button>
                </div>
              </div>
            )}

    </FileToolLayout>
  );
}
