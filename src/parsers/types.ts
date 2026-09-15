/**
 * Normalized, provider-agnostic representation of what a document response's
 * headers reveal about the serving infrastructure. UI code must depend only
 * on these shapes, never on raw Cloudflare/Shopify/etc. header names.
 */

export interface ServerTimingMetric {
  /** Metric name exactly as sent, e.g. "db_async" */
  name: string;
  /** Duration in milliseconds, if the metric carried a `dur` param. */
  duration?: number;
  /** Free-text description from the `desc` param, if present. */
  description?: string;
}

export interface CdnInfo {
  provider?: string;
  requestId?: string;
  /** Parsed PoP / edge location code (e.g. "MXP"), not the raw ray/id string. */
  edgeLocation?: string;
  cacheStatus?: string;
  /** Cloudflare-specific: the raw `cf-ray` value (hash-pop). */
  rayId?: string;
}

export interface PlatformInfo {
  provider?: string;
  requestId?: string;
  /**
   * An identifier for the process/node that served the request. This is
   * explicitly NOT guaranteed to be a physical server - it may be a
   * container, worker, or cache node. Never label it "Server" in the UI.
   */
  servingNode?: string;
  datacenters?: string[];
}

export interface TimingInfo {
  processing?: number;
  database?: number;
  asyncDatabase?: number;
  render?: number;
  compression?: number;
}

/** Known Server-Timing metrics that don't map onto cdn/platform/timing shapes. */
export interface ServerTimingExtras {
  edge?: string;
  country?: string;
  asn?: string;
  theme?: string;
  pageType?: string;
}

export interface GenericProviderMatch {
  provider: string;
  /** Header names that triggered detection - evidence, not proof. */
  evidence: string[];
  /** A few raw, unparsed values worth surfacing verbatim. */
  details: Record<string, string>;
}

export interface InfrastructureInfo {
  cdn?: CdnInfo;
  platform?: PlatformInfo;
  timing?: TimingInfo;
  serverTimingExtras?: ServerTimingExtras;
  /** Full structured parse of the Server-Timing header, in header order. */
  serverTimingRaw: ServerTimingMetric[];
  /** Other CDN/hosting providers detected from generic header signatures. */
  genericProviders: GenericProviderMatch[];
  /** Header names are lower-cased; values are exactly as received. */
  rawHeaders: Record<string, string>;
}

/** How confident/direct a displayed value is. Used by the UI to label things honestly. */
export type ValueKind = "observed" | "parsed" | "inferred";

export interface CaptureMeta {
  url: string;
  tabId: number;
  timestamp: number;
  statusCode: number;
}

export interface Capture {
  meta: CaptureMeta;
  info: InfrastructureInfo;
}
