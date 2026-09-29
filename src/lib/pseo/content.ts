import { createHash } from "node:crypto";
import { CAPABILITY_BY_ID } from "./capabilities";
import type { Classification } from "./classify";
import { pageSchema, type Keyword, type PseoPage } from "./schema";

export const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const platforms: Record<string, { label: string; pick: string; save: string; limit: string }> = {
  mac: { label: "Mac", pick: "Use the file picker to choose documents from Finder. Download cloud-only files before selecting them.", save: "After downloading, open the file from your browser's Downloads list or the Downloads folder in Finder.", limit: "Keep the browser tab open while processing. Available memory limits large document jobs." },
  windows: { label: "Windows", pick: "Choose files from File Explorer. Make OneDrive placeholders available on this device before selecting them.", save: "Use your browser's download notification or the Downloads folder in File Explorer to locate the result.", limit: "Browser download prompts and managed-device policies can affect where the output is saved." },
  iphone: { label: "iPhone", pick: "Use the system file picker to browse the Files app. Save an attachment to Files first if it is only visible in another app.", save: "Open the downloaded result in Files. Use the share sheet if you need to move it into another app.", limit: "Leave the browser in the foreground during processing. Large PDFs can exceed the memory available to a mobile browser." },
  ipad: { label: "iPad", pick: "Choose the document using Browse in the Files picker. Make cloud documents available locally first.", save: "Locate the output through the browser download control, then open or share it from Files.", limit: "Keep the processing tab active. Split-screen layouts provide less working space for page controls." },
  android: { label: "Android", pick: "Choose files through the Android document picker. Download messaging-app attachments before opening them here.", save: "Find the result in the browser download list or your device's Files/Downloads app.", limit: "Keep the tab active while processing. File provider behaviour and memory vary by device." },
  chromebook: { label: "Chromebook", pick: "Select documents through the ChromeOS Files picker. Make Drive files available locally before processing.", save: "Open the completed file from the browser download list or the Downloads section in Files.", limit: "School or workplace device policies may restrict downloads and access to local files." },
  linux: { label: "Linux", pick: "Choose documents using your browser's system file picker. Confirm access to files outside sandboxed application folders.", save: "Use the browser download list to reveal the result in your desktop file manager.", limit: "File picker and save behaviour vary by desktop environment and browser packaging." },
};

