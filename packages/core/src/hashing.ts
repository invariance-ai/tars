import { createHmac, randomBytes } from "node:crypto";

/**
 * Salted, one-way hashing for paths and identifiers.
 *
 * The salt is generated per-repo at `tars init` and stored in `.tars/config.yml`.
 * Because the salt never leaves the machine, hashes are useless for cross-repo
 * correlation — they exist only so we can count *re-edits of the same file*
 * within one repo (the rework signal) without ever knowing the path.
 */

const HASH_LEN = 16; // truncated hex chars — collision-resistant enough for per-repo counting

export function newSalt(): string {
  return randomBytes(32).toString("hex");
}

export function hashPath(salt: string, raw: string): string {
  // Normalize trivial differences so the same file maps to one hash.
  const normalized = raw.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  return createHmac("sha256", salt).update(normalized).digest("hex").slice(0, HASH_LEN);
}

/** A short, non-reversible fingerprint of the salt itself — safe to display. */
export function saltFingerprint(salt: string): string {
  return createHmac("sha256", "tars-fingerprint").update(salt).digest("hex").slice(0, 8);
}

/** Per-session random nonce — used for manual sessions that have no native id. */
export function sessionNonce(): string {
  return randomBytes(12).toString("hex");
}

/**
 * Deterministic on-disk key for a native session/conversation id.
 *
 * Hashing with the per-repo salt keeps the native id off disk while staying stable
 * across the many short-lived hook processes that make up one conversation — so all
 * events for a session land in the same NDJSON file. Non-reversible and not
 * correlatable across repos (different salt).
 */
export function sessionKey(salt: string, sessionId: string): string {
  return createHmac("sha256", salt).update(`session:${sessionId}`).digest("hex").slice(0, 24);
}
