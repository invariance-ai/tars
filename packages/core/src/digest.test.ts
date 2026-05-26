import { describe, expect, it } from "vitest";

import { computeStats, renderDigest } from "./digest.js";
import type { FeatureRecord } from "./session.js";

const t = (m: number) => new Date(Date.UTC(2026, 0, 1, 0, m)).toISOString();

function positiveSession(): FeatureRecord[] {
  return [
    {
      t: "framing",
      surface: "claude",
      at: t(0),
      features: {
        promptLen: "short",
        hasGoal: true,
        hasConstraints: true,
        acceptanceCriteriaPresent: true,
        decompositionSteps: 3,
        clarifyingQuestions: false,
        examplesGiven: false,
      },
    },
    { t: "action", surface: "claude", at: t(1), action: "read", failed: false, isTest: false },
    { t: "action", surface: "claude", at: t(2), action: "edit", pathHash: "p1", failed: false, isTest: false },
    { t: "action", surface: "claude", at: t(3), action: "test", failed: false, isTest: true },
    { t: "end", surface: "claude", at: t(4), status: "completed" },
  ];
}

describe("digest", () => {
  it("is deterministic for the same input", () => {
    const sessions = new Map([["a", positiveSession()]]);
    const opts = { sessions, salt: "fixedsalt", surfaces: ["claude" as const], version: "0.1.0", now: new Date("2026-05-26T00:00:00Z") };
    expect(renderDigest(opts)).toBe(renderDigest(opts));
  });

  it("contains no code, paths, or prompt text and carries the privacy footer", () => {
    const md = renderDigest({
      sessions: new Map([["a", positiveSession()]]),
      salt: "fixedsalt",
      surfaces: ["claude"],
      version: "0.1.0",
      now: new Date("2026-05-26T00:00:00Z"),
    });
    expect(md).toContain("How this operator approaches tasks");
    expect(md).toContain("What is NOT in this file");
    expect(md).toContain("plan-first");
    expect(md).not.toContain("p1"); // path hashes never surface in the digest
  });

  it("counts positives", () => {
    const stats = computeStats(new Map([["a", positiveSession()]]));
    expect(stats).toEqual({ total: 1, positive: 1 });
  });

  it("handles an empty repo gracefully", () => {
    const md = renderDigest({ sessions: new Map(), salt: "s", surfaces: [], version: "0.1.0", now: new Date("2026-05-26T00:00:00Z") });
    expect(md).toContain("No sessions captured yet");
  });
});
