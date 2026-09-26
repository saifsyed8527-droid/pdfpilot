import type { BaseContentEntity } from "./types";
import { DOCUMENT_TEMPLATES, documentTemplatePath, type DocumentTemplate } from "./document-templates";
export interface TemplateEntity extends BaseContentEntity { type: "template"; document: DocumentTemplate; downloadFileName: string; }
export const TEMPLATES: readonly TemplateEntity[] = DOCUMENT_TEMPLATES.map(document => ({
  type: "template", id: document.slug === "invoice-template" ? "template-invoice" : `template-${document.slug}`,
  slug: document.slug, path: documentTemplatePath(document), title: `Free ${document.name} PDF Template`, description: document.description,
  searchIntent: "transactional", difficulty: "beginner", document, downloadFileName: `${document.slug}.pdf`,
  related: [{ type: "tool", id: "tool-fill-pdf" }, { type: "tool", id: "tool-merge-pdf" }, ...DOCUMENT_TEMPLATES.filter(peer => peer.category === document.category && peer.slug !== document.slug).map(peer => ({ type: "template" as const, id: peer.slug === "invoice-template" ? "template-invoice" : `template-${peer.slug}` }))],
}));
export const getTemplate = (path: string) => TEMPLATES.find(template => template.path === path);
