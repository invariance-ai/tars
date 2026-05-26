import { buildProfile, coachingLines, MIN_POSITIVE_FOR_COACHING } from "./coach.js";
import { saltFingerprint } from "./hashing.js";
import { summarizeSession, type SessionSummary } from "./positive.js";
import type { FeatureRecord } from "./session.js";
import type { Surface } from "./events.js";

/**
 * Renders the exportable, repo-level digest — "how this operator approaches tasks."
 *
 * It is computed purely from the redacted session NDJSON, so it carries no code, no
 * paths, no prompt text, no identifiers. It is meant to be read and shared: the whole
 * point is to make a good operator's orchestration legible and learnable.
 */

const RECENT_LIMIT = 10;
const WINDOW = 30;

export interface DigestInput {
  sessions: Map<string, FeatureRecord[]>;
  salt: string;
  surfaces: Surface[];
  version: string;
  now?: Date;
}

export interface DigestStats {
  total: number;
  positive: number;
}

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 100);
}

export function computeStats(sessions: Map<string, FeatureRecord[]>): DigestStats {
  let positive = 0;
  for (const recs of sessions.values()) {
    if (summarizeSession(recs).isPositive) positive++;
  }
  return { total: sessions.size, positive };
}

export function renderDigest(input: DigestInput): string {
  const now = input.now ?? new Date();
  // Order by last activity; keep the most recent WINDOW sessions.
  const ordered = [...input.sessions.entries()]
    .map(([id, recs]) => ({ id, recs, summary: summarizeSession(recs), last: recs[recs.length - 1]?.at ?? "" }))
    .sort((a, b) => (a.last < b.last ? 1 : -1))
    .slice(0, WINDOW);

  const positives = ordered.filter((s) => s.summary.isPositive);
  const total = ordered.length;
  const nPos = positives.length;

  const L: string[] = [];
  L.push("# How this operator approaches tasks — tars digest");
  L.push("");
  L.push(
    `Repo: ${saltFingerprint(input.salt)} · Surfaces: ${input.surfaces.join(", ") || "none"}`,
  );
  L.push(
    `Window: last ${total} sessions (${nPos} positive) · Generated: ${now.toISOString().slice(0, 10)} · tars v${input.version}`,
  );
  L.push("");

  if (total === 0) {
    L.push("_No sessions captured yet. Drive an agent in this repo and run `tars digest` again._");
    L.push("");
    L.push(footer());
    return L.join("\n");
  }

  // ---- operating profile ----
  const strategyCounts = tally(positives.map((s) => s.summary.approach.strategy));
  const dominant = topKey(strategyCounts) ?? "—";
  const medianBucket = mode(positives.map((s) => s.summary.durationBucket)) ?? "—";
  const typicalSeq = mode(positives.map((s) => s.summary.approach.phaseSequence.join(" → "))) ?? "—";

  L.push("## Operating profile");
  L.push(`- Dominant strategy: ${pretty(dominant)} (${pct(strategyCounts[dominant] ?? 0, nPos)}% of positive sessions)`);
  L.push(`- Typical phase sequence: ${typicalSeq}`);
  L.push(`- Median session: ${medianBucket} bucket`);
  L.push("");

  // ---- framing ----
  const f = positives.map((s) => s.summary.framing);
  const avgSteps = f.length ? round1(f.reduce((a, x) => a + x.decompositionSteps, 0) / f.length) : 0;
  L.push("## How tasks are framed");
  L.push(`- ${pct(count(f, (x) => x.hasGoal), f.length)}% of prompts include an explicit goal`);
  L.push(`- ${pct(count(f, (x) => x.acceptanceCriteriaPresent), f.length)}% state acceptance criteria up front`);
  L.push(`- Avg decomposition: ${avgSteps} named sub-steps · clarifying questions in ${pct(count(f, (x) => x.clarifyingQuestions), f.length)}%`);
  L.push("");

  // ---- approach (positive sessions) ----
  L.push("## How tasks are approached (positive sessions only)");
  L.push(`- Explores before first edit: ${pct(count(positives, (s) => s.summary.approach.strategy === "explore_first"), nPos)}% · test-first: ${pct(count(positives, (s) => s.summary.approach.strategy === "test_first"), nPos)}%`);
  const backtracks = positives.map((s) => s.summary.approach.backtrackCount).sort((a, b) => a - b);
  L.push(`- Backtracking: median ${median(backtracks)}, p90 ${percentile(backtracks, 90)}`);
  L.push("");

  // ---- quality signals ----
  L.push("## Signals this operator does it well");
  L.push(`- Clean stops: ${count(positives, (s) => s.summary.positive.cleanStop)}/${nPos} · Tests pass: ${count(positives, (s) => s.summary.positive.testsPassed)}/${nPos} · Explicit approval: ${count(positives, (s) => s.summary.positive.userApproved)}/${nPos}`);
  L.push("");

  // ---- your edge (what tars coaches the agent toward) ----
  const profile = buildProfile(input.sessions);
  if (profile.positiveCount >= MIN_POSITIVE_FOR_COACHING) {
    const edge = coachingLines(
      { promptLen: "tiny", hasGoal: false, hasConstraints: false, acceptanceCriteriaPresent: false, decompositionSteps: 0, clarifyingQuestions: false, examplesGiven: false },
      profile,
    );
    if (edge.length) {
      L.push("## Your edge (what tars coaches your agent toward)");
      for (const e of edge) L.push(`- ${e}`);
      L.push("");
    }
  }

  // ---- recent table ----
  L.push("## Recent positive sessions (anonymized)");
  L.push("| # | surface | strategy | steps | tests | stop | score |");
  L.push("|---|---------|----------|-------|-------|------|-------|");
  positives.slice(0, RECENT_LIMIT).forEach((s, i) => {
    const sm = s.summary;
    L.push(
      `| ${i + 1} | ${sm.surface} | ${pretty(sm.approach.strategy)} | ${sm.framing.decompositionSteps} | ${sm.positive.testsPassed ? "pass" : "—"} | ${sm.positive.cleanStop ? "clean" : "—"} | ${sm.positive.score.toFixed(2)} |`,
    );
  });
  L.push("");
  L.push(footer());
  return L.join("\n");
}

function footer(): string {
  return [
    "## What is NOT in this file",
    "No source code, no file paths, no prompt/response text, no secrets, no identifiers. See PRIVACY.md.",
  ].join("\n");
}

// ---- tiny stats helpers ----
function tally<T extends string>(xs: T[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const x of xs) m[x] = (m[x] ?? 0) + 1;
  return m;
}
function topKey(m: Record<string, number>): string | undefined {
  let best: string | undefined;
  let n = -1;
  for (const [k, v] of Object.entries(m)) if (v > n) ((best = k), (n = v));
  return best;
}
function mode<T extends string>(xs: T[]): T | undefined {
  return topKey(tally(xs)) as T | undefined;
}
function count<T>(xs: T[], p: (x: T) => boolean): number {
  return xs.reduce((a, x) => a + (p(x) ? 1 : 0), 0);
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : Math.round(((sorted[mid - 1]! + sorted[mid]!) / 2) * 10) / 10;
}
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)]!;
}
function pretty(s: string): string {
  return s.replace(/_/g, "-");
}

export type { SessionSummary };
