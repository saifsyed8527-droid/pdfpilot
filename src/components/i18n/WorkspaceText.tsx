"use client";
import { createContext, useCallback, useContext, type ReactNode } from "react";
import { uiText } from "@/lib/i18n/ui-copy";
import type { LocaleCode } from "@/lib/i18n/locales";
import { translateWorkspaceText, type WorkspaceDictionary } from "@/lib/i18n/workspace-text";
const WorkspaceContext = createContext<{ locale: LocaleCode; words: WorkspaceDictionary }>({ locale: "en", words: {} });
export function WorkspaceLocaleProvider({ locale, words, children }: { locale: LocaleCode; words: WorkspaceDictionary; children: ReactNode }) {
  return <WorkspaceContext.Provider value={{ locale, words }}>{children}</WorkspaceContext.Provider>;
}
export function useWorkspaceText() {
  const { locale, words } = useContext(WorkspaceContext);
  return useCallback((text: string, values: readonly unknown[] = []) => {
    const shared = uiText(locale, text);
    return translateWorkspaceText(words, shared !== text ? shared : text, values);
  }, [locale, words]);
}
/** Text only: no markup, layout changes, document traversal or runtime network requests. */
export function UiText({ text, values }: { text: string | number; values?: readonly unknown[] }) {
  return useWorkspaceText()(String(text), values);
}
