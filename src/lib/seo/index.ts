export { getOrganizationSchema } from "./organization";
export type { OrganizationSchema } from "./organization";

export { getWebSiteSchema } from "./website";
export type { WebSiteSchema } from "./website";

export { getSoftwareApplicationSchema } from "./software";
export type { SoftwareApplicationSchema, SoftwareApplicationInput } from "./software";

export * from "./constants";
export type { SchemaReference } from "./types";

export { TOOL_SEO_REGISTRY, getToolSeo } from "./tool-registry";
export type { ToolSeoEntry } from "./tool-registry";

export { getBreadcrumbSchema } from "./breadcrumb";
export type {
  BreadcrumbListSchema,
  BreadcrumbListItem,
  BreadcrumbItemInput,
} from "./breadcrumb";

export { getFaqSchema } from "./faq";
export type { FaqPageSchema, FaqQuestion, FaqInput } from "./faq";

export { getArticleSchema } from "./article";
export type { ArticleSchema, ArticleInput } from "./article";

export { getCollectionPageSchema } from "./collection";
export type { CollectionPageSchema, CollectionItem, CollectionPageInput } from "./collection";

export { getHowToSchema } from "./howto";
export type { HowToSchema, HowToStep, HowToInput } from "./howto";
