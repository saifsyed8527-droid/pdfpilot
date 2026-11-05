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
export function isConnectionPath(path: string) {
  if (path === CONNECTION_ROOT) return true;
  const parts = path.split("/").filter(Boolean);
  if (parts[0] !== "integrations") return false;
  if (parts.length === 2) return CONNECTION_SOURCES.includes(parts[1]);
  return parts.length === 3 && Boolean(getConnection(parts[1], parts[2]));
}

/** The same graph drives routing, navigation and bounded sitemap batches. */
export function* connectionPaths(): Generator<string> {
  yield CONNECTION_ROOT;
  for (const source of CONNECTION_SOURCES) {
    yield connectionPath(source);
    for (const connection of connectionTargets(source)) yield connectionPath(source, connection.target);
  }
}
export function connectionCount() {
  return 1 + CONNECTION_SOURCES.reduce((count, source) => count + 1 + connectionTargets(source).length, 0);
}
export function connectionSlice(offset: number, limit: number): string[] {
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit <= 0) return [];
  const result: string[] = [];
  if (offset === 0) result.push(CONNECTION_ROOT); else offset--;
  for (const source of CONNECTION_SOURCES) {
    if (result.length === limit) break;
    const targets = connectionTargets(source);
    const blockSize = 1 + targets.length;
    if (offset >= blockSize) { offset -= blockSize; continue; }
    if (offset === 0) result.push(connectionPath(source));
    const start = Math.max(0, offset - 1);
    for (let index = start; index < targets.length && result.length < limit; index++) result.push(connectionPath(source, targets[index].target));
    offset = 0;
  }
  return result;
}
