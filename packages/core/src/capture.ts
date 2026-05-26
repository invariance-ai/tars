import type { NormalizedEvent } from "./events.js";
import { extractFraming, isTestCommand, looksLikeApproval } from "./features.js";
import { hashPath, sessionKey } from "./hashing.js";
import { appendRecord, type FeatureRecord } from "./session.js";
import type { TarsPaths } from "./paths.js";

export interface CaptureResult {
  /** The salted, on-disk session key these records were appended under. */
  key: string;
  records: FeatureRecord[];
}

/**
 * Turns one normalized event into one (or two) redacted feature records and appends
 * them to the session NDJSON. This is the only path by which event data reaches disk,
 * and by construction it writes structure only — never the raw prompt, command, path,
 * or native session id (the on-disk key is a salted hash of it).
 */
export function captureEvent(paths: TarsPaths, salt: string, ev: NormalizedEvent): CaptureResult {
  const key = sessionKey(salt, ev.sessionId);
  const written: FeatureRecord[] = [];

  if (ev.kind === "prompt_submit") {
    written.push({ t: "framing", surface: ev.surface, at: ev.at, features: extractFraming(ev.prompt) });
    // A prompt can simultaneously be an approval of the previous turn ("lgtm, now do X").
    if (looksLikeApproval(ev.prompt)) {
      written.push({ t: "approval", surface: ev.surface, at: ev.at });
    }
  } else if (ev.kind === "tool_action") {
    written.push({
      t: "action",
      surface: ev.surface,
      at: ev.at,
      action: ev.action,
      ...(ev.path ? { pathHash: hashPath(salt, ev.path) } : {}),
      failed: ev.failed ?? false,
      isTest: ev.action === "test" || isTestCommand(ev.command),
    });
  } else {
    written.push({ t: "end", surface: ev.surface, at: ev.at, status: ev.status });
  }

  for (const rec of written) appendRecord(paths, key, rec);
  return { key, records: written };
}
