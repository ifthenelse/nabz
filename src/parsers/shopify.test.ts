import { describe, expect, it } from "vitest";
import { parseShopify } from "./shopify.js";
import { parseServerTimingHeader } from "./serverTiming.js";

describe("parseShopify", () => {
  it("reports not detected when no Shopify headers are present", () => {
    const result = parseShopify({}, []);
    expect(result.detected).toBe(false);
  });

  it("detects via powered-by: Shopify", () => {
    const result = parseShopify({ "powered-by": "Shopify" }, []);
    expect(result.detected).toBe(true);
    expect(result.poweredBy).toBe("Shopify");
  });

  it("detects via a complexity score header even without powered-by", () => {
    const result = parseShopify({ "shopify-complexity-score": "12" }, []);
    expect(result.detected).toBe(true);
    expect(result.complexityScore).toBe("12");
  });

  it("extracts request id and datacenter, parsing a known cloud region", () => {
    const result = parseShopify(
      {
        "powered-by": "Shopify",
        "x-request-id": "491233dc-80f2-4ee9-ab11-d572587bf25c-1789464666",
        "x-dc": "gcp-europe-west1",
      },
      [],
    );
    expect(result.requestId).toBe("491233dc-80f2-4ee9-ab11-d572587bf25c-1789464666");
    expect(result.datacenter).toBe("gcp-europe-west1");
    expect(result.datacenterRegion).toBe("europe-west1");
  });

  it("does not guess a region from an unrecognized x-dc prefix", () => {
    const result = parseShopify({ "powered-by": "Shopify", "x-dc": "unknown-region-1" }, []);
    expect(result.datacenterRegion).toBeUndefined();
  });

  it("reads the serving node from a servedBy Server-Timing entry", () => {
    const metrics = parseServerTimingHeader('servedBy;desc="2plk"');
    const result = parseShopify({ "powered-by": "Shopify" }, metrics);
    expect(result.servingNode).toBe("2plk");
  });

  it("leaves servingNode undefined when no servedBy entry exists", () => {
    const result = parseShopify({ "powered-by": "Shopify" }, []);
    expect(result.servingNode).toBeUndefined();
  });
});
