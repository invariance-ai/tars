import { describe, expect, it } from "vitest";

import type { FeatureRecord } from "./session.js";
import { POSITIVE_THRESHOLD, summarizeSession } from "./positive.js";

const t = (s: number) => new Date(Date.UTC(2026, 0, 1, 0, s)).toISOString();

function framing(partial: Partial<Extract<FeatureRecord, { t: "framing" }>["features"]> = {}): FeatureRecord {
  return {
    t: "framing",
    surface: "claude",
    at: t(0),
    features: {
      promptLen: "short",
      hasGoal: true,
      hasConstraints: true,
      acceptanceCriteriaPresent: false,
      decompositionSteps: 3,
      clarifyingQuestions: false,
      examplesGiven: false,
      ...partial,
    },
  };
}

describe("summarizeSession", () => {
  it("scores a clean, tested, well-framed session as positive", () => {
    const recs: FeatureRecord[] = [
      framing(),
      { t: "action", surface: "claude", at: t(1), action: "read", failed: false, isTest: false },
      { t: "action", surface: "claude", at: t(2), action: "edit", pathHash: "aaa", failed: false, isTest: false },
      { t: "action", surface: "claude", at: t(3), action: "test", failed: false, isTest: true },
      { t: "end", surface: "claude", at: t(4), status: "completed" },
    ];
    const s = summarizeSession(recs);
    expect(s.isPositive).toBe(true);
    expect(s.positive.score).toBeGreaterThanOrEqual(POSITIVE_THRESHOLD);
    expect(s.positive.cleanStop).toBe(true);
    expect(s.positive.testsPassed).toBe(true);
    expect(s.approach.strategy).toBe("plan_first");
  });

  it("marks an aborted, untested session as not positive", () => {
    const recs: FeatureRecord[] = [
      framing({ hasGoal: false, hasConstraints: false, decompositionSteps: 0 }),
      { t: "action", surface: "claude", at: t(1), action: "edit", pathHash: "aaa", failed: false, isTest: false },
      { t: "end", surface: "claude", at: t(2), status: "aborted" },
    ];
    const s = summarizeSession(recs);
    expect(s.isPositive).toBe(false);
    expect(s.approach.strategy).toBe("dive_in");
  });

  it("counts re-edits of the same path as backtracking", () => {
    const recs: FeatureRecord[] = [
      framing(),
      { t: "action", surface: "claude", at: t(1), action: "edit", pathHash: "x", failed: false, isTest: false },
      { t: "action", surface: "claude", at: t(2), action: "edit", pathHash: "x", failed: false, isTest: false },
      { t: "action", surface: "claude", at: t(3), action: "edit", pathHash: "x", failed: false, isTest: false },
      { t: "end", surface: "claude", at: t(4), status: "completed" },
    ];
    const s = summarizeSession(recs);
    expect(s.approach.backtrackCount).toBe(2);
    expect(s.positive.reworkRatio).toBeCloseTo(2 / 3, 2);
  });

  it("detects test-first ordering", () => {
    const recs: FeatureRecord[] = [
      framing({ decompositionSteps: 0 }),
      { t: "action", surface: "codex", at: t(1), action: "test", failed: false, isTest: true },
      { t: "action", surface: "codex", at: t(2), action: "edit", pathHash: "y", failed: false, isTest: false },
      { t: "end", surface: "codex", at: t(3), status: "completed" },
    ];
    expect(summarizeSession(recs).approach.strategy).toBe("test_first");
  });
});
