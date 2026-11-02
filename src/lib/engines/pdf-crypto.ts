/** Compatibility entrypoints. Real qpdf AES-256 and native decryption run in a local worker. */
import { processPdfPassword } from "./pdf-password-engine";
export async function lockPdf(file: File, password: string): Promise<Blob> {
  return (
    await processPdfPassword(file, {
      operation: "lock",
      openPassword: password,
    })
  ).blob;
}
export async function unlockPdf(
  file: File,
  password: string,
  onPageProgress?: (page: number, total: number) => void,
): Promise<Blob> {
  const result = await processPdfPassword(file, {
    operation: "unlock",
    currentPassword: password,
  });
  onPageProgress?.(result.pageCount, result.pageCount);
  return result.blob;
}
