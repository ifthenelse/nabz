import { describe, expect, it } from "vitest";
import { findMetric, parseServerTimingHeader } from "./serverTiming.js";

describe("parseServerTimingHeader", () => {
  it("returns an empty array for missing/empty input", () => {
    expect(parseServerTimingHeader(undefined)).toEqual([]);
    expect(parseServerTimingHeader("")).toEqual([]);
    expect(parseServerTimingHeader("   ")).toEqual([]);
  });

  it("parses a single metric with duration only", () => {
    expect(parseServerTimingHeader("processing;dur=401")).toEqual([
      { name: "processing", duration: 401 },
    ]);
  });

  it("parses a comma-separated list of metrics", () => {
    const result = parseServerTimingHeader(
      "processing;dur=401, db;dur=65, db_async;dur=99, render;dur=152, compression;dur=21.754",
    );
    expect(result).toEqual([
      { name: "processing", duration: 401 },
      { name: "db", duration: 65 },
      { name: "db_async", duration: 99 },
      { name: "render", duration: 152 },
      { name: "compression", duration: 21.754 },
    ]);
  });

  it("parses quoted descriptions and preserves commas inside them", () => {
    const result = parseServerTimingHeader('edge;desc="MXP, cache HIT", country;desc="IT"');
    expect(result).toEqual([
      { name: "edge", description: "MXP, cache HIT" },
      { name: "country", description: "IT" },
    ]);
  });

  it("parses a metric with both dur and desc", () => {
    const result = parseServerTimingHeader('cfRequestDuration;dur=12.3;desc="edge processing"');
    expect(result).toEqual([
      { name: "cfRequestDuration", duration: 12.3, description: "edge processing" },
    ]);
  });

  it("ignores unparseable dur values without throwing", () => {
    const result = parseServerTimingHeader("weird;dur=notanumber");
    expect(result).toEqual([{ name: "weird" }]);
  });

  it("handles metrics with no params", () => {
    expect(parseServerTimingHeader("edge")).toEqual([{ name: "edge" }]);
  });
});

describe("findMetric", () => {
  it("finds a metric case-insensitively", () => {
    const metrics = parseServerTimingHeader("db_async;dur=99");
    expect(findMetric(metrics, "DB_ASYNC")?.duration).toBe(99);
  });

  it("returns undefined when not found", () => {
    const metrics = parseServerTimingHeader("db;dur=1");
    expect(findMetric(metrics, "render")).toBeUndefined();
  });
});
