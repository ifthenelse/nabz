import type { ServerTimingMetric } from "./types.js";
import { findMetric } from "./serverTiming.js";

export interface ShopifyParseResult {
  detected: boolean;
  poweredBy?: string;
  requestId?: string;
  /** Raw `x-dc` value, e.g. "gcp-europe-west1". */
  datacenter?: string;
  /** Cloud region parsed out of x-dc, e.g. "europe-west1". Undefined if the
   * prefix isn't a recognized cloud provider marker - we don't guess. */
  datacenterRegion?: string;
  complexityScore?: string;
  complexityScoreV2?: string;
  /**
   * Best-effort serving node identifier, read from a `servedBy`-style
   * Server-Timing entry when present. This is explicitly NOT a physical
   * server - see PlatformInfo.servingNode.
   */
  servingNode?: string;
}

const KNOWN_DC_PREFIXES = ["gcp", "aws", "azure", "gce"];

export function parseDatacenterRegion(dc: string): string | undefined {
  const [prefix, ...rest] = dc.split("-");
  if (!prefix || rest.length === 0) return undefined;
  if (!KNOWN_DC_PREFIXES.includes(prefix.toLowerCase())) return undefined;
  return rest.join("-");
}

export function parseShopify(
  headers: Record<string, string>,
  serverTiming: ServerTimingMetric[],
): ShopifyParseResult {
  const poweredBy = headers["powered-by"];
  const complexityScore = headers["shopify-complexity-score"];
  const complexityScoreV2 = headers["shopify-complexity-score-v2"];

  const detected =
    /shopify/i.test(poweredBy ?? "") || Boolean(complexityScore) || Boolean(complexityScoreV2);

  const datacenter = headers["x-dc"];
  const servedByMetric = findMetric(serverTiming, "servedBy") ?? findMetric(serverTiming, "served-by");

  return {
    detected,
    poweredBy,
    requestId: headers["x-request-id"],
    datacenter,
    datacenterRegion: datacenter ? parseDatacenterRegion(datacenter) : undefined,
    complexityScore,
    complexityScoreV2,
    servingNode: servedByMetric?.description,
  };
}
