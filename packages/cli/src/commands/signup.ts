import kleur from "kleur";

import { requireConfig, saveConfig } from "@invariance/tars-core";
import { signup } from "@invariance/tars-upload";

import { resolvePaths } from "../root.js";

/**
 * GitHub signup. Authenticates via Supabase Auth (loopback PKCE), records only the
 * opaque contributor UUID locally, and moves consent to "signed-up". Upload still
 * requires an explicit `tars upload`.
 */
export async function signupCommand(opts: { root?: string }): Promise<void> {
  const paths = resolvePaths(opts.root);
  const cfg = requireConfig(paths);

  console.log(kleur.dim("Signing up is anonymous: GitHub verifies you once; we store only an opaque id."));
  const { contributorId } = await signup();

  cfg.contributorId = contributorId;
  cfg.consent = "signed-up";
  saveConfig(paths, cfg);

  console.log(kleur.green("signed up.") + ` contributor id ${kleur.dim(contributorId.slice(0, 8) + "…")}`);
  console.log(kleur.dim("Run `tars upload --dry-run` to preview exactly what would be shared."));
}
