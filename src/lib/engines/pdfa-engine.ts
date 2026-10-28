import type { PDFDocument } from "pdf-lib";

export type PdfaConformance = "PDF/A-1b" | "PDF/A-2b" | "PDF/A-3b";
export interface PdfaConversionOptions {
  conformance: PdfaConformance;
  dpi?: 150 | 300;
  rotation?: number;
  isCancelled?: () => boolean;
}
export interface PdfaConversionResult {
  blob: Blob;
  filename: string;
  pageCount: number;
  conformance: PdfaConformance;
  flattened: true;
}

const PROFILES = new Set<PdfaConformance>(["PDF/A-1b", "PDF/A-2b", "PDF/A-3b"]);
const MAX_PIXELS = 32_000_000;
const MAX_OUTPUT_BYTES = 128 * 1024 * 1024;
function safeBaseName(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "converted";
}
function xmpEscape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function checkCancelled(options: PdfaConversionOptions) {
  if (options.isCancelled?.()) throw new Error("Conversion cancelled.");
}

/** Only generated image pages enter this document. Source fonts, scripts,
 * annotations, attachments, encryption and transparency are never copied. */
async function setArchiveMetadata(pdf: PDFDocument, name: string, profile: PdfaConformance) {
  const { PDFName, PDFHexString, PDFString, PDFHeader } = await import("pdf-lib");
  const response = await fetch("/color-profiles/srgb-v2.icc");
  if (!response.ok) throw new Error("The archive color profile could not load. Please retry.");
  const icc = new Uint8Array(await response.arrayBuffer());
  if (icc.length < 128 || new TextDecoder().decode(icc.slice(36, 40)) !== "acsp") throw new Error("The archive color profile is invalid.");
  const iccRef = pdf.context.register(pdf.context.flateStream(icc, { N: 3 }));
  const intent = pdf.context.register(pdf.context.obj({
    Type: "OutputIntent", S: "GTS_PDFA1", OutputConditionIdentifier: PDFString.of("sRGB IEC61966-2.1"),
    Info: PDFString.of("sRGB IEC61966-2.1"), RegistryName: PDFString.of("http://www.color.org"), DestOutputProfile: iccRef,
  }));
  pdf.catalog.set(PDFName.of("OutputIntents"), pdf.context.obj([intent]));
  const part = profile.slice(6, 7);
  pdf.context.header = PDFHeader.forVersion(1, part === "1" ? 4 : 7);
  const now = new Date(Math.floor(Date.now() / 1000) * 1000);
  const title = `${safeBaseName(name)} archive copy`, creator = "PDFPilot", producer = "PDFPilot PDF/A visual archive converter";
  pdf.setTitle(title); pdf.setCreator(creator); pdf.setProducer(producer);
  pdf.setCreationDate(now); pdf.setModificationDate(now);
  // Avoid Info/XMP mismatches: only these synchronized fields are emitted.
  const xmp = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
<pdfaid:part>${part}</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance>
<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmpEscape(title)}</rdf:li></rdf:Alt></dc:title>
<dc:format>application/pdf</dc:format><xmp:CreatorTool>${creator}</xmp:CreatorTool>
<xmp:CreateDate>${now.toISOString()}</xmp:CreateDate><xmp:ModifyDate>${now.toISOString()}</xmp:ModifyDate>
<pdf:Producer>${producer}</pdf:Producer>
</rdf:Description></rdf:RDF></x:xmpmeta>
<?xpacket end="w"?>`;
  pdf.catalog.set(PDFName.of("Metadata"), pdf.context.register(pdf.context.stream(new TextEncoder().encode(xmp), { Type: "Metadata", Subtype: "XML" })));
  const id = PDFHexString.of(crypto.randomUUID().replace(/-/g, ""));
  pdf.context.trailerInfo.ID = pdf.context.obj([id, id]);
}

export async function convertPdfToPdfa(file: File, options: PdfaConversionOptions, onProgress?: (done: number, total: number) => void): Promise<PdfaConversionResult> {
  if (!PROFILES.has(options.conformance)) throw new Error("Choose PDF/A-1b, PDF/A-2b or PDF/A-3b. Tagged and Unicode archive conversion is not supported.");
  const dpi = options.dpi ?? 150, rotation = options.rotation ?? 0;
  if (![150, 300].includes(dpi) || !Number.isInteger(rotation / 90)) throw new Error("Choose a supported resolution and a 90-degree rotation.");
  checkCancelled(options);
  const [pdfjs, { PDFDocument, pushGraphicsState, concatTransformationMatrix, drawObject, popGraphicsState }] = await Promise.all([
    import("../pdfjs").then(module => module.loadPdfjs()), import("pdf-lib"),
  ]);
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  // Do not leave PDF.js waiting forever for a password prompt that has no UI.
  task.onPassword = () => { void task.destroy(); };
  try {
    let source;
    try { source = await task.promise; } catch (error) {
      if (error instanceof Error && /password|destroyed/i.test(error.message)) throw new Error("This PDF is password-protected. Unlock it before converting to PDF/A.");
      throw error;
    }
    if (!source.numPages) throw new Error("This PDF has no pages to convert.");
    const out = await PDFDocument.create();
    await setArchiveMetadata(out, file.name, options.conformance);
    let compressedBytes = 0;
    for (let n = 1; n <= source.numPages; n++) {
      checkCancelled(options);
      const page = await source.getPage(n);
      const orientation = (page.rotate + rotation) % 360;
      const physical = page.getViewport({ scale: 1, rotation: orientation });
      const viewport = page.getViewport({ scale: dpi / 72, rotation: orientation });
      const width = Math.ceil(viewport.width), height = Math.ceil(viewport.height);
      if (width * height > MAX_PIXELS) throw new Error(`Page ${n} is too large at ${dpi} DPI. Choose 150 DPI or crop this page first.`);
      if (physical.width > 14400 || physical.height > 14400) throw new Error(`Page ${n} exceeds the archive page-size limit. Crop it before converting.`);
      const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
      try {
        const context = canvas.getContext("2d", { colorSpace: "srgb" });
        if (!context) throw new Error("This browser does not support PDF page rendering.");
        await page.render({ canvas, viewport, background: "rgb(255,255,255)" }).promise;
        checkCancelled(options);
        const pixels = context.getImageData(0, 0, width, height).data;
        const rgb = new Uint8Array(width * height * 3);
        for (let input = 0, output = 0; input < pixels.length; input += 4) {
          const alpha = pixels[input + 3] / 255;
          for (let c = 0; c < 3; c++) rgb[output++] = Math.round(pixels[input + c] * alpha + 255 * (1 - alpha));
        }
        const stream = out.context.flateStream(rgb, { Type: "XObject", Subtype: "Image", Width: width, Height: height, BitsPerComponent: 8, ColorSpace: "DeviceRGB", Interpolate: false });
        compressedBytes += stream.getContentsSize();
        if (compressedBytes > MAX_OUTPUT_BYTES) throw new Error("This archive exceeds the browser's 128 MB output limit. Choose 150 DPI or split the PDF first.");
        const outputPage = out.addPage([physical.width, physical.height]);
        const imageName = outputPage.node.newXObject("ArchivePage", out.context.register(stream));
        outputPage.pushOperators(pushGraphicsState(), concatTransformationMatrix(physical.width, 0, 0, physical.height, 0, 0), drawObject(imageName), popGraphicsState());
      } finally { canvas.width = 1; canvas.height = 1; page.cleanup(); }
      onProgress?.(n, source.numPages);
    }
    checkCancelled(options);
    const bytes = await out.save({ addDefaultPage: false, useObjectStreams: false });
    checkCancelled(options);
    return { blob: new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }), filename: `${safeBaseName(file.name)}_${options.conformance.toLowerCase().replace("/", "")}.pdf`, pageCount: source.numPages, conformance: options.conformance, flattened: true };
  } finally { await task.destroy(); }
}
