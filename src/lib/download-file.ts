export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Download hand-off is asynchronous in some browsers. Revoking during the
  // click can invalidate the file before the browser has started reading it.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
