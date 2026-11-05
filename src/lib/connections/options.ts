export type ConnectionOptions = { range: string; rotation: number; firstNumber: number; watermark: string; tableName: string; sheetName: string };
export const DEFAULT_CONNECTION_OPTIONS: ConnectionOptions = { range: "1", rotation: 90, firstNumber: 1, watermark: "DRAFT", tableName: "stock", sheetName: "" };
export const CONNECTION_FILE_LIMIT = 4 * 1024 * 1024;

