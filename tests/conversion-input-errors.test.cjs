const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./load-ts.cjs");
const { pdfDocumentInputError, officeArchiveInputError } = loadTs("src/lib/engines/conversion-input-errors.ts");

test("protected and invalid PDFs produce stable recovery guidance without parser text", () => {
  const password = Object.assign(new Error("No password given"), { name: "PasswordException" });
  const invalid = Object.assign(new Error("Invalid PDF structure"), { name: "InvalidPDFException" });
  assert.equal(pdfDocumentInputError(password), "This PDF is password-protected. Remove the password and try again.");
  assert.equal(pdfDocumentInputError(new Error("The PDF is encrypted")), pdfDocumentInputError(password));
  assert.equal(pdfDocumentInputError(invalid), "Couldn't read this PDF. The file may be corrupted or not a valid PDF.");
  assert.equal(pdfDocumentInputError(new Error("This PDF looks scanned. Choose Auto or Free OCR to convert it into editable Word text.")), "This PDF looks scanned. Choose Auto or Free OCR to convert it into editable Word text.");
  assert.equal(pdfDocumentInputError(new Error("private document text")), "Couldn't read this PDF. Try a different file.");
});

test("invalid Office archives identify the expected format without exposing ZIP errors", () => {
  assert.equal(officeArchiveInputError(new Error("invalid zip data"), "DOCX"), "This is not a readable DOCX file. Re-export it from the original editor and try again.");
  assert.equal(officeArchiveInputError(new Error("invalid zip data"), "PPTX"), "This is not a readable PPTX file. Re-export it from the original editor and try again.");
  assert.equal(officeArchiveInputError(new Error("layout cannot fit"), "DOCX"), null);
});


test("mixed-page and empty-text recovery guidance survives error normalization", () => {
  const mixed = "No selectable text on page 2. Choose Auto or Free OCR to avoid missing scanned content.";
  assert.equal(pdfDocumentInputError(new Error(mixed)), mixed);
  assert.equal(pdfDocumentInputError(new Error("This PDF has no pages.")), "This PDF has no pages.");
  const empty = "No readable text was found. Try a clearer English scan or a PDF with selectable text.";
  assert.equal(pdfDocumentInputError(new Error(empty)), empty);
  assert.equal(pdfDocumentInputError(new Error("No selectable text on page confidential-client-name. Choose Auto or Free OCR to avoid missing scanned content.")), "Couldn't read this PDF. Try a different file.");
});
