export function formatMs(value: number | undefined): string | undefined {
  if (value === undefined) return undefined;
  const rounded = Number.isInteger(value) ? value : Math.round(value * 1000) / 1000;
  return `${rounded} ms`;
}

export function truncateMiddle(value: string, max = 28): string {
  if (value.length <= max) return value;
  const half = Math.floor((max - 1) / 2);
  return `${value.slice(0, half)}…${value.slice(value.length - half)}`;
}
