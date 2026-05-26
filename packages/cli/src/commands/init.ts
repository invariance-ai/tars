import kleur from "kleur";

import { defaultConfig, ensureDirs, loadConfig, saveConfig, type Surface } from "@invariance/tars-core";

import { installSurface } from "../install.js";
import { resolvePaths } from "../root.js";

const ALL: Surface[] = ["claude", "codex", "cursor"];

function parseSurfaces(raw?: string): Surface[] {
  if (!raw) return ALL;
  const picked = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is Surface => (ALL as string[]).includes(s));
  return picked.length ? picked : ALL;
}

export function initCommand(opts: { surface?: string; root?: string }): void {
  const paths = resolvePaths(opts.root);
  const surfaces = parseSurfaces(opts.surface);

  // Preserve the existing salt + consent if re-running init.
  const existing = loadConfig(paths);
  const cfg = existing ? { ...existing, surfaces } : defaultConfig(surfaces);

  ensureDirs(paths);
  saveConfig(paths, cfg);

  const installed: string[] = [];
  for (const s of surfaces) {
    const file = installSurface(paths.root, s);
    if (file) installed.push(`${s} → ${file.replace(paths.root + "/", "")}`);
  }

  console.log(kleur.bold().yellow("tars initialized") + ` in ${paths.root}`);
  console.log(`  surfaces:  ${surfaces.join(", ")}`);
  console.log(`  hooks:     ${installed.join("\n             ")}`);
  console.log(`  state:     .tars/  ${kleur.dim("(gitignored — never committed)")}`);
  console.log(`  consent:   ${kleur.bold(cfg.consent)}  ${kleur.dim("(upload OFF until you run `tars signup`)")}`);
  console.log("");
  console.log(kleur.dim("Work normally. See `tars digest --print` anytime. Nothing leaves your machine without `tars upload`."));
}
