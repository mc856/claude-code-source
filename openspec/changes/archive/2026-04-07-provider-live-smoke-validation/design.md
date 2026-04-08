## Context

The previous provider runtime validation change deliberately kept live network calls out of the default regression gate. That was the right boundary for a repository-level required validation command, but it left one explicit follow-up: environments that do have real provider credentials still need an operator-invoked end-to-end smoke path on the restored source runtime.

This follow-up must preserve the existing safety boundary. Live smoke checks are inherently environment-dependent because they require credentials, network reachability, and working provider endpoints. They should therefore be exposed as an additive validation layer, not folded into `validate:providers`.

## Goals / Non-Goals

**Goals:**
- Add an opt-in live smoke script for `claude`, `openai`, and `azure-openai`.
- Keep default behavior safe by skipping all live execution unless explicitly enabled.
- Provide per-provider pass/fail/skip reporting and clear missing-config reasons.
- Reuse the restored source runtime (`bun run ./src/dev-entry.ts -p`) rather than introducing a separate execution path.

**Non-Goals:**
- Make live provider checks part of the required repository validation gate.
- Replace deterministic provider validation.
- Add deep integration or performance testing for provider backends.
- Broaden provider capability support beyond what already exists.

## Decisions

### Use an independent live smoke command
The live smoke command should be separate from `validate:providers` so the default gate remains deterministic and secrets-free.

Alternative considered: add a flag to `validate:providers` that enables live calls. Rejected because it blurs the contract of the existing script and makes CI/operator usage easier to misconfigure.

### Default to skip-unless-enabled
Live smoke should do nothing unless an explicit opt-in environment control is set. This prevents accidental live calls in local shells or automated environments that happen to contain credentials.

Alternative considered: auto-run whenever provider credentials are present. Rejected because merely having credentials available should not trigger billable external calls.

### Use pure helper logic for provider selection and skip reasoning
The script should delegate provider-selection and missing-config decisions to testable helper functions under `src/services/providers/`.

Alternative considered: keep all selection logic inline in the script. Rejected because the skip rules are behavior worth testing independently.

## Risks / Trade-offs

- Live smoke will still fail for environment reasons unrelated to code. -> Keep it opt-in and report provider-local failure details clearly.
- Claude OAuth-backed local environments are harder to detect automatically than API-key-backed providers. -> Allow explicit provider selection so operators can choose Claude even when auth comes from OAuth.
- A separate script adds one more validation surface to maintain. -> Keep it thin and share helper logic with tests.

## Migration Plan

Add the live smoke helper module, the script, a package command, and tests for the skip/selection logic. Existing deterministic validation commands remain unchanged.

## Open Questions

- Whether a future CI profile should expose a controlled way to run this script in secured environments.
- Whether provider-specific expected response matching should stay as a strict `OK` check or expand to a normalized success predicate later.