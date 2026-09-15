import { describe, expect, it } from "vitest";
import { buildInfrastructureInfo, normalizeHeaders } from "./index.js";

describe("normalizeHeaders", () => {
  it("lower-cases header names but preserves values", () => {
    expect(normalizeHeaders({ "Cf-Ray": "abc-MXP", Server: "cloudflare" })).toEqual({
      "cf-ray": "abc-MXP",
      server: "cloudflare",
    });
  });
});

describe("buildInfrastructureInfo", () => {
  it("returns rawHeaders and empty collections for an empty response", () => {
    const info = buildInfrastructureInfo({});
    expect(info.cdn).toBeUndefined();
    expect(info.platform).toBeUndefined();
    expect(info.timing).toBeUndefined();
    expect(info.serverTimingRaw).toEqual([]);
    expect(info.genericProviders).toEqual([]);
  });

  it("assembles a full Cloudflare + Shopify response like the README example", () => {
    const info = buildInfrastructureInfo({
      server: "cloudflare",
      "cf-ray": "a3b69dd28bce4c46-MXP",
      "cf-cache-status": "DYNAMIC",
      "powered-by": "Shopify",
      "x-request-id": "491233dc-80f2-4ee9-ab11-d572587bf25c-1789464666",
      "x-dc": "gcp-europe-west1",
      "server-timing":
        'servedBy;desc="2plk", processing;dur=401, db;dur=65, db_async;dur=99, render;dur=152, compression;dur=21.754',
    });

    expect(info.cdn).toEqual({
      provider: "Cloudflare",
      edgeLocation: "MXP",
      cacheStatus: "DYNAMIC",
      rayId: "a3b69dd28bce4c46-MXP",
    });

    expect(info.platform).toEqual({
      provider: "Shopify",
      requestId: "491233dc-80f2-4ee9-ab11-d572587bf25c-1789464666",
      servingNode: "2plk",
      datacenters: ["gcp-europe-west1"],
    });

    expect(info.timing).toEqual({
      processing: 401,
      database: 65,
      asyncDatabase: 99,
      render: 152,
      compression: 21.754,
    });
  });

  it("falls back to a generic provider for the Overview when Cloudflare isn't present", () => {
    const info = buildInfrastructureInfo({ "x-amz-cf-id": "abc123" });
    expect(info.cdn?.provider).toBe("Amazon CloudFront");
    expect(info.genericProviders.map((p) => p.provider)).toContain("Amazon CloudFront");
  });

  it("never invents a value that wasn't present in headers", () => {
    const info = buildInfrastructureInfo({ "cf-ray": "a3b69dd28bce4c46-MXP" });
    expect(info.cdn?.cacheStatus).toBeUndefined();
    expect(info.platform).toBeUndefined();
  });
});
