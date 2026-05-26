# What we collect

The short version: **derived structure, never content.** This is the per-field detail; see
[PRIVACY.md](../PRIVACY.md) for the guarantees behind it.

## Framing (how you start a task)

| Field | Type | Notes |
|---|---|---|
| `promptLen` | bucket | `tiny`/`short`/`medium`/`long`/`xlong` — never the actual length |
| `hasGoal` | bool | did the prompt state an objective |
| `hasConstraints` | bool | did it state constraints ("must", "don't", "only") |
| `acceptanceCriteriaPresent` | bool | did it state how to know it's done |
| `decompositionSteps` | int 0–8 | enumerated sub-steps you laid out |
| `clarifyingQuestions` | bool | did you ask questions while framing |
| `examplesGiven` | bool | did you provide examples |

## Approach (how you drove the agent)

| Field | Type | Notes |
|---|---|---|
| `strategy` | enum | `plan_first` / `explore_first` / `test_first` / `dive_in` |
| `phaseSequence` | enum[] | deduped, e.g. `frame → explore → edit → test → stop` |
| `toolActionCounts` | counts | `{edit, write, read, test, shell, other}` |
| `backtrackCount` | int | re-edits of the same (hashed) file |
| `planBeforeEdit` | bool | did you decompose before the first edit |

## Outcome (whether it went well)

| Field | Type | Notes |
|---|---|---|
| `score` | 0–1 | the positive score |
| `reasons` | string[] | which signals fired |
| `testsPassed`, `cleanStop`, `userApproved`, `coherentFraming` | bool | |
| `reworkRatio` | number | backtracks ÷ edits |
| `duration_bucket` | bucket | `<5m` / `5-30m` / `30-120m` / `>120m` |

## Never collected

Source code · diffs · prompt or response text · exact file paths (hashed) · native session ids
(hashed) · secrets/keys/tokens/emails/IPs · your GitHub identity (auth-only, never joined to data)
· exact timestamps.
