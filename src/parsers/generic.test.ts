import { describe, expect, it } from "vitest";
import { detectGenericProviders } from "./generic.js";

describe("detectGenericProviders", () => {
  it("returns an empty list when nothing matches", () => {
    expect(detectGenericProviders({})).toEqual([]);
  });

  it("detects Fastly via x-served-by", () => {
    const matches = detectGenericProviders({ "x-served-by": "cache-mxp1234" });
    expect(matches).toHaveLength(1);
    expect(matches[0]?.provider).toBe("Fastly");
    expect(matches[0]?.evidence).toContain("x-served-by");
  });

  it("detects Amazon CloudFront via x-amz-cf-id", () => {
    const matches = detectGenericProviders({ "x-amz-cf-id": "abc123" });
    expect(matches.map((m) => m.provider)).toContain("Amazon CloudFront");
  });

  it("detects Vercel via server header when no dedicated header is present", () => {
    const matches = detectGenericProviders({ server: "Vercel" });
    expect(matches.map((m) => m.provider)).toContain("Vercel");
  });

  it("can detect multiple providers at once", () => {
    const matches = detectGenericProviders({
      "x-served-by": "cache-mxp1234",
      "x-amz-cf-id": "abc123",
    });
    expect(matches.map((m) => m.provider).sort()).toEqual(["Amazon CloudFront", "Fastly"]);
  });

  it("only surfaces detail headers that are actually present", () => {
    const matches = detectGenericProviders({ "x-served-by": "cache-mxp1234" });
    expect(matches[0]?.details).toEqual({ "x-served-by": "cache-mxp1234" });
  });
});
