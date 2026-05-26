import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Locates the per-repo `.tars/` state directory.
 *
 * State is rooted at the repo so each project gets its own salt and digest. We treat
 * the nearest ancestor containing a `.git` or an existing `.tars` as the repo root,
 * falling back to the provided root (or cwd) when neither is found.
 */

export interface TarsPaths {
  root: string;
  dir: string; // <root>/.tars
  configFile: string; // .tars/config.yml
  sessionsDir: string; // .tars/sessions
  outboxDir: string; // .tars/outbox
  digestFile: string; // .tars/digest.md
}

export function findRepoRoot(start: string = process.cwd()): string {
  let cur = resolve(start);
  for (;;) {
    if (existsSync(join(cur, ".git")) || existsSync(join(cur, ".tars"))) return cur;
    const parent = dirname(cur);
    if (parent === cur) return resolve(start);
    cur = parent;
  }
}

export function tarsPaths(root: string): TarsPaths {
  const dir = join(root, ".tars");
  return {
    root,
    dir,
    configFile: join(dir, "config.yml"),
    sessionsDir: join(dir, "sessions"),
    outboxDir: join(dir, "outbox"),
    digestFile: join(dir, "digest.md"),
  };
}

export function sessionFile(paths: TarsPaths, sessionId: string): string {
  // sessionId is already a tars nonce by the time it reaches disk (see hashing.sessionNonce).
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return join(paths.sessionsDir, `${safe}.ndjson`);
}
