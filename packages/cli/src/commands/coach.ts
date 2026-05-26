import kleur from "kleur";

import {
  buildProfile,
  coachingEnabled,
  coachingLines,
  readAllSessions,
  renderCoaching,
  requireConfig,
  saveConfig,
  MIN_POSITIVE_FOR_COACHING,
} from "@invariance/tars-core";

import { resolvePaths } from "../root.js";

/**
 * Inspect and toggle the pipe-back loop. `tars coach` shows what tars has learned from
 * your clean sessions and the coaching it would inject; `--on`/`--off` flip the flag
 * that the hook reads on each prompt.
 */
export function coachCommand(opts: { on?: boolean; off?: boolean; json?: boolean; root?: string }): void {
  const paths = resolvePaths(opts.root);
  const cfg = requireConfig(paths);

  if (opts.on || opts.off) {
    cfg.coaching = Boolean(opts.on) && !opts.off;
    saveConfig(paths, cfg);
    console.log(`coaching ${cfg.coaching ? kleur.green("on") : kleur.yellow("off")}.`);
    return;
  }

  const profile = buildProfile(readAllSessions(paths));

  if (opts.json) {
    console.log(JSON.stringify({ enabled: coachingEnabled(cfg), profile }, null, 2));
    return;
  }

  console.log(kleur.bold().yellow("tars coach") + `  (${coachingEnabled(cfg) ? "on" : "off"})`);
  if (profile.positiveCount < MIN_POSITIVE_FOR_COACHING) {
    console.log(
      kleur.dim(
        `  Learning… ${profile.positiveCount}/${MIN_POSITIVE_FOR_COACHING} clean sessions captured. ` +
          `Coaching starts once there's enough signal.`,
      ),
    );
    return;
  }

  console.log(`  Learned from ${profile.positiveCount} clean sessions:`);
  console.log(`    dominant strategy : ${(profile.dominantStrategy ?? "—").replace(/_/g, "-")}`);
  console.log(`    states acceptance : ${Math.round(profile.acceptanceRate * 100)}%`);
  console.log(`    avg reads / edits : ${profile.avgReads.toFixed(1)} / ${profile.avgEdits.toFixed(1)}`);
  console.log(`    test before stop  : ${Math.round(profile.testBeforeStopRate * 100)}%`);
  console.log("");

  // Show what would be injected for a deliberately bare prompt (worst-case framing).
  const sample = coachingLines(
    { promptLen: "tiny", hasGoal: false, hasConstraints: false, acceptanceCriteriaPresent: false, decompositionSteps: 0, clarifyingQuestions: false, examplesGiven: false },
    profile,
  );
  const block = renderCoaching(sample, profile.positiveCount);
  console.log(block ? block : kleur.dim("  No nudges — your habits don't trigger any coaching yet."));
}
