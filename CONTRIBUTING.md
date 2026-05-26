# Contributing to tars

Thanks for helping make agent orchestration legible. tars is small on purpose — please keep
changes focused and the privacy guarantees airtight.

## Setup

```bash
pnpm install
pnpm -r build
pnpm -r test
```

Requires Node ≥ 20 and pnpm 10. The Supabase backend needs the Supabase CLI + Docker; bring it
up with `supabase start && supabase db reset`.

## Project layout

| Package | Responsibility |
|---|---|
| `packages/core` | Event model, redaction, feature extraction, positive scoring, digest, upload-record schema. |
| `packages/adapters` | Normalize Claude Code / Codex / Cursor hook payloads into one event shape. |
| `packages/upload` | GitHub signup (loopback PKCE) and the RLS-respecting Supabase client. |
| `packages/cli` | The `tars` binary and hook installers. |

## The one rule that matters

**Nothing but allow-listed structure may ever leave the machine.** If you touch capture,
redaction, or the upload record:

1. Add new fields to the strict schema in `packages/core/src/record.ts` deliberately — the schema
   is `.strict()`, so unmodeled fields are rejected by design. Don't loosen it.
2. Never store or transmit raw text, code, paths, or identifiers. Derive structure; hash paths;
   bucketize magnitudes.
3. Add a redaction/golden test proving your change can't leak (see `packages/core/src/capture.test.ts`
   and `record.test.ts`).

PRs that weaken the privacy posture will be declined regardless of other merit.

## Before opening a PR

- `pnpm -r build` and `pnpm -r test` are green.
- New behavior has tests.
- User-facing changes are reflected in `README.md` / `PRIVACY.md`.

By contributing you agree your contributions are licensed under the [MIT License](./LICENSE).
