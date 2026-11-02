export const ORGANIZE_LIMITS = {
  files: 20,
  fileBytes: 100 * 1024 * 1024,
  totalBytes: 200 * 1024 * 1024,
  pages: 1000,
};
export interface OrganizeSource {
  id: string;
  file: File;
}
export interface OrganizePage {
  id: string;
  kind: "pdf" | "blank";
  fileId?: string;
  originalPageIndex?: number;
  rotation: number;
  width?: number;
  height?: number;
}
export interface OrganizeOptions {
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
}
