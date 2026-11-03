import {
  createImagePdf,
  type ImagePdfInput,
  type ImagePdfOptions,
} from "../lib/engines/jpg-to-pdf-engine";
self.onmessage = async ({
  data,
}: MessageEvent<{ inputs: ImagePdfInput[]; options: ImagePdfOptions }>) => {
  try {
    self.postMessage({
      result: await createImagePdf(
        data.inputs,
        data.options,
        (progress) => self.postMessage({ progress }),
        () => false,
      ),
    });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error
          ? error.message
          : "The images could not be converted.",
    });
  }
};
