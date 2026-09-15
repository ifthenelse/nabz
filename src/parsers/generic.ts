import type { GenericProviderMatch } from "./types.js";

interface Detector {
  provider: string;
  /** Header names (lower-case) that, if present, are evidence for this provider. */
  signals: string[];
  /** Extra check beyond header presence, e.g. matching a `server`/`via` value. */
  extra?: (headers: Record<string, string>) => boolean;
  /** Header names worth surfacing verbatim when this provider is detected. */
  detailHeaders: string[];
}

const DETECTORS: Detector[] = [
  {
    provider: "Fastly",
    signals: ["x-served-by", "x-fastly-request-id", "fastly-debug-digest"],
    detailHeaders: ["x-served-by", "x-cache", "x-cache-hits", "x-fastly-request-id"],
  },
  {
    provider: "Akamai",
    signals: ["akamai-x-cache", "akamai-x-cache-on", "x-akamai-transformed", "akamai-grn"],
    extra: (h) => /akamai/i.test(h["server"] ?? ""),
    detailHeaders: ["akamai-x-cache", "x-akamai-transformed", "akamai-grn"],
  },
  {
    provider: "Amazon CloudFront",
    signals: ["x-amz-cf-id", "x-amz-cf-pop"],
    extra: (h) => /cloudfront/i.test(h["via"] ?? ""),
    detailHeaders: ["x-amz-cf-id", "x-amz-cf-pop", "x-cache"],
  },
  {
    provider: "Vercel",
    signals: ["x-vercel-id", "x-vercel-cache"],
    extra: (h) => /vercel/i.test(h["server"] ?? ""),
    detailHeaders: ["x-vercel-id", "x-vercel-cache"],
  },
  {
    provider: "Netlify",
    signals: ["x-nf-request-id"],
    extra: (h) => /netlify/i.test(h["server"] ?? ""),
    detailHeaders: ["x-nf-request-id"],
  },
  {
    provider: "Google Cloud (Cloud Run / GFE)",
    signals: ["x-cloud-trace-context"],
    extra: (h) => /google frontend|gfe/i.test(h["server"] ?? ""),
    detailHeaders: ["x-cloud-trace-context"],
  },
];

/**
 * Detects generic CDN/hosting signatures beyond Cloudflare and Shopify.
 * Detection is signature-based only - if a provider adds/removes headers,
 * this simply stops (or starts) matching. Nothing is inferred beyond what
 * the response headers literally contain.
 */
export function detectGenericProviders(headers: Record<string, string>): GenericProviderMatch[] {
  const matches: GenericProviderMatch[] = [];

  for (const detector of DETECTORS) {
    const evidence = detector.signals.filter((s) => headers[s] !== undefined);
    const extraMatch = detector.extra?.(headers) ?? false;

    if (evidence.length === 0 && !extraMatch) continue;

    const details: Record<string, string> = {};
    for (const h of detector.detailHeaders) {
      const value = headers[h];
      if (value !== undefined) details[h] = value;
    }

    matches.push({ provider: detector.provider, evidence, details });
  }

  return matches;
}
