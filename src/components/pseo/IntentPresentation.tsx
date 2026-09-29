"use client";
import { createContext, useContext, type ReactNode } from "react";

/** Presentation only: never changes acceptance, controls, state or processing options. */
const IntentContext = createContext<{ title: string; description: string; privacy: string } | null>(null);
export const useIntentPresentation = () => useContext(IntentContext);
export function IntentPresentation({ title, description, privacy, children }: { title: string; description: string; privacy: string; children: ReactNode }) {
  return <IntentContext.Provider value={{ title, description, privacy }}>{children}</IntentContext.Provider>;
}
