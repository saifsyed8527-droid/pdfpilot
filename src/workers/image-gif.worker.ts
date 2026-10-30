import { gifEncoder, gifFramePlacement, validateGifOptions, type GifOptions } from "../lib/engines/image-gif-core";

self.onmessage = async (event: MessageEvent<{ files: File[]; options: GifOptions }>) => {
  try {
    const { files, options } = event.data;
    validateGifOptions(options, files.length);
    if (files.reduce((sum, file) => sum + file.size, 0) > 200 * 1024 * 1024) throw new Error("Choose images with a combined size below 200MB.");
    const encoder = gifEncoder(options);
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      if (file.size > 100 * 1024 * 1024) throw new Error("Each image must be smaller than 100MB.");
      const bitmap = await createImageBitmap(file), canvas = new OffscreenCanvas(options.width, options.height);
      try {
        if (bitmap.width * bitmap.height > 40_000_000) throw new Error("Use images below 40 megapixels.");
        const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("This browser cannot prepare GIF frames.");
        ctx.fillStyle = options.background; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
        const area = gifFramePlacement(bitmap.width, bitmap.height, options);
        ctx.drawImage(bitmap, area.x, area.y, area.width, area.height);
        encoder.add(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
      } finally { bitmap.close(); canvas.width = canvas.height = 0; }
      self.postMessage({ progress: (index + 1) / files.length * 95 });
    }
    const bytes = new Uint8Array(encoder.finish());
    self.postMessage({ bytes: bytes.buffer }, { transfer: [bytes.buffer] });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : "Could not create GIF. Choose valid images and try again." }); }
};
