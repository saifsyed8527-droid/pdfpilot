import type { ReactElement } from "react";

/** Load only the real workspace for the selected tool. Editorial copy stays on the page in its own language. */
export const catalogWorkspaces: Record<string, () => Promise<ReactElement>> = {
  "rearrange-pages": async () => {
    const { RearrangePagesClient } = await import("@/app/rearrange-pages/rearrange-pages-client");
    return <RearrangePagesClient faqs={[]} related={[]} />;
  },
  "pdf-metadata-editor": async () => {
    const { PdfMetadataEditorClient } = await import("@/app/pdf-metadata-editor/pdf-metadata-editor-client");
    return <PdfMetadataEditorClient faqs={[]} related={[]} />;
  },
  "duplicate-pages": async () => {
    const { DuplicatePagesClient } = await import("@/app/duplicate-pages/duplicate-pages-client");
    return <DuplicatePagesClient faqs={[]} related={[]} />;
  },
  "convert-image": async () => {
    const { ConvertImageClient } = await import("@/app/convert-image/convert-image-client");
    return <ConvertImageClient faqs={[]} related={[]} />;
  },
  "resize-image": async () => {
    const { ResizeImageClient } = await import("@/app/resize-image/resize-image-client");
    return <ResizeImageClient faqs={[]} related={[]} />;
  },
  "summary-generator": async () => {
    const { SummaryGeneratorClient } = await import("@/app/summary-generator/summary-generator-client");
    return <SummaryGeneratorClient faqs={[]} related={[]} />;
  },
  "flatten-pdf": async () => {
    const { FlattenPdfClient } = await import("@/app/flatten-pdf/flatten-pdf-client");
    return <FlattenPdfClient faqs={[]} related={[]} />;
  },
  "insert-pages": async () => {
    const { InsertPagesClient } = await import("@/app/insert-pages/insert-pages-client");
    return <InsertPagesClient faqs={[]} related={[]} />;
  },
  "compare-pdf": async () => {
    const { ComparePdfClient } = await import("@/app/compare-pdf/compare-pdf-client");
    return <ComparePdfClient faqs={[]} related={[]} />;
  },
  "lock-pdf": async () => {
    const { LockPdfClient } = await import("@/app/lock-pdf/lock-pdf-client");
    return <LockPdfClient faqs={[]} related={[]} />;
  },
  "unlock-pdf": async () => {
    const { UnlockPdfClient } = await import("@/app/unlock-pdf/unlock-pdf-client");
    return <UnlockPdfClient faqs={[]} related={[]} />;
  },
  "crop-image": async () => {
    const { CropImageClient } = await import("@/app/crop-image/crop-image-client");
    return <CropImageClient faqs={[]} related={[]} />;
  },
  "rotate-image": async () => {
    const { RotateImageClient } = await import("@/app/rotate-image/rotate-image-client");
    return <RotateImageClient faqs={[]} related={[]} />;
  },
  "compress-image": async () => {
    const { CompressImageClient } = await import("@/app/compress-image/compress-image-client");
    return <CompressImageClient faqs={[]} related={[]} />;
  },
  "image-metadata": async () => {
    const { ImageMetadataClient } = await import("@/app/image-metadata/image-metadata-client");
    return <ImageMetadataClient faqs={[]} related={[]} />;
  },
  "ocr-image": async () => {
    const { OcrImageClient } = await import("@/app/ocr-image/ocr-image-client");
    return <OcrImageClient faqs={[]} related={[]} />;
  },
  "docx-merge": async () => {
    const { DocxMergeClient } = await import("@/app/docx-merge/docx-merge-client");
    return <DocxMergeClient faqs={[]} related={[]} />;
  },
  "txt-to-pdf": async () => {
    const { TxtToPdfClient } = await import("@/app/txt-to-pdf/txt-to-pdf-client");
    return <TxtToPdfClient faqs={[]} related={[]} />;
  },
  "markdown-to-pdf": async () => {
    const { MarkdownToPdfClient } = await import("@/app/markdown-to-pdf/markdown-to-pdf-client");
    return <MarkdownToPdfClient faqs={[]} related={[]} />;
  },
  "csv-to-pdf": async () => {
    const { CsvToPdfClient } = await import("@/app/csv-to-pdf/csv-to-pdf-client");
    return <CsvToPdfClient faqs={[]} related={[]} />;
  },
  "csv-to-xml": async () => {
    const { CsvToXmlClient } = await import("@/app/csv-to-xml/csv-to-xml-client");
    return <CsvToXmlClient faqs={[]} related={[]} />;
  },
  "xml-to-csv": async () => {
    const { XmlToCsvClient } = await import("@/app/xml-to-csv/xml-to-csv-client");
    return <XmlToCsvClient faqs={[]} related={[]} />;
  },
  "xml-to-excel": async () => {
    const { XmlToExcelClient } = await import("@/app/xml-to-excel/xml-to-excel-client");
    return <XmlToExcelClient faqs={[]} related={[]} />;
  },
  "heic-to-jpg": async () => {
    const { HeicToJpgClient } = await import("@/app/heic-to-jpg/heic-to-jpg-client");
    return <HeicToJpgClient faqs={[]} related={[]} />;
  },
  "heic-to-png": async () => {
    const { HeicToPngClient } = await import("@/app/heic-to-png/heic-to-png-client");
    return <HeicToPngClient faqs={[]} related={[]} />;
  },
  "svg-to-pdf": async () => {
    const { SvgToPdfClient } = await import("@/app/svg-to-pdf/svg-to-pdf-client");
    return <SvgToPdfClient faqs={[]} related={[]} />;
  },
  "image-watermark": async () => {
    const { ImageWatermarkClient } = await import("@/app/image-watermark/image-watermark-client");
    return <ImageWatermarkClient faqs={[]} related={[]} />;
  },
  "json-to-csv": async () => {
    const { JsonToCsvClient } = await import("@/app/json-to-csv/json-to-csv-client");
    return <JsonToCsvClient faqs={[]} related={[]} />;
  },
  "csv-to-json": async () => {
    const { CsvToJsonClient } = await import("@/app/csv-to-json/csv-to-json-client");
    return <CsvToJsonClient faqs={[]} related={[]} />;
  },
  "json-to-excel": async () => {
    const { JsonToExcelClient } = await import("@/app/json-to-excel/json-to-excel-client");
    return <JsonToExcelClient faqs={[]} related={[]} />;
  },
  "excel-to-json": async () => {
    const { ExcelToJsonClient } = await import("@/app/excel-to-json/excel-to-json-client");
    return <ExcelToJsonClient faqs={[]} related={[]} />;
  },
  "tsv-to-csv": async () => {
    const { TsvToCsvClient } = await import("@/app/tsv-to-csv/tsv-to-csv-client");
    return <TsvToCsvClient faqs={[]} related={[]} />;
  },
  "csv-to-tsv": async () => {
    const { CsvToTsvClient } = await import("@/app/csv-to-tsv/csv-to-tsv-client");
    return <CsvToTsvClient faqs={[]} related={[]} />;
  },
  "tsv-to-excel": async () => {
    const { TsvToExcelClient } = await import("@/app/tsv-to-excel/tsv-to-excel-client");
    return <TsvToExcelClient faqs={[]} related={[]} />;
  },
  "excel-to-tsv": async () => {
    const { ExcelToTsvClient } = await import("@/app/excel-to-tsv/excel-to-tsv-client");
    return <ExcelToTsvClient faqs={[]} related={[]} />;
  },
  "yaml-to-json": async () => {
    const { YamlToJsonClient } = await import("@/app/yaml-to-json/yaml-to-json-client");
    return <YamlToJsonClient faqs={[]} related={[]} />;
  },
  "json-to-yaml": async () => {
    const { JsonToYamlClient } = await import("@/app/json-to-yaml/json-to-yaml-client");
    return <JsonToYamlClient faqs={[]} related={[]} />;
  },
  "markdown-to-html": async () => {
    const { MarkdownToHtmlClient } = await import("@/app/markdown-to-html/markdown-to-html-client");
    return <MarkdownToHtmlClient faqs={[]} related={[]} />;
  },
  "html-to-markdown": async () => {
    const { HtmlToMarkdownClient } = await import("@/app/html-to-markdown/html-to-markdown-client");
    return <HtmlToMarkdownClient faqs={[]} related={[]} />;
  },
  "html-to-text": async () => {
    const { HtmlToTextClient } = await import("@/app/html-to-text/html-to-text-client");
    return <HtmlToTextClient faqs={[]} related={[]} />;
  },
  "text-to-html": async () => {
    const { TextToHtmlClient } = await import("@/app/text-to-html/text-to-html-client");
    return <TextToHtmlClient faqs={[]} related={[]} />;
  },
  "base64-encode": async () => {
    const { Base64EncodeClient } = await import("@/app/base64-encode/base64-encode-client");
    return <Base64EncodeClient faqs={[]} related={[]} />;
  },
  "base64-decode": async () => {
    const { Base64DecodeClient } = await import("@/app/base64-decode/base64-decode-client");
    return <Base64DecodeClient faqs={[]} related={[]} />;
  },
  "url-encode": async () => {
    const { UrlEncodeClient } = await import("@/app/url-encode/url-encode-client");
    return <UrlEncodeClient faqs={[]} related={[]} />;
  },
  "url-decode": async () => {
    const { UrlDecodeClient } = await import("@/app/url-decode/url-decode-client");
    return <UrlDecodeClient faqs={[]} related={[]} />;
  },
  "json-formatter": async () => {
    const { JsonFormatterClient } = await import("@/app/json-formatter/json-formatter-client");
    return <JsonFormatterClient faqs={[]} related={[]} />;
  },
  "json-minifier": async () => {
    const { JsonMinifierClient } = await import("@/app/json-minifier/json-minifier-client");
    return <JsonMinifierClient faqs={[]} related={[]} />;
  },
  "json-validator": async () => {
    const { JsonValidatorClient } = await import("@/app/json-validator/json-validator-client");
    return <JsonValidatorClient faqs={[]} related={[]} />;
  },
  "xml-formatter": async () => {
    const { XmlFormatterClient } = await import("@/app/xml-formatter/xml-formatter-client");
    return <XmlFormatterClient faqs={[]} related={[]} />;
  },
  "xml-minifier": async () => {
    const { XmlMinifierClient } = await import("@/app/xml-minifier/xml-minifier-client");
    return <XmlMinifierClient faqs={[]} related={[]} />;
  },
  "xml-validator": async () => {
    const { XmlValidatorClient } = await import("@/app/xml-validator/xml-validator-client");
    return <XmlValidatorClient faqs={[]} related={[]} />;
  },
  "csv-formatter": async () => {
    const { CsvFormatterClient } = await import("@/app/csv-formatter/csv-formatter-client");
    return <CsvFormatterClient faqs={[]} related={[]} />;
  },
  "csv-cleaner": async () => {
    const { CsvCleanerClient } = await import("@/app/csv-cleaner/csv-cleaner-client");
    return <CsvCleanerClient faqs={[]} related={[]} />;
  },
  "duplicate-row-remover": async () => {
    const { DuplicateRowRemoverClient } = await import("@/app/duplicate-row-remover/duplicate-row-remover-client");
    return <DuplicateRowRemoverClient faqs={[]} related={[]} />;
  },
  "column-extractor": async () => {
    const { ColumnExtractorClient } = await import("@/app/column-extractor/column-extractor-client");
    return <ColumnExtractorClient faqs={[]} related={[]} />;
  },
  "csv-splitter": async () => {
    const { CsvSplitterClient } = await import("@/app/csv-splitter/csv-splitter-client");
    return <CsvSplitterClient faqs={[]} related={[]} />;
  },
  "csv-merger": async () => {
    const { CsvMergerClient } = await import("@/app/csv-merger/csv-merger-client");
    return <CsvMergerClient faqs={[]} related={[]} />;
  },
  "excel-sheet-extractor": async () => {
    const { ExcelSheetExtractorClient } = await import("@/app/excel-sheet-extractor/excel-sheet-extractor-client");
    return <ExcelSheetExtractorClient faqs={[]} related={[]} />;
  },
  "excel-sheet-merger": async () => {
    const { ExcelSheetMergerClient } = await import("@/app/excel-sheet-merger/excel-sheet-merger-client");
    return <ExcelSheetMergerClient faqs={[]} related={[]} />;
  },
  "sql-to-csv": async () => {
    const { SqlToCsvClient } = await import("@/app/sql-to-csv/sql-to-csv-client");
    return <SqlToCsvClient faqs={[]} related={[]} />;
  },
  "csv-to-sql": async () => {
    const { CsvToSqlClient } = await import("@/app/csv-to-sql/csv-to-sql-client");
    return <CsvToSqlClient faqs={[]} related={[]} />;
  },
  "sql-to-json": async () => {
    const { SqlToJsonClient } = await import("@/app/sql-to-json/sql-to-json-client");
    return <SqlToJsonClient faqs={[]} related={[]} />;
  },
  "json-to-sql": async () => {
    const { JsonToSqlClient } = await import("@/app/json-to-sql/json-to-sql-client");
    return <JsonToSqlClient faqs={[]} related={[]} />;
  },
  "json-to-xml": async () => {
    const { JsonToXmlClient } = await import("@/app/json-to-xml/json-to-xml-client");
    return <JsonToXmlClient faqs={[]} related={[]} />;
  },
  "xml-to-json": async () => {
    const { XmlToJsonClient } = await import("@/app/xml-to-json/xml-to-json-client");
    return <XmlToJsonClient faqs={[]} related={[]} />;
  },
  "yaml-to-xml": async () => {
    const { YamlToXmlClient } = await import("@/app/yaml-to-xml/yaml-to-xml-client");
    return <YamlToXmlClient faqs={[]} related={[]} />;
  },
  "xml-to-yaml": async () => {
    const { XmlToYamlClient } = await import("@/app/xml-to-yaml/xml-to-yaml-client");
    return <XmlToYamlClient faqs={[]} related={[]} />;
  },
  "csv-to-excel": async () => {
    const { CsvToExcelClient } = await import("@/app/csv-to-excel/csv-to-excel-client");
    return <CsvToExcelClient faqs={[]} related={[]} />;
  },
  "excel-to-csv": async () => {
    const { ExcelToCsvClient } = await import("@/app/excel-to-csv/excel-to-csv-client");
    return <ExcelToCsvClient faqs={[]} related={[]} />;
  },
  "jwt-decode": async () => {
    const { JwtDecodeClient } = await import("@/app/jwt-decode/jwt-decode-client");
    return <JwtDecodeClient faqs={[]} related={[]} />;
  },
  "json-diff": async () => {
    const { JsonDiffClient } = await import("@/app/json-diff/json-diff-client");
    return <JsonDiffClient faqs={[]} related={[]} />;
  },
  "csv-to-markdown-table": async () => {
    const { CsvToMarkdownTableClient } = await import("@/app/csv-to-markdown-table/csv-to-markdown-table-client");
    return <CsvToMarkdownTableClient faqs={[]} related={[]} />;
  },
  "markdown-table-to-csv": async () => {
    const { MarkdownTableToCsvClient } = await import("@/app/markdown-table-to-csv/markdown-table-to-csv-client");
    return <MarkdownTableToCsvClient faqs={[]} related={[]} />;
  },
  "redact-pdf": async () => {
    const { RedactPdfClient } = await import("@/app/redact-pdf/redact-pdf-client");
    return <RedactPdfClient />;
  },
  "pdf-to-markdown": async () => {
    const { PdfTextToolClient } = await import("@/components/tool/PdfTextToolClient");
    return <PdfTextToolClient mode="markdown" faqs={[]} />;
  },
  "sign-pdf": async () => {
    const { EditPdfClient } = await import("@/app/edit-pdf/edit-pdf-client");
    return <EditPdfClient variant="sign" faqs={[]} related={[]} />;
  },
  "photo-editor": async () => {
    const { PhotoEditorClient } = await import("@/app/photo-editor/photo-editor-client");
    return <PhotoEditorClient />;
  },
  "meme-generator": async () => {
    const { PhotoEditorClient } = await import("@/app/photo-editor/photo-editor-client");
    return <PhotoEditorClient variant="meme" />;
  },
  "blur-face": async () => {
    const { BlurFaceClient } = await import("@/app/blur-face/blur-face-client");
    return <BlurFaceClient />;
  },
  "html-to-image": async () => {
    const { HtmlConvertClient } = await import("@/app/html-to-pdf/html-to-pdf-client");
    return <HtmlConvertClient mode="image" />;
  },
  "remove-background": async () => {
    const { RemoveBackgroundClient } = await import("@/app/remove-background/remove-background-client");
    return <RemoveBackgroundClient />;
  },
  "upscale-image": async () => {
    const { UpscaleImageClient } = await import("@/app/upscale-image/upscale-image-client");
    return <UpscaleImageClient />;
  },
  "translate-pdf": async () => {
    const { TranslatePdfClient } = await import("@/app/translate-pdf/translate-pdf-client");
    return <TranslatePdfClient />;
  },
};
