import { findRepoRoot, tarsPaths, type TarsPaths } from "@invariance/tars-core";

/** Resolve the tars paths for a command, honoring an explicit --root override. */
export function resolvePaths(root?: string): TarsPaths {
  return tarsPaths(root ? root : findRepoRoot());
}

/** Read the CLI version from the package at runtime (kept in sync with package.json). */
export const TARS_VERSION = "0.1.0";
