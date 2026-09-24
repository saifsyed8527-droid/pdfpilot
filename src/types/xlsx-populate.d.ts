declare module "xlsx-populate/browser/xlsx-populate.min.js" {
  const XlsxPopulate: {
    fromDataAsync(data: Uint8Array, options: { password: string }): Promise<{
      outputAsync(options: { type: "uint8array"; password?: string }): Promise<Uint8Array<ArrayBuffer>>;
    }>;
  };
  export default XlsxPopulate;
}
