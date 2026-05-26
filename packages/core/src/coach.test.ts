import { describe, expect, it } from "vitest";

import { buildProfile, coachingLines, MIN_POSITIVE_FOR_COACHING, renderCoaching, standingLines } from "./coach.js";
import type { FeatureRecord } from "./session.js";

const t = (m: number) => new Date(Date.UTC(2026, 0, 1, 0, m)).toISOString();

/** A clean explore-first + tested session (low decomposition so explore beats plan). */
function cleanSession(steps = 1): FeatureRecord[] {
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
        decompositionSteps: steps,
        clarifyingQuestions: false,
        examplesGiven: false,
      },
    },
    { t: "action", surface: "claude", at: t(1), action: "read", failed: false, isTest: false },
    { t: "action", surface: "claude", at: t(2), action: "read", failed: false, isTest: false },
    { t: "action", surface: "claude", at: t(3), action: "edit", pathHash: "p", failed: false, isTest: false },
    { t: "action", surface: "claude", at: t(4), action: "test", failed: false, isTest: true },
    { t: "end", surface: "claude", at: t(5), status: "completed" },
  ];
}

const bareFraming = {
  promptLen: "tiny" as const,
  hasGoal: false,
  hasConstraints: false,
  acceptanceCriteriaPresent: false,
  decompositionSteps: 0,
  clarifyingQuestions: false,
  examplesGiven: false,
};

describe("buildProfile", () => {
  it("aggregates tool-call habits from clean sessions", () => {
    const sessions = new Map([
      ["a", cleanSession()],
      ["b", cleanSession()],
      ["c", cleanSession()],
    ]);
    const p = buildProfile(sessions);
    expect(p.positiveCount).toBe(3);
    expect(p.dominantStrategy).toBe("explore_first");
    expect(p.avgReads).toBeCloseTo(2, 5);
    expect(p.avgEdits).toBeCloseTo(1, 5);
    expect(p.testBeforeStopRate).toBe(1);
    expect(p.acceptanceRate).toBe(1);
  });

  it("is empty when there are no positive sessions", () => {
    expect(buildProfile(new Map()).positiveCount).toBe(0);
  });
});

describe("coachingLines", () => {
  it("stays silent below the trust threshold", () => {
    const sessions = new Map([["a", cleanSession()], ["b", cleanSession()]]); // only 2
    const p = buildProfile(sessions);
    expect(p.positiveCount).toBeLessThan(MIN_POSITIVE_FOR_COACHING);
    expect(coachingLines(bareFraming, p)).toEqual([]);
  });

  it("surfaces self-relative framing gaps, capped at 2", () => {
    const p = buildProfile(new Map([["a", cleanSession()], ["b", cleanSession()], ["c", cleanSession()]]));
    const lines = coachingLines(bareFraming, p);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThanOrEqual(2);
    // self-relative phrasing: references the operator's OWN habit, not generic advice
    expect(lines[0]).toMatch(/acceptance criteria/i);
    expect(lines[0]).toMatch(/you/i);
  });

  it("stays silent when the prompt already matches the operator's habits (no nag)", () => {
    const p = buildProfile(new Map([["a", cleanSession()], ["b", cleanSession()], ["c", cleanSession()]]));
    const wellFramed = { ...bareFraming, hasGoal: true, acceptanceCriteriaPresent: true, decompositionSteps: 3 };
    expect(coachingLines(wellFramed, p)).toEqual([]);
  });

  it("exposes durable habits via standingLines (not per-prompt)", () => {
    const p = buildProfile(new Map([["a", cleanSession()], ["b", cleanSession()], ["c", cleanSession()]]));
    expect(standingLines(p).join(" ")).toMatch(/Read ~2 files before the first edit/i);
  });
});

describe("renderCoaching", () => {
  it("renders a labeled block, or empty for no lines", () => {
    expect(renderCoaching([], 5)).toBe("");
    const block = renderCoaching(["do the thing"], 7);
    expect(block).toContain("[tars] Orchestration coach");
    expect(block).toContain("7 cleanest sessions");
    expect(block).toContain("• do the thing");
  });
});
