/**
 * Structural feature extraction.
 *
 * These functions read raw event text but return ONLY derived structure — booleans,
 * small counts, and enum labels. No substring of the input is ever returned or stored.
 * If the source text trips the secret/PII guard, the caller drops the whole derived
 * field rather than risk inference from it.
 */

import { containsSecret, lengthBucket, type LengthBucket } from "./redact.js";

export interface FramingFeatures {
  promptLen: LengthBucket;
  hasGoal: boolean;
  hasConstraints: boolean;
  acceptanceCriteriaPresent: boolean;
  /** Count of enumerated/decomposed sub-steps the human laid out (capped). */
  decompositionSteps: number;
  /** Did the human ask clarifying questions while framing? */
  clarifyingQuestions: boolean;
  /** Did the human supply examples / sample I/O? */
  examplesGiven: boolean;
}

const GOAL_CUES = /\b(i (?:want|need|would like)|goal|objective|please|let'?s|implement|add|build|fix|create|refactor|make)\b/i;
const CONSTRAINT_CUES = /\b(must|should|don'?t|do not|avoid|only|without|keep|ensure|never|always|constraint|requirement)\b/i;
const ACCEPTANCE_CUES = /\b(acceptance|definition of done|so that|verify|test that|it should|expected|criteria|pass(?:es|ing)?)\b/i;
const EXAMPLE_CUES = /\b(e\.g\.|for example|such as|like this|example:)\b/i;

/** Numbered/bulleted list items → a decomposition-step estimate, capped at 8. */
function countSteps(text: string): number {
  const lines = text.split(/\r?\n/);
  let steps = 0;
  for (const line of lines) {
    if (/^\s*(?:\d+[.)]|[-*•])\s+\S/.test(line)) steps++;
  }
  return Math.min(steps, 8);
}

export function extractFraming(prompt: string): FramingFeatures {
  // Work on a length-bounded view; the guard decides whether cue detection is trustworthy.
  const safe = containsSecret(prompt);
  return {
    promptLen: lengthBucket(prompt),
    hasGoal: !safe && GOAL_CUES.test(prompt),
    hasConstraints: !safe && CONSTRAINT_CUES.test(prompt),
    acceptanceCriteriaPresent: !safe && ACCEPTANCE_CUES.test(prompt),
    decompositionSteps: safe ? 0 : countSteps(prompt),
    clarifyingQuestions: !safe && /\?/.test(prompt),
    examplesGiven: !safe && EXAMPLE_CUES.test(prompt),
  };
}

const APPROVAL_LEXICON = /\b(lgtm|ship it|perfect|great|nice work|merge it|looks good|that works|exactly|thanks?,? that)\b/i;

/** Lexicon-only approval detection. Returns a boolean; no text is retained. */
export function looksLikeApproval(prompt: string): boolean {
  if (containsSecret(prompt)) return false;
  return APPROVAL_LEXICON.test(prompt);
}

/** Map a test/shell command to whether it is a test invocation — used for the positive signal. */
const TEST_CUES = /\b(vitest|jest|pytest|go test|cargo test|npm (?:run )?test|pnpm (?:run )?test|yarn test|mocha|rspec|phpunit|gradle test|mvn test)\b/i;

export function isTestCommand(command: string | undefined): boolean {
  if (!command || containsSecret(command)) return false;
  return TEST_CUES.test(command);
}
