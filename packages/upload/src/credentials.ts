import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/**
 * Credential storage. The Supabase session token and the opaque contributor UUID are
 * the only things we persist, and they live in a user-scoped config dir (not the repo),
 * chmod 600. Nothing here ties back to a project's captured data on disk.
 */

export interface Credentials {
  contributorId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

function credPath(): string {
  const base = process.env.TARS_CONFIG_HOME ?? join(homedir(), ".config", "tars");
  return join(base, "credentials.json");
}

export function saveCredentials(creds: Credentials): void {
  const file = credPath();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(creds, null, 2), { mode: 0o600 });
  chmodSync(file, 0o600);
}

export function loadCredentials(): Credentials | undefined {
  const file = credPath();
  if (!existsSync(file)) return undefined;
  return JSON.parse(readFileSync(file, "utf8")) as Credentials;
}

export function clearCredentials(): void {
  const file = credPath();
  if (existsSync(file)) rmSync(file);
}
