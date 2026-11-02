/* Local PDF password processing. A fresh worker is terminated after each file. */
"use strict";
importScripts("./qpdf-core.js", "./password-core.js");
self.onmessage = async ({ data }) => {
  try {
    self.postMessage({
      type: "progress",
      percent: 3,
      message: "Loading PDF encryption engine…",
    });
    const response = await fetch("./qpdf-core.wasm", {
      credentials: "same-origin",
    });
    if (!response.ok)
      throw new Error(
        "The PDF engine could not load. Check your connection and retry.",
      );
    const result = await self.PdfPilotPasswordCore.transform(
      createQpdfCore,
      new Uint8Array(await response.arrayBuffer()),
      new Uint8Array(data.bytes),
      data.options,
      (percent, message) =>
        self.postMessage({ type: "progress", percent, message }),
    );
    self.postMessage({ type: "result", result }, [result.bytes.buffer]);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "This PDF could not be processed.";
    self.postMessage({
      type: "error",
      message:
        /out of memory|memory access|Aborted|unreachable|WebAssembly|too complex/i.test(
          message,
        )
          ? "This PDF is too large or complex for this browser. Try a smaller document or another current browser."
          : message,
    });
  }
};
