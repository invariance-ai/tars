import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";

import type { Action, Surface } from "./events.js";
import type { FramingFeatures } from "./features.js";
import { sessionFile, type TarsPaths } from "./paths.js";

/**
 * The on-disk working set: one append-only NDJSON file per session under
 * `.tars/sessions/`. Every line is an already-redacted feature record — there is
 * no raw text here. The digest and the upload record are both derived by replaying
 * these lines, so the NDJSON is the single source of truth and is itself safe to read.
 */

export type FeatureRecord =
  | { t: "framing"; surface: Surface; at: string; features: FramingFeatures }
  | {
      t: "action";
      surface: Surface;
      at: string;
      action: Action;
      pathHash?: string;
      failed: boolean;
      isTest: boolean;
    }
  | { t: "approval"; surface: Surface; at: string }
  | { t: "end"; surface: Surface; at: string; status: "completed" | "aborted" | "error" };

export function ensureDirs(paths: TarsPaths): void {
  for (const d of [paths.dir, paths.sessionsDir, paths.outboxDir]) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  }
}

export function appendRecord(paths: TarsPaths, sessionId: string, rec: FeatureRecord): void {
  ensureDirs(paths);
  appendFileSync(sessionFile(paths, sessionId), JSON.stringify(rec) + "\n", "utf8");
}

export function readSession(paths: TarsPaths, sessionId: string): FeatureRecord[] {
  const file = sessionFile(paths, sessionId);
  if (!existsSync(file)) return [];
  return parseNdjson(readFileSync(file, "utf8"));
}

export function readAllSessions(paths: TarsPaths): Map<string, FeatureRecord[]> {
  const out = new Map<string, FeatureRecord[]>();
  if (!existsSync(paths.sessionsDir)) return out;
  for (const name of readdirSync(paths.sessionsDir)) {
    if (!name.endsWith(".ndjson")) continue;
    const id = name.slice(0, -".ndjson".length);
    out.set(id, parseNdjson(readFileSync(`${paths.sessionsDir}/${name}`, "utf8")));
  }
  return out;
}

function parseNdjson(raw: string): FeatureRecord[] {
  const recs: FeatureRecord[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      recs.push(JSON.parse(trimmed) as FeatureRecord);
    } catch {
      // A corrupt line is skipped, never fatal — capture must never break the agent.
    }
  }
  return recs;
}
