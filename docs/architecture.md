# Architecture

tars is a small pnpm monorepo. Data flows one way: agent event → redacted structure → local
digest → (opt-in) anonymized upload.

```
┌─────────────┐   stdin JSON    ┌──────────────┐   NormalizedEvent   ┌─────────────────────┐
│ agent hook  │ ──────────────▶ │  adapters    │ ──────────────────▶ │  core: capture       │
│ (claude/    │                 │ claude/codex/│                     │  → redact + extract  │
│  codex/     │                 │ cursor       │                     │  → append NDJSON     │
│  cursor)    │                 └──────────────┘                     └─────────┬───────────┘
└─────────────┘                                                                 │
                                                          ┌─────────────────────┼───────────────────┐
                                                          ▼                                          ▼
                                              .tars/digest.md (always)                 .tars/outbox/*.json
                                              core: digest (deterministic)             core: positive ≥ 0.6
                                                                                        core: record (strict zod)
                                                                                                   │
                                                                          tars signup + tars upload (opt-in)
                                                                                                   ▼
                                                                          upload: RLS-respecting Supabase client
                                                                          (insert/delete-own; corpus unreadable)
```

## Packages

- **`core`** — the only package that touches event data. Modules:
  `events` (the normalized model), `redact` (secret/PII detection + bucketization),
  `hashing` (salted path/session hashing), `features` (structure extraction),
  `capture` (event → NDJSON), `positive` (scoring + session summary),
  `record` (strict allow-list schema — the privacy boundary), `digest` (markdown render),
  `session`/`config`/`paths` (on-disk state).
- **`adapters`** — one normalizer per surface; ignores non-tool events to stay cheap.
- **`upload`** — `auth` (loopback PKCE GitHub signup), `client` (anon + user-JWT clients),
  `credentials` (0600 token storage), and the insert/delete API.
- **`cli`** — `commander` program, hook installers, and the eight commands.

## Why it can never leak

1. Adapters and `capture` only ever pass structure forward — raw text is read in memory for cue
   detection and discarded.
2. `redact.containsSecret` is fail-closed: a suspicious field is dropped, not stored.
3. Paths and session ids are salted-hashed; the salt is per-repo and local-only.
4. `record.ContributionSchema` is `.strict()`: any field not explicitly allow-listed is rejected
   before upload.
5. Server-side, RLS has no `SELECT` policy on contributions — no client can read the corpus.

## Backend

A single migration defines `tars_contributors` (opaque id ↔ `auth.users`) and
`tars_contributions` (structure-only rows), deny-by-default RLS, and two `SECURITY DEFINER` RPCs
(`tars_get_or_create_contributor`, `tars_delete_my_contributions`). The model corpus is exported
only by a service-role job that sees opaque ids, never identities.
