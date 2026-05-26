import { dispatch, readStdinJson } from "@invariance/tars-adapters";
import {
  buildProfile,
  captureEvent,
  coachingEnabled,
  coachingLines,
  extractFraming,
  loadConfig,
  readAllSessions,
  readSession,
  renderCoaching,
  type Surface,
} from "@invariance/tars-core";

import { resolvePaths } from "../root.js";
import { contributionForSession, stageContribution, writeDigest } from "./shared.js";

// Surfaces that fold a hook's stdout back into the agent's context. Cursor hooks are
// observe-only (stdout can't steer the agent), so we never print coaching there.
const INJECTABLE: ReadonlySet<Surface> = new Set<Surface>(["claude", "codex"]);

/**
 * The agent-invoked entry point. It must be fast and must NEVER fail the agent:
 * any error is swallowed to stderr and we always exit 0. It reads one hook payload
 * from stdin, normalizes it, and appends redacted structure to the session NDJSON.
 *
 * This is also where the loop closes: on prompt submit, if coaching is enabled and the
 * surface injects stdout, we print ≤2 nudges drawn from the operator's own clean-session
 * patterns — orchestration method only, never codebase facts (that's gps).
 * On session end it refreshes the digest and stages a positive session for upload.
 */
export async function hookCommand(surface: Surface): Promise<void> {
  try {
    const paths = resolvePaths();
    const cfg = loadConfig(paths);
    if (!cfg) return; // not initialized here — silently do nothing

    const payload = await readStdinJson();
    const event = dispatch(surface, payload);
    if (!event) return; // not a tool-relevant event — ignore (keeps capture lean)

    // Coaching reads from history BEFORE we append this prompt's framing.
    if (event.kind === "prompt_submit" && coachingEnabled(cfg) && INJECTABLE.has(surface)) {
      const profile = buildProfile(readAllSessions(paths));
      const lines = coachingLines(extractFraming(event.prompt), profile);
      const block = renderCoaching(lines, profile.positiveCount);
      if (block) process.stdout.write(block + "\n");
    }

    const { key } = captureEvent(paths, cfg.salt, event);

    if (event.kind === "session_end") {
      writeDigest(paths, cfg);
      const contribution = contributionForSession(readSession(paths, key));
      if (contribution) stageContribution(paths, key, contribution);
    }
  } catch (err) {
    process.stderr.write(`tars hook: ${(err as Error).message}\n`);
  }
}
