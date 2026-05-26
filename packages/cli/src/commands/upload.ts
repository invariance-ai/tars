import { createInterface } from "node:readline/promises";
import kleur from "kleur";

import { requireConfig, saveConfig } from "@invariance/tars-core";
import { uploadContributions } from "@invariance/tars-upload";

import { resolvePaths } from "../root.js";
import { clearOutboxFiles, readOutbox } from "./shared.js";

/**
 * Opt-in upload. Shows exactly what would be sent (structure only), requires explicit
 * confirmation, then inserts the pending positive sessions through RLS. `--dry-run`
 * previews without sending; `--yes` skips the prompt for CI/non-interactive use.
 */
export async function uploadCommand(opts: { dryRun?: boolean; yes?: boolean; root?: string }): Promise<void> {
  const paths = resolvePaths(opts.root);
  const cfg = requireConfig(paths);

  const pending = readOutbox(paths);
  if (pending.length === 0) {
    console.log("Nothing to upload — no pending positive sessions.");
    return;
  }

  console.log(kleur.bold(`${pending.length} pending session(s) — exactly this will be sent:`));
  console.log(kleur.dim("surface  strategy      steps  tests  stop   dur      score"));
  for (const { contribution: c } of pending) {
    const p = c.positive;
    console.log(
      `${c.surface.padEnd(8)} ${c.approach.strategy.padEnd(13)} ${String(c.framing.decompositionSteps).padEnd(6)} ` +
        `${(p.testsPassed ? "pass" : "—").padEnd(6)} ${(p.cleanStop ? "clean" : "—").padEnd(6)} ${c.duration_bucket.padEnd(8)} ${p.score.toFixed(2)}`,
    );
  }
  console.log(kleur.dim("No code, paths, prompts, or identifiers are included. See PRIVACY.md."));

  if (opts.dryRun) {
    console.log(kleur.dim("\n--dry-run: nothing sent."));
    return;
  }

  if (cfg.consent === "local-only" || !cfg.contributorId) {
    console.log(kleur.yellow("\nNot signed up.") + " Run `tars signup` first. (Nothing has left your machine.)");
    return;
  }

  if (!opts.yes) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await rl.question(`\nUpload these ${pending.length} session(s)? [y/N] `)).trim().toLowerCase();
    rl.close();
    if (answer !== "y" && answer !== "yes") {
      console.log("Aborted. Nothing sent.");
      return;
    }
  }

  const count = await uploadContributions(pending.map((p) => p.contribution));
  clearOutboxFiles(pending.map((p) => p.file));

  cfg.consent = "upload-enabled";
  cfg.lastUploadAt = new Date().toISOString();
  saveConfig(paths, cfg);

  console.log(kleur.green(`uploaded ${count} session(s).`) + kleur.dim(" Thank you — delete anytime with `tars wipe --remote`."));
}
