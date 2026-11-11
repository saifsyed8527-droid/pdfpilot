"use client";
import { useWorkspaceText, UiText } from "@/components/i18n/WorkspaceText";

import { useId, useState } from "react";
import { OCR_LANGUAGES } from "@/lib/engines/ocr-options";
export function OcrLanguagePicker({
  value,
  onChange,
  disabled = false,
  primary = false,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  const __copy = useWorkspaceText();
  const [search, setSearch] = useState("");
  const id = useId();
  const matching = OCR_LANGUAGES.filter(([code, label]) =>
    `${code} ${<UiText text={label} />}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <fieldset disabled={disabled} className="space-y-3">
      <legend className="mb-2 text-sm font-semibold">
        {""}<UiText text={"Document languages · choose 1–3"} />{" "}</legend>
      <div className="flex flex-wrap gap-2">
        {value.map((code) => (
          <button
            type="button"
            key={code}
            onClick={() => onChange(value.filter((item) => item !== code))}
            className="rounded-full border bg-muted px-3 py-2 text-xs"
            aria-label={__copy("Remove {0}", [OCR_LANGUAGES.find(([id]) => id === code)?.[1]])}
          >
            {OCR_LANGUAGES.find(([id]) => id === code)?.[1]} ×
          </button>
        ))}
      </div>
      {primary && value.length > 1 && (
        <label className="block text-sm font-semibold">
          {""}<UiText text={"Primary language"} />{" "}<select
            aria-label={__copy("Primary language")}
            className="mt-2 h-10 w-full rounded-lg border bg-background px-3 font-normal"
            value={value[0]}
            onChange={(event) =>
              onChange([
                event.target.value,
                ...value.filter((code) => code !== event.target.value),
              ])
            }
          >
            {value.map((code) => (
              <option key={code} value={code}>
                {OCR_LANGUAGES.find(([id]) => id === code)?.[1]}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            {""}<UiText text={"Choose the main language of the selected pages. English can help with Latin words and numbers."} />{" "}</span>
        </label>
      )}
      <label htmlFor={id} className="sr-only">
        {""}<UiText text={"Find a document language"} />{" "}</label>
      <input
        id={id}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={__copy("Find a language…")}
        className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
      />
      <div className="max-h-36 space-y-1 overflow-auto rounded-xl border p-2">
        {matching.map(([code, label]) => (
          <label
            key={code}
            className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted"
          >
            <input
              type="checkbox"
              checked={value.includes(code)}
              disabled={
                disabled || (!value.includes(code) && value.length >= 3)
              }
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...value, code]
                    : value.filter((item) => item !== code),
                )
              }
            />
            <span dir="auto">{<UiText text={label} />}</span>
          </label>
        ))}
        {!matching.length && (
          <p className="p-2 text-sm text-muted-foreground">
            {""}<UiText text={"No matching language."} />{" "}</p>
        )}
      </div>
    </fieldset>
  );
}
