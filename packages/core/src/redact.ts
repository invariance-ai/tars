/**
 * The redaction primitives. This is the privacy boundary.
 *
 * Nothing in tars writes raw event text to disk. `features.ts` derives structural
 * booleans and counts; this module supplies the guards those derivations rely on:
 *  - secret/PII detection (so we can *drop* a derived field if its source looked sensitive),
 *  - bucketization (so timestamps and lengths become coarse buckets, never exact values).
 *
 * The redaction pipeline is fail-closed: callers treat any detected secret as a reason
 * to omit the field entirely, and `record.ts` re-validates the final payload against an
 * allow-list so nothing un-modeled can leak even if a future change forgets a guard.
 */

// gitleaks-flavored ruleset, trimmed to high-signal patterns. Order doesn't matter — any hit redacts.
const SECRET_PATTERNS: RegExp[] = [
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key id
  /\bsk-[A-Za-z0-9]{20,}\b/, // OpenAI-style secret key
  /\bsk-ant-[A-Za-z0-9-]{20,}\b/, // Anthropic key
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/, // GitHub token
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, // Slack token
  /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/, // private key block
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, // JWT
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, // email address
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/, // IPv4
  /\b(?:[a-f0-9]{2}:){5}[a-f0-9]{2}\b/i, // MAC address
];

/** Shannon entropy per character — high-entropy tokens are likely credentials. */
function entropy(s: string): number {
  if (!s) return 0;
  const counts = new Map<string, number>();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let h = 0;
  for (const c of counts.values()) {
    const p = c / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

const HIGH_ENTROPY_BITS = 4.0;
const HIGH_ENTROPY_MIN_LEN = 20;

/** True if a string appears to contain a secret, credential, or PII. Fail-closed callers drop on true. */
export function containsSecret(raw: string | undefined): boolean {
  if (!raw) return false;
  for (const re of SECRET_PATTERNS) {
    if (re.test(raw)) return true;
  }
  // Long, high-entropy contiguous tokens (base64/hex blobs) — likely keys.
  for (const tok of raw.split(/\s+/)) {
    if (tok.length >= HIGH_ENTROPY_MIN_LEN && entropy(tok) >= HIGH_ENTROPY_BITS) return true;
  }
  return false;
}

export type LengthBucket = "tiny" | "short" | "medium" | "long" | "xlong";

/** Prompt length → coarse bucket. Exact character counts are never stored. */
export function lengthBucket(text: string): LengthBucket {
  const n = text.trim().length;
  if (n < 60) return "tiny";
  if (n < 240) return "short";
  if (n < 800) return "medium";
  if (n < 2000) return "long";
  return "xlong";
}

export type DurationBucket = "<5m" | "5-30m" | "30-120m" | ">120m";

/** Wall-clock span → coarse bucket. Exact timestamps are never stored. */
export function durationBucket(startIso: string, endIso: string): DurationBucket {
  const ms = Math.max(0, Date.parse(endIso) - Date.parse(startIso));
  const min = ms / 60000;
  if (min < 5) return "<5m";
  if (min < 30) return "5-30m";
  if (min < 120) return "30-120m";
  return ">120m";
}
