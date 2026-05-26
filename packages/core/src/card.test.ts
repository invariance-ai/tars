import { describe, expect, it } from "vitest";

import { buildProfile, renderProfileCard, renderSessionCard } from "./card.js";
import type { FeatureRecord } from "./session.js";

const t = (m: number) => new Date(Date.UTC(2026, 0, 1, 0, m)).toISOString();

function session(opts: { reads?: number; backtracks?: number; tested?: boolean } = {}): FeatureRecord[] {
  const recs: FeatureRecord[] = [
    {
      t: "framing",
      surface: "claude",
      at: t(0),
      features: { promptLen: "short", hasGoal: true, hasConstraints: true, acceptanceCriteriaPresent: true, decompositionSteps: 1, clarifyingQuestions: false, examplesGiven: false },
    },
  ];
  let m = 1;
  for (let i = 0; i < (opts.reads ?? 2); i++) recs.push({ t: "action", surface: "claude", at: t(m++), action: "read", failed: false, isTest: false });
  recs.push({ t: "action", surface: "claude", at: t(m++), action: "edit", pathHash: "p", failed: false, isTest: false });
  for (let i = 0; i < (opts.backtracks ?? 0); i++) recs.push({ t: "action", surface: "claude", at: t(m++), action: "edit", pathHash: "p", failed: false, isTest: false });
  if (opts.tested ?? true) recs.push({ t: "action", surface: "claude", at: t(m++), action: "test", failed: false, isTest: true });
  recs.push({ t: "end", surface: "claude", at: t(m++), status: "completed" });
  return recs;
}

describe("renderSessionCard", () => {
  it("renders an instant mirror with no history needed", () => {
    const card = renderSessionCard(session(), new Map());
    expect(card).toContain("[tars] Session card");
    expect(card).toMatch(/tool calls/);
    // with <3 other sessions, shows the coaching-unlock teaser
    expect(card).toMatch(/coaching unlocks/i);
  });

  it("compares to your own history once enough sessions exist", () => {
    const history = new Map([["a", session()], ["b", session()], ["c", session()]]);
    const card = renderSessionCard(session(), history);
    expect(card).toMatch(/cleaner than \d+%/);
  });

  it("flags heavy rework as an observation", () => {
    const card = renderSessionCard(session({ backtracks: 3 }), new Map());
    expect(card).toMatch(/re-edited the same file/i);
  });
});

describe("renderProfileCard", () => {
  it("summarizes how the operator works", () => {
    const profile = buildProfile(new Map([["a", session()], ["b", session()], ["c", session()]]));
    const card = renderProfileCard(profile);
    expect(card).toContain("How you operate");
    expect(card).toMatch(/3 clean sessions/);
  });

  it("handles a cold start", () => {
    expect(renderProfileCard(buildProfile(new Map()))).toMatch(/No clean sessions/i);
  });
});
