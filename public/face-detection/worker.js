/* PDFPilot: all detection stays in this same-origin, cancellable worker. */
self.exports = {};
importScripts('/face-detection/mediapipe-0.10.21/vision_bundle.js');
self.onmessage = async function (event) {
  let detector;
  try {
    const { files, confidence } = event.data;
    if (!Array.isArray(files) || !files.length || files.length > 20 || ![.3, .5, .75].includes(confidence)) throw new Error('Choose valid images and detection sensitivity.');
    const runtime = '/face-detection/mediapipe-0.10.21';
    const vision = await self.exports.FilesetResolver.forVisionTasks(runtime + '/wasm');
    detector = await self.exports.FaceDetector.createFromOptions(vision, { baseOptions: { modelAssetPath: runtime + '/blaze-face-short-range.tflite', delegate: 'CPU' }, runningMode: 'IMAGE', minDetectionConfidence: confidence, minSuppressionThreshold: .3 });
    const results = [];
    for (let index = 0; index < files.length; index++) {
      const bitmap = await createImageBitmap(files[index]);
      let surface;
      try {
        if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 20_000_000) throw new Error('Use images below 20 megapixels.');
        const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
        surface = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
        const ctx = surface.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, surface.width, surface.height); ctx.drawImage(bitmap, 0, 0, surface.width, surface.height);
        const faces = [];
        const scans = [{ x: 0, y: 0, width: surface.width, height: surface.height }];
        if (confidence === .3) for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) scans.push({ x: Math.round(col * surface.width / 4), y: Math.round(row * surface.height / 4), width: Math.floor(surface.width / 2), height: Math.floor(surface.height / 2) });
        for (const [scanIndex, scan] of scans.entries()) {
          if (scan.width < 1 || scan.height < 1) continue;
          const tile = new OffscreenCanvas(scan.width, scan.height); tile.getContext('2d').drawImage(surface, scan.x, scan.y, scan.width, scan.height, 0, 0, scan.width, scan.height);
          try {
            for (const d of detector.detect(tile).detections) {
              const b = d.boundingBox, score = d.categories[0]?.score ?? 0;
              if (!b || b.width <= 0 || b.height <= 0 || (scanIndex > 0 && score < .6)) continue;
              const face = { x: (b.originX + scan.x) / surface.width, y: (b.originY + scan.y) / surface.height, width: b.width / surface.width, height: b.height / surface.height, score };
              const duplicate = faces.findIndex(f => { const intersection = Math.max(0, Math.min(f.x + f.width, face.x + face.width) - Math.max(f.x, face.x)) * Math.max(0, Math.min(f.y + f.height, face.y + face.height) - Math.max(f.y, face.y)); return intersection / (f.width * f.height + face.width * face.height - intersection) > .35 || intersection / Math.min(f.width * f.height, face.width * face.height) > .65; });
              if (duplicate >= 0) { if (score > faces[duplicate].score) faces[duplicate] = face; } else if (faces.length < 100) faces.push(face);
            }
          } finally { tile.width = tile.height = 0; }
        }
        results.push(faces); self.postMessage({ type: 'progress', completed: index + 1, total: files.length });
      } finally { bitmap.close(); if (surface) surface.width = surface.height = 0; }
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    self.postMessage({ type: 'done', results });
  } catch (e) { self.postMessage({ type: 'error', message: e instanceof Error && /Choose valid|Use images below/.test(e.message) ? e.message : 'Automatic detection could not finish. Try a smaller image or add areas manually.' }); }
  finally { if (detector) detector.close(); }
};
