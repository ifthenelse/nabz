import { describe, expect, it } from "vitest";
import { parseCloudflare } from "./cloudflare.js";
import { parseServerTimingHeader } from "./serverTiming.js";

describe("parseCloudflare", () => {
  it("reports not detected when no Cloudflare headers are present", () => {
    const result = parseCloudflare({}, []);
    expect(result.detected).toBe(false);
    expect(result.edgeLocation).toBeUndefined();
  });

  it("detects via cf-ray and parses the PoP code out of it", () => {
    const result = parseCloudflare({ "cf-ray": "a3b69dd28bce4c46-MXP" }, []);
    expect(result.detected).toBe(true);
    expect(result.rayId).toBe("a3b69dd28bce4c46-MXP");
    expect(result.edgeLocation).toBe("MXP");
  });

  it("detects via cf-cache-status alone", () => {
    const result = parseCloudflare({ "cf-cache-status": "DYNAMIC" }, []);
    expect(result.detected).toBe(true);
    expect(result.cacheStatus).toBe("DYNAMIC");
  });

  it("detects via server: cloudflare", () => {
    const result = parseCloudflare({ server: "cloudflare" }, []);
    expect(result.detected).toBe(true);
  });

  it("does not fabricate an edge location from a malformed cf-ray", () => {
    const result = parseCloudflare({ "cf-ray": "not-a-ray-id-format-123" }, []);
    expect(result.detected).toBe(true);
    expect(result.edgeLocation).toBeUndefined();
  });

  it("filters server-timing entries to cf-prefixed ones only", () => {
    const metrics = parseServerTimingHeader(
      "cfRequestDuration;dur=12, processing;dur=401, cfCacheStatus;desc=HIT",
    );
    const result = parseCloudflare({ "cf-ray": "abc123-MXP" }, metrics);
    expect(result.serverTimingEntries.map((m) => m.name)).toEqual([
      "cfRequestDuration",
      "cfCacheStatus",
    ]);
  });
});
