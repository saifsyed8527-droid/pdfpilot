/** Identify embedded content by its bytes, not the Office relationship suffix. */
export function rasterFormat(
  bytes: Uint8Array,
): "png" | "jpeg" | "gif" | "bmp" | "webp" | null {
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v))
    return "png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpeg";
  if (bytes[0] === 71 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 56)
    return "gif";
  if (bytes[0] === 66 && bytes[1] === 77) return "bmp";
  if (
    bytes[0] === 82 &&
    bytes[1] === 73 &&
    bytes[2] === 70 &&
    bytes[3] === 70 &&
    bytes[8] === 87 &&
    bytes[9] === 69 &&
    bytes[10] === 66 &&
    bytes[11] === 80
  )
    return "webp";
  return null;
}

export function checkPptxArchiveEntry(
  name: string,
  size: number,
  count: number,
  expanded: number,
) {
  if (
    !Number.isSafeInteger(size) ||
    size < 0 ||
    count > 25000 ||
    expanded > 384 * 1024 * 1024 ||
    size > 64 * 1024 * 1024 ||
    name.startsWith("/") ||
    name.split("/").includes("..")
  ) {
    throw new Error(
      "This presentation is too large or unsafe to unpack in your browser. Save a fresh PPTX copy or split it into smaller files.",
    );
  }
}
