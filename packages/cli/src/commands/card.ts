import kleur from "kleur";

import { buildProfile, readAllSessions, renderProfileCard, requireConfig } from "@invariance/tars-core";

import { resolvePaths } from "../root.js";

/**
 * `tars card` — the mirror, on demand. Shows how you tend to operate across your captured
 * sessions. Pure-local, needs no corpus or signup. This is the session-1 value: reflection
 * first, coaching is the earned upgrade.
 */
export function cardCommand(opts: { json?: boolean; root?: string }): void {
  const paths = resolvePaths(opts.root);
  requireConfig(paths);
  const profile = buildProfile(readAllSessions(paths));

  if (opts.json) {
    console.log(JSON.stringify(profile, null, 2));
    return;
  }
  console.log(kleur.yellow(renderProfileCard(profile)));
}
