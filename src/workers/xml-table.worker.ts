import { exportTable } from "../lib/engines/xml-table-engine";

self.onmessage = async ({ data }) => {
  try {
    self.postMessage({ result: await exportTable(data.data, data.options) });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error ? error.message : "Could not export this table.",
    });
  }
};
