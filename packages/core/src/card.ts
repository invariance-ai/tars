import { buildProfile, MIN_POSITIVE_FOR_COACHING, type OperatorProfile } from "./coach.js";
import { summarizeSession } from "./positive.js";
import type { FeatureRecord } from "./session.js";

/**
 * The Session Card — instant, local, single-session reflection printed at session end.
 *
 * This is the session-1 value: it needs no corpus, no signup, no coaching history. It just
 * mirrors back how you drove the agent this session (tool calls, backtracks, how it compares
 * to your own median) plus a progress teaser toward coaching. Reflection is the hook; coaching
 * is the earned upgrade.
 */

export interface SessionCard {
  text: string;
}

function observation(strategy: string, edits: number, backtracks: number, testsPassed: boolean): string | undefined {
  if (edits > 0 && backtracks / edits >= 0.4) {
    return "You re-edited the same file repeatedly — the first instruction may have been underspecified.";
  }
  if (!testsPassed && edits > 0) {
    return "No passing test ran before you stopped — a quick test would catch regressions.";
  }
  if (strategy === "dive_in" && edits > 0) {
    return "You edited before exploring — reading a few files first usually means less rework.";
  }
  return undefined;
}

/**
 * Render the card for one just-finished session, given the full local history (for comparison
 * and the streak teaser). `historyExcludingCurrent` should be all OTHER sessions.
 */
export function renderSessionCard(
  current: FeatureRecord[],
  historyExcludingCurrent: Map<string, FeatureRecord[]>,
): string {
  const s = summarizeSession(current);
  const a = s.approach;
  const toolCalls = Object.values(a.toolActionCounts).reduce((x, y) => x + y, 0);

  const L: string[] = [];
  L.push(`[tars] Session card · ${s.surface}`);
  L.push(
    `  ${s.durationBucket} · ${toolCalls} tool calls · ${a.toolActionCounts.read} read / ${a.toolActionCounts.edit + a.toolActionCounts.write} edit · ${a.backtrackCount} backtrack${a.backtrackCount === 1 ? "" : "s"} · ${a.strategy.replace(/_/g, "-")}`,
  );

  // Comparison to your own median, when there's enough history.
  const others = [...historyExcludingCurrent.values()].map(summarizeSession);
  const positives = others.filter((o) => o.isPositive).length;
  if (others.length >= 3) {
    const cleaner = others.filter((o) => o.positive.score < s.positive.score).length;
    const pctile = Math.round((cleaner / others.length) * 100);
    L.push(`  cleaner than ${pctile}% of your past ${others.length} sessions (score ${s.positive.score.toFixed(2)})`);
  }

  const obs = observation(a.strategy, a.toolActionCounts.edit + a.toolActionCounts.write, a.backtrackCount, s.positive.testsPassed);
  if (obs) L.push(`  → ${obs}`);

  // Streak teaser toward coaching unlock.
  const totalPositive = positives + (s.isPositive ? 1 : 0);
  if (totalPositive < MIN_POSITIVE_FOR_COACHING) {
    L.push(`  coaching unlocks at ${MIN_POSITIVE_FOR_COACHING} clean sessions — you're at ${totalPositive}/${MIN_POSITIVE_FOR_COACHING}.`);
  }
  return L.join("\n");
}

/** Build a profile-aware "how you tend to operate" mini-card for `tars card` with no live session. */
export function renderProfileCard(profile: OperatorProfile): string {
  if (profile.positiveCount === 0) return "[tars] No clean sessions captured yet — run your agent and check back.";
  const L: string[] = [];
  L.push(`[tars] How you operate · ${profile.positiveCount} clean sessions`);
  L.push(`  dominant strategy: ${(profile.dominantStrategy ?? "—").replace(/_/g, "-")}`);
  L.push(`  avg reads/edits: ${profile.avgReads.toFixed(1)}/${profile.avgEdits.toFixed(1)} · tests before stop: ${Math.round(profile.testBeforeStopRate * 100)}%`);
  L.push(`  states acceptance criteria: ${Math.round(profile.acceptanceRate * 100)}%`);
  return L.join("\n");
}

export { buildProfile };
