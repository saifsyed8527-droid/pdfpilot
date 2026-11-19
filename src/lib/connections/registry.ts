import rows from "./operations.json";
import catalog from "../tools-data.json";

export interface FileOperation {
  slug: string;
  input: string;
  output: string;
  kind: string;
  samples: string[];
  settings: string[];
}
export const OPERATIONS: readonly FileOperation[] = rows;
export const CLOUD_SOURCES = ["google-drive", "dropbox"] as const;
export const CONNECTION_ROOT = "/integrations";
export const CONNECTION_CHUNK_SIZE = 1000;
const operations = new Map(OPERATIONS.map(operation => [operation.slug, operation]));
const tools = new Map(catalog.map(tool => [tool.slug, tool]));
if (operations.size !== OPERATIONS.length || OPERATIONS.some(operation => !tools.has(operation.slug))) {
  throw new Error("Connection operations must reference unique tools.");
}

export function compatible(first: FileOperation, next: FileOperation): boolean {
  if (first.slug === next.slug || first.output !== next.input || next.kind === "merge") return false;
  if (first.kind === "rotate" && next.kind === "number") return false;
  if (["merge", "extract"].includes(first.kind) && next.kind === "flatten") return false;
  if ([first.kind, next.kind].every(kind => ["format", "minify"].includes(kind))) return false;
  // A conversion followed by its inverse creates no distinct target task.
  return !(first.kind === "convert" && next.kind === "convert" && first.input === next.output);
}

export function getConnection(source: string, target: string) {
  const tool = tools.get(target);
  if (!tool) return undefined;
  if ((CLOUD_SOURCES as readonly string[]).includes(source)) return { source, target, cloud: true as const, tool };
  const first = operations.get(source), next = operations.get(target);
  return first && next && compatible(first, next) ? { source, target, cloud: false as const, tool, first, next } : undefined;
}
export type Connection = NonNullable<ReturnType<typeof getConnection>>;
export function connectionTargets(source: string) {
  return catalog.map(tool => getConnection(source, tool.slug)).filter((row): row is Connection => Boolean(row));
}
export const CONNECTION_SOURCES = [...CLOUD_SOURCES, ...OPERATIONS.map(operation => operation.slug)]
  .filter(source => connectionTargets(source).length > 0);

export function connectionPath(source?: string, target?: string) {
  return [CONNECTION_ROOT, source, target].filter(Boolean).join("/");
}
// The landing-page graph is retired. Operation helpers above remain available
// to processing code; they are not public pages or indexable route aliases.
export function isConnectionPath(_path: string): boolean { return false; }
export function* connectionPaths(): Generator<string> { return; }
export function connectionCount(): number { return 0; }
export function connectionSlice(_offset: number, _limit: number): string[] { return []; }
