import type { LocaleCode } from "../i18n/locales";
import { nextObjectId, type DrawObject } from "./types";

export type FormMark = "check" | "cross";
/** Toolbar label, printable check, printable cross, editable date. */
export const FORM_MARK_LABELS: Record<LocaleCode, readonly [string, string, string, string]> = {
  en: ["Form marks", "Check mark", "Cross mark", "Date"],
  es: ["Marcas del formulario", "Marca de verificación", "Cruz", "Fecha"],
  "pt-BR": ["Marcas do formulário", "Marca de seleção", "Cruz", "Data"],
  de: ["Formularzeichen", "Häkchen", "Kreuz", "Datum"],
  fr: ["Marques de formulaire", "Coche", "Croix", "Date"],
  hi: ["फ़ॉर्म के निशान", "सही का निशान", "क्रॉस का निशान", "तारीख"],
  id: ["Tanda formulir", "Tanda centang", "Tanda silang", "Tanggal"],
  "zh-CN": ["表单标记", "对勾", "叉号", "日期"],
  ja: ["フォームの記号", "チェックマーク", "バツ印", "日付"],
  ko: ["양식 기호", "체크 표시", "가위표", "날짜"],
  ar: ["علامات النموذج", "علامة صح", "علامة خطأ", "التاريخ"],
  ru: ["Отметки формы", "Галочка", "Крестик", "Дата"],
};

/** Use vector strokes so a mark can be printed, resized and recolored,
 * including on a scanned form with no interactive fields or embedded fonts. */
export function createFormMark(kind: FormMark, pageWidth: number, pageHeight: number, color: string): DrawObject {
  const size = Math.min(29, pageWidth * 0.8, pageHeight * 0.8);
  const width = size, height = kind === "check" ? size * 0.75 : size;
  const strokes = kind === "check"
    ? [[{x:0,y:0.48},{x:0.33,y:1},{x:1,y:0}]]
    : [[{x:0,y:0},{x:1,y:1}],[{x:1,y:0},{x:0,y:1}]];
  return {
    id: nextObjectId(), type: "draw", kind, strokes, points: strokes.flat(), strokeColor: color,
    strokeWidth: Math.min(2.4, size / 9), width, height, x: (pageWidth - width) / 2, y: (pageHeight - height) / 2,
    rotation: 0, zIndex: 0,
  };
}
