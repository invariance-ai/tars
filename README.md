<h1 align="center">tars</h1>

<p align="center">
  <b>Your agent learns to orchestrate like your best engineer.</b><br/>
  Anonymous · opt-in · local-first.
</p>

<p align="center">
  <a href="#the-loop">The loop</a> ·
  <a href="#quickstart">Quickstart</a> ·
  <a href="#privacy-first">Privacy</a> ·
  <a href="#what-we-collect">What we collect</a> ·
  <a href="#cli-reference">CLI</a>
</p>

---

The best operators have a *way* of working an AI coding agent — they explore before editing,
write the test first, frame with acceptance criteria, rarely backtrack. **tars learns that way
from your own cleanest sessions and feeds it back into the agent.**

It hooks into Claude Code, Codex, and Cursor, watches the *structure* of how you drive the agent
(never your code or prompts), scores which sessions went well, and on your next prompt injects
≤2 terse, specific nudges drawn from what works for *you* — "you Read ~3 files before the first
edit; explore first", "you almost always land a passing test before stopping; line one up".

## The loop

```
your sessions ─▶ tars learns your winning method ─▶ injected back into the agent on the next prompt
      ▲                                                                    │
      └──────────────────── you keep shipping; the loop tightens ◀─────────┘
```

Two tiers:

- **Personal coach (local, private, default-on).** Pays off after ~3 clean sessions — no signup,
  no network, no team buy-in. This is the reason to install. Toggle with `tars coach --off`.
- **Borrow-the-best (opt-in).** Contribute anonymized, structure-only records and get back the
  distilled orchestration method of thousands of good operators (the trained model). This is the
  reason to opt in — and what builds the shared asset.

