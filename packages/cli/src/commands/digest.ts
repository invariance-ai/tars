import { writeFileSync } from "node:fs";

import { computeStats, readAllSessions, requireConfig, summarizeSession } from "@invariance/tars-core";

import { resolvePaths } from "../root.js";
import { writeDigest } from "./shared.js";

/** Recompute the local digest. Pure-local; never touches the network. */
export function digestCommand(opts: { print?: boolean; out?: string; json?: boolean; root?: string }): void {
  const paths = resolvePaths(opts.root);
  const cfg = requireConfig(paths);

  if (opts.json) {
    const sessions = readAllSessions(paths);
    const summaries = [...sessions.values()].map((recs) => summarizeSession(recs));
    console.log(JSON.stringify({ stats: computeStats(sessions), sessions: summaries }, null, 2));
    return;
  }

  const md = writeDigest(paths, cfg);
  if (opts.out) writeFileSync(opts.out, md, "utf8");
  if (opts.print) console.log(md);
  else console.log(`digest written to ${(opts.out ?? paths.digestFile).replace(paths.root + "/", "")}`);
}
