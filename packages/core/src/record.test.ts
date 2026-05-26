import { describe, expect, it } from "vitest";

import { buildContribution, ContributionSchema } from "./record.js";
import { summarizeSession } from "./positive.js";
import type { FeatureRecord } from "./session.js";

const recs: FeatureRecord[] = [
  {
    t: "framing",
    surface: "cursor",
    at: "2026-01-01T00:00:00.000Z",
    features: {
      promptLen: "medium",
      hasGoal: true,
      hasConstraints: true,
      acceptanceCriteriaPresent: true,
      decompositionSteps: 2,
      clarifyingQuestions: true,
      examplesGiven: false,
    },
  },
  { t: "action", surface: "cursor", at: "2026-01-01T00:01:00.000Z", action: "edit", pathHash: "z", failed: false, isTest: false },
  { t: "end", surface: "cursor", at: "2026-01-01T00:05:00.000Z", status: "completed" },
];

describe("buildContribution", () => {
  it("builds a record that matches the allow-list", () => {
    const c = buildContribution(summarizeSession(recs), "0.1.0");
    expect(c.surface).toBe("cursor");
    expect(c.schema_version).toBe(1);
    expect(c.duration_bucket).toBe("5-30m");
  });

  it("rejects any field outside the allow-list (privacy guarantee)", () => {
    const c = buildContribution(summarizeSession(recs), "0.1.0");
    const leaky = { ...c, prompt: "secret text", path: "/Users/jane/app.ts" };
    expect(() => ContributionSchema.parse(leaky)).toThrow();
  });

  it("rejects a leaked field nested under framing", () => {
    const c = buildContribution(summarizeSession(recs), "0.1.0");
    const leaky = { ...c, framing: { ...c.framing, rawPrompt: "leak" } };
    expect(() => ContributionSchema.parse(leaky)).toThrow();
  });
});
