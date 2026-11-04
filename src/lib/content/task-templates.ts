import templates from "./task-templates.json";
import { TOOLS } from "../tools";

export const TASK_ROOT = "/templates/tasks";
export type TaskTemplate = (typeof templates)[number];
export const TASK_TEMPLATES: readonly TaskTemplate[] = templates;
export const taskPath = (task: TaskTemplate) => TASK_ROOT + "/" + task.slug;
const bySlug = new Map(templates.map(task => [task.slug, task]));
const byTool = new Map(templates.map(task => [task.tool, task]));
export const getTaskTemplate = (slug: string) => bySlug.get(slug);
export const taskForTool = (tool: string) => byTool.get(tool);
export function relatedTasks(task: TaskTemplate) {
  const incoming = templates.filter(candidate => candidate.nextTool === task.tool && candidate.tool !== task.nextTool);
  return [byTool.get(task.nextTool), ...incoming].filter(item => item !== undefined).slice(0, 4);
}
const publicTools = new Set(TOOLS.map(tool => tool.slug));
if (bySlug.size !== templates.length || byTool.size !== templates.length ||
    templates.some(task => !publicTools.has(task.tool) || !publicTools.has(task.nextTool))) {
  throw new Error("Task templates require unique slugs and working public tools.");
}
