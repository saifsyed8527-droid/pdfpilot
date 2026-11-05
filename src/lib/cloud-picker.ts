import type { Accept } from "react-dropzone";
import type { CloudProvider } from "./cloud-import";

export const PICKER_FILE_LIMIT = 100 * 1024 * 1024;
export const PICKER_BATCH_LIMIT = 20;
export type PickerErrorCode = "configuration" | "loading" | "popup" | "permission" | "unsupported" | "size" | "empty" | "count" | "download";
export class CloudPickerError extends Error {
  constructor(public readonly code: PickerErrorCode) { super(code); }
}

export type PickerConfig = { googleClientId: string; googleApiKey: string; googleAppId: string; dropboxAppKey: string };
export const pickerConfig: PickerConfig = {
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID ?? "",
  googleApiKey: process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY ?? "",
  googleAppId: process.env.NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID ?? "",
  dropboxAppKey: process.env.NEXT_PUBLIC_DROPBOX_APP_KEY ?? "",
};

export function pickerConfigured(provider: CloudProvider, config = pickerConfig) {
  return provider === "google-drive"
    ? Boolean(config.googleClientId && config.googleApiKey && config.googleAppId)
    : Boolean(config.dropboxAppKey);
}

type PickerDocument = { id: string; name: string; mimeType: string; sizeBytes?: number };
type PickerInstance = { setVisible: (visible: boolean) => void; dispose: () => void };
type DocsView = { setIncludeFolders: (value: boolean) => DocsView; setSelectFolderEnabled: (value: boolean) => DocsView; setEnableDrives: (value: boolean) => DocsView; setMode: (mode: string) => DocsView };
type PickerBuilder = {
  addView: (view: DocsView) => PickerBuilder;
  setOAuthToken: (token: string) => PickerBuilder;
  setDeveloperKey: (key: string) => PickerBuilder;
  setAppId: (id: string) => PickerBuilder;
  setOrigin: (origin: string) => PickerBuilder;
  setLocale: (locale: string) => PickerBuilder;
  setMaxItems: (count: number) => PickerBuilder;
  setSelectableMimeTypes: (types: string) => PickerBuilder;
  setTitle: (title: string) => PickerBuilder;
  enableFeature: (feature: string) => PickerBuilder;
  setCallback: (callback: (data: { action: string; docs?: PickerDocument[] }) => void) => PickerBuilder;
  build: () => PickerInstance;
};
type DropboxFile = { link: string; name: string; bytes: number; isDir: boolean };
type CloudWindow = Window & {
  gapi?: { load: (name: string, options: { callback: () => void; onerror: () => void; timeout: number; ontimeout: () => void }) => void };
  google?: {
    accounts?: { oauth2: { initTokenClient: (options: { client_id: string; scope: string; include_granted_scopes: boolean; callback: (response: { access_token?: string; error?: string }) => void; error_callback: (error: { type: string }) => void }) => { requestAccessToken: (options: { prompt: string }) => void } } };
    picker?: { PickerBuilder: new () => PickerBuilder; DocsView: new () => DocsView; DocsViewMode: { LIST: string }; Feature: { MULTISELECT_ENABLED: string }; Action: { PICKED: string; CANCEL: string; ERROR: string } };
  };
  Dropbox?: { choose: (options: { success: (files: DropboxFile[]) => void; cancel: () => void; ready: () => void; error: () => void; linkType: "direct"; multiselect: boolean; extensions?: string[]; folderselect: false; sizeLimit: number }) => void; cancelChooser?: () => void; isBrowserSupported: () => boolean };
};

const scripts = new Map<string, Promise<void>>();
const ready = new Map<CloudProvider, Promise<void>>();
function loadScript(id: string, src: string, attributes: Record<string, string> = {}) {
  if (scripts.has(id)) return scripts.get(id)!;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = id; script.src = src; script.async = true;
    for (const [key, value] of Object.entries(attributes)) script.setAttribute(key, value);
    const timeout = window.setTimeout(fail, 20000);
    function fail() { clearTimeout(timeout); script.remove(); scripts.delete(id); reject(new CloudPickerError("loading")); }
    script.onload = () => { clearTimeout(timeout); resolve(); };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  scripts.set(id, promise);
  return promise;
}

