import { convertExcel, inspectExcel, type ExcelOptions } from "../lib/engines/excel-conversion-engine";

self.onmessage = async (event: MessageEvent<{ type: "inspect" | "convert"; file: File; options: ExcelOptions }>) => {
  try {
    const { type, file, options } = event.data;
    const result = type === "inspect" ? await inspectExcel(file, options.password) : await convertExcel(file, options, (progress) => self.postMessage({ type: "progress", progress }));
    self.postMessage({ type: "result", result });
  } catch (error) {
    self.postMessage({ type: "error", error: error instanceof Error ? error.message : "Could not read this workbook." });
  }
};
