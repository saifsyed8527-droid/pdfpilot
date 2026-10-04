/** Stable user-facing messages for failed source files. Never echo parser text. */
export function pdfDocumentInputError(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";
  if (/^This PDF looks scanned\./.test(message)) {
    return "This PDF looks scanned. Choose Auto or Free OCR to convert it into editable Word text.";
  }
  if (name === "PasswordException" || /no password given|incorrect password|is encrypted|password.protected/i.test(message)) {
    return "This PDF is password-protected. Remove the password and try again.";
  }
  if (name === "InvalidPDFException" || /invalid pdf|empty pdf|missing pdf/i.test(message)) {
    return "Couldn't read this PDF. The file may be corrupted or not a valid PDF.";
  }
  return "Couldn't read this PDF. Try a different file.";
}

export function officeArchiveInputError(error: unknown, format: "DOCX" | "PPTX"): string | null {
  const message = error instanceof Error ? error.message : "";
  if (!/invalid zip data|invalid zip|end of central directory|not a zip/i.test(message)) return null;
  return `This is not a readable ${format} file. Re-export it from the original editor and try again.`;
}