/** Load official SDKs ahead of the click so the account popup retains user activation. */
export function prepareCloudPicker(provider: CloudProvider, config = pickerConfig): Promise<void> {
  if (!pickerConfigured(provider, config)) return Promise.reject(new CloudPickerError("configuration"));
  if (ready.has(provider)) return ready.get(provider)!;
  const win = window as CloudWindow;
  const promise = provider === "dropbox"
    ? loadScript("dropboxjs", "https://www.dropbox.com/static/api/2/dropins.js", { "data-app-key": config.dropboxAppKey })
    : Promise.all([
      loadScript("pdfpilot-google-identity", "https://accounts.google.com/gsi/client"),
      loadScript("pdfpilot-google-api", "https://apis.google.com/js/api.js").then(() => new Promise<void>((resolve, reject) => {
        if (!win.gapi) { reject(new CloudPickerError("loading")); return; }
        const fail = () => reject(new CloudPickerError("loading"));
        win.gapi.load("picker", { callback: resolve, onerror: fail, timeout: 20000, ontimeout: fail });
      })),
    ]).then(() => undefined);
  ready.set(provider, promise);
  promise.catch(() => ready.delete(provider));
  return promise;
}

const exportsByMime: Record<string, Record<string, string>> = {
  "application/vnd.google-apps.document": { docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pdf: "application/pdf", txt: "text/plain", odt: "application/vnd.oasis.opendocument.text", rtf: "application/rtf" },
  "application/vnd.google-apps.spreadsheet": { xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv: "text/csv", pdf: "application/pdf", tsv: "text/tab-separated-values", ods: "application/vnd.oasis.opendocument.spreadsheet" },
  "application/vnd.google-apps.presentation": { pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", pdf: "application/pdf", txt: "text/plain", odp: "application/vnd.oasis.opendocument.presentation" },
};
export function driveExport(mime: string, accept?: Accept) {
  const formats = exportsByMime[mime];
  if (!formats) return undefined;
  const extensions = Object.values(accept ?? {}).flat().map(ext => ext.replace(/^\./, "").toLowerCase());
  const extension = extensions.length ? extensions.find(ext => formats[ext]) : Object.keys(formats)[0];
  if (!extension) throw new CloudPickerError("unsupported");
  return { extension, mime: formats[extension] };
}
export function pickerMimeTypes(accept?: Accept) {
  if (!accept || Object.keys(accept).some(mime => mime.endsWith("/*") || mime === "application/octet-stream")) return undefined;
  const mimes = Object.keys(accept);
  for (const mime of Object.keys(exportsByMime)) {
    try { if (driveExport(mime, accept)) mimes.push(mime); } catch { /* This native document cannot export to the required format. */ }
  }
  return mimes.join(",");
}
function safeName(value: string) { return value.replace(/[\x00-\x1f\x7f/\\]/g, "_").trim().slice(0, 180) || "cloud-file"; }
export function acceptsCloudFile(file: File, accept?: Accept) {
  return !accept || Object.entries(accept).some(([mime, extensions]) =>
    (mime !== "application/octet-stream" && (file.type === mime || (mime.endsWith("/*") && file.type.startsWith(mime.slice(0, -1))))) || extensions.some(ext => file.name.toLowerCase().endsWith(ext.toLowerCase())));
}
export function dropboxDirectUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.port || !(url.hostname === "dl.dropboxusercontent.com" || url.hostname.endsWith(".dl.dropboxusercontent.com"))) throw new CloudPickerError("download");
  return url.href;
}

/** Bound streamed downloads too, even when the provider omits Content-Length. */
export async function readCloudFile(response: Response, name: string, mime: string, maxSize: number, signal: AbortSignal): Promise<File> {
  if (!response.ok) throw new CloudPickerError(response.status === 401 || response.status === 403 ? "permission" : "download");
  if (Number(response.headers.get("content-length")) > maxSize) { await response.body?.cancel(); throw new CloudPickerError("size"); }
  if (!response.body) throw new CloudPickerError("empty");
  const reader = response.body.getReader();
  const chunks: ArrayBuffer[] = [];
  let size = 0;
  let stalled = false;
  let timeout: ReturnType<typeof setTimeout>;
  const resetTimeout = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => { stalled = true; void reader.cancel(); }, 30000);
  };
  const cancel = () => { void reader.cancel(); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    for (;;) {
      signal.throwIfAborted();
      resetTimeout();
      const chunk = await reader.read();
      signal.throwIfAborted();
      if (stalled) throw new CloudPickerError("download");
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxSize) { await reader.cancel(); throw new CloudPickerError("size"); }
      chunks.push(chunk.value.slice().buffer);
    }
  } finally { clearTimeout(timeout!); signal.removeEventListener("abort", cancel); reader.releaseLock(); }
  if (!size) throw new CloudPickerError("empty");
  return new File(chunks, safeName(name), { type: mime || response.headers.get("content-type")?.split(";")[0] || "application/octet-stream" });
}

