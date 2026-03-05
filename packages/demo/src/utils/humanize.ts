const MINUTE = 60;
const HOUR = 60 * 60;

export function humanizeDuration(value?: number): string | undefined {
  if (!value) return undefined;

  const seconds = (value % HOUR) % MINUTE;
  const minutes = ((value % HOUR) - seconds) / MINUTE;
  const hours = (value - minutes * 60 - seconds) / HOUR;

  const output: string[] = [];

  if (hours) {
    output.push(`${hours}h`);
  }

  if (minutes) {
    output.push(`${minutes}m`);
  }

  if (seconds) {
    output.push(`${seconds}s`);
  }

  return output.join(' ') || undefined;
}
