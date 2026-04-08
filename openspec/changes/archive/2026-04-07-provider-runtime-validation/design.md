## Context

Provider abstraction, Azure OpenAI support, and provider-selection UX already landed, and the restored source runtime now reaches the normal non-bare prompt path. What is missing is a stable provider regression boundary on that restored runtime: today the repository has unit coverage for some provider-selection cases, but maintainers still depend on manual command knowledge to confirm diagnostics, auth expectations, and model-compatibility behavior after runtime changes.

This change should stay narrow. It is not another provider-feature change, and it is not a reopening of mirror-gap cleanup. Its role is to make provider validation repeatable on the now-working source runtime and to encode the expected failure boundaries for local validation.

## Goals / Non-Goals

**Goals:**
- Define a small provider validation matrix centered on `claude`, `openai`, and `azure-openai`.
- Add repeatable validation entrypoints that exercise provider config resolution, diagnostics, and compatibility checks on the restored source runtime.
- Keep the regression boundary local and deterministic by preferring startup validation, diagnostics, and source-imported checks over live provider calls.
- Document which failures are expected boundaries, especially OAuth-disabled `--bare` Claude auth and incompatible model/provider combinations.

**Non-Goals:**
- Implement new provider adapters or broaden provider feature support.
- Add live integration tests that require real provider credentials or network access.
- Reopen guarded Anthropic-only surfaces such as bridge, remote-session, or OAuth flows for non-Claude providers.
- Resume generic mirror-gap reduction or missing-import cleanup.

## Decisions

### Use a bounded local validation matrix instead of live provider smoke tests
Live calls would couple the regression gate to local credentials, network reachability, and provider quotas. This change should validate the source runtime's provider behavior through config validation, diagnostics, and known command boundaries that are deterministic in local development.

Alternative considered: add real prompt smoke tests for OpenAI and Azure OpenAI. Rejected because the repo does not guarantee those credentials locally and because provider connectivity failures would blur the line between product regressions and environment setup problems.

### Validate through both CLI-facing and source-imported paths
Some expectations belong at the launcher level (`bun run ./src/dev-entry.ts`), while others are easier to keep deterministic through direct validation helpers and tests under `src/services/providers/`. The change should use both so the runtime gate stays meaningful without forcing every case through a full interactive command.

Alternative considered: only add unit tests. Rejected because provider regressions can still hide in launcher wiring and bootstrap startup paths.

### Treat provider boundary failures as first-class expected results
The earlier runtime-activation work showed that bare-mode Claude auth failures can be misread as runtime breakage. This change should encode those expected boundaries directly in validation output and tests so later provider work does not re-litigate them.

Alternative considered: keep those distinctions only in prose notes. Rejected because the same confusion will recur unless validation artifacts themselves encode the expected outcomes.

## Risks / Trade-offs

- Validation may still miss provider behaviors that only appear during live requests. -> Keep this change scoped to deterministic startup and diagnostics checks, and leave live-provider smoke coverage to a separate future change if it becomes necessary.
- Adding a script can drift from the real runtime path if it reimplements too much logic. -> Reuse existing provider config, diagnostics, and validation helpers directly from source modules.
- Source-runtime command checks can be sensitive to local auth state. -> Limit command-level checks to cases with deterministic outcomes or explicitly expected auth boundaries.

## Migration Plan

Add the validation entrypoint and tests, wire it into `package.json`, and use it alongside the existing restoration validation commands. If the script proves too noisy, it can be rolled back cleanly without affecting provider runtime behavior because it is only a validation surface.

## Open Questions

- Whether to keep provider validation as a standalone script or fold it into a broader restored-runtime validation script after the first iteration proves stable.
- Whether a future follow-up should add opt-in live smoke checks gated behind explicit environment variables for teams that want deeper provider verification.