type PickOptions = { accept?: Accept; multiple?: boolean; maxSize?: number; locale: string; title?: string; signal: AbortSignal; onReady?: () => void; onDownload: () => void };
function checkCount(files: unknown[], multiple?: boolean) {
  if (!files.length || files.length > (multiple ? PICKER_BATCH_LIMIT : 1)) throw new CloudPickerError("count");
}
function checked(file: File, accept?: Accept) { if (!acceptsCloudFile(file, accept)) throw new CloudPickerError("unsupported"); return file; }

/** A provider that never sends response headers must not leave the upload locked. */
async function fetchCloudFile(url: string, init: RequestInit & { signal: AbortSignal }) {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort(init.signal.reason);
  init.signal.addEventListener("abort", abort, { once: true });
  if (init.signal.aborted) abort();
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 20000);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  catch (error) { if (timedOut) throw new CloudPickerError("download"); throw error; }
  finally { clearTimeout(timeout); init.signal.removeEventListener("abort", abort); }
}

export async function downloadDriveFiles(docs: PickerDocument[], accessToken: string, options: PickOptions): Promise<File[]> {
  checkCount(docs, options.multiple);
  const files: File[] = [];
  const limit = Math.min(options.maxSize ?? PICKER_FILE_LIMIT, PICKER_FILE_LIMIT);
  for (const doc of docs) {
    options.signal.throwIfAborted();
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(doc.id)) throw new CloudPickerError("download");
    // Never follow a callback URL with a bearer token. Only the fixed Drive API receives it.
    const base = `https://www.googleapis.com/drive/v3/files/${doc.id}`;
    const init = { headers: { Authorization: `Bearer ${accessToken}` }, signal: options.signal, credentials: "omit" as const, cache: "no-store" as const, redirect: "error" as const };
    const metadata = await fetchCloudFile(`${base}?fields=name,mimeType,size,capabilities(canDownload)&supportsAllDrives=true`, init);
    if (!metadata.ok) throw new CloudPickerError("permission");
    const metadataFile = await readCloudFile(metadata, "metadata.json", "application/json", 64 * 1024, options.signal);
    const info = JSON.parse(await metadataFile.text()) as { name: string; mimeType: string; size?: string; capabilities?: { canDownload?: boolean } };
    if (!info.name || !info.mimeType || info.capabilities?.canDownload === false) throw new CloudPickerError("permission");
    if (Number(info.size) > limit) throw new CloudPickerError("size");
    const exported = driveExport(info.mimeType, options.accept);
    if (!exported && info.mimeType.startsWith("application/vnd.google-apps.")) throw new CloudPickerError("unsupported");
    const name = exported ? `${info.name}.${exported.extension}` : info.name;
    const response = await fetchCloudFile(exported ? `${base}/export?mimeType=${encodeURIComponent(exported.mime)}` : `${base}?alt=media&supportsAllDrives=true`, init);
    files.push(checked(await readCloudFile(response, name, exported?.mime ?? info.mimeType, limit, options.signal), options.accept));
  }
  return files;
}

