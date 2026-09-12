export type PdfaConformance =
  | "PDF/A-1b"
  | "PDF/A-1a"
  | "PDF/A-2b"
  | "PDF/A-2u"
  | "PDF/A-2a"
  | "PDF/A-3b"
  | "PDF/A-3u"
  | "PDF/A-3a";
export type PdfaConversionMode = "preserve" | "flatten";

export interface PdfaConversionOptions {
  conformance: PdfaConformance;
  allowDowngrade: boolean;
  mode: PdfaConversionMode;
}

export interface PdfaConversionResult {
  blob: Blob;
  filename: string;
  pageCount: number;
  conformance: PdfaConformance;
  mode: PdfaConversionMode;
  flattened: boolean;
}

function safeBaseName(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "converted";
}

function xmpEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function conformanceParts(conformance: PdfaConformance) {
  const [, partAndLevel] = conformance.split("-");
  const [part, level] = partAndLevel.replace("PDF/A-", "").split("");
  return { part, level };
}

function createPdfaXmp(fileName: string, options: PdfaConversionOptions) {
  const { part, level } = conformanceParts(options.conformance);
  const now = new Date().toISOString();
  const title = xmpEscape(`${safeBaseName(fileName)} archive copy`);

  return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="PDFPilot">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <pdfaid:part>${part}</pdfaid:part>
      <pdfaid:conformance>${level.toUpperCase()}</pdfaid:conformance>
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${title}</rdf:li></rdf:Alt></dc:title>
      <dc:format>application/pdf</dc:format>
      <xmp:CreatorTool>PDFPilot PDF to PDF/A</xmp:CreatorTool>
      <xmp:CreateDate>${now}</xmp:CreateDate>
      <xmp:ModifyDate>${now}</xmp:ModifyDate>
      <pdf:Producer>PDFPilot browser-local PDF/A archive converter</pdf:Producer>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

async function attachXmpMetadata(pdfDoc: import("pdf-lib").PDFDocument, xmp: string) {
  const { PDFName } = await import("pdf-lib");
  const metadataStream = pdfDoc.context.stream(xmp, {
    Type: "Metadata",
    Subtype: "XML",
  });
  const metadataRef = pdfDoc.context.register(metadataStream);
  pdfDoc.catalog.set(PDFName.of("Metadata"), metadataRef);
}

async function normalizePdf(file: File, options: PdfaConversionOptions, onProgress?: (done: number, total: number) => void) {
  const { PDFDocument } = await import("pdf-lib");
  const sourceBytes = await file.arrayBuffer();
  const source = await PDFDocument.load(sourceBytes);
  const out = await PDFDocument.create();
  const pageCount = source.getPageCount();
  const copiedPages = await out.copyPages(source, Array.from({ length: pageCount }, (_, i) => i));

  copiedPages.forEach((page, index) => {
    out.addPage(page);
    onProgress?.(index + 1, pageCount);
  });

  const now = new Date();
  out.setTitle(`${safeBaseName(file.name)} archive copy`);
  out.setAuthor("PDFPilot");
  out.setSubject(`${options.conformance} archive conversion`);
  out.setKeywords(["PDF/A", options.conformance, "archive", "PDFPilot", options.allowDowngrade ? "fallback allowed" : "strict preference"]);
  out.setCreator("PDFPilot");
  out.setProducer("PDFPilot browser-local PDF/A archive converter");
  out.setCreationDate(now);
  out.setModificationDate(now);
  await attachXmpMetadata(out, createPdfaXmp(file.name, options));

  return { bytes: await out.save({ addDefaultPage: false, useObjectStreams: false }), pageCount };
}

async function flattenPdfAppearance(file: File, options: PdfaConversionOptions, onProgress?: (done: number, total: number) => void) {
  const [pdfjsLib, { PDFDocument }] = await Promise.all([import("@/lib/pdfjs").then((m) => m.loadPdfjs()), import("pdf-lib")]);
  const sourceBytes = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: sourceBytes.slice(0) });
  const source = await loadingTask.promise;

  try {
    const out = await PDFDocument.create();
    const pageCount = source.numPages;

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      const page = await source.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("This browser does not support PDF page rendering.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, viewport }).promise;

      const jpegBlob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Failed to render this PDF page."))), "image/jpeg", 0.92)
      );
      const jpeg = await out.embedJpg(await jpegBlob.arrayBuffer());
      const outPage = out.addPage([viewport.width, viewport.height]);
      outPage.drawImage(jpeg, { x: 0, y: 0, width: viewport.width, height: viewport.height });
      onProgress?.(pageNumber, pageCount);
    }

    const now = new Date();
    out.setTitle(`${safeBaseName(file.name)} archive copy`);
    out.setAuthor("PDFPilot");
    out.setSubject(`${options.conformance} flattened archive conversion`);
    out.setKeywords([
      "PDF/A",
      options.conformance,
      "flattened",
      "archive",
      "PDFPilot",
      options.allowDowngrade ? "fallback allowed" : "strict preference",
    ]);
    out.setCreator("PDFPilot");
    out.setProducer("PDFPilot browser-local PDF/A archive converter");
    out.setCreationDate(now);
    out.setModificationDate(now);
    await attachXmpMetadata(out, createPdfaXmp(file.name, options));

    return { bytes: await out.save({ addDefaultPage: false, useObjectStreams: false }), pageCount };
  } finally {
    loadingTask.destroy();
  }
}

export async function convertPdfToPdfa(
  file: File,
  options: PdfaConversionOptions,
  onProgress?: (done: number, total: number) => void
): Promise<PdfaConversionResult> {
  const output =
    options.mode === "flatten"
      ? await flattenPdfAppearance(file, options, onProgress)
      : await normalizePdf(file, options, onProgress);

  const blob = new Blob([output.bytes as unknown as BlobPart], { type: "application/pdf" });
  return {
    blob,
    filename: `${safeBaseName(file.name)}_${options.conformance.toLowerCase().replace("/", "")}.pdf`,
    pageCount: output.pageCount,
    conformance: options.conformance,
    mode: options.mode,
    flattened: options.mode === "flatten",
  };
}
