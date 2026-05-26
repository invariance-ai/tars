# Privacy

tars is a tool for learning *how* people orchestrate AI coding agents — not *what* they build.
That distinction is the entire design. This document explains, precisely, what happens to your
data.

## Principles

1. **Local-first.** tars works fully offline. It always writes `.tars/digest.md` locally and
   never needs an account. Uploading is a separate, explicit, opt-in step.
2. **Structure, never content.** We capture derived structure — booleans, small counts, coarse
   buckets, enum labels. We never capture or store source code, diffs, prompts, responses, or
   any free text.
3. **Fail-closed.** If anything looks like a secret or PII, the affected field is dropped, not
   guessed at. The final upload payload is validated against a strict allow-list; unknown fields
   are rejected.
4. **Anonymous.** Contributed data is keyed to an opaque random id. Your GitHub identity is used
   only to prove you're a real person, lives only in the auth system, and is never attached to
   or readable alongside contributed data.
5. **Reversible.** You can delete everything, locally and remotely, with one command.

## What is captured

Per session, all derived locally before anything is written:

- **Framing structure:** prompt length *bucket* (not length), and booleans like "stated a goal",
  "stated constraints", "stated acceptance criteria", an estimated count of decomposition steps,
  whether clarifying questions were asked, whether examples were given.
- **Approach:** a strategy label (`plan_first` / `explore_first` / `test_first` / `dive_in`), a
  deduplicated phase sequence (e.g. `frame → explore → edit → test → stop`), tool-action counts
  by category, and a backtracking count.
- **Outcome signals:** whether tests ran and passed, whether the session stopped cleanly, a
  rework ratio, whether you explicitly approved, and the resulting positive score.
- **Duration bucket:** `<5m` / `5-30m` / `30-120m` / `>120m`. Never exact timestamps.

## What is never captured

- Source code, file contents, or diffs.
- Prompt text or model responses (we test cue patterns against the text in memory and keep only
  the resulting booleans).
- Exact file paths — they are one-way **HMAC-SHA256 hashed** with a salt generated per-repo and
  stored only in `.tars/config.yml`. The salt never leaves your machine, so a path hash can't be
  reversed or correlated across repos.
- Native session/conversation ids — also salted-hashed before they're used as a filename.
- Secrets, keys, tokens, emails, IPs, MACs — detected by pattern and entropy and dropped.

## The anonymity model

`tars signup` performs a GitHub sign-in via Supabase Auth and immediately calls a server function
that returns an **opaque contributor UUID**. Locally we store only that UUID and a session token.

- Contributed rows reference only the UUID.
- The UUID ↔ GitHub mapping exists only in the auth system's `auth.users` and the
  `tars_contributors` table.
- Row-Level Security gives **no client any way to read contributed data** — there is intentionally
  no `SELECT` policy on the contributions table. Only a service-role training/export job can read
  the corpus, and it sees opaque UUIDs, not identities.

## Coaching is computed locally

The pipe-back loop (`tars coach`, and the nudges injected on prompt submit) is derived
entirely from your own `.tars/sessions` on this machine. It needs no account, no network, and
no corpus — it works offline from session ~3. Disable it any time with `tars coach --off`.
The collective/trained-model tier only ever uses the same anonymized, structure-only records
described above, and only after you opt in.

## Your controls

| Action | Command |
|---|---|
| See exactly what would be uploaded | `tars upload --dry-run` |
| Inspect everything stored locally | `cat .tars/digest.md`, `.tars/sessions/*.ndjson` |
| Delete local capture | `tars wipe --local` |
| Delete everything you contributed, server-side | `tars wipe --remote` |
| Fully detach (delete + remove hooks + creds) | `tars wipe --all` |

## Contact

Questions or a privacy concern? Open an issue at
<https://github.com/invariance-ai/tars/issues> or email privacy@invariance.ai.
