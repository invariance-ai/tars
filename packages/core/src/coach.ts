import type { FramingFeatures } from "./features.js";
import { summarizeSession, type Strategy } from "./positive.js";
import type { FeatureRecord } from "./session.js";

/**
 * The pipe-back loop. tars watches which sessions go well and learns the operator's
 * winning patterns; this module turns those patterns into terse, in-the-moment coaching
 * that a hook injects back into the agent on the next prompt.
 *
 * Scope is deliberately narrow: transferable ORCHESTRATION METHOD only — how the operator
 * frames and sequences work — never codebase facts or project rules (that is gps's job).
 * That boundary is what keeps tars and gps distinct rather than overlapping.
 */

/** Don't coach until there's enough positive signal to be trustworthy. */
export const MIN_POSITIVE_FOR_COACHING = 3;

export interface OperatorProfile {
  positiveCount: number;
  dominantStrategy?: Strategy;
  strategyShare: Record<Strategy, number>;
  goalRate: number;
  acceptanceRate: number;
  decompositionAvg: number;
  testRate: number;
  /** Tool-call habits on clean runs — the "very specific things" worth coaching. */
  avgReads: number; // typical Read/Grep/Glob actions per clean session
  avgEdits: number; // typical Edit/Write actions per clean session
  testBeforeStopRate: number; // share of clean sessions that ran a passing test
}

const EMPTY_SHARE: Record<Strategy, number> = { plan_first: 0, explore_first: 0, test_first: 0, dive_in: 0 };

const EMPTY_PROFILE: OperatorProfile = {
  positiveCount: 0,
  strategyShare: { ...EMPTY_SHARE },
  goalRate: 0,
  acceptanceRate: 0,
  decompositionAvg: 0,
  testRate: 0,
  avgReads: 0,
  avgEdits: 0,
  testBeforeStopRate: 0,
};

/** Aggregate the operator's positive sessions into a profile of what works for them. */
export function buildProfile(sessions: Map<string, FeatureRecord[]>): OperatorProfile {
  const positives = [...sessions.values()].map(summarizeSession).filter((s) => s.isPositive);
  const n = positives.length;
  if (n === 0) return { ...EMPTY_PROFILE, strategyShare: { ...EMPTY_SHARE } };

  const share = { ...EMPTY_SHARE };
  let goal = 0;
  let acceptance = 0;
  let steps = 0;
  let tests = 0;
  let reads = 0;
  let edits = 0;
  for (const s of positives) {
    share[s.approach.strategy] += 1 / n;
    if (s.framing.hasGoal) goal++;
    if (s.framing.acceptanceCriteriaPresent) acceptance++;
    steps += s.framing.decompositionSteps;
    if (s.positive.testsPassed) tests++;
    reads += s.approach.toolActionCounts.read;
    edits += s.approach.toolActionCounts.edit + s.approach.toolActionCounts.write;
  }

  let dominant: Strategy | undefined;
  let best = 0;
  for (const k of Object.keys(share) as Strategy[]) {
    if (share[k] > best) ((best = share[k]), (dominant = k));
  }

  return {
    positiveCount: n,
    dominantStrategy: dominant,
    strategyShare: share,
    goalRate: goal / n,
    acceptanceRate: acceptance / n,
    decompositionAvg: steps / n,
    testRate: tests / n,
    avgReads: reads / n,
    avgEdits: edits / n,
    testBeforeStopRate: tests / n,
  };
}

/**
 * Build coaching for the current prompt: surface the operator's own habits where this
 * prompt is missing one. Returns at most two lines, ordered by impact. Empty when there
 * isn't enough history to be credible.
 */
/**
 * Situational coaching for the CURRENT prompt. Self-relative by construction: every line
 * fires only when this prompt DEVIATES from something the operator personally does on their
 * own clean runs ("you usually X — this prompt doesn't"). It is not generic best-practice
 * advice (that would be a horoscope every model already knows); if the prompt already matches
 * the operator's habits, it stays silent. That gating is also what keeps it from nagging.
 */
export function coachingLines(current: FramingFeatures, profile: OperatorProfile): string[] {
  if (profile.positiveCount < MIN_POSITIVE_FOR_COACHING) return [];
  const candidates: string[] = [];

  // Each line = a gap between THIS prompt and the operator's OWN demonstrated habit.
  if (profile.acceptanceRate >= 0.5 && !current.acceptanceCriteriaPresent) {
    candidates.push(`You state acceptance criteria in ${Math.round(profile.acceptanceRate * 100)}% of your clean sessions — this prompt doesn't yet.`);
  }
  if (profile.decompositionAvg >= 2 && current.decompositionSteps === 0) {
    candidates.push(`You usually outline ~${Math.round(profile.decompositionAvg)} sub-steps before starting — this prompt jumps straight in.`);
  }
  if (profile.goalRate >= 0.6 && !current.hasGoal) {
    candidates.push("Your strong sessions open with an explicit goal — this prompt doesn't state one.");
  }

  return candidates.slice(0, 2);
}

/**
 * Standing method — the operator's durable habits, independent of any single prompt. Used by
 * the Session Card and (later) a once-per-session injection. Not fired per prompt: standing
 * text repeated every turn becomes wallpaper the model ignores.
 */
export function standingLines(profile: OperatorProfile): string[] {
  if (profile.positiveCount < MIN_POSITIVE_FOR_COACHING) return [];
  const lines: string[] = [];
  if (profile.strategyShare.explore_first >= 0.5 && profile.avgReads >= 2) {
    lines.push(`You Read ~${Math.round(profile.avgReads)} files before the first edit on clean runs.`);
  }
  if (profile.dominantStrategy === "test_first") {
    lines.push("Your cleanest work is test-first.");
  } else if (profile.testBeforeStopRate >= 0.6) {
    lines.push("You land a passing test before stopping on clean runs.");
  }
  return lines.slice(0, 2);
}

/** Render coaching as the block a hook prints to stdout for the agent to read. */
export function renderCoaching(lines: string[], positiveCount: number): string {
  if (lines.length === 0) return "";
  const body = lines.map((l) => `  • ${l}`).join("\n");
  return `[tars] Orchestration coach — patterns from your ${positiveCount} cleanest sessions:\n${body}`;
}