export function generateCandidate(intent: Classification, rows: Keyword[], date: string, previous?: PseoPage): PseoPage | undefined {
  const tool = CAPABILITY_BY_ID.get(intent.toolId ?? "");
  if (!tool || !["format", "size", "platform", "device", "use-case"].includes(intent.family)) return undefined;
  const sorted = [...rows].sort((a,b) => (b.searchVolume ?? -1) - (a.searchVolume ?? -1) || a.normalizedKeyword.localeCompare(b.normalizedKeyword) || a.id.localeCompare(b.id));
  const keywords = [...new Set(sorted.map(r=>r.normalizedKeyword))];
  // Once a page owns an intent, incremental observations cannot silently rename its URL or primary keyword.
  const primaryKeyword = previous?.primaryKeyword ?? keywords[0];
  let title = "", intro = "", recipeId = "unreviewed", details: string[] = [], compatibility: string[] = [], extraLimits: string[] = [];
  let steps = tool.howToSteps;
  let slug = `${tool.toolId}-${intent.modifier.replace(/[^a-z0-9]+/g,"-")}`;
  if (tool.toolId === "pdf-to-jpg" && intent.modifier === "extract-images") {
    title="Extract Images from PDF"; slug="extract-images-from-pdf"; recipeId="pdf-native-images-v1";
    intro="Save embedded raster pictures from a PDF at their decoded native dimensions. Export JPG for sharing or PNG to avoid additional lossy pixel encoding.";
    details=["Choose Embedded images after selecting the PDF. This extracts image assets rather than taking screenshots of complete pages. A small picture placed on a large page keeps its own pixel dimensions; increasing page DPI does not enlarge extracted assets.","Extraction does not preserve page-level clipping, layout or placement, and vector drawings and standalone stencil masks are not exported as photographs. Repeated assets are saved once per page. If no raster images exist, the tool reports that instead of silently returning page screenshots."];
    compatibility=["JPG flattens transparency onto white and uses lossy compression. PNG preserves decoded image pixels and transparency where available; it is not a byte-for-byte copy of the original embedded stream."];
    steps=["Select a PDF and choose Embedded images.","Choose JPG or PNG. Source dimensions are retained; page resolution is not used in extraction mode.","Export, download the image or ZIP, and inspect the extracted assets separately from the page layout."];
  } else if (tool.toolId === "pdf-to-jpg" && intent.modifier === "high-quality") {
    title="PDF to JPG in High Quality"; recipeId="pdf-jpg-300dpi-v1";
    intro="Render PDF pages at 300 DPI for clearer small text and graphics. Compare JPG with the lossless PNG option and inspect the exported pixel dimensions.";
    details=["Keep Full pages and High detail · 300 DPI selected for a detailed page render. An A4-sized page is approximately 2481 × 3508 pixels, depending on its exact PDF dimensions. At 150 DPI the width and height are halved, so small lettering has fewer pixels.","JPG is always a lossy format, even at a high encoder setting. For line art, screenshots and small text, choose PNG to avoid JPEG compression artifacts. More output pixels cannot restore details missing from a low-resolution scan, and raster images do not retain selectable PDF text."];
    compatibility=["DPI describes rendering density, not a promise about the image file's embedded print-resolution tag. Check pixel dimensions and set the intended print size in your printing application."];
    steps=["Select your PDFs and keep Full pages selected.","Choose High detail · 300 DPI and JPG, or PNG for lossless pixel encoding.","Export and inspect small text at 100% zoom. Download all pages together as a ZIP when there is more than one image."];
  } else if (tool.toolId === "pdf-to-jpg" && intent.modifier === "pdf-to-png") {
    title="PDF to PNG"; slug="pdf-to-png"; recipeId="pdf-png-lossless-v1";
    intro="Export PDF pages as PNG images with lossless pixel encoding. Useful for diagrams, screenshots and text where JPEG compression artifacts are unwanted.";
    details=["After choosing your PDFs, select PNG in the image-format controls. Full pages includes visible text and graphics on a white page background. Choose Embedded images instead when you need the separate raster assets; their transparency is retained where available.","PNG avoids lossy JPEG encoding, but rendering a PDF still converts vectors and text into pixels. Choose 300 DPI for more detail or 150 DPI for smaller dimensions. PNG files can be larger than JPG files, particularly for photographs, and a higher DPI does not repair a blurred scan."];
    compatibility=["Single-image results download directly as PNG. Multiple pages or assets are grouped into a ZIP with numbered filenames to prevent collisions."];
    steps=["Select PDFs in the existing image-export workspace.","Choose PNG and select full pages or embedded images. Set page resolution when exporting full pages.","Export, download and inspect your PNG images before sharing or printing."];
  } else if (intent.family === "format" && intent.sourceFormat === "png") {
    title="PNG to PDF"; slug="png-to-pdf"; recipeId="png-layout-v1";
    intro="Turn screenshots and PNG graphics into PDF pages. Keep each image on its own page or combine an ordered set in one document.";
    details=["PNG is useful for screenshots, diagrams and graphics with transparency. Choose Fit when the page should follow the image proportions; choose A4 or Letter when you need a standard paper size.","Arrange the PNG images before converting. Check transparent regions and margins in a PDF viewer before printing or sharing; the viewer's page background can change their appearance."];
    compatibility=["The existing JPG to PDF workspace accepts PNG directly. It also accepts JPG files in the same ordered batch."];
  } else if (intent.family === "use-case" && tool.toolId === "jpg-to-pdf" && intent.modifier === "whatsapp-images") {
    title="WhatsApp Images to PDF"; recipeId="saved-whatsapp-images-v1";
    intro="Combine JPG or PNG pictures saved from a WhatsApp conversation into an ordered PDF. Download the images to your device before selecting them here.";
    details=["Save each required picture as a local JPG or PNG file. A chat link or message export is not an image upload; this workspace does not connect to your account or retrieve messages.","Check the saved pictures before combining them. A picture already reduced or cropped when it was shared cannot regain missing detail during PDF conversion. Arrange the files in reading order and check small text in the downloaded PDF."];
    compatibility=["JPG, JPEG and PNG files can be combined in the same batch. Choose the page size and margins in the existing image workspace."];
    extraLimits=["PDFPilot is not affiliated with WhatsApp and provides no WhatsApp integration. Save or share the finished PDF yourself."];
    steps=["Save the required JPG or PNG images to your device.","Select those images and arrange them in the order you want.","Choose the page size and margins, convert, then download and inspect the PDF."];
  } else if (intent.family === "use-case" && tool.toolId === "edit-pdf" && intent.modifier === "resume") {
    title="Edit a PDF Resume"; recipeId="resume-edits-v1";
    intro="Make supported text and annotation changes to a PDF resume, then export a copy and check its appearance before submitting it.";
    details=["Keep an untouched copy of your resume. Check whether the text you need to change is editable before replacing dates, contact details or short descriptions. Complex embedded fonts and scanned pages can limit direct editing.","After exporting, reopen the resume and inspect line wrapping, spacing and the page count. Check that contact information is readable and that changes have not covered nearby text. The original Word document may be a better starting point for substantial layout changes."];
    compatibility=["Use the existing editor controls for supported text, image and annotation changes. This page does not generate resumes or certify compatibility with recruitment systems."];
    steps=["Select a copy of your PDF resume.","Make supported changes with the PDF editor and inspect the affected areas.","Save the edited PDF, download it and review the result before submission."];
  } else if (intent.family === "use-case" && tool.toolId === "excel-to-pdf" && intent.modifier === "landscape") {
    title="Excel to PDF in Landscape"; recipeId="xlsx-landscape-v1";
    intro="Export an XLSX workbook with landscape page orientation. The converter reads the workbook's saved sheet layout when arranging its PDF pages.";
    details=["Save the required sheet orientation and print settings in the source workbook before uploading it. Landscape gives wide tables more horizontal room; it does not ensure that every sheet fits on one page.","Select the sheets you need, convert, and inspect the rightmost columns and page breaks in the PDF. Wide sheets can still span pages. Adjust the source workbook's print area or layout and export again if important columns fall outside the intended pages."];
    compatibility=["This workspace accepts XLSX. Orientation comes from the saved workbook layout; this page does not add a new orientation control or change the conversion engine."];
    steps=["Save the source XLSX workbook with the desired landscape sheet layout.","Select the workbook and choose the sheets to include.","Convert and download the PDF, then check page orientation, columns and pagination."];
  } else if (intent.family === "use-case" && tool.toolId === "pdf-to-excel" && intent.modifier === "bank-statements") {
    title="Bank Statement PDF to Excel"; recipeId="bank-statement-tables-v1";
    intro="Extract supported transaction tables from a bank-statement PDF into an XLSX workbook. Compare the exported dates, amounts and column order with the original statement.";
    details=["Choose a PDF whose transaction text can be selected. Repeated headers, wrapped descriptions and page breaks can split a transaction across rows or shift values into adjacent columns. Check these boundaries after conversion.","Before using the spreadsheet, compare transaction dates, debit/credit signs, decimal separators and balances with the PDF. Keep the original statement as the reference; the converter does not reconcile accounts or certify financial figures."];
    compatibility=["The existing PDF-to-Excel workspace produces XLSX. Image-only statements may need a separate OCR step and further checking; this page does not promise extraction from every bank layout."];
    steps=["Select a bank-statement PDF with selectable transaction text.","Run the existing PDF-to-Excel conversion and download the XLSX file.","Open the workbook and compare its rows and amounts with the original statement."];
  } else if (intent.family === "use-case" && tool.toolId === "pdf-to-word" && intent.modifier === "scanned") {
    title="Scanned PDF to Word with OCR"; recipeId="scanned-pdf-word-v1";
    intro="Recognize English text in image-only PDF pages and download editable Word paragraphs. Use Auto or Free OCR in the existing PDF-to-Word workspace.";
    details=["A scanned PDF stores pictures of text rather than selectable characters. Auto first checks for selectable text; Free OCR forces recognition when an image-only scan needs it. Recognition is slower than ordinary text extraction.","Proofread names, dates, numbers and punctuation in the Word document. Blur, skew and low contrast can introduce recognition errors. The output contains editable paragraphs rather than a faithful reconstruction of complex page layouts."];
    compatibility=["OCR runs in the browser using local WebAssembly worker assets and currently recognizes English. Keep the tab open while each scanned page is processed."];
    steps=["Select the scanned PDF.","Choose Auto or Free OCR and start conversion.","Download the Word file and compare its recognized text with the original scan."];
  } else if (["platform","device"].includes(intent.family) && platforms[intent.modifier]) {
    const p=platforms[intent.modifier]; title=`${tool.displayName} on ${p.label}`;slug=`${tool.toolId}-on-${intent.modifier}`;recipeId=`platform-${intent.modifier}-v1`;
    intro=`Complete the ${tool.displayName.toLowerCase()} task in your ${p.label} browser. These instructions cover selecting local files and finding the downloaded result.`;
    details=[p.pick,p.save]; compatibility=[p.limit,...tool.platformRequirements];
  } else if (intent.family === "use-case" && tool.toolId === "compress-pdf" && ["email","upload"].includes(intent.modifier)) {
    const email=intent.modifier==="email"; title=email?"Compress PDF for Email":"Reduce PDF Size for Upload";slug=email?"compress-pdf-for-email":"compress-pdf-for-upload";recipeId=email?"compress-email-v1":"compress-upload-v1";
    intro=email?"Prepare a smaller PDF attachment and check its readability before sending. Choose the compression level in the existing compressor and compare the output size.":"Reduce a PDF before uploading it to a form or portal. Compare the downloaded result with the receiving site's stated size limit.";
    details=email?["An email message can include several attachments, and the mail service may count the total encoded message size. Check the current limit in the service you use and leave room for the other attachments.","Open the compressed file before attaching it. Inspect small text, scanned signatures and diagrams; use a less aggressive setting if the result is difficult to read."]:["Check whether the receiving portal limits each file or the whole submission. Compare its stated limit with the actual downloaded file size before retrying the upload.","If compression is insufficient, extract only the required pages when the recipient permits that. Keep the original document so you can return to it if the result loses important detail."];
    extraLimits=["PDFPilot does not guarantee a particular attachment or upload limit and does not upload the result to a third-party service."];
  } else if (intent.family === "use-case" && tool.toolId === "merge-pdf" && intent.modifier === "application") {
    title="Combine PDFs for an Application";slug="merge-pdf-for-application";recipeId="merge-application-v1";
    intro="Arrange separate PDF documents into one application packet in the order requested by the recipient.";
    details=["Read the application checklist before combining files. Put the required cover sheet, supporting documents and appendices in the stated sequence, then review the merged page order.","Some portals require separate files for each document category. Merge only when a combined packet is accepted, and check the final file against the portal's size limit."];
  } else {
    title=`${tool.displayName}: ${intent.modifier}`;intro=tool.facts[0];extraLimits=["This intent has no reviewed content recipe or executable preset. It cannot be indexed."];
  }
  const subtitle=intro;
  const body={h1:title,subtitle,intro,howToSteps:steps,useCaseContent:details,compatibilityContent:compatibility,limitationsContent:[...tool.limitations,...extraLimits],faqItems:[{question:"How is my file processed?",answer:tool.privacyFacts.join(" ")},{question:"What should I check before using the result?",answer:tool.limitations.join(" ")}],recipeId};
  return pageSchema.parse({
    id:previous?.id ?? fingerprint(intent.signature).slice(0,20),slug:previous?.slug ?? slug,pageType:intent.family,
    baseToolId:tool.toolId,baseToolSlug:tool.canonicalSlug,primaryKeyword,secondaryKeywords:keywords.filter(k=>k!==primaryKeyword),
    intentCluster:intent.signature,intentSignature:intent.signature,modifierType:intent.family,modifierValue:intent.modifier,
    ...(intent.sourceFormat?{sourceFormat:intent.sourceFormat,targetFormat:intent.targetFormat}:{}),...(intent.targetSize?{targetSize:intent.targetSize}:{}),
    ...(intent.family==="use-case"?{useCase:intent.modifier}:{}),...(intent.family==="platform"?{platform:intent.modifier}:{}),...(intent.family==="device"?{device:intent.modifier}:{}),
    provenance:sorted.map(({sourceDataset,sourceFile,sourceRowId,sourceMarket,language})=>({sourceDataset,sourceFile,sourceRowId,sourceMarket,language})),demand:sorted,
    language:"en",locale:null,metaTitle:`${title} | PDFPilot`,metaDescription:intro,...body,
    toolPreset:null,relatedPages:[],relatedTools:[tool.toolId],canonicalUrl:`https://pdfpilot.net/${previous?.slug ?? slug}`,
    indexable:false,qualityStatus:"draft",rejectionReason:[],createdAt:previous?.createdAt ?? date,updatedAt:previous?.updatedAt ?? date,lastReviewed:null,
    contentFingerprint:fingerprint(body),fixture:rows.some(r=>r.sourceDataset.startsWith("fixture-")),
  });
}
