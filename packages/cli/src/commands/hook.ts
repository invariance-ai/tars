import { dispatch, readStdinJson } from "@invariance/tars-adapters";
import { captureEvent, loadConfig, readSession, type Surface } from "@invariance/tars-core";

import { resolvePaths } from "../root.js";
import { contributionForSession, stageContribution, writeDigest } from "./shared.js";

/**
 * The agent-invoked entry point. It must be fast and must NEVER fail the agent:
 * any error is swallowed to stderr and we always exit 0. It reads one hook payload
 * from stdin, normalizes it, and appends redacted structure to the session NDJSON.
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
