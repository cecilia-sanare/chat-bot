export function color(hex?: string): number | undefined {
  if (!hex) return undefined;

  const code = hex.startsWith('#') ? hex.substring(1) : hex;

  return parseInt(code, 16);
}
