import type { Contribution } from "@invariance/tars-core";

import { userClient } from "./client.js";
import { loadCredentials } from "./credentials.js";

export { signup, type SignupResult } from "./auth.js";
export { clearCredentials, loadCredentials, saveCredentials, type Credentials } from "./credentials.js";
export { resolveEndpoint } from "./client.js";

/**
 * Insert opt-in contributions. Every row is keyed to the caller's opaque contributor
 * UUID and written through RLS, which only permits inserting your own rows. Returns the
 * number of rows accepted.
 */
export async function uploadContributions(contributions: Contribution[]): Promise<number> {
  const creds = loadCredentials();
  if (!creds) throw new Error("Not signed up. Run `tars signup` first.");
  if (contributions.length === 0) return 0;

  const supabase = userClient(creds.accessToken);
  const rows = contributions.map((c) => ({ ...c, contributor_id: creds.contributorId }));
  const { error, count } = await supabase
    .from("tars_contributions")
    .insert(rows, { count: "exact" });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return count ?? rows.length;
}

/** Purge all of this contributor's rows server-side. Returns the deleted count. */
export async function deleteRemoteContributions(): Promise<number> {
  const creds = loadCredentials();
  if (!creds) throw new Error("Not signed up; nothing to delete remotely.");
  const supabase = userClient(creds.accessToken);
  const { data, error } = await supabase.rpc("tars_delete_my_contributions");
  if (error) throw new Error(`Remote delete failed: ${error.message}`);
  return typeof data === "number" ? data : 0;
}
