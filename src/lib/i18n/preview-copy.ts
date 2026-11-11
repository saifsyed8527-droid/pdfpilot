import it from "./preview/it.json";
import zh_TW from "./preview/zh-TW.json";
import bg from "./preview/bg.json";
import ca from "./preview/ca.json";
import nl from "./preview/nl.json";
import el from "./preview/el.json";
import ms from "./preview/ms.json";
import pl from "./preview/pl.json";
import sv from "./preview/sv.json";
import th from "./preview/th.json";
import tr from "./preview/tr.json";
import uk from "./preview/uk.json";
import vi from "./preview/vi.json";
import sw from "./preview/sw.json";
const data = {"it":it,"zh-TW":zh_TW,"bg":bg,"ca":ca,"nl":nl,"el":el,"ms":ms,"pl":pl,"sv":sv,"th":th,"tr":tr,"uk":uk,"vi":vi,"sw":sw};
type Code = keyof typeof data;
type Copy = typeof data.it;
export function previewTable<K extends keyof Copy>(key: K): Record<Code, Copy[K]> {
 return Object.fromEntries(Object.entries(data).map(([locale, copy]) => [locale, copy[key]])) as Record<Code, Copy[K]>;
}
export function previewRows(key: "TOOL_NAMES" | "UI_ROWS" | "HOME_ROWS" | "WORKSPACE_ROWS" | "CONVERSION_UI_ROWS" | "SUMMARIES"): Record<Code,string> {
 return Object.fromEntries(Object.entries(data).map(([locale, copy]) => [locale, copy[key].join("|")])) as Record<Code,string>;
}
