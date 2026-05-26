# Quickstart

## Install & initialize

```bash
npx @invariance/tars init --surface claude,codex,cursor
```

This creates `.tars/` (gitignored) and merges hook blocks into `.claude/settings.json`,
`.codex/hooks.json`, and `.cursor/hooks.json`. Pick a subset with `--surface claude`, etc.

## Use your agent normally

tars captures in the background on tool-relevant events only. There's nothing to remember.

## See how you operate (local, never uploaded)

```bash
tars digest --print      # render the markdown digest
tars status              # consent state + counts
tars digest --json       # machine-readable summaries
```

## Contribute (optional, anonymous)

```bash
tars signup              # GitHub sign-in → opaque contributor id
tars upload --dry-run    # preview EXACTLY what would be sent
tars upload              # confirm and send pending positive sessions
```

## Delete anytime

```bash
tars wipe --local        # on-disk capture
tars wipe --remote       # everything you contributed, server-side
tars wipe --all          # both + remove hooks and credentials
```

## Local backend (for development / self-hosting)

```bash
supabase start
supabase db reset        # applies the migration + seed
export TARS_SUPABASE_URL=http://127.0.0.1:54321
export TARS_SUPABASE_ANON_KEY=<anon key from `supabase status`>
```
