import type { InfrastructureInfo, ServerTimingExtras } from "./types.js";
import { parseServerTimingHeader, findMetric } from "./serverTiming.js";
import { parseCloudflare } from "./cloudflare.js";
import { parseShopify } from "./shopify.js";
import { detectGenericProviders } from "./generic.js";

export * from "./types.js";
export { parseServerTimingHeader, findMetric } from "./serverTiming.js";
export { parseCloudflare } from "./cloudflare.js";
export { parseShopify, parseDatacenterRegion } from "./shopify.js";
export { detectGenericProviders } from "./generic.js";
export { docFor, FIELD_DOCS } from "./docs.js";
export type { DocEntry } from "./docs.js";

/** Lower-cases header names so lookups are case-insensitive and consistent. */
export function normalizeHeaders(headers: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = value;
  }
  return normalized;
}

function numberOrUndefined(n: number | undefined): number | undefined {
  return typeof n === "number" && !Number.isNaN(n) ? n : undefined;
}

/**
 * Builds the normalized InfrastructureInfo from a raw header map. This is
 * the single entry point the UI/background layers should call - it never
 * touches chrome.* APIs and has no side effects, so it's fully unit
 * testable in isolation.
 */
export function buildInfrastructureInfo(rawHeaders: Record<string, string>): InfrastructureInfo {
  const headers = normalizeHeaders(rawHeaders);
  const serverTimingRaw = parseServerTimingHeader(headers["server-timing"]);

  const cf = parseCloudflare(headers, serverTimingRaw);
  const shop = parseShopify(headers, serverTimingRaw);
  const generic = detectGenericProviders(headers);

  const info: InfrastructureInfo = {
    rawHeaders: headers,
    serverTimingRaw,
    genericProviders: generic,
  };

  if (cf.detected) {
    info.cdn = {
      provider: "Cloudflare",
      edgeLocation: cf.edgeLocation,
      cacheStatus: cf.cacheStatus,
      rayId: cf.rayId,
    };
  } else if (generic.length > 0) {
    // Fall back to the first generic CDN-ish match so the Overview section
    // isn't empty when a non-Cloudflare CDN is present.
    const first = generic[0];
    if (first) {
      info.cdn = { provider: first.provider };
    }
  }

  if (shop.detected) {
    info.platform = {
      provider: "Shopify",
      requestId: shop.requestId,
      servingNode: shop.servingNode,
      datacenters: shop.datacenter ? [shop.datacenter] : undefined,
    };
  }

  const processing = findMetric(serverTimingRaw, "processing");
  const db = findMetric(serverTimingRaw, "db");
  const dbAsync = findMetric(serverTimingRaw, "db_async");
  const render = findMetric(serverTimingRaw, "render");
  const compression = findMetric(serverTimingRaw, "compression");

  if (processing || db || dbAsync || render || compression) {
    info.timing = {
      processing: numberOrUndefined(processing?.duration),
      database: numberOrUndefined(db?.duration),
      asyncDatabase: numberOrUndefined(dbAsync?.duration),
      render: numberOrUndefined(render?.duration),
      compression: numberOrUndefined(compression?.duration),
    };
  }

  const extras: ServerTimingExtras = {
    edge: findMetric(serverTimingRaw, "edge")?.description,
    country: findMetric(serverTimingRaw, "country")?.description,
    asn: findMetric(serverTimingRaw, "asn")?.description,
    theme: findMetric(serverTimingRaw, "theme")?.description,
    pageType: findMetric(serverTimingRaw, "pageType")?.description,
  };
  if (Object.values(extras).some((v) => v !== undefined)) {
    info.serverTimingExtras = extras;
  }

  return info;
}
