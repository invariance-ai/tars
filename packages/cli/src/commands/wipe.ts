import { existsSync, rmSync } from "node:fs";
import kleur from "kleur";

import { loadConfig, saveConfig } from "@invariance/tars-core";
import { clearCredentials, deleteRemoteContributions } from "@invariance/tars-upload";

import { uninstallSurface } from "../install.js";
import { resolvePaths } from "../root.js";

/**
 * Delete tars data. `--local` clears the on-disk capture; `--remote` purges this
 * contributor's uploaded rows server-side; `--all` does both and fully detaches
 * (removes hooks + credentials, resets consent). With no flag, defaults to --local.
 */
export async function wipeCommand(opts: { local?: boolean; remote?: boolean; all?: boolean; root?: string }): Promise<void> {
  const paths = resolvePaths(opts.root);
  const doLocal = opts.local || opts.all || (!opts.remote && !opts.all);
  const doRemote = opts.remote || opts.all;

  if (doRemote) {
    try {
      const n = await deleteRemoteContributions();
      console.log(kleur.green(`remote: deleted ${n} contribution(s).`));
    } catch (err) {
      console.log(kleur.yellow(`remote: ${(err as Error).message}`));
    }
  }

  if (doLocal) {
    for (const dir of [paths.sessionsDir, paths.outboxDir]) {
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    }
    if (existsSync(paths.digestFile)) rmSync(paths.digestFile);
    console.log(kleur.green("local: cleared sessions, outbox, and digest."));
  }

  if (opts.all) {
    const cfg = loadConfig(paths);
    if (cfg) {
      for (const s of cfg.surfaces) uninstallSurface(paths.root, s);
      cfg.consent = "local-only";
      delete cfg.contributorId;
      delete cfg.lastUploadAt;
      saveConfig(paths, cfg);
    }
    clearCredentials();
    console.log(kleur.green("detached: removed hook blocks and credentials; consent reset to local-only."));
  }
}