**Pairs with [gps](https://github.com/invariance-ai/gps):** gps tells your agent about *your code*;
tars teaches it *how to work*. Method, never codebase facts — that line is what keeps them distinct.

> Part of the [Invariance](https://invariance.ai) family. The interesting training signal isn't
> the code — it's the orchestration.

## Privacy first

This is the whole design, not a footnote. See [PRIVACY.md](./PRIVACY.md) for the full story.

- **Anonymous by design.** Signing up uses GitHub once to prove you're a real person. We store
  only an opaque contributor id; your GitHub identity is never attached to any contributed data
  and is never readable by anyone but the auth system itself.
- **Local-first.** tars always writes `.tars/digest.md` locally. **Nothing is uploaded** until
  you run `tars signup` *and* `tars upload`. Even then you preview exactly what's sent.
- **Structure only — never content.** No source code. No diffs. No prompt or response text.
  File paths are one-way **hashed** with a per-repo salt that never leaves your machine.
  Secrets and PII are detected and dropped before anything touches disk (fail-closed).
- **Positives only.** Only sessions scored as "went well" are eligible to upload.
- **Yours to delete.** `tars wipe --remote` purges everything you ever contributed, server-side.

## Quickstart

```bash
# 1. Set up tars in a repo and install the agent hooks (all three by default)
npx @invariance/tars init --surface claude,codex,cursor

# 2. Just work. Drive Claude Code / Codex / Cursor like you normally would.

# 3. See what tars learned and what it coaches your agent toward (pure-local)
npx @invariance/tars coach
npx @invariance/tars digest --print

# 4. (Optional) contribute to the open model — anonymous, with a preview first
npx @invariance/tars signup
npx @invariance/tars upload --dry-run   # see EXACTLY what would be sent
npx @invariance/tars upload             # confirm, then send
```

`init` is idempotent and merges into your existing hook configs without touching anything else.
`.tars/` is gitignored — your capture state never gets committed.

## How it works

```
agent hook (stdin JSON)  →  adapter  →  redact + extract structure  →  .tars/sessions/*.ndjson
                                                                              │
                                              ┌───────────────────────────────┤
                                              ▼                               ▼
                                     .tars/digest.md (always)      .tars/outbox/*.json
                                     local, exportable             (positive sessions only)
                                                                              │
                                                            tars signup + tars upload (opt-in)
                                                                              ▼
                                                            Supabase (RLS: insert/delete-own;
                                                            no one can read the corpus)
```

tars registers only on **tool-relevant** lifecycle events — prompt framing, tool calls, and
session end — so nothing else is ever invoked and capture stays cheap. Each hook process reads
one JSON event, derives a handful of booleans and counts, and exits immediately. It never blocks
or slows the agent, and it always exits 0.

## Per-surface setup

`tars init` writes these for you; shown here so you know exactly what's added.

**Claude Code** — `.claude/settings.json`

```jsonc
{ "hooks": {
  "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "tars hook claude" }] }],
  "PostToolUse":      [{ "matcher": "Edit|Write|MultiEdit|Read|Grep|Glob|Bash|NotebookEdit",
                         "hooks": [{ "type": "command", "command": "tars hook claude" }] }],
  "Stop":             [{ "hooks": [{ "type": "command", "command": "tars hook claude" }] }]
}}
```

**Codex** — `.codex/hooks.json`: `UserPromptSubmit`, `PostToolUse`, `Stop` → `tars hook codex`.

**Cursor** — `.cursor/hooks.json` (`"version": 1`): `beforeSubmitPrompt`, `afterFileEdit`,
`stop` → `tars hook cursor`. Cursor hooks are observe-only (they can't steer the agent) — which
is exactly what tars wants.

## What we collect

Everything is derived structure. Here's the full picture:

| Field | Example | Stored locally? | Uploaded (after opt-in)? |
|---|---|---|---|
| Prompt / response text | "fix the auth bug" | ❌ never | ❌ never |
| Source code / diffs | — | ❌ never | ❌ never |
| File path | `/Users/jane/app.ts` | hashed (HMAC + per-repo salt) | hashed |
| Native session id | `conv_abc123` | hashed | ❌ never |
| Framing structure | `hasGoal=true, steps=3` | ✅ | ✅ |
| Approach | `strategy=explore-first` | ✅ | ✅ |
| Tool-action counts | `{edit:4, read:6, test:2}` | ✅ | ✅ |
| Tests passed / clean stop | `true` | ✅ | ✅ |
| Duration | bucket `5-30m` (never exact) | ✅ | ✅ |
| GitHub identity | login / email | ❌ never | stays in auth only, never joined to data |

A real uploaded record looks like this — and `tars upload` prints exactly this before sending:

```json
{
  "surface": "claude",
  "tars_version": "0.1.0",
  "schema_version": 1,
  "framing": { "promptLen": "short", "hasGoal": true, "decompositionSteps": 3, "...": "..." },
  "approach": { "strategy": "explore_first", "phaseSequence": ["frame","explore","edit","test","stop"],
                "toolActionCounts": { "edit": 4, "read": 6, "test": 2, "shell": 1 }, "backtrackCount": 0 },
  "positive": { "score": 0.9, "reasons": ["clean stop","tests passed","low rework"], "...": "..." },
  "duration_bucket": "5-30m"
}
```

The upload payload is validated against a **strict allow-list** ([`record.ts`](./packages/core/src/record.ts)):
any field not explicitly modeled is rejected, so nothing un-vetted can ever leak.

## How "positive" is decided

A transparent, additive score in `[0,1]`. A session is positive (upload-eligible) at `≥ 0.6`.
The weights live in one auditable block ([`positive.ts`](./packages/core/src/positive.ts)):

| Signal | Weight |
|---|---|
| Clean stop (no abort/error) | +0.30 |
| Tests run and passed | +0.30 |
| Low rework (few re-edits of the same file) | +0.20 |
| Explicit user approval ("lgtm", "ship it", …) | +0.10 |
| Coherent framing (goal + constraints/acceptance) | +0.10 |

## CLI reference

| Command | What it does |
|---|---|
| `tars init [--surface claude,codex,cursor] [--root <path>]` | Set up `.tars/` and install agent hooks. Idempotent. |
| `tars coach [--on] [--off] [--json]` | Show what tars learned from your clean sessions; toggle the agent pipe-back. |
| `tars digest [--print] [--out <path>] [--json]` | Recompute the local, exportable digest. No network. |
| `tars status [--json]` | Consent state, session/positive counts, pending uploads, repo fingerprint. |
| `tars signup` | Anonymous GitHub sign-in to enable upload. Stores only an opaque id. |
| `tars upload [--dry-run] [--yes]` | Preview and opt-in upload of pending positive sessions. |
| `tars capture [--prompt-file -]` | Manually capture a session (for surfaces without a live hook). |
| `tars wipe [--local] [--remote] [--all]` | Delete data: local, server-side, or both + detach hooks. |
| `tars hook <surface>` | Internal — invoked by the agent's hooks; reads a JSON event on stdin. |

## Data deletion

```bash
tars wipe --local     # clear on-disk capture (sessions, outbox, digest)
tars wipe --remote    # purge everything you ever contributed, server-side
tars wipe --all       # both, plus remove hooks + credentials and reset consent
```

## Self-hosting / configuration

| Env var | Purpose |
|---|---|
| `TARS_SUPABASE_URL` / `TARS_SUPABASE_ANON_KEY` | Point tars at your own Supabase project. |
| `TARS_CONFIG_HOME` | Where credentials are stored (default `~/.config/tars`). |
| `TARS_GITHUB_CLIENT_ID` / `TARS_GITHUB_SECRET` | GitHub OAuth app for `supabase start` (local dev). |

The backend is a single Supabase migration ([`supabase/migrations`](./supabase/migrations/)):
two tables, deny-by-default RLS, and two `SECURITY DEFINER` RPCs. `supabase start && supabase db reset`
brings up a complete local copy.

## Development

```bash
pnpm install
pnpm -r build
pnpm -r test
```

Monorepo: [`core`](./packages/core) (capture, redaction, scoring, digest),
[`adapters`](./packages/adapters) (per-surface normalization),
[`upload`](./packages/upload) (signup + RLS-respecting client), and the
[`cli`](./packages/cli). See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE) © Invariance
