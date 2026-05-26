import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parse, stringify } from "yaml";

import { newSalt } from "./hashing.js";
import { ensureDirs } from "./session.js";
import type { Surface } from "./events.js";
import type { TarsPaths } from "./paths.js";

/**
 * `.tars/config.yml` — per-repo configuration and consent state.
 *
 * Consent is explicit and staged: a fresh repo is `local-only` (nothing ever leaves
 * the machine). `tars signup` moves it to `signed-up`, and only after `tars upload`
 * confirmation does it become `upload-enabled`. The salt lives here and never leaves.
 */

export type Consent = "local-only" | "signed-up" | "upload-enabled";

export interface TarsConfig {
  version: 1;
  salt: string;
  consent: Consent;
  surfaces: Surface[];
  /** Opaque anonymous contributor UUID from Supabase. Present once signed up. */
  contributorId?: string;
  lastUploadAt?: string;
}

export function defaultConfig(surfaces: Surface[]): TarsConfig {
  return { version: 1, salt: newSalt(), consent: "local-only", surfaces };
}

export function loadConfig(paths: TarsPaths): TarsConfig | undefined {
  if (!existsSync(paths.configFile)) return undefined;
  return parse(readFileSync(paths.configFile, "utf8")) as TarsConfig;
}

export function saveConfig(paths: TarsPaths, config: TarsConfig): void {
  ensureDirs(paths);
  writeFileSync(paths.configFile, stringify(config), "utf8");
}

/** Load config or throw a friendly error directing the user to `tars init`. */
export function requireConfig(paths: TarsPaths): TarsConfig {
  const cfg = loadConfig(paths);
  if (!cfg) throw new Error("tars is not initialized in this repo. Run `tars init` first.");
  return cfg;
}
