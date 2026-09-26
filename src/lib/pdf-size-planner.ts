export const SIZE_UNITS = { KB: 1_000, MB: 1_000_000, MiB: 1_048_576 } as const;
export type SizeUnit = keyof typeof SIZE_UNITS;

export function planPdfSize(current: string, maximum: string, headroom: string, currentUnit: SizeUnit, maximumUnit: SizeUnit) {
  const values = [current, maximum, headroom];
  const [size, limit, margin] = values.map(Number);
  if (values.some(value => !value.trim()) || ![size, limit, margin].every(Number.isFinite) || size <= 0 || limit <= 0 || margin < 0 || margin >= 100) return null;
  const currentBytes = size * SIZE_UNITS[currentUnit];
  const targetBytes = limit * SIZE_UNITS[maximumUnit] * (1 - margin / 100);
  if (!Number.isFinite(currentBytes) || !Number.isFinite(targetBytes) || targetBytes <= 0) return null;
  return { target: targetBytes / SIZE_UNITS[maximumUnit], reduction: Math.max(0, (currentBytes - targetBytes) / currentBytes * 100), unit: maximumUnit };
}
