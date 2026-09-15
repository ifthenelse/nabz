/**
 * Short, human-written explanations (and, where a genuine canonical public
 * page exists, a link to it) for values the UI displays. Kept separate
 * from the parsers themselves and from render.ts: this is presentation
 * copy, not parsing logic, and having it in one place makes it easy to
 * audit which links are real vs. omitted on purpose.
 *
 * A missing `href` is deliberate, not an oversight - some fields (a
 * platform's internal request ID, a proprietary complexity score) have no
 * single authoritative public page describing that exact field, and this
 * extension does not fabricate links.
 */
export interface DocEntry {
  description: string;
  href?: string;
}

export const FIELD_DOCS: Record<string, DocEntry> = {
  "cdn.provider": {
    description:
      "Inferred from a combination of response headers (e.g. cf-ray, cf-cache-status, or the value of the server header) rather than one single field.",
  },
  "cdn.edgeLocation": {
    description:
      "The Cloudflare PoP (point of presence) that handled this request, parsed out of the cf-ray header's trailing airport code - it is not sent as its own header.",
    href: "https://developers.cloudflare.com/fundamentals/reference/cloudflare-ray-id/",
  },
  "cdn.rayId": {
    description:
      "A per-request identifier Cloudflare assigns as it passes through their network. Useful when contacting Cloudflare or origin support, but not guaranteed to be globally unique.",
    href: "https://developers.cloudflare.com/fundamentals/reference/cloudflare-ray-id/",
  },
  "cdn.cacheStatus": {
    description:
      "Whether Cloudflare served this response from cache, from the origin, or skipped caching - e.g. HIT, MISS, DYNAMIC, BYPASS, REVALIDATED.",
    href: "https://developers.cloudflare.com/cache/concepts/cache-responses/",
  },

  "platform.provider": {
    description:
      "Inferred from platform-specific response headers (e.g. powered-by: Shopify or a shopify-complexity-score header).",
  },
  "platform.servingNode": {
    description:
      "An identifier for the process or cache node that served the request, read from a Server-Timing entry. It is not necessarily a physical server - it may be a container, worker, or cache node - and Shopify does not publicly document its exact meaning.",
  },
  "platform.datacenter": {
    description:
      "The x-dc response header, naming the datacenter/region that handled this request. Not documented in detail publicly; the cloud-provider prefix (gcp-, aws-, azure-) is parsed out where recognized.",
  },
  "platform.requestId": {
    description:
      "A per-request identifier from the x-request-id response header, useful for correlating a request with platform/support logs.",
  },

  "timing.metric": {
    description:
      "One named metric from the Server-Timing response header. Metric names and meanings are defined by whichever backend sent them, not by the Server-Timing spec itself.",
    href: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Server-Timing",
  },

  "servertiming.cf": {
    description:
      "A Server-Timing entry whose name starts with \"cf\", suggesting it was added by Cloudflare. Cloudflare does not publish a full reference for these metric names.",
    href: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Server-Timing",
  },

  "generic.Fastly": {
    description:
      "Fastly identifies the cache node that served a request via X-Served-By, and whether it was a cache hit via X-Cache.",
    href: "https://www.fastly.com/documentation/reference/http/http-headers/X-Served-By/",
  },
  "generic.Akamai": {
    description:
      "Headers Akamai's edge network adds to indicate caching behavior and request handling. Akamai does not publish a full public reference for these specific header names.",
  },
  "generic.Amazon CloudFront": {
    description:
      "x-amz-cf-id is an opaque per-request trace ID; x-amz-cf-pop names the edge location (PoP) that handled the request, using an airport-code-style naming convention.",
  },
  "generic.Vercel": {
    description:
      "x-vercel-id identifies the region(s) the request was routed through; x-vercel-cache reports cache status (HIT, MISS, BYPASS, REVALIDATED).",
    href: "https://vercel.com/docs/headers/response-headers",
  },
  "generic.Netlify": {
    description:
      "x-nf-request-id is a per-request identifier used for correlating a request with Netlify's own logs, primarily when contacting Netlify support.",
  },
  "generic.Google Cloud (Cloud Run / GFE)": {
    description:
      "x-cloud-trace-context is Google's request-tracing header, used to correlate a request across Google Cloud services (e.g. Cloud Run, Google Front End).",
  },
};

export function docFor(key: string): DocEntry | undefined {
  return FIELD_DOCS[key];
}
