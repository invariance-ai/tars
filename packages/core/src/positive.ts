import type { Surface } from "./events.js";
import type { FramingFeatures } from "./features.js";
import { durationBucket, type DurationBucket } from "./redact.js";
import type { FeatureRecord } from "./session.js";

/**
 * Reduces a session's redacted feature records into a single summary, and scores how
 * well the session went. The "positive" filter is a transparent additive score in
 * [0,1]; only sessions at or above POSITIVE_THRESHOLD are eligible to be uploaded.
 *
 * The weights live here, in one auditable block, and the reasons that fired are
 * recorded verbatim so the digest and the upload record can show their work.
 */

export const POSITIVE_WEIGHTS = {
  cleanStop: 0.3,
  testsPassed: 0.3,
  lowRework: 0.2,
  userApproved: 0.1,
  coherentFraming: 0.1,
} as const;

export const POSITIVE_THRESHOLD = 0.6;
const LOW_REWORK_MAX = 0.2;

export type Strategy = "plan_first" | "explore_first" | "test_first" | "dive_in";

export interface ApproachFeatures {
  strategy: Strategy;
  phaseSequence: string[];
  toolActionCounts: { edit: number; write: number; read: number; test: number; shell: number; other: number };
  backtrackCount: number;
  planBeforeEdit: boolean;
}

export interface PositiveAssessment {
  score: number;
  reasons: string[];
  testsPassed: boolean;
  cleanStop: boolean;
  reworkRatio: number;
  userApproved: boolean;
  coherentFraming: boolean;
}

export interface SessionSummary {
  surface: Surface;
  framing: FramingFeatures;
  approach: ApproachFeatures;
  positive: PositiveAssessment;
  durationBucket: DurationBucket;
  isPositive: boolean;
}

const EMPTY_FRAMING: FramingFeatures = {
  promptLen: "tiny",
  hasGoal: false,
  hasConstraints: false,
  acceptanceCriteriaPresent: false,
  decompositionSteps: 0,
  clarifyingQuestions: false,
  examplesGiven: false,
};

function phaseFor(rec: FeatureRecord): string {
  if (rec.t === "framing") return "frame";
  if (rec.t === "approval") return "approve";
  if (rec.t === "end") return "stop";
  switch (rec.action) {
    case "read":
      return "explore";
    case "edit":
    case "write":
      return "edit";
    case "test":
      return "test";
    case "shell":
      return "shell";
    default:
      return "other";
  }
}

export function summarizeSession(records: FeatureRecord[]): SessionSummary {
  const framing = (records.find((r) => r.t === "framing") as Extract<FeatureRecord, { t: "framing" }> | undefined)
    ?.features ?? EMPTY_FRAMING;
  const surface = records[0]?.surface ?? "manual";

  const counts = { edit: 0, write: 0, read: 0, test: 0, shell: 0, other: 0 };
  const editsByPath = new Map<string, number>();
  let totalEdits = 0;
  let firstEditIdx = Infinity;
  let firstReadIdx = Infinity;
  let firstTestIdx = Infinity;
  let anyTest = false;
  let anyFailedTest = false;
  const actions = records.filter((r): r is Extract<FeatureRecord, { t: "action" }> => r.t === "action");
  actions.forEach((a, idx) => {
    counts[a.action]++;
    if (a.action === "edit" || a.action === "write") {
      totalEdits++;
      if (idx < firstEditIdx) firstEditIdx = idx;
      if (a.pathHash) editsByPath.set(a.pathHash, (editsByPath.get(a.pathHash) ?? 0) + 1);
    }
    if (a.action === "read" && idx < firstReadIdx) firstReadIdx = idx;
    if (a.isTest) {
      anyTest = true;
      if (idx < firstTestIdx) firstTestIdx = idx;
      if (a.failed) anyFailedTest = true;
    }
  });

  let backtrackCount = 0;
  for (const n of editsByPath.values()) backtrackCount += Math.max(0, n - 1);
  const reworkRatio = totalEdits > 0 ? backtrackCount / totalEdits : 0;

  const strategy: Strategy =
    anyTest && firstTestIdx < firstEditIdx
      ? "test_first"
      : framing.decompositionSteps >= 2
        ? "plan_first"
        : firstReadIdx < firstEditIdx
          ? "explore_first"
          : "dive_in";

  // Compress the record stream into a deduplicated phase sequence.
  const phaseSequence: string[] = [];
  for (const rec of records) {
    const p = phaseFor(rec);
    if (phaseSequence[phaseSequence.length - 1] !== p) phaseSequence.push(p);
  }

  const approach: ApproachFeatures = {
    strategy,
    phaseSequence,
    toolActionCounts: counts,
    backtrackCount,
    planBeforeEdit: framing.decompositionSteps >= 2,
  };

  // ---- positive scoring ----
  const endRec = records.find((r) => r.t === "end") as Extract<FeatureRecord, { t: "end" }> | undefined;
  const cleanStop = endRec?.status === "completed";
  const testsPassed = anyTest && !anyFailedTest;
  const lowRework = reworkRatio < LOW_REWORK_MAX;
  const userApproved = records.some((r) => r.t === "approval");
  const coherentFraming = framing.hasGoal && (framing.hasConstraints || framing.acceptanceCriteriaPresent);

  const reasons: string[] = [];
  let score = 0;
  if (cleanStop) {
    score += POSITIVE_WEIGHTS.cleanStop;
    reasons.push("clean stop");
  }
  if (testsPassed) {
    score += POSITIVE_WEIGHTS.testsPassed;
    reasons.push("tests passed");
  }
  if (lowRework) {
    score += POSITIVE_WEIGHTS.lowRework;
    reasons.push("low rework");
  }
  if (userApproved) {
    score += POSITIVE_WEIGHTS.userApproved;
    reasons.push("user approved");
  }
  if (coherentFraming) {
    score += POSITIVE_WEIGHTS.coherentFraming;
    reasons.push("coherent framing");
  }
  score = Math.round(score * 100) / 100;

  const positive: PositiveAssessment = {
    score,
    reasons,
    testsPassed,
    cleanStop,
    reworkRatio: Math.round(reworkRatio * 100) / 100,
    userApproved,
    coherentFraming,
  };

  const first = records[0]?.at;
  const last = records[records.length - 1]?.at;
  const bucket = first && last ? durationBucket(first, last) : "<5m";

  return { surface, framing, approach, positive, durationBucket: bucket, isPositive: score >= POSITIVE_THRESHOLD };
}
