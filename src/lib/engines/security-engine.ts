/** Compatibility API. Password encryption/decryption use the local qpdf worker.
 * Certificate-based digital signing remains distinct from the visual Sign PDF tool. */
import { processPdfPassword } from "./pdf-password-engine";
export class SecurityEngineUnavailableError extends Error {
  constructor(operation: string) {
    super(
      `${operation} is not available. Use a certificate-based signing service for cryptographic signatures.`,
    );
    this.name = "SecurityEngineUnavailableError";
  }
}
export interface EncryptPdfOptions {
  userPassword?: string;
  ownerPassword?: string;
  permissions?: {
    allowPrinting: boolean;
    allowCopying: boolean;
    allowModification: boolean;
  };
}
export async function encryptPdf(
  file: File,
  options: EncryptPdfOptions,
): Promise<Blob> {
  return (
    await processPdfPassword(file, {
      operation: "lock",
      openPassword: options.userPassword,
      ownerPassword: options.ownerPassword,
      print: options.permissions?.allowPrinting === false ? "none" : "full",
      copy: options.permissions?.allowCopying,
      modify: options.permissions?.allowModification === false ? "none" : "all",
    })
  ).blob;
}
export async function decryptPdf(file: File, password: string): Promise<Blob> {
  return (
    await processPdfPassword(file, {
      operation: "unlock",
      currentPassword: password,
    })
  ).blob;
}
export interface SignPdfOptions {
  certificateId: string;
  reason?: string;
}
export async function signPdf(
  _file: File,
  _options: SignPdfOptions,
): Promise<Blob> {
  throw new SecurityEngineUnavailableError("Certificate-based digital signing");
}
