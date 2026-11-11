import type { WorkspaceDictionary } from "./workspace-text";
const loaders: Record<string, () => Promise<{ default: WorkspaceDictionary }>> = {
  "it": () => import("./workspaces/it.json"),
  "zh-TW": () => import("./workspaces/zh-TW.json"),
  "bg": () => import("./workspaces/bg.json"),
  "ca": () => import("./workspaces/ca.json"),
  "nl": () => import("./workspaces/nl.json"),
  "el": () => import("./workspaces/el.json"),
  "ms": () => import("./workspaces/ms.json"),
  "pl": () => import("./workspaces/pl.json"),
  "sv": () => import("./workspaces/sv.json"),
  "th": () => import("./workspaces/th.json"),
  "tr": () => import("./workspaces/tr.json"),
  "uk": () => import("./workspaces/uk.json"),
  "vi": () => import("./workspaces/vi.json"),
  "sw": () => import("./workspaces/sw.json"),
};
export async function workspaceDictionary(locale: string): Promise<WorkspaceDictionary> {
  return loaders[locale] ? (await loaders[locale]()).default : {};
}
