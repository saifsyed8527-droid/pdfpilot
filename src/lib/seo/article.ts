import { SITE_URL } from "./constants";

export interface ArticleSchema {
  "@context": "https://schema.org";
  "@type": "Article";
  headline: string;
  description: string;
  url: string;
}

export interface ArticleInput {
  title: string;
  description: string;
  path: string;
}

export function getArticleSchema({ title, description, path }: ArticleInput): ArticleSchema {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url: `${SITE_URL}${path}`,
  };
}
