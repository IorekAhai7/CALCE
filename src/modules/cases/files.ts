export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export function detectMime(bytes: Uint8Array): string | null {
  const starts = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "image/png";
  if (
    starts([0x52, 0x49, 0x46, 0x46]) &&
    [0x57, 0x45, 0x42, 0x50].every((b, i) => bytes[i + 8] === b)
  )
    return "image/webp";
  return null;
}
export function safeFilename(name: string) {
  return (
    name
      .replace(/[\x00-\x1f\x7f/\\]/g, "_")
      .trim()
      .slice(0, 180) || "documento"
  );
}
