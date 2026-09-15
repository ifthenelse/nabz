import type { ServerTimingMetric } from "./types.js";

/**
 * Splits a Server-Timing header value into its comma-separated metric
 * entries, respecting commas that appear inside a quoted `desc="..."`
 * param. Per RFC 8996 / the Server-Timing spec, entries look like:
 *
 *   name;dur=123.4;desc="quoted, text", name2;dur=5
 */
function splitEntries(value: string): string[] {
  const entries: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of value) {
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === "," && !inQuotes) {
      entries.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim().length > 0) {
    entries.push(current);
  }
  return entries;
}

function parseEntry(entry: string): ServerTimingMetric | undefined {
  const parts = entry.split(";").map((p) => p.trim()).filter(Boolean);
  const name = parts[0];
  if (!name) return undefined;

  const metric: ServerTimingMetric = { name };

  for (const part of parts.slice(1)) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    let raw = part.slice(eq + 1).trim();
    if (raw.startsWith('"') && raw.endsWith('"')) {
      raw = raw.slice(1, -1);
    }
    if (key === "dur") {
      const dur = Number.parseFloat(raw);
      if (!Number.isNaN(dur)) metric.duration = dur;
    } else if (key === "desc") {
      metric.description = raw;
    }
  }

  return metric;
}

/**
 * Parses a raw `Server-Timing` header value into structured metrics.
 * Returns an empty array for an empty/missing header - it never guesses.
 */
export function parseServerTimingHeader(headerValue: string | undefined): ServerTimingMetric[] {
  if (!headerValue || headerValue.trim().length === 0) return [];

  return splitEntries(headerValue)
    .map(parseEntry)
    .filter((m): m is ServerTimingMetric => m !== undefined);
}

/** Case-insensitive lookup of a single metric by name. */
export function findMetric(
  metrics: ServerTimingMetric[],
  name: string,
): ServerTimingMetric | undefined {
  const lower = name.toLowerCase();
  return metrics.find((m) => m.name.toLowerCase() === lower);
}
