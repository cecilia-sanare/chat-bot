export function number(value: number): number;
export function number(value: number | string | null | undefined, defaultValue: number): number;
export function number(value: number | string | null | undefined, defaultValue?: number | null): number | null;
export function number(value: number | string | null | undefined, defaultValue: number | null = null): number | null {
  if (value === undefined || value === null) return defaultValue;

  const number = Number(value);

  if (isNaN(number)) return defaultValue;

  return number;
}
