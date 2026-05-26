import { z } from "zod";

import type { SessionSummary } from "./positive.js";

/**
 * The upload record and its allow-list schema.
 *
 * This is the last line of the privacy defense: every field that may leave the
 * machine must be enumerated here, and the schema is `.strict()` so any key not
 * modeled below is *rejected*, not silently passed through. If a future change to
 * capture starts producing a new field, it cannot be uploaded until it is added here
 * deliberately. There is intentionally no field for paths, prompt text, or identifiers.
 */

export const SCHEMA_VERSION = 1;

const FramingSchema = z
  .object({
    promptLen: z.enum(["tiny", "short", "medium", "long", "xlong"]),
    hasGoal: z.boolean(),
    hasConstraints: z.boolean(),
    acceptanceCriteriaPresent: z.boolean(),
    decompositionSteps: z.number().int().min(0).max(8),
    clarifyingQuestions: z.boolean(),
    examplesGiven: z.boolean(),
  })
  .strict();

const ApproachSchema = z
  .object({
    strategy: z.enum(["plan_first", "explore_first", "test_first", "dive_in"]),
    phaseSequence: z.array(z.enum(["frame", "explore", "edit", "test", "shell", "approve", "stop", "other"])),
    toolActionCounts: z
      .object({
        edit: z.number().int().min(0),
        write: z.number().int().min(0),
        read: z.number().int().min(0),
        test: z.number().int().min(0),
        shell: z.number().int().min(0),
        other: z.number().int().min(0),
      })
      .strict(),
    backtrackCount: z.number().int().min(0),
    planBeforeEdit: z.boolean(),
  })
  .strict();

const PositiveSchema = z
  .object({
    score: z.number().min(0).max(1),
    reasons: z.array(z.string()),
    testsPassed: z.boolean(),
    cleanStop: z.boolean(),
    reworkRatio: z.number().min(0),
    userApproved: z.boolean(),
    coherentFraming: z.boolean(),
  })
  .strict();

export const ContributionSchema = z
  .object({
    surface: z.enum(["claude", "codex", "cursor", "manual"]),
    tars_version: z.string(),
    schema_version: z.literal(SCHEMA_VERSION),
    framing: FramingSchema,
    approach: ApproachSchema,
    positive: PositiveSchema,
    duration_bucket: z.enum(["<5m", "5-30m", "30-120m", ">120m"]),
  })
  .strict();

export type Contribution = z.infer<typeof ContributionSchema>;

/**
 * Build a validated contribution from a session summary. Throws if the payload does
 * not match the allow-list — callers treat that as a hard stop (never upload).
 */
export function buildContribution(summary: SessionSummary, tarsVersion: string): Contribution {
  const candidate = {
    surface: summary.surface,
    tars_version: tarsVersion,
    schema_version: SCHEMA_VERSION,
    framing: summary.framing,
    approach: summary.approach,
    positive: summary.positive,
    duration_bucket: summary.durationBucket,
  };
  return ContributionSchema.parse(candidate);
}
