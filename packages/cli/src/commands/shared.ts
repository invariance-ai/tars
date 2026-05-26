import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildContribution,
  ensureDirs,
  readAllSessions,
  renderDigest,
  summarizeSession,
  type Contribution,
  type TarsConfig,
  type TarsPaths,
} from "@invariance/tars-core";

import { TARS_VERSION } from "../root.js";

/** Recompute and write `.tars/digest.md` from the current session NDJSON. Returns the markdown. */
export function writeDigest(paths: TarsPaths, cfg: TarsConfig): string {
  ensureDirs(paths);
  const md = renderDigest({
    sessions: readAllSessions(paths),
    salt: cfg.salt,
    surfaces: cfg.surfaces,
    version: TARS_VERSION,
  });
  writeFileSync(paths.digestFile, md, "utf8");
  return md;
}

/** Stage a positive session as a pending, validated contribution in the outbox. */
export function stageContribution(paths: TarsPaths, sessionId: string, contribution: Contribution): void {
  ensureDirs(paths);
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  writeFileSync(join(paths.outboxDir, `${safe}.json`), JSON.stringify(contribution), "utf8");
}

export interface PendingItem {
  file: string;
  contribution: Contribution;
}

export function readOutbox(paths: TarsPaths): PendingItem[] {
  if (!existsSync(paths.outboxDir)) return [];
  const out: PendingItem[] = [];
  for (const name of readdirSync(paths.outboxDir)) {
    if (!name.endsWith(".json")) continue;
    const file = join(paths.outboxDir, name);
    try {
      out.push({ file, contribution: JSON.parse(readFileSync(file, "utf8")) as Contribution });
    } catch {
      /* skip corrupt staged file */
    }
  }
  return out;
}

export function clearOutboxFiles(files: string[]): void {
  for (const f of files) if (existsSync(f)) rmSync(f);
}

/** Build the pending contribution for one session (or undefined if it isn't positive). */
export function contributionForSession(
  records: Parameters<typeof summarizeSession>[0],
): Contribution | undefined {
  const summary = summarizeSession(records);
  if (!summary.isPositive) return undefined;
  return buildContribution(summary, TARS_VERSION);
}