export async function downloadDropboxFiles(docs: DropboxFile[], options: PickOptions): Promise<File[]> {
  checkCount(docs, options.multiple);
  const files: File[] = [];
  const limit = Math.min(options.maxSize ?? PICKER_FILE_LIMIT, PICKER_FILE_LIMIT);
  for (const doc of docs) {
    options.signal.throwIfAborted();
    if (doc.isDir) throw new CloudPickerError("unsupported");
    if (doc.bytes > limit) throw new CloudPickerError("size");
    const response = await fetchCloudFile(dropboxDirectUrl(doc.link), { signal: options.signal, credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", redirect: "error" });
    files.push(checked(await readCloudFile(response, doc.name, "", limit, options.signal), options.accept));
  }
  return files;
}

/** Must be called synchronously from a user click after prepareCloudPicker completes. */
export function pickCloudFiles(provider: CloudProvider, options: PickOptions, config = pickerConfig): Promise<File[]> {
  if (!pickerConfigured(provider, config)) return Promise.reject(new CloudPickerError("configuration"));
  const win = window as CloudWindow;
  return new Promise<File[]>((resolve, reject) => {
    let settled = false;
    let picker: PickerInstance | undefined;
    const finish = (files: File[] | undefined, error?: unknown) => {
      if (settled) return;
      settled = true;
      options.signal.removeEventListener("abort", abort);
      // An already-closed provider window must not prevent cancellation from
      // settling our promise and unlocking the upload controls.
      try { picker?.dispose(); } catch { /* The picker may already be detached. */ }
      if (error && provider === "dropbox") {
        try { win.Dropbox?.cancelChooser?.(); } catch { /* The popup may already be closed. */ }
      }
      if (error) reject(error); else resolve(files ?? []);
    };
    const abort = () => {
      finish(undefined, new DOMException("Cancelled", "AbortError"));
    };
    options.signal.addEventListener("abort", abort, { once: true });
    if (options.signal.aborted) { abort(); return; }
    const download = (load: () => Promise<File[]>) => {
      if (settled) return;
      picker?.setVisible(false); options.onDownload();
      load().then(files => finish(files), error => finish(undefined, error));
    };
    try {
      if (provider === "dropbox") {
        if (!win.Dropbox) throw new CloudPickerError("loading");
        if (!win.Dropbox.isBrowserSupported()) throw new CloudPickerError("popup");
        // ready/error/cancelChooser are provided by the official dropins.js SDK.
        // Always call choose in the click, and close its window on app cancellation.
        try {
          win.Dropbox.choose({ success: docs => download(() => downloadDropboxFiles(docs, options)), cancel: () => finish([]), ready: () => { if (!settled) options.onReady?.(); }, error: () => finish(undefined, new CloudPickerError("loading")), linkType: "direct", multiselect: Boolean(options.multiple), extensions: options.accept ? Object.values(options.accept).flat() : undefined, folderselect: false, sizeLimit: Math.min(options.maxSize ?? PICKER_FILE_LIMIT, PICKER_FILE_LIMIT) });
        } catch (error) {
          if (error instanceof Error && (error.name === "WindowFailedToOpenError" || /Failed to open/i.test(error.message))) throw new CloudPickerError("popup");
          throw error;
        }
        return;
      }
      const sdk = win.google?.picker;
      const oauth = win.google?.accounts?.oauth2;
      if (!sdk || !oauth) throw new CloudPickerError("loading");
      const client = oauth.initTokenClient({
        client_id: config.googleClientId,
        scope: "https://www.googleapis.com/auth/drive.file",
        include_granted_scopes: false,
        error_callback: error => error.type === "popup_closed" ? finish([]) : finish(undefined, new CloudPickerError("popup")),
        callback: response => {
          if (settled) return;
          if (response.error || !response.access_token) { finish(undefined, new CloudPickerError("permission")); return; }
          try {
            const token = response.access_token;
            const view = new sdk.DocsView().setIncludeFolders(true).setSelectFolderEnabled(false).setMode(sdk.DocsViewMode.LIST);
            const sharedDrives = new sdk.DocsView().setEnableDrives(true).setIncludeFolders(true).setSelectFolderEnabled(false).setMode(sdk.DocsViewMode.LIST);
            const mimes = pickerMimeTypes(options.accept);
            // Filter selection, not folder contents. Hiding every non-PDF made
            // image/Office folders look empty even though they contain files.
            const builder = new sdk.PickerBuilder().addView(view).addView(sharedDrives).setOAuthToken(token).setDeveloperKey(config.googleApiKey).setAppId(config.googleAppId).setOrigin(window.location.origin).setLocale(options.locale.replace("-", "_")).setMaxItems(options.multiple ? PICKER_BATCH_LIMIT : 1).setCallback(data => {
              if (data.action === sdk.Action.ERROR) finish(undefined, new CloudPickerError("loading"));
              if (data.action === sdk.Action.CANCEL) finish([]);
              if (data.action === sdk.Action.PICKED) download(() => downloadDriveFiles(data.docs ?? [], token, options));
            });
            if (mimes) builder.setSelectableMimeTypes(mimes);
            if (options.title) builder.setTitle(options.title);
            if (options.multiple) builder.enableFeature(sdk.Feature.MULTISELECT_ENABLED);
            picker = builder.build(); picker.setVisible(true); options.onReady?.();
          } catch (error) { finish(undefined, error); }
        },
      });
      // The token stays in this selection callback. Never store it or send it to PDFPilot.
      client.requestAccessToken({ prompt: "select_account" });
    } catch (error) { finish(undefined, error); }
  });
}
