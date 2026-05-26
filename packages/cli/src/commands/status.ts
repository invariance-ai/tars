import kleur from "kleur";

import { computeStats, readAllSessions, requireConfig, saltFingerprint } from "@invariance/tars-core";

import { resolvePaths } from "../root.js";
import { readOutbox } from "./shared.js";

/** Show what tars knows about this repo — consent state, counts, and the salt fingerprint. */
export function statusCommand(opts: { json?: boolean; root?: string }): void {
  const paths = resolvePaths(opts.root);
  const cfg = requireConfig(paths);

  const sessions = readAllSessions(paths);
  const stats = computeStats(sessions);
  const pending = readOutbox(paths).length;

  const report = {
    root: paths.root,
    surfaces: cfg.surfaces,
    consent: cfg.consent,
    signedUp: Boolean(cfg.contributorId),
    sessions: stats.total,
    positive: stats.positive,
    pendingUpload: pending,
    lastUploadAt: cfg.lastUploadAt ?? null,
    saltFingerprint: saltFingerprint(cfg.salt),
  };

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(kleur.bold().yellow("tars status"));
  console.log(`  repo:            ${report.root}`);
  console.log(`  surfaces:        ${report.surfaces.join(", ") || "none"}`);
  console.log(`  consent:         ${kleur.bold(report.consent)}`);
  console.log(`  sessions:        ${report.sessions} (${report.positive} positive)`);
  console.log(`  pending upload:  ${report.pendingUpload}`);
  console.log(`  last upload:     ${report.lastUploadAt ?? kleur.dim("never")}`);
  console.log(`  repo fingerprint:${" "}${kleur.dim(report.saltFingerprint)}`);
}
