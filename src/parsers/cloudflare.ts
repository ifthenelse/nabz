import type { ServerTimingMetric } from "./types.js";

export interface CloudflareParseResult {
  detected: boolean;
  server?: string;
  /** Raw `cf-ray` value, e.g. "7d1a2b3c4d5e6f70-MXP". */
  rayId?: string;
  /** PoP / edge location code parsed out of cf-ray, e.g. "MXP". */
  edgeLocation?: string;
  cacheStatus?: string;
  /** Server-Timing entries whose name looks Cloudflare-specific (cf* prefix). */
  serverTimingEntries: ServerTimingMetric[];
}

/**
 * A cf-ray value is `<16-hex-char hash>-<PoP airport code>`, optionally
 * with a trailing environment suffix (e.g. "-DEV" in local dev). We only
 * ever report the PoP code we can actually read out of it - we never guess
 * a location from anything else.
 */
function parseRayId(rayId: string): string | undefined {
  const match = /^[0-9a-f]{8,20}-([A-Z]{3,4})(?:-[A-Z]+)?$/i.exec(rayId.trim());
  return match?.[1]?.toUpperCase();
}

export function parseCloudflare(
  headers: Record<string, string>,
  serverTiming: ServerTimingMetric[],
): CloudflareParseResult {
  const server = headers["server"];
  const rayId = headers["cf-ray"];
  const cacheStatus = headers["cf-cache-status"];

  const detected =
    Boolean(rayId) || Boolean(cacheStatus) || (server ?? "").toLowerCase() === "cloudflare";

  const serverTimingEntries = serverTiming.filter((m) => /^cf/i.test(m.name));

  return {
    detected,
    server,
    rayId,
    edgeLocation: rayId ? parseRayId(rayId) : undefined,
    cacheStatus,
    serverTimingEntries,
  };
}
