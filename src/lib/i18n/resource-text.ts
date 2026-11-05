export type ResourceDictionary = Record<string, string>;
export function resourceText(dictionary: ResourceDictionary, value: string): string {
  const key = value.replace(/\s+/g, ' ').trim();
  if (/^[^\s/\\]+\.(pdf|docx?|pptx?|xlsx?|csv|tsv|txt|md|json|xml|ya?ml|sql|html?|png|jpe?g|svg|webp|heic|zip)$/i.test(key)) return value;
  const translated = dictionary[key];
  return translated ? value.replace(/\S[\s\S]*\S|\S/, () => translated) : value;
}
