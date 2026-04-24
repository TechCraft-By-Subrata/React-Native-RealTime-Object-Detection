export function withAlpha(hex: string, alpha: number): string {
  const sanitized = hex.replace('#', '');
  if (sanitized.length !== 6) {
    return `rgba(77,195,255,${alpha})`;
  }

  const r = Number.parseInt(sanitized.slice(0, 2), 16);
  const g = Number.parseInt(sanitized.slice(2, 4), 16);
  const b = Number.parseInt(sanitized.slice(4, 6), 16);

  return `rgba(${r},${g},${b},${alpha})`;
}
