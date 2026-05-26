import { describe, expect, it } from "vitest";

import { containsSecret, durationBucket, lengthBucket } from "./redact.js";

describe("containsSecret", () => {
  it("flags common credential shapes", () => {
    expect(containsSecret("AKIAIOSFODNN7EXAMPLE")).toBe(true);
    expect(containsSecret("here is sk-abcdefghijklmnopqrstuvwxyz123")).toBe(true);
    expect(containsSecret("token ghp_0123456789abcdefghijABCDEFGHIJ0123")).toBe(true);
    expect(containsSecret("email me at jane.doe@example.com")).toBe(true);
    expect(containsSecret("server at 10.0.12.99")).toBe(true);
    expect(containsSecret("-----BEGIN RSA PRIVATE KEY-----")).toBe(true);
  });

  it("flags long high-entropy blobs", () => {
    expect(containsSecret("Zm9vYmFyMTIzNDU2Nzg5MGFiY2RlZmdoaWprbA==")).toBe(true);
  });

  it("passes ordinary prose", () => {
    expect(containsSecret("implement the login flow and add a test")).toBe(false);
    expect(containsSecret(undefined)).toBe(false);
  });
});

describe("buckets", () => {
  it("bucketizes length", () => {
    expect(lengthBucket("hi")).toBe("tiny");
    expect(lengthBucket("x".repeat(100))).toBe("short");
    expect(lengthBucket("x".repeat(500))).toBe("medium");
    expect(lengthBucket("x".repeat(2500))).toBe("xlong");
  });

  it("bucketizes duration", () => {
    const t0 = "2026-01-01T00:00:00.000Z";
    expect(durationBucket(t0, "2026-01-01T00:02:00.000Z")).toBe("<5m");
    expect(durationBucket(t0, "2026-01-01T00:20:00.000Z")).toBe("5-30m");
    expect(durationBucket(t0, "2026-01-01T01:00:00.000Z")).toBe("30-120m");
    expect(durationBucket(t0, "2026-01-01T03:00:00.000Z")).toBe(">120m");
  });
});
