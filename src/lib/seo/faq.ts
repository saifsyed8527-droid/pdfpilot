export interface FaqInput {
  question: string;
  answer: string;
}

export interface FaqQuestion {
  "@type": "Question";
  name: string;
  acceptedAnswer: {
    "@type": "Answer";
    text: string;
  };
}

export interface FaqPageSchema {
  "@context": "https://schema.org";
  "@type": "FAQPage";
  mainEntity: FaqQuestion[];
  inLanguage?: string;
}

export function getFaqSchema(faqs: FaqInput[], inLanguage?: string): FaqPageSchema {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
    ...(inLanguage ? { inLanguage } : {}),
  };
}